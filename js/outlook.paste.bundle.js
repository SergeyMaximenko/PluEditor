// /js/outlook.paste.bundle.js
// 📧 Кнопка в модалці: читає буфер (Outlook invite) -> підставляє Date/Time/Subject -> фокус на KPLD
// ✅ Multi-language parser: EN / RU / UA

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

const MONTHS_RU = new Map([
  ["января", 1],
  ["февраля", 2],
  ["марта", 3],
  ["апреля", 4],
  ["мая", 5],
  ["июня", 6],
  ["июля", 7],
  ["августа", 8],
  ["сентября", 9],
  ["октября", 10],
  ["ноября", 11],
  ["декабря", 12],
]);

const MONTHS_EN = new Map([
  ["january", 1], ["jan", 1],
  ["february", 2], ["feb", 2],
  ["march", 3], ["mar", 3],
  ["april", 4], ["apr", 4],
  ["may", 5],
  ["june", 6], ["jun", 6],
  ["july", 7], ["jul", 7],
  ["august", 8], ["aug", 8],
  ["september", 9], ["sep", 9], ["sept", 9],
  ["october", 10], ["oct", 10],
  ["november", 11], ["nov", 11],
  ["december", 12], ["dec", 12],
]);

function pad2(n){ return String(n).padStart(2, "0"); }

function normalizeMonthToken(s){
  return String(s || "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .trim();
}

function firstMatchLine(src, patterns){
  for (const re of patterns){
    const m = src.match(re);
    if (m) return (m[1] || "").trim();
  }
  return "";
}

function toYmd(y, m, d){
  const yyyy = Number(y), mm = Number(m), dd = Number(d);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return "";
  if (yyyy < 1970 || yyyy > 2100) return "";
  if (mm < 1 || mm > 12) return "";
  if (dd < 1 || dd > 31) return "";
  return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
}

function normalizeTimeHM_24(s){
  const m = String(s || "").match(/^\s*(\d{1,2})[:.](\d{2})\s*$/);
  if (!m) return "";
  const hh = Number(m[1]), mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";
  return `${pad2(hh)}:${pad2(mm)}`;
}

function normalizeTimeHM_ampm(raw){
  // e.g. "5:00 PM", "11:15am"
  const m = String(raw || "").trim().match(/^(\d{1,2})[:.](\d{2})\s*([ap]\.?m\.?)$/i);
  if (!m) return "";
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const ap = String(m[3] || "").toLowerCase();
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return "";

  const isPM = ap.startsWith("p");
  if (isPM && hh !== 12) hh += 12;
  if (!isPM && hh === 12) hh = 0;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function extractTimeRange(line){
  const s = String(line || "");

  // 24h: 17:00-20:00 / 17:00 – 20:00 / 17.00—20.00
  {
    const m = s.match(/(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})/);
    if (m){
      const tFrom = normalizeTimeHM_24(m[1]);
      const tTo   = normalizeTimeHM_24(m[2]);
      if (tFrom && tTo) return { tFrom, tTo };
    }
  }

  // AM/PM: 5:00 PM - 6:30 PM
  {
    const m = s.match(/(\d{1,2}[:.]\d{2}\s*[ap]\.?m\.?)\s*[-–—]\s*(\d{1,2}[:.]\d{2}\s*[ap]\.?m\.?)/i);
    if (m){
      const tFrom = normalizeTimeHM_ampm(m[1]);
      const tTo   = normalizeTimeHM_ampm(m[2]);
      if (tFrom && tTo) return { tFrom, tTo };
    }
  }

  return { tFrom:"", tTo:"" };
}

function extractDateFromLine(line){
  const s0 = String(line || "").trim();
  const s = s0.replace(/\s+/g, " ");

  // ISO: 2026-02-09
  {
    const m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (m){
      const ymd = toYmd(m[1], m[2], m[3]);
      if (ymd) return ymd;
    }
  }

  // D.M.YYYY or DD/MM/YYYY
  // NOTE: ambiguous dd/mm vs mm/dd — we'll assume dd/mm (UA/RU typical).
  {
    const m = s.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/);
    if (m){
      const dd = Number(m[1]);
      const mm = Number(m[2]);
      const yyyy = Number(m[3]);
      const ymd = toYmd(yyyy, mm, dd);
      if (ymd) return ymd;
    }
  }

  // UA/RU: "9 лютого 2026" / "9 февраля 2026"
  {
    const m = s.match(/\b(\d{1,2})\s+([^\d\s]+)\s+(\d{4})\b/i);
    if (m){
      const dd = Number(m[1]);
      const token = normalizeMonthToken(m[2]);
      const yyyy = Number(m[3]);
      const mm =
        MONTHS_UA.get(token) ||
        MONTHS_RU.get(token) ||
        0;
      const ymd = toYmd(yyyy, mm, dd);
      if (ymd) return ymd;
    }
  }

  // EN: "February 9, 2026" / "Feb 9, 2026"
  {
    const m = s.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/);
    if (m){
      const token = normalizeMonthToken(m[1]);
      const dd = Number(m[2]);
      const yyyy = Number(m[3]);
      const mm = MONTHS_EN.get(token) || 0;
      const ymd = toYmd(yyyy, mm, dd);
      if (ymd) return ymd;
    }
  }

  // EN: "9 February 2026" / "9 Feb 2026"
  {
    const m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\b/);
    if (m){
      const dd = Number(m[1]);
      const token = normalizeMonthToken(m[2]);
      const yyyy = Number(m[3]);
      const mm = MONTHS_EN.get(token) || 0;
      const ymd = toYmd(yyyy, mm, dd);
      if (ymd) return ymd;
    }
  }

  return "";
}


function addTeamsSuffix(subject, srcText){
  const s = String(subject || "").trim();
  if (!s) return s;

  const src = String(srcText || "");
  const hasTeams = /microsoft\s+teams\s+meeting/i.test(src);
  if (!hasTeams) return s;

  const suffix = " (нарада в Teams)";
  if (s.toLowerCase().endsWith(suffix.toLowerCase())) return s; // не дублюємо
  return s + suffix;
}


function parseOutlookText(text){
  const out = { subject:"", dateYMD:"", tFrom:"", tTo:"" };
  const src = String(text || "");

  // Subject / Тема (EN/RU/UA)
  out.subject = firstMatchLine(src, [
    /^\s*Subject:\s*(.+)\s*$/im,
    /^\s*Тема:\s*(.+)\s*$/im,
    /^\s*Тема письма:\s*(.+)\s*$/im,
  ]);

  out.subject = addTeamsSuffix(out.subject, src);
  
  // When / Коли / Когда (берём только первую строку When/Коли/Когда)
  const whenLine = firstMatchLine(src, [
    /^\s*When:\s*(.+)\s*$/im,
    /^\s*Коли:\s*(.+)\s*$/im,
    /^\s*Когда:\s*(.+)\s*$/im,
  ]);

  // Иногда Outlook даёт Date отдельно
  const dateLine = firstMatchLine(src, [
    /^\s*Date:\s*(.+)\s*$/im,
    /^\s*Дата:\s*(.+)\s*$/im,
  ]);

  // Время: из whenLine в приоритете, иначе попробуем из Date line (редко, но бывает)
  {
    const tr = extractTimeRange(whenLine) || { tFrom:"", tTo:"" };
    out.tFrom = tr.tFrom || "";
    out.tTo   = tr.tTo   || "";
    if (!out.tFrom || !out.tTo){
      const tr2 = extractTimeRange(dateLine);
      out.tFrom = out.tFrom || tr2.tFrom || "";
      out.tTo   = out.tTo   || tr2.tTo   || "";
    }
  }

  // Дата: whenLine приоритет, иначе dateLine, иначе попробуем поиск по всему тексту (первая адекватная дата)
  out.dateYMD = extractDateFromLine(whenLine) || extractDateFromLine(dateLine) || "";

  if (!out.dateYMD){
    // fallback: поиск даты по всему тексту (первое совпадение)
    const lines = src.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    for (const ln of lines){
      const ymd = extractDateFromLine(ln);
      if (ymd){ out.dateYMD = ymd; break; }
    }
  }

  return out;
}

async function readClipboardText(){
  if (!navigator.clipboard?.readText){
    throw new Error("Clipboard API недоступний. Відкрий сторінку через http(s) (не file://) та дай дозвіл на буфер.");
  }
  return await navigator.clipboard.readText();
}

function dispatchInputChange(el){
  if (!el) return;
  try { el.dispatchEvent(new Event("input", { bubbles:true })); } catch {}
  try { el.dispatchEvent(new Event("change", { bubbles:true })); } catch {}
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

      if (data.subject) mDescription.value = data.subject;
      if (data.dateYMD) mDate.value = data.dateYMD;
      if (data.tFrom)   mFrom.value = data.tFrom;
      if (data.tTo)     mTo.value   = data.tTo;

      try { window.__erpRefreshWhenPreview?.(); } catch {}

      dispatchInputChange(mDate);
      dispatchInputChange(mFrom);
      dispatchInputChange(mTo);

      try { window.updateKpldClearVisibility?.(); } catch {}

      mKpldText?.focus();

    } catch(e){
      const msg = (e && (e.message || e.toString())) ? String(e.message || e.toString()) : "Помилка";
      setModalError?.("⚠️ " + msg);
      console.error("[ERP-Cal][MAIL]", e);
    }
  });
}
