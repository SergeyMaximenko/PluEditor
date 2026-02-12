// ========================================================
// ERPAuth — модуль авторизації (PROD)
// - хранит { userIdCoded, userName } в localStorage
// - toast / spinner НЕ дублирует стили: использует opts.toast()
// ========================================================

export const ERPAuth = (() => {
  const LS_AUTH_KEY = "erp_cal_auth_v2";

  const s = (v) => String(v ?? "");

  function encodeId(id){
    return btoa(unescape(encodeURIComponent(s(id))));
  }
  function decodeId(encoded){
    try { return decodeURIComponent(escape(atob(s(encoded)))); }
    catch { return ""; }
  }

  function readAuth(){
    try{
      const raw = localStorage.getItem(LS_AUTH_KEY);
      if (!raw) return null;

      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return null;

      const userIdCoded = s(obj.userIdCoded || obj.idEnc || "");
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
    const obj = { userIdCoded, userName: s(userName) };
    localStorage.setItem(LS_AUTH_KEY, JSON.stringify(obj));
    return { userIdCoded, id: s(id), userName: s(userName) };
  }

  function clearAuth(){ localStorage.removeItem(LS_AUTH_KEY); }
  function isLoggedIn(){ return !!readAuth(); }

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
    dom.backdrop.style.display = "flex";
    setTimeout(() => dom.user?.focus(), 0);
  }

  function closeLoginModal(dom){
    if (!dom?.backdrop) return;
    dom.backdrop.style.display = "none";
    setLoginError(dom, "");
  }




  function init(opts){
    if (!opts?.setButtonText) throw new Error("ERPAuth.init: setButtonText is required");

    const dom = getLoginDom();
    const toast = opts.toast || ((msg)=>console.error("[ERPAuth toast missing]", msg));

    const confirmLogout = opts.confirmLogout || (async () => confirm("Вийти з облікового запису?"));
    const apiBase = s(opts.apiBase || "https://webclient.it-enterprise.com").replace(/\/+$/,"");


 // ✅ ВСТАВЬ ВОТ ЭТО (новое место!)
  function setGlobalSpinner(isOn, labelText = "Завантаження…"){
    // если app.js передал колбек — используем его
    if (opts?.setSpinner){
      opts.setSpinner(!!isOn, labelText); // ✅ auth spinner всегда модальный
      return;
    }

    // fallback, если колбек не передали
    const sp = document.getElementById("pageSpinner");
    if (!sp) return;

    const label = sp.querySelector(".label");
    if (label && labelText) label.textContent = String(labelText);

    sp.classList.toggle("is-on", !!isOn);
    sp.classList.toggle("is-modal", !!isOn); // логин = модально
    sp.setAttribute("aria-hidden", isOn ? "false" : "true");
  }




    const loginRequest = opts.loginRequest || (async (login, pass) => {
      if (!login || !pass) return { success:false, message:"Логін/пароль обовʼязкові" };

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15000);

      try{
        const url = `${apiBase}/ws/api/LOGIN`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "accept": "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ login, password: pass }),
          signal: ac.signal,
        });

        if (!resp.ok){
          return { success:false, message:`Немає доступу до сервера авторизації (HTTP ${resp.status}).` };
        }

        let data = null;
        try{ data = await resp.json(); }
        catch{
          return { success:false, message:"Сервер повернув некоректну відповідь (не JSON)." };
        }

        const ok = !!data?.Success;
        if (!ok){
          return { success:false, message:"Невірний логін або пароль" };
        }

        const id = s(data?.Id).trim();
        const userName = s(data?.UserName).trim();
        if (!id || !userName){
          return { success:false, message:"Відсутні поля Id/UserName у відповіді сервера." };
        }
        return { success:true, id, userName };
      }catch(e){
        let messageError = "";
        if (e?.name === "AbortError"){
          messageError = "Таймаут авторизації 15 сек\nПеревірте, що ви у внутрішній мережі IT-Enterprise";
        } else if (e?.message === "Failed to fetch"){
          messageError = "Не вдалось отримати доступ до серверу ITA\nПеревірте, що ви у внутрішній мережі IT-Enterprise";
        } else {
          messageError = "Не вдалось отримати доступ до серверу ITA\nПомилка: " + (e?.message || e);
        }
        return { success:false, message: messageError };
      }finally{
        clearTimeout(timer);
      }
    });

    function refresh(){
      const auth = readAuth();
      if (!auth){
        opts.setButtonText("Увійти в обліковий запис");
        return;
      }
      opts.setButtonText(`Вітаємо ${auth.userName} [Вийти]`);
    }

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

    if (dom?.ok){
      dom.ok.addEventListener("click", async () => {
        try{
          setLoginError(dom, "");

          const login = s(dom.user?.value).trim();
          const pass  = s(dom.pass?.value).trim();

          if (!login){ setLoginError(dom, "Вкажіть логін"); dom.user?.focus(); return; }
          if (!pass){ setLoginError(dom, "Вкажіть пароль"); dom.pass?.focus(); return; }

          setGlobalSpinner(true, "Авторизація…");
          dom.ok.disabled = true;
          dom.cancel.disabled = true;


          // 🔽 ЗАТРИМКА
//await new Promise(r => setTimeout(r, 8000));

          let res;
          try{ res = await loginRequest(login, pass); }
          finally{
            setGlobalSpinner(false);
            dom.ok.disabled = false;
            dom.cancel.disabled = false;
          }

          if (!res?.success){
            toast(res?.message || "Не вдалося увійти", "error", "Авторизація");
            setLoginError(dom, res?.message || "Не вдалося увійти");
            return;
          }

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

    async function handleLoginButtonClick(){
      if (!isLoggedIn()){
        openLoginModal(dom);
        return;
      }

      const ok = await Promise.resolve(confirmLogout());
      if (!ok) return;

      clearAuth();
      refresh();
      await Promise.resolve(opts.onLoginChanged?.({ isLoggedIn:false, auth: null }));
    }

    return { refresh, handleLoginButtonClick, readAuth, isLoggedIn, clearAuth, writeAuth, encodeId, decodeId };
  }

  return { init };
})();
