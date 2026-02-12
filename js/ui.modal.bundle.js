// /js/ui.modal.bundle.js
// ========================================================
// UIConfirm — confirm-модалка замість window.confirm
// Використання: const ok = await uiConfirm({ title, text, okText, cancelText })
// ========================================================

export function uiConfirm(opts = {}){
  const title = String(opts.title ?? "Підтвердження");
  const text  = String(opts.text ?? "");
  const okText = String(opts.okText ?? "OK");
  const cancelText = String(opts.cancelText ?? "Скасувати");

  const b = document.getElementById("uiConfirmBackdrop");
  const t = document.getElementById("uiConfirmTitle");
  const tx = document.getElementById("uiConfirmText");
  const ok = document.getElementById("uiConfirmOk");
  const cancel = document.getElementById("uiConfirmCancel");

  // fallback якщо модалки нема
  if (!b || !t || !tx || !ok || !cancel){
    return Promise.resolve(confirm(text || title));
  }

  return new Promise(resolve => {
    t.textContent = title;
    tx.textContent = text;
    ok.textContent = okText;
    cancel.textContent = cancelText;

    b.style.display = "flex";

    const cleanup = (result) => {
      b.style.display = "none";
      ok.onclick = null;
      cancel.onclick = null;
      resolve(result);
    };

    
    ok.onclick = () => cleanup(true);
    cancel.onclick = () => cleanup(false);

    // click on backdrop
    const onMouseDown = (e) => {
      if (e.target === b) cleanup(false);
    };

    // ESC
    const onKeyDown = (e) => {
      if (e.key === "Escape") cleanup(false);
    };

    // attach with auto-remove
    document.addEventListener("mousedown", onMouseDown, { once:true });
    document.addEventListener("keydown", onKeyDown, { once:true });

    setTimeout(() => ok.focus(), 0);
  });
}
