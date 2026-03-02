// /js/ui.modal.bundle.js
export function uiConfirm(opts = {}){
  const title = String(opts.title ?? "Підтвердження");
  const text  = String(opts.text ?? "");
  const okText = String(opts.okText ?? "OK");
  const cancelText = String(opts.cancelText ?? "Скасувати");

  const danger = !!opts.danger;

  const b = document.getElementById("uiConfirmBackdrop");
  const t = document.getElementById("uiConfirmTitle");
  const tx = document.getElementById("uiConfirmText");
  const ok = document.getElementById("uiConfirmOk");
  const cancel = document.getElementById("uiConfirmCancel");

  if (!b || !t || !tx || !ok || !cancel){
    return Promise.resolve(confirm(text || title));
  }

  return new Promise(resolve => {
    t.textContent = title;
    tx.textContent = text;
    ok.textContent = okText;
    cancel.textContent = cancelText;

    const prevBg = ok.style.background;
    const prevBorder = ok.style.borderColor;
    const prevColor = ok.style.color;

    if (danger){
      ok.style.background = "#dc2626";
      ok.style.borderColor = "#dc2626";
      ok.style.color = "#fff";
    } else {
      ok.style.background = "";
      ok.style.borderColor = "";
      ok.style.color = "";
    }

    b.style.display = "flex";

    const onMouseDown = (e) => { if (e.target === b) cleanup(false); };

    const onKeyDown = (e) => {
      if (e.key === "Escape") return cleanup(false);

      // ✅ Ctrl+Enter => OK
      const isCtrlEnter =
        (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter") && e.ctrlKey;

      if (!isCtrlEnter) return;
      if (e.altKey || e.shiftKey || e.metaKey) return;

      // якщо раптом фокус у textarea — часто Ctrl+Enter там теж ок, але залишу захист:
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = (tag === "textarea"); // input ок, textarea можна заборонити/дозволити як хочеш
      if (typing) return;

      e.preventDefault();
      e.stopPropagation();
      cleanup(true);
    };

    const cleanup = (result) => {
      b.style.display = "none";
      ok.onclick = null;
      cancel.onclick = null;

      ok.style.background = prevBg;
      ok.style.borderColor = prevBorder;
      ok.style.color = prevColor;

      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);

      resolve(result);
    };

    ok.onclick = () => cleanup(true);
    cancel.onclick = () => cleanup(false);

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    setTimeout(() => ok.focus(), 0);
  });
}