// /js/erp.auth.bundle.js
// ========================================================
// ERPAuth — модуль авторизації (логін/логаут) для календаря
// GitHub Pages (browser JS), зберігає стан у localStorage.
// - Якщо НЕ залогінено: кнопка "Логін"
// - Якщо залогінено: "Вітаємо <UserName> [Вийти]"
// - В localStorage (JSON): { idEnc, userName }
// - idEnc: base64(utf8(Id)) — просте кодування (не крипто-захист)
//   ВАЖЛИВО: login (email) НЕ зберігаємо взагалі.
// ========================================================

export const ERPAuth = (() => {
  const LS_AUTH_KEY = "erp_cal_auth_v2"; // <-- v2 бо формат змінився (idEnc/userName)
  const TOAST_STYLE_ID = "erp-toast-style-v1";

  // ---------- helpers: safe strings ----------
  const s = (v) => String(v ?? "");

  // ---------- encoding (utf8 safe) ----------
  function encodeId(id){
    return btoa(unescape(encodeURIComponent(s(id))));
  }
  function decodeId(encoded){
    try { return decodeURIComponent(escape(atob(s(encoded)))); }
    catch { return ""; }
  }

  
  // ---------- storage ----------
function readAuth(){
  try{
    const raw = localStorage.getItem(LS_AUTH_KEY);
    if (!raw) return null;

    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;

    // ✅ NEW: userIdCoded, ✅ OLD: idEnc (backward)
    const userIdCoded = s(obj.userIdCoded ||  "");
    const userName = s(obj.userName || "");

    const id = decodeId(userIdCoded);
    if (!userIdCoded || !id || !userName) return null;

    return { userIdCoded, id, userName };
  }catch{
    return null;
  }
}

function writeAuth({ id, userName }){
  const userIdCoded = encodeId(id);

  // ✅ теперь храним userIdCoded вместо idEnc
  const obj = { userIdCoded, userName: s(userName) };
  localStorage.setItem(LS_AUTH_KEY, JSON.stringify(obj));

  return { userIdCoded, id: s(id), userName: s(userName) };
}

  function clearAuth(){
    localStorage.removeItem(LS_AUTH_KEY);
  }

  function isLoggedIn(){
    return !!readAuth();
  }

  // ---------- UI: toast (bottom popup) ----------
  function ensureToastCssOnce(){
    if (document.getElementById(TOAST_STYLE_ID)) return;
    const st = document.createElement("style");
    st.id = TOAST_STYLE_ID;
    st.textContent = `
      .erp-toast{
        position: fixed;
        left: 50%;
        bottom: 18px;
        transform: translateX(-50%) translateY(16px);
        min-width: 260px;
        max-width: min(720px, calc(100vw - 24px));
        padding: 10px 14px;
        border-radius: 12px;
        background: rgba(20,20,20,.92);
        color: #fff;
        font: 14px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
        opacity: 0;
        transition: opacity .18s ease, transform .18s ease;
        z-index: 999999;
        cursor: default;
        user-select: text;
      }
      .erp-toast.show{
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      .erp-toast .title{
        font-weight: 700;
        margin-bottom: 4px;
      }
      .erp-toast .msg{
        white-space: pre-wrap;
        word-break: break-word;
      }
      .erp-toast.error{ background: rgba(160, 30, 30, .94); }
      .erp-toast.warn{  background: rgba(150, 110, 10, .94); }
      .erp-toast.ok{    background: rgba(20, 120, 60, .94); }
    `;
    document.head.appendChild(st);
  }

  function toast(message, type="error", title="Помилка", ms=5500){
    ensureToastCssOnce();

    const el = document.createElement("div");
    el.className = `erp-toast ${type}`;
    el.innerHTML = `
      <div class="title">${s(title)}</div>
      <div class="msg">${escapeHtml(s(message))}</div>
    `;

    document.body.appendChild(el);

    // show
    requestAnimationFrame(() => el.classList.add("show"));

    const kill = () => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 220);
      document.removeEventListener("keydown", onKey);
    };

    const onKey = (e) => { if (e.key === "Escape") kill(); };
    document.addEventListener("keydown", onKey);

    // click to close
    el.addEventListener("click", kill);

    // auto close
    setTimeout(kill, ms);
  }

  function escapeHtml(str){
    return str
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- UI: modal refs ----------
  function getLoginDom(){
    return {
      backdrop: document.getElementById("loginBackdrop"),
      user: document.getElementById("lUser"),
      pass: document.getElementById("lPass"),
      ok: document.getElementById("lOk"),
      cancel: document.getElementById("lCancel"),
      error: document.getElementById("lError"),
    };
  }

  function setLoginError(dom, text){
    const t = s(text).trim();
    if (!dom?.error) return;
    if (!t){
      dom.error.style.display = "none";
      dom.error.textContent = "";
      return;
    }
    dom.error.style.display = "block";
    dom.error.textContent = "⚠️ " + t;
  }

  function openLoginModal(dom){
    if (!dom?.backdrop) return;
    setLoginError(dom, "");
    if (dom.user) dom.user.value = "";
    if (dom.pass) dom.pass.value = "";
    dom.backdrop.style.display = "flex";
    setTimeout(() => dom.user?.focus(), 0);
  }

  function closeLoginModal(dom){
    if (!dom?.backdrop) return;
    dom.backdrop.style.display = "none";
    setLoginError(dom, "");
  }

  // ---------- core factory ----------
  /**
   * init(opts)
   * @param {{
   *   setButtonText: (text:string)=>void,
   *   confirmLogout?: ()=>Promise<boolean>|boolean,
   *   loginRequest?: (login:string, pass:string)=>Promise<{success:boolean,id?:string,userName?:string,message?:string}>,
   *   apiBase?: string, // напр: "https://webclient.it-enterprise.com"
   *   onLoginChanged?: ({isLoggedIn:boolean, auth:any})=>void|Promise<void>,
   * }} opts
   */
  function init(opts){
    if (!opts?.setButtonText) throw new Error("ERPAuth.init: setButtonText is required");

    const dom = getLoginDom();

    // ---- default stubs ----
    
    const confirmLogout = opts.confirmLogout || (async () => confirm("Вийти з облікового запису?"));

    const apiBase = s(opts.apiBase || "https://webclient.it-enterprise.com").replace(/\/+$/,"");

    // ---- REAL loginRequest via API (default) ----
    const loginRequest = opts.loginRequest || (async (login, pass) => {
      if (!login || !pass) return { success:false, message:"Логін/пароль обовʼязкові" };

      // timeout
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 12000);

      try{
        const url = `${apiBase}/ws/api/LOGIN`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ login, password: pass }),
          signal: ac.signal,
        });

        // якщо ендпойнт неправильний/сервер віддав HTML/404/500
        if (!resp.ok){
          return {
            success:false,
            message:`Немає доступу до сервера авторизації (HTTP ${resp.status}). Перевірте мережу або адресу API.`,
          };
        }

        // пробуємо JSON
        let data = null;
        try{ data = await resp.json(); }
        catch{
          return {
            success:false,
            message:"Сервер повернув некоректну відповідь (не JSON). Перевірте ендпойнт / права доступу.",
          };
        }

        // очікуваний формат:
        // { Success:true/false, Id, UserName, FailReason, FailCode, ... }
        const ok = !!data?.Success;
        if (!ok){
          const reason = s(data?.FailReason || data?.FailCode || "Невірний логін або пароль");
          return { success:false, message: reason };
        }

        const id = s(data?.Id).trim();
        const userName = s(data?.UserName).trim();

        if (!id || !userName){
          return { success:false, message:"Відсутні поля Id/UserName у відповіді сервера." };
        }

        return { success:true, id, userName };
      }catch(e){
        const isAbort = (e?.name === "AbortError");
        return {
          success:false,
          message: isAbort
            ? "Таймаут авторизації (12 сек). Перевірте мережу або доступність сервера."
            : "Немає доступу до мережі або невірний ендпойнт авторизації.",
        };
      }finally{
        clearTimeout(timer);
      }
    });

    // ---- button text refresh ----
    function refresh(){
      const auth = readAuth();
      if (!auth){
        opts.setButtonText("Увійти в обліковий запис");
        return;
      }
      opts.setButtonText(`Вітаємо ${auth.userName} [Вийти]`);
    }

    // ---- modal events ----
    if (dom?.cancel){
      dom.cancel.addEventListener("click", () => closeLoginModal(dom));
    }

    if (dom?.backdrop){
      dom.backdrop.addEventListener("mousedown", (e) => {
        if (e.target === dom.backdrop) closeLoginModal(dom);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dom?.backdrop?.style.display === "flex"){
        closeLoginModal(dom);
      }
    });

    // ---- submit login ----
    if (dom?.ok){
      dom.ok.addEventListener("click", async () => {
        try{
          setLoginError(dom, "");

          const login = s(dom.user?.value).trim();
          const pass  = s(dom.pass?.value).trim();

          if (!login){ setLoginError(dom, "Вкажіть логін"); dom.user?.focus(); return; }
          if (!pass){ setLoginError(dom, "Вкажіть пароль"); dom.pass?.focus(); return; }

          // ✅ confirm показуємо окремо, тому тимчасово ховаємо логін-модалку
          closeLoginModal(dom);


          // якщо ок — знову покажемо модалку (бо далі може бути помилка loginRequest)
          openLoginModal(dom);
          dom.user.value = login;
          dom.pass.value = pass;

          const res = await loginRequest(login, pass);

          if (!res?.success){
            // 1) toast знизу (як ти просив)
            toast(res?.message || "Не вдалося увійти", "error", "Авторизація");

            // 2) + дублюємо у модалці (зручно, бо поле підсвітити/показати)
            setLoginError(dom, res?.message || "Не вдалося увійти");
            return;
          }

          // зберігаємо ТІЛЬКИ Id + UserName
          writeAuth({ id: res.id, userName: res.userName });

          closeLoginModal(dom);
          refresh();
          await Promise.resolve(opts.onLoginChanged?.({ isLoggedIn:true, auth: readAuth() }));

        }catch(e){
          const msg = e?.message || s(e) || "Невідома помилка";
          toast(msg, "error", "Авторизація");
          setLoginError(dom, msg);
        }
      });
    }

    // ---- click handler for calendar header button ----
    async function handleLoginButtonClick(){
      // Якщо не залогінено — відкриваємо модалку
      if (!isLoggedIn()){
        openLoginModal(dom);
        return;
      }

      // Якщо залогінено — це "Вийти"
      const ok = await Promise.resolve(confirmLogout());
      if (!ok) return;

      clearAuth();
      refresh();
      await Promise.resolve(opts.onLoginChanged?.({ isLoggedIn:false, auth: null }));
    }

    return {
      refresh,
      handleLoginButtonClick,
      readAuth,
      isLoggedIn,
      clearAuth,
      writeAuth,
      encodeId,
      decodeId,
      toast, // інколи корисно ззовні
    };
  }

  return { init };
})();


// ========================================================
// Красивый alert (вместо window.alert) — залишив як було
// ========================================================
function uiAlert(message, title = "Повідомлення"){
  return new Promise(resolve => {
    const b = document.getElementById("infoBackdrop");
    const t = document.getElementById("infoTitle");
    const text = document.getElementById("infoText");
    const ok = document.getElementById("infoOk");

    if (!b || !t || !text || !ok){
      alert(message);
      resolve(true);
      return;
    }

    t.textContent = title;
    text.textContent = String(message || "");

    b.style.display = "flex";

    const cleanup = () => {
      b.style.display = "none";
      ok.onclick = null;
      resolve(true);
    };

    ok.onclick = cleanup;

    const onMouseDown = (e) => {
      if (e.target === b){
        document.removeEventListener("mousedown", onMouseDown);
        cleanup();
      }
    };
    document.addEventListener("mousedown", onMouseDown);

    document.addEventListener("keydown", function esc(e){
      if (e.key === "Escape"){
        document.removeEventListener("keydown", esc);
        document.removeEventListener("mousedown", onMouseDown);
        cleanup();
      }
    });

    setTimeout(() => ok.focus(), 0);
  });
}
