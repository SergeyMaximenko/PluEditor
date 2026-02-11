// /js/outlook.paste.bundle.js
// 📧 Кнопка в модалці: читає буфер (Outlook invite) -> підставляє Date/Time/Subject -> фокус на KPLD

const MONTHS_UA = new Map([
  ["січня", 1], ["сiчня", 1],
  ["лютого", 2],
  ["березня", 3],
  ["квітня", 4], ["квiтня", 4],
  ["травня", 5],
  ["червня", 6],
  ["липня", 7],
  ["серпня", 8],
  ["вересня", 9],
  ["жовтня", 10],
  ["листопада", 11],
  ["грудня", 12],
]);

function pad2(n){ return String(n).padStart(2,"0"); }

function normalizeMonthToken(s){
  return String(s || "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .trim();
}

function normalizeTimeHM(s){
  const m = String(s || "").match(/^\s*(\d{1,2}):(\d{2})\s*$/);
  if (!m) return "";
  const hh = Number(m[1]), mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";
  return `${pad2(hh)}:${pad2(mm)}`;
}

function parseOutlookText(text){
  const out = { subject:"", dateYMD:"", tFrom:"", tTo:"" };
  const src = String(text || "");

  // Subject:
  {
    const m = src.match(/^\s*Subject:\s*(.+)\s*$/im);
    if (m) out.subject = (m[1] || "").trim();
  }

  // When: берем только первую строку When:
  let whenLine = "";
  {
    const m = src.match(/^\s*When:\s*(.+)\s*$/im);
    if (m) whenLine = (m[1] || "").trim();
  }

  // Time: 17:00-20:00 (поддержка -, – , —)
  if (whenLine){
    const mt = whenLine.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
    if (mt){
      out.tFrom = normalizeTimeHM(mt[1]);
      out.tTo   = normalizeTimeHM(mt[2]);
    }
  }

  // Date UA: "9 лютого 2026" (+ "р.")
  if (whenLine){
    const md = whenLine.match(/(\d{1,2})\s+([^\d\s]+)\s+(\d{4})/);
    if (md){
      const dd = Number(md[1]);
      const monToken = normalizeMonthToken(md[2]);
      const yyyy = Number(md[3]);
      const mm = MONTHS_UA.get(monToken) || 0;

      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 1970 && yyyy <= 2100){
        out.dateYMD = `${yyyy}-${pad2(mm)}-${pad2(dd)}`; // ✅ для input[type=date]
      }
    }
  }

  return out;
}

async function readClipboardText(){
  // works on localhost / https. For file:// will fail.
  if (!navigator.clipboard?.readText){
    throw new Error("Clipboard API недоступний. Відкрий сторінку через http://127.0.0.1 (не file://) та дай дозвіл на буфер.");
  }
  return await navigator.clipboard.readText();
}

/**
 * @param {{
 *  btn: HTMLElement,
 *  mDate: HTMLInputElement,
 *  mFrom: HTMLInputElement,
 *  mTo: HTMLInputElement,
 *  mDescription: HTMLTextAreaElement,
 *  mKpldText: HTMLInputElement,
 *  setModalError?: (text:string)=>void
 * }} opts
 */
export function initOutlookClipboardPaste(opts){
  const { btn, mDate, mFrom, mTo, mDescription, mKpldText, setModalError } = opts;

  if (!btn) throw new Error("initOutlookClipboardPaste: btn missing");

  btn.addEventListener("click", async () => {
    try{
      setModalError?.("");

      const text = await readClipboardText();
      const data = parseOutlookText(text);

      // Subject -> Тема
      if (data.subject) mDescription.value = data.subject;

      // Date -> input[type=date] expects YYYY-MM-DD
      if (data.dateYMD) mDate.value = data.dateYMD;

      // Time
      if (data.tFrom) mFrom.value = data.tFrom;
      if (data.tTo)   mTo.value   = data.tTo;

      try { window.__erpRefreshWhenPreview?.(); } catch {}

      // ✅ симулируем события чтобы сработали слушатели input/change
[mDate, mFrom, mTo].forEach(el => {
  try {
    el.dispatchEvent(new Event("input", { bubbles:true }));
    el.dispatchEvent(new Event("change", { bubbles:true }));
  } catch {}
});

try { window.updateKpldClearVisibility?.(); } catch {}

      // Фокус на "Код завдання"
      mKpldText?.focus();

    } catch(e){
      const msg = (e && (e.message || e.toString())) ? String(e.message || e.toString()) : "Помилка";
      setModalError?.("⚠️ " + msg);
      // на всякий случай в консоль
      console.error("[ERP-Cal][MAIL]", e);
    }
  });
}
