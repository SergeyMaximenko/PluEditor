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

    // клік по фону
    const onMouseDown = (e) => {
      if (e.target === b){
        document.removeEventListener("mousedown", onMouseDown);
        cleanup(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);

    // ESC
    document.addEventListener("keydown", function esc(e){
      if (e.key === "Escape"){
        document.removeEventListener("keydown", esc);
        document.removeEventListener("mousedown", onMouseDown);
        cleanup(false);
      }
    });

    setTimeout(() => ok.focus(), 0);
  });
}
