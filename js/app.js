// /js/app.js
// ========================================================
//  ERP Day Calendar — app.js
//  ✅ Оптимизировано: единая модель события (model),
//     единые функции model<->event<->payload,
//     единая сборка title, единая обработка create/update/delete.
//  ✅ Разбито на большие блоки + комментарии на русском.
// ========================================================

import { ERPDayCalendar } from "./erp.calendar.bundle.js";
import { initOutlookClipboardPaste } from "./outlook.paste.bundle.js";
import { ERPAuth } from "./erp.auth.bundle.js";
import { uiConfirm } from "./ui.modal.bundle.js";

// ========================================================
// [БЛОК 1] ЛОГИ
// ========================================================
const LOG_PREFIX = "[ERP-Cal]";
function log(...args){ console.log(LOG_PREFIX, ...args); }
function err(...args){ console.error(LOG_PREFIX, ...args); }

// ========================================================
// [БЛОК 2] УТИЛИТЫ ДАТ/ВРЕМЕНИ/ПРОВЕРОК
// ========================================================
const pad2 = n => String(n).padStart(2,'0');
function fmtTime(d){ d = new Date(d); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function fmtDate(d){ d = new Date(d); return d.toLocaleDateString('uk-UA'); }
function isoDate(d){ d = new Date(d); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function parseTimeHHMM(s){
  if (!s) return null;
  const m = String(s).match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (hh<0 || hh>23 || mm<0 || mm>59) return null;
  return { hh, mm };
}
function parseDateYYYYMMDD(s){
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const dt = new Date(y, mo, d, 0, 0, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}
function combineDateTime(dateStr, timeStr){
  const d = parseDateYYYYMMDD(dateStr);
  const t = parseTimeHHMM(timeStr);
  if (!d || !t) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.hh, t.mm, 0, 0);
}
function minutesDiff(a,b){ return Math.round((b.getTime()-a.getTime())/60000); }
function sameDay(a,b){
  return a.getFullYear()===b.getFullYear()
    && a.getMonth()===b.getMonth()
    && a.getDate()===b.getDate();
}
function isWithinSingleDay(start, end){
  return !!start && !!end && sameDay(start, end);
}
function durationUaShort(totalMinutes){
  totalMinutes = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h} год ${m} хв`;
  if (h > 0) return `${h} год`;
  return `${m} хв`;
}
function formatWhenWithDuration(start, end){
  const dur = durationUaShort(minutesDiff(start, end));
  return `${fmtDate(start)}  ${fmtTime(start)}–${fmtTime(end)} (${dur})`;
}

function genGuid(){
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  const s4 = () => Math.floor((1+Math.random())*0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`.toUpperCase();
}
function isTempId(id){ return typeof id === "string" && id.startsWith("tmp-"); }

function normalizeErrMessage(e){
  const msg = (e && (e.message || e.toString())) ? String(e.message || e.toString()) : "Помилка";
  return msg.replace(/\s+/g," ").trim();
}
function shortErr(msg, max=120){
  msg = normalizeErrMessage(msg);
  if (msg.length <= max) return msg;
  return msg.slice(0, max-1) + "…";
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message, type="error", title="Повідомлення", ms=4500){
  const el = document.createElement("div");
  el.className = `erp-toast ${type}`;
  el.innerHTML = `
    <div class="title">${escapeHtml(title)}</div>
    <div class="msg">${escapeHtml(message)}</div>
  `;
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add("show"));

  const kill = () => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
    document.removeEventListener("keydown", onKey);
  };

  const onKey = (e) => { if (e.key === "Escape") kill(); };
  document.addEventListener("keydown", onKey);

  el.addEventListener("click", kill);
  setTimeout(kill, ms);
}

// ========================================================
// PlaceWork: persist last choice (safe)
// ========================================================
const LS_PLACEWORK_KEY = "erp_cal_last_placeWork_v1";

function getLastPlaceWork(){
  try{
    const v = localStorage.getItem(LS_PLACEWORK_KEY);
    return (v && String(v).trim()) ? String(v).trim() : "";
  }catch{ return ""; }
}
function setLastPlaceWork(v){
  try{
    localStorage.setItem(LS_PLACEWORK_KEY, String(v ?? ""));
  }catch{}
}

const LS_AUTH_KEY = "erp_cal_auth_v2"; // ✅ тот же ключ что в ERPAuth

function getAuthFromLs(){
  let userIdCoded = "";
  let userName = "";
  try{
    const raw = localStorage.getItem(LS_AUTH_KEY);
    if (raw){
      const obj = JSON.parse(raw);
      // ✅ NEW: userIdCoded, ✅ OLD: idEnc
      userIdCoded = String(obj?.userIdCoded || obj?.idEnc || "").trim();
      userName    = String(obj?.userName || "").trim();
    }
  }catch{}
  return { userIdCoded, userName };
}

function withAuthParams(params){
  const { userIdCoded, userName } = getAuthFromLs();
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params || {});
  if (userIdCoded) p.set("UserIdCoded", userIdCoded);
  if (userName)    p.set("UserName", userName);
  return p;
}

// ========================================================
// [БЛОК 3] DOM-ССЫЛКИ (календарь/модалка/контекст/спиннеры)
// ========================================================
const calendarEl = document.getElementById("calendar");
const pageSpinner = document.getElementById("pageSpinner");

const ctx = document.getElementById("ctx");
const ctxHint = document.getElementById("ctxHint");
const ctxCreate = document.getElementById("ctxCreate");
const ctxClear = document.getElementById("ctxClear");

const backdrop = document.getElementById("backdrop");
const modalTitle = document.getElementById("modalTitle");
const mWhen = document.getElementById("mWhen");
const mDate = document.getElementById("mDate");
const mFrom = document.getElementById("mFrom");
const mTo = document.getElementById("mTo");
const mDescription = document.getElementById("mDescription");

const mKpldText = document.getElementById("mKpldText");
const mKpldList = document.getElementById("mKpldList");
const mKpld = document.getElementById("mKpld"); // hidden

const mSave = document.getElementById("mSave");
const mCancel = document.getElementById("mCancel");
const mDelete = document.getElementById("mDelete");
const mPlaceWork = document.getElementById("mPlaceWork");
const mError = document.getElementById("mError");

const LS_USER_ID_CODED = "erp_userIdCoded";
const LS_USER_NAME     = "erp_userName";

ctxClear?.addEventListener("click", () => {
  clearEditActive();
});

// зберігати вибір при зміні
if (mPlaceWork){
  mPlaceWork.addEventListener("change", () => {
    setLastPlaceWork(mPlaceWork.value);
  });
}

function setModalError(text){
  if (!mError) return;
  const t = (text || "").trim();
  if (!t){
    mError.style.display = "none";
    mError.textContent = "";
    return;
  }
  mError.style.display = "block";
  mError.textContent = t;
}

// Ошибка загрузки (по центру)
const loadErrorEl = document.getElementById("loadError");
function showLoadError(text){
  if (!loadErrorEl) return;
  loadErrorEl.textContent = text || "Не вдалося завантажити дані";
  loadErrorEl.style.display = "block";
}
function hideLoadError(){
  if (!loadErrorEl) return;
  loadErrorEl.style.display = "none";
  loadErrorEl.textContent = "";
}

// ========================================================
// [БЛОК 4] OUTLOOK PASTE (кнопка + хоткей)
// ========================================================
const mPasteMail = document.getElementById("mPasteMail");
initOutlookClipboardPaste({
  btn: mPasteMail,
  mDate,
  mFrom,
  mTo,
  mDescription,
  mKpldText,
  setModalError
});
// Hotkey: Ctrl+Shift+Alt+7 (только когда модалка открыта)
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.altKey && e.code === "Digit7") {
    if (backdrop.style.display === "flex") {
      e.preventDefault();
      mPasteMail?.click();
    }
  }
});

// ========================================================
// [БЛОК 5] PAGE SPINNER (глобальный спиннер загрузки страницы)
// ========================================================
let pageSpinnerCounter = 0;
function showPageSpinner(reason){
  pageSpinnerCounter++;
  pageSpinner.classList.add("is-on");
  pageSpinner.setAttribute("aria-hidden","false");
  log("PAGE spinner ON", pageSpinnerCounter, reason || "");
}
function hidePageSpinner(reason){
  pageSpinnerCounter = Math.max(0, pageSpinnerCounter - 1);
  if (pageSpinnerCounter === 0){
    pageSpinner.classList.remove("is-on");
    pageSpinner.setAttribute("aria-hidden","true");
  }
  log("PAGE spinner OFF", pageSpinnerCounter, reason || "");
}

// ========================================================
// [БЛОК 6] SPINNER ВНУТРИ СОБЫТИЯ (DOM spinner внутри event)
// ========================================================
const eventDomMap = new Map(); // id -> DOM элемент события
const savingIds = new Set();   // id событий, которые сейчас "сохраняются"

function ensureSpinner(el){
  if (!el) return;
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  if (!el.querySelector(".dom-spinner")){
    const sp = document.createElement("div");
    sp.className = "dom-spinner";
    sp.innerHTML = `<div class="ring"></div>`;
    el.appendChild(sp);
  }
}
function removeSpinner(el){
  if (!el) return;
  el.querySelector(".dom-spinner")?.remove();
}
function findEventEl(eventId){
  const mapped = eventDomMap.get(eventId);
  if (mapped && document.contains(mapped)) return mapped;
  try {
    return calendarEl.querySelector(`[data-event-id="${CSS.escape(eventId)}"]`);
  } catch {
    return calendarEl.querySelector(`[data-event-id="${String(eventId).replace(/"/g,'\\"')}"]`);
  }
}

// ========================================================
// Подсветка события, которое сейчас редактируем в модалке
// ========================================================
let editActiveEventId = null;


function setEditActive(eventId){
  // снять со старого
  if (editActiveEventId){
    const oldEl = findEventEl(editActiveEventId);
    if (oldEl) oldEl.classList.remove("is-edit-active");
  }

  editActiveEventId = eventId || null;
  if (!editActiveEventId) return;

  // попытка №1: прямо сейчас
  const apply = () => {
    const el = findEventEl(editActiveEventId);
    if (el) el.classList.add("is-edit-active");
  };

  apply();

  // попытка №2: в следующий кадр (когда FC уже дорисовал DOM)
  requestAnimationFrame(apply);

  // попытка №3: ещё один кадр (на случай перемонта после спиннера/рендера)
  requestAnimationFrame(() => requestAnimationFrame(apply));
}


/*
function setEditActive(eventId){
  if (editActiveEventId){
    const oldEl = findEventEl(editActiveEventId);
    if (oldEl) oldEl.classList.remove("is-edit-active");
  }
  editActiveEventId = eventId || null;
  if (editActiveEventId){
    const el = findEventEl(editActiveEventId);
    if (el) el.classList.add("is-edit-active");
  }
}
  */

function clearEditActive(){
  setEditActive(null);
}

function startSaving(eventId, reason){
  savingIds.add(eventId);
  const el = findEventEl(eventId);
  if (el) ensureSpinner(el);
  log("SPINNER ON", eventId, reason || "");
}
function stopSaving(eventId, reason){
  savingIds.delete(eventId);
  const el = findEventEl(eventId);
  if (el) removeSpinner(el);
  log("SPINNER OFF", eventId, reason || "");
}

// ========================================================
// [БЛОК 7] МАРКЕРЫ ОШИБОК НА СОБЫТИЯХ (create/update/delete)
// ========================================================
function markCreateError(ev){ const el = findEventEl(ev.id); if (el) el.classList.add("is-create-error"); }
function clearCreateError(ev){ const el = findEventEl(ev.id); if (el) el.classList.remove("is-create-error"); }
function applyCreateErrorText(ev, msg){
  ev.setExtendedProp("__create_error", normalizeErrMessage(msg));
  ev.setExtendedProp("__create_error_short", shortErr(msg));
  markCreateError(ev);
}

function markUpdateError(ev){ const el = findEventEl(ev.id); if (el) el.classList.add("is-update-error"); }
function clearUpdateError(ev){ const el = findEventEl(ev.id); if (el) el.classList.remove("is-update-error"); }
function applyUpdateErrorText(ev, msg){
  ev.setExtendedProp("__update_error", normalizeErrMessage(msg));
  ev.setExtendedProp("__update_error_short", shortErr(msg));
  markUpdateError(ev);
}
function clearUpdateErrorText(ev){
  ev.setExtendedProp("__update_error", "");
  ev.setExtendedProp("__update_error_short", "");
  clearUpdateError(ev);
}

function markDeleteError(ev){ const el = findEventEl(ev.id); if (el) el.classList.add("is-delete-error"); }
function clearDeleteError(ev){ const el = findEventEl(ev.id); if (el) el.classList.remove("is-delete-error"); }
function applyDeleteErrorText(ev, msg){
  ev.setExtendedProp("__delete_error", normalizeErrMessage(msg));
  ev.setExtendedProp("__delete_error_short", shortErr(msg));
  markDeleteError(ev);
}
function clearDeleteErrorText(ev){
  ev.setExtendedProp("__delete_error", "");
  ev.setExtendedProp("__delete_error_short", "");
  clearDeleteError(ev);
}

// ========================================================
// [БЛОК 8] API URLS + JSON HELPERS (общие функции чтения/нормализации)
// ========================================================
const API_LIST_URL   = "https://webclient.it-enterprise.com/ws/api/_PLUTEST_GET";
const API_CREATE_URL = "https://webclient.it-enterprise.com/ws/api/_PLUTEST_ADD";
const API_UPDATE_URL = "https://webclient.it-enterprise.com/ws/api/_PLUTEST_UPD";
const API_DELETE_URL = "https://webclient.it-enterprise.com/ws/api/_PLUTEST_DEL";
const API_SKD_URL    = "https://webclient.it-enterprise.com/ws/api/_PLUTEST_GETSKD";
const API_PLD_URL    = "https://webclient.it-enterprise.com/ws/api/_PLUTEST_GETPLD";

async function readApiJson(resp, opName){
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json") || ct.includes("text/json") || ct.includes("+json")) {
    try { return await resp.json(); }
    catch (e){
      const raw = await resp.text().catch(()=> "");
      throw new Error(`${opName}: invalid JSON: ${normalizeErrMessage(e)} | raw: ${raw}`);
    }
  }
  const raw = await resp.text();
  try { return JSON.parse(raw); }
  catch { throw new Error(`${opName}: expected JSON, got: ${raw}`); }
}

function normalizeApiResult(obj){
  if (!obj || typeof obj !== "object"){
    return { Success:false, Id:0, MessageError:"Некоректна відповідь сервера", objCode:"", kzajCode:"" };
  }
  const Success = Boolean(obj.Success ?? obj.success ?? false);
  const Id = Number(obj.Id ?? obj.id ?? 0) || 0;
  const MessageError = String(obj.MessageError ?? obj.messageError ?? obj.error ?? "").trim();

  const objCode = String(obj.PluObj?.objCode ?? obj.objCode ?? "").trim();
  const kzajCode = String(obj.PluObj?.kzajCode ?? obj.kzajCode ?? "").trim();

  return { Success, Id, MessageError, objCode, kzajCode };
}
function throwIfNotSuccess(opName, res){
  if (res.Success) return;
  throw new Error(res.MessageError || `${opName}: Success=false`);
}

// ========================================================
// [БЛОК 9] KPLD AUTOCOMPLETE (PLD) — ✅ ОБНОВЛЕНО: obj/kzaj в списке
// ========================================================

// Кэш теперь хранит объект: kpld -> { kpld,npld,pldObjCode,pldKzaj, labelText }
const pldCache = new Map();
let pldDebTimer = null;

let acItems = [];
let acActive = -1;
let acOpen = false;

// Строка для поля ввода (БЕЗ html)
function buildPldInputText(it){
  const k = String(it?.kpld ?? "").trim();
  const obj = String(it?.pldObjCode ?? "").trim();
  const kz = String(it?.pldKzaj ?? "").trim();
  const n = String(it?.npld ?? "").trim();

  const parts = [];
  if (k) parts.push(k);
  if (obj) parts.push(obj);
  if (kz) parts.push(kz);
  const head = parts.join("  ");

  if (!head && !n) return "";
  if (!head) return n;
  if (!n) return head;
  return `${head} — ${n}`;
}

function pldSet(kpld, labelText){
  const k = (kpld === "" || kpld === null || kpld === undefined) ? "" : String(Number(kpld) || "");
  mKpld.value = k;
  mKpldText.value = labelText || (k ? k : "");
}

function pldHideList(){
  acOpen = false;
  acItems = [];
  acActive = -1;
  mKpldList.style.display = "none";
  mKpldList.innerHTML = "";
}

function acUpdateActive(){
  const els = [...mKpldList.querySelectorAll(".ac-item")];
  els.forEach((el, i) => el.classList.toggle("is-active", i === acActive));

  const activeEl = els[acActive];
  if (activeEl){
    const list = mKpldList;
    const top = activeEl.offsetTop;
    const bottom = top + activeEl.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }
}

function acPickIndex(i){
  if (i < 0 || i >= acItems.length) return;
  const it = acItems[i];

  const code = String(it.kpld);
  const labelText = buildPldInputText(it);

  // кэшируем объект целиком
  pldCache.set(code, { ...it, labelText });

  pldSet(code, labelText);
  pldHideList();
  updateKpldClearVisibility();
}

function pldRenderList(items){
  acItems = Array.isArray(items) ? items : [];
  acOpen = true;

  if (!acItems.length){
    mKpldList.innerHTML = `<div class="ac-empty">Нічого не знайдено</div>`;
    mKpldList.style.display = "block";
    acActive = -1;
    return;
  }

  mKpldList.innerHTML = acItems.map(it => {
    const kpld = escapeHtml(String(it.kpld ?? ""));
    const obj  = escapeHtml(String(it.pldObjCode ?? ""));
    const kzaj = escapeHtml(String(it.pldKzaj ?? ""));
    const name = escapeHtml(String(it.npld ?? ""));

    // data-* оставляем минимально нужное
    return `
      <div class="ac-item" data-kpld="${kpld}">
<div class="ac-line">
  <span class="ac-head">
    <span class="ac-kpld">${kpld}</span>
    ${obj ? `&nbsp;<span class="ac-obj">${obj}</span>` : ``}
    ${kzaj ? `&nbsp;<span class="ac-kzaj">${kzaj}</span>` : ``}
  </span>
</div>
        <div class="ac-desc">${name}</div>
      </div>
    `;
  }).join("");

  mKpldList.style.display = "block";

  const els = [...mKpldList.querySelectorAll(".ac-item")];
  els.forEach((el, idx) => {
    el.addEventListener("mouseenter", () => { acActive = idx; acUpdateActive(); });
    el.addEventListener("mousedown", (e) => { e.preventDefault(); acPickIndex(idx); });
  });

  acActive = 0;
  acUpdateActive();
}

async function apiGetPld({ q = "", kpld = "" } = {}){
  let params = new URLSearchParams();
  params.set("q", q ? String(q) : "");
  params.set("kpld", (kpld !== "" && kpld != null) ? String(kpld) : "0");

  params = withAuthParams(params);
  const url = `${API_PLD_URL}?${params.toString()}`;

  log("API PLD ->", url);

  const resp = await fetch(url, { method:"GET", headers:{ "accept":"application/json" } });
  const text = await resp.text();
  log("API PLD <- HTTP", resp.status, "raw:", text);

  if (!resp.ok) throw new Error("API PLD HTTP " + resp.status + ": " + text);

  let arr;
  try { arr = JSON.parse(text); }
  catch(e){ throw new Error("API PLD invalid JSON: " + String(e) + " | raw: " + text); }

  if (!Array.isArray(arr)) throw new Error("API PLD expected array");

  return arr
    .filter(x => x && typeof x === "object")
    .map(x => ({
      kpld: Number(x.kpld ?? x.KPLD ?? x.Kpld ?? 0) || 0,
      npld: String(x.npld ?? x.NPLD ?? x.Npld ?? x.name ?? x.text ?? "").trim(),
      pldObjCode: String(x.pldObjCode ?? x.PldObjCode ?? x.PLDOBJCODE ?? x.objCode ?? "").trim(),
      pldKzaj: String(x.pldKzaj ?? x.PldKzaj ?? x.PLDKZAJ ?? x.pldKZAJ ?? x.kzajCode ?? "").trim(),
    }))
    .filter(x => x.kpld);
}

async function pldLoadAll(){
  try{
    const items = await apiGetPld({ q: "" });
    items.forEach(it => {
      const code = String(it.kpld);
      pldCache.set(code, { ...it, labelText: buildPldInputText(it) });
    });
    pldRenderList(items);
  } catch(e){
    err("PLD loadAll failed:", e);
    pldHideList();
  }
}

async function pldSearch(q){
  const s = (q || "").trim();
  try{
    const items = await apiGetPld({ q: s });
    items.forEach(it => {
      const code = String(it.kpld);
      pldCache.set(code, { ...it, labelText: buildPldInputText(it) });
    });
    pldRenderList(items);
  } catch(e){
    err("PLD search failed:", e);
    pldHideList();
  }
}

async function pldPrefillByKpld(kpld){
  const k = String(Number(kpld) || "");
  if (!k){
    pldSet("", "");
    pldHideList();
    return;
  }
  if (pldCache.has(k)){
    const hit = pldCache.get(k);
    pldSet(k, hit?.labelText || k);
    return;
  }
  try{
    const items = await apiGetPld({ kpld: k });
    const hit = items.find(x => String(x.kpld) === k) || items[0];
    if (hit){
      const labelText = buildPldInputText(hit);
      pldCache.set(k, { ...hit, labelText });
      pldSet(hit.kpld, labelText);
      return;
    }
  } catch {}
  try{
    const items = await apiGetPld({ q: k });
    const hit = items.find(x => String(x.kpld) === k) || items[0];
    if (hit){
      const labelText = buildPldInputText(hit);
      pldCache.set(k, { ...hit, labelText });
      pldSet(hit.kpld, labelText);
      return;
    }
  } catch(e){ err("PLD prefill failed:", e); }
  pldSet(k, k);
}

async function pldShowSelected(){
  const k = String(Number(mKpld.value || 0) || "");
  if (!k) return;

  if (pldCache.has(k)){
    const hit = pldCache.get(k);
    pldRenderList([hit]);
    return;
  }
  try{
    const items = await apiGetPld({ kpld: k });
    if (items.length){
      const hit = items.find(x => String(x.kpld) === k) || items[0];
      const labelText = buildPldInputText(hit);
      pldCache.set(k, { ...hit, labelText });
      pldRenderList([hit]);
      return;
    }
  } catch(e){ err("PLD showSelected failed:", e); }
  pldRenderList([{ kpld: Number(k), npld: "", pldObjCode:"", pldKzaj:"" }]);
}

function initPldUI(){
  if (!mKpldText || !mKpldList || !mKpld) return;

  mKpldText.addEventListener("focus", () => {
    const val = (mKpldText.value || "").trim();
    const hasSelected = !!mKpld.value;

    if (hasSelected){ pldShowSelected(); return; }
    if (!val){ pldLoadAll(); return; }

    clearTimeout(pldDebTimer);
    pldDebTimer = setTimeout(() => pldSearch(val), 0);
  });

  mKpldText.addEventListener("input", () => {
    const val = mKpldText.value || "";
    mKpld.value = "";
    clearTimeout(pldDebTimer);
    pldDebTimer = setTimeout(() => {
      const s = (val || "").trim();
      if (!s) return pldLoadAll();
      pldSearch(s);
    }, 200);

    updateKpldClearVisibility();
  });

  mKpldText.addEventListener("keydown", (e) => {
    if (!acOpen || mKpldList.style.display === "none"){
      if (e.key === "ArrowDown"){
        e.preventDefault();
        const val = (mKpldText.value || "").trim();
        if (!val && !mKpld.value) pldLoadAll();
        else pldSearch(val);
      }
      return;
    }

    if (e.key === "ArrowDown"){
      e.preventDefault();
      if (!acItems.length) return;
      acActive = Math.min(acItems.length - 1, acActive + 1);
      acUpdateActive();
      return;
    }
    if (e.key === "ArrowUp"){
      e.preventDefault();
      if (!acItems.length) return;
      acActive = Math.max(0, acActive - 1);
      acUpdateActive();
      return;
    }
    if (e.key === "Enter"){
      if (acActive >= 0 && acActive < acItems.length){
        e.preventDefault();
        acPickIndex(acActive);
      }
      return;
    }
    if (e.key === "Escape"){
      e.preventDefault();
      pldHideList();
      return;
    }
  });

  mKpldText.addEventListener("blur", () => {
    setTimeout(() => {
      pldHideList();
      const raw = (mKpldText.value || "").trim();
      if (raw && !mKpld.value){
        // берем первое число (kpld) из начала строки
        const guess = raw.match(/^\s*(\d+)\b/)?.[1] || "";
        if (/^\d+$/.test(guess)) pldPrefillByKpld(guess);
      }
    }, 120);
  });

  document.addEventListener("mousedown", (e) => {
    if (!mKpldList.contains(e.target) && e.target !== mKpldText){
      pldHideList();
    }
  });

  // ========================================================
  // KPLD clear button (красный крестик)
  // ========================================================
  const mKpldClear = document.getElementById("mKpldClear");

  function updateKpldClearVisibility(){
    if (!mKpldClear) return;
    const hasValue = !!(mKpld.value || mKpldText.value.trim());
    mKpldClear.style.display = hasValue ? "block" : "none";
  }

  // 🌍 делаем доступной глобально (для outlook.paste.bundle.js)
  window.updateKpldClearVisibility = updateKpldClearVisibility;

  if (mKpldClear){
    mKpldClear.addEventListener("click", () => {
      mKpld.value = "";
      mKpldText.value = "";
      pldHideList();
      updateKpldClearVisibility();
      mKpldText.focus();
    });
  }
}
initPldUI();

// ========================================================
// [ДАЛЕЕ] — всё остальное без изменений
// ========================================================

// ========================================================
// [БЛОК 10] API ВЫЗОВЫ (LIST/SKD/CREATE/UPDATE/DELETE)
// ========================================================

// LIST (работы)
async function apiGetListJobs(dateFrom, dateTo){
  const params = withAuthParams({ dateFrom, dateTo });
  const url = `${API_LIST_URL}?${params.toString()}`;

  log("API LIST ->", url);

  const resp = await fetch(url, { method:"GET", headers:{ "accept":"application/json" } });
  const text = await resp.text();
  log("API LIST <- HTTP", resp.status, "raw:", text);

  if (!resp.ok) throw new Error("API LIST HTTP " + resp.status + ": " + text);

  let arr;
  try { arr = JSON.parse(text); }
  catch(e){ throw new Error("API LIST invalid JSON: " + String(e) + " | raw: " + text); }

  if (!Array.isArray(arr)) throw new Error("API LIST expected array");

  return arr
    .filter(x => x && typeof x === "object")
    .map(x => ({
      id: String(x.id ?? x.Id ?? ""),
      time_from: String(x.time_from ?? x.Time_From ?? x.timeFrom ?? ""),
      time_to: String(x.time_to ?? x.Time_To ?? x.timeTo ?? ""),
      date: String(x.date ?? x.Date ?? ""),
      kpld: Number(x.kpld ?? x.KPLD ?? x.Kpld ?? 0) || 0,
      objCode: String(x.objCode ?? ""),
      kzajCode: String(x.kzajCode ?? ""),
      description: String(x.description ?? x.Description ?? ""),
      placeWork: String(x.placeWork ?? x.PlaceWork ?? x.place_work ?? "").trim()
    }))
    .filter(x =>
      x.id && /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
      /^\d{2}:\d{2}$/.test(x.time_from) &&
      /^\d{2}:\d{2}$/.test(x.time_to)
    );
}

// SKD интервалы
function parseIsoDateTime(s){
  const d = new Date(String(s || ""));
  return isNaN(d.getTime()) ? null : d;
}
async function apiGetSkd(dateFrom, dateTo){
  const params = withAuthParams({ dateFrom, dateTo });
  const url = `${API_SKD_URL}?${params.toString()}`;
  log("API SKD ->", url);

  const resp = await fetch(url, { method:"GET", headers:{ "accept":"application/json" } });
  const text = await resp.text();
  log("API SKD <- HTTP", resp.status, "raw:", text);

  if (!resp.ok) throw new Error("API SKD HTTP " + resp.status + ": " + text);

  let arr;
  try { arr = JSON.parse(text); }
  catch(e){ throw new Error("API SKD invalid JSON: " + String(e) + " | raw: " + text); }

  if (!Array.isArray(arr)) throw new Error("API SKD expected array");

  return arr
    .filter(x => x && typeof x === "object")
    .map(x => ({
      from: parseIsoDateTime(x.DateFrom ?? x.dateFrom ?? x.from),
      to:   parseIsoDateTime(x.DateTo   ?? x.dateTo   ?? x.to)
    }))
    .filter(x => x.from && x.to);
}
function skdIntervalsToMarkerEvents(items){
  const ONE_MIN = 60 * 1000;
  const out = [];
  for (let i=0; i<items.length; i++){
    const it = items[i];
    const fromTxt = fmtTime(it.from);
    const toTxt   = fmtTime(it.to);

    out.push({
      id: `skd-from-${i}-${it.from.getTime()}`,
      start: it.from,
      end: new Date(it.from.getTime() + ONE_MIN),
      display: "background",
      editable: false,
      classNames: ["skd-marker", "skd-from"],
      extendedProps: { __skd_marker: true, __skd_label: `СКД з ${fromTxt}` }
    });

    out.push({
      id: `skd-to-${i}-${it.to.getTime()}`,
      start: it.to,
      end: new Date(it.to.getTime() + ONE_MIN),
      display: "background",
      editable: false,
      classNames: ["skd-marker", "skd-to"],
      extendedProps: { __skd_marker: true, __skd_label: `СКД по ${toTxt}` }
    });
  }
  return out;
}

// CREATE
async function apiCreateJob(payload){
  const params = withAuthParams(new URLSearchParams());
  const url = `${API_CREATE_URL}?${params.toString()}`;

  log("API CREATE ->", url, payload);

  let resp;
  try{
    resp = await fetch(url, {
      method:"POST",
      headers:{ "accept":"application/json", "Content-Type":"application/json" },
      body: JSON.stringify({Record:payload})
    });
  } catch(fetchErr){
    throw new Error("Немає доступу до API: " + normalizeErrMessage(fetchErr));
  }

  let json;
  try { json = await readApiJson(resp, "API CREATE"); }
  catch(e){ throw new Error(`API CREATE HTTP ${resp.status}: ${normalizeErrMessage(e)}`); }

  const res = normalizeApiResult(json);
  log("API CREATE <- HTTP", resp.status, "json:", res);

  if (!resp.ok) throw new Error(res.MessageError || `API CREATE HTTP ${resp.status}`);
  throwIfNotSuccess("API CREATE", res);
  if (!res.Id) throw new Error("API CREATE: Id=0");

  return { id: String(res.Id), objCode: res.objCode ?? "", kzajCode: res.kzajCode ?? "" };
}

// UPDATE
async function apiUpdateJob(payload){
  const params = withAuthParams(new URLSearchParams());
  const url = `${API_UPDATE_URL}?${params.toString()}`;

  log("API UPDATE ->", url, payload);

  let resp;
  try{
    resp = await fetch(url, {
      method:"POST",
      headers:{ "accept":"application/json", "Content-Type":"application/json" },
      body: JSON.stringify( {Record: payload} )
    });
  } catch(fetchErr){
    throw new Error("Немає доступу до API: " + normalizeErrMessage(fetchErr));
  }

  let json;
  try { json = await readApiJson(resp, "API UPDATE"); }
  catch(e){ throw new Error(`API UPDATE HTTP ${resp.status}: ${normalizeErrMessage(e)}`); }

  const res = normalizeApiResult(json);
  log("API UPDATE <- HTTP", resp.status, "json:", res);

  if (!resp.ok) throw new Error(res.MessageError || `API UPDATE HTTP ${resp.status}`);
  throwIfNotSuccess("API UPDATE", res);

  return { objCode: res?.objCode ?? "", kzajCode: res?.kzajCode ?? "" };
}

// DELETE
async function apiDeleteJob(id){
  const params = withAuthParams({ Id: String(id) });
  const url = `${API_DELETE_URL}?${params.toString()}`;

  log("API DELETE ->", url);

  let resp;
  try{
    resp = await fetch(url, { method:"POST", headers:{ "accept":"application/json" } });
  } catch(fetchErr){
    throw new Error("Немає доступу до API: " + normalizeErrMessage(fetchErr));
  }

  let json;
  try { json = await readApiJson(resp, "API DELETE"); }
  catch(e){ throw new Error(`API DELETE HTTP ${resp.status}: ${normalizeErrMessage(e)}`); }

  const res = normalizeApiResult(json);
  log("API DELETE <- HTTP", resp.status, "json:", res);

  if (!resp.ok) throw new Error(res.MessageError || `API DELETE HTTP ${resp.status}`);
  throwIfNotSuccess("API DELETE", res);

  return true;
}

// ========================================================
// [БЛОК 11] ЕДИНАЯ МОДЕЛЬ СОБЫТИЯ (model) + МАППИНГИ
// ========================================================
function buildTitle(model){
  return `<span class="ev-obj-code">${String(model.objCode||"")}</span> ` +
         `<span class="ev-kzaj-code">${String(model.kzajCode||"")}</span> ` +
         `${String(model.description||"")}`;
}

function ensureErrorProps(ep){
  return {
    __create_error: ep?.__create_error || "",
    __create_error_short: ep?.__create_error_short || "",
    __update_error: ep?.__update_error || "",
    __update_error_short: ep?.__update_error_short || "",
    __delete_error: ep?.__delete_error || "",
    __delete_error_short: ep?.__delete_error_short || "",
  };
}

function scrubTempProps(ep){
  if (!ep) return;
  delete ep.__pending_create;
  delete ep.__create_error;
  delete ep.__create_error_short;
}

function modelFromJob(job){
  const start = new Date(job.date + "T" + job.time_from + ":00");
  const end   = new Date(job.date + "T" + job.time_to   + ":00");
  return {
    id: String(job.id),
    start, end,
    kpld: Number(job.kpld || 0) || 0,
    objCode: String(job.objCode || ""),
    kzajCode: String(job.kzajCode || ""),
    placeWork: String(job.placeWork || "").trim(),
    description: String(job.description || ""),
    errors: ensureErrorProps({})
  };
}

function modelFromEvent(ev){
  const ep = ev.extendedProps || {};
  return {
    id: String(ev.id || ""),
    start: ev.start,
    end: ev.end,
    kpld: Number(ep.kpld || 0) || 0,
    objCode: String(ep.objCode || ""),
    kzajCode: String(ep.kzajCode || ""),
    placeWork: String(ep.placeWork || "").trim(),
    description: String(ep.description || ""),
    errors: ensureErrorProps(ep),
    __pending_create: !!ep.__pending_create
  };
}

function payloadFromModel(m){
  return {
    id: Number(String(m.id).replace(/[^\d]/g,"")) || 0,
    time_from: fmtTime(m.start),
    time_to: fmtTime(m.end),
    date: isoDate(m.start),
    kpld: Number(m.kpld || 0) || 0,
    description: String(m.description || ""),
    objCode: String(m.objCode || ""),
    kzajCode: String(m.kzajCode || ""),
    placeWork: String(m.placeWork || "").trim()
  };
}

function applyModelToEvent(ev, m){
  ev.setStart(m.start);
  ev.setEnd(m.end);
  ev.setProp("title", buildTitle(m));

  ev.setExtendedProp("kpld", Number(m.kpld || 0) || 0);
  ev.setExtendedProp("objCode", String(m.objCode || ""));
  ev.setExtendedProp("kzajCode", String(m.kzajCode || ""));
  ev.setExtendedProp("description", String(m.description || ""));
  ev.setExtendedProp("placeWork", String(m.placeWork || "").trim());

  const e = m.errors || {};
  ev.setExtendedProp("__create_error", e.__create_error || "");
  ev.setExtendedProp("__create_error_short", e.__create_error_short || "");
  ev.setExtendedProp("__update_error", e.__update_error || "");
  ev.setExtendedProp("__update_error_short", e.__update_error_short || "");
  ev.setExtendedProp("__delete_error", e.__delete_error || "");
  ev.setExtendedProp("__delete_error_short", e.__delete_error_short || "");
}

function modelToEventInput(m){
  return {
    id: String(m.id),
    title: buildTitle(m),
    start: m.start,
    end: m.end,
    extendedProps: {
      kpld: Number(m.kpld || 0) || 0,
      objCode: String(m.objCode || ""),
      kzajCode: String(m.kzajCode || ""),
      description: String(m.description || ""),
      placeWork: String(m.placeWork || "").trim(),
      ...ensureErrorProps(m.errors || {})
    }
  };
}

function jobToEvent(job){
  return modelToEventInput(modelFromJob(job));
}

// ========================================================
// [БЛОК 12] МОДАЛКА (открыть/закрыть/валидация/preview)
// ========================================================
let modalMode = null; // 'create' | 'edit'
let currentEvent = null;
let pendingCreate = null; // { start,end, existingTempEvent? }

function fillModalWhen(start, end){
  mWhen.textContent = formatWhenWithDuration(start, end);
  mDate.value = isoDate(start);
  mFrom.value = fmtTime(start);
  mTo.value = fmtTime(end);
}

function openModal(mode, payload){
  modalMode = mode;

  if (mode === "edit"){
    currentEvent = payload.event;
    setEditActive(currentEvent?.id);
    pendingCreate = null;

    fillModalWhen(currentEvent.start, currentEvent.end);

    mDescription.value = currentEvent.extendedProps?.description || "";

    const kpldVal = Number(currentEvent.extendedProps?.kpld || 0) || 0;
    mKpld.value = kpldVal ? String(kpldVal) : "";
    pldPrefillByKpld(mKpld.value);

    modalTitle.textContent = "Коригувати запис";
    mSave.textContent = "✏️ Коригувати";
    mDelete.style.display = "inline-block";

    const upd = currentEvent.extendedProps?.__update_error || "";
    const del = currentEvent.extendedProps?.__delete_error || "";
    const text = payload?.errorText || del || upd || "";

    if (mPlaceWork){
      const pw = String(currentEvent.extendedProps?.placeWork || "").trim();
      mPlaceWork.value = pw || "";
    }

    setModalError(text ? ("⚠️ " + text) : "");

  } else {
    if (mPlaceWork){
      const fromPayload = String(payload?.placeWork || "").trim();
      const last = getLastPlaceWork();
      mPlaceWork.value = (fromPayload || last || "");
    }

    currentEvent = null;
    pendingCreate = payload;
    clearEditActive();

    fillModalWhen(pendingCreate.start, pendingCreate.end);

    mDescription.value = payload?.description ?? "";

    const kpldVal = Number(payload?.kpld || 0) || 0;
    mKpld.value = kpldVal ? String(kpldVal) : "";
    pldPrefillByKpld(mKpld.value);

    modalTitle.textContent = "Додати запис";
    mSave.textContent = "✅ Додати";
    mDelete.style.display = "none";

    setModalError(payload?.errorText ? ("⚠️ " + payload.errorText) : "");
  }

  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden","false");
  window.updateKpldClearVisibility?.();
  setTimeout(() => mDescription.focus(), 0);
}

function closeModal(){

  backdrop.style.display = "none";
  backdrop.setAttribute("aria-hidden","true");
  setModalError("");
  currentEvent = null;
  pendingCreate = null;
  modalMode = null;
  pldHideList();
}
mCancel.onclick = closeModal;

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && backdrop.style.display === "flex") closeModal();
});
backdrop.addEventListener("mousedown", (e) => {
  if (e.target === backdrop) closeModal();
});

function getStartEndFromModal(){
  const start0 = combineDateTime(mDate.value, mFrom.value);
  const end0   = combineDateTime(mDate.value, mTo.value);
  if (!start0 || !end0) return { ok:false, error:"Некоректна дата/час." };
  if (!isWithinSingleDay(start0, end0)) return { ok:false, error:"Має бути в межах одного дня." };
  const diff = minutesDiff(start0, end0);
  if (diff <= 0) return { ok:false, error:"Час «по» має бути більшим за «з»." };
  return { ok:true, start: start0, end: end0 };
}
function refreshWhenPreview(){
  window.__erpRefreshWhenPreview = refreshWhenPreview;
  const res = getStartEndFromModal();
  if (!res.ok) return;
  mWhen.textContent = formatWhenWithDuration(res.start, res.end);
}
[mDate, mFrom, mTo].forEach(el => el.addEventListener("change", refreshWhenPreview));
[mFrom, mTo].forEach(el => el.addEventListener("input", refreshWhenPreview));

// ========================================================
// [БЛОК 13] CONFIRM DELETE (вторая модалка подтверждения)
// ========================================================
function confirmDelete(){
  return new Promise(resolve => {
    const backdrop = document.getElementById("confirmBackdrop");
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");

    backdrop.style.display = "flex";

    const onEsc = (e) => { if (e.key === "Escape") cleanup(false); };

    const cleanup = (result) => {
      backdrop.style.display = "none";
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      document.removeEventListener("keydown", onEsc);
      resolve(result);
    };

    okBtn.onclick = () => cleanup(true);
    cancelBtn.onclick = () => cleanup(false);

    document.addEventListener("keydown", onEsc);
  });
}

// ========================================================
// [БЛОК 13.5] AUTH: инициализация БЕЗ зависимости от widget (чтобы не было TDZ)
// ========================================================
let auth = null;
let _setLoginBtnText = (text) => { /* noop */ };

auth = ERPAuth.init({
  apiBase: "https://webclient.it-enterprise.com",
  setButtonText: (text) => _setLoginBtnText(text),

  confirmLogout: async () => {
    return await uiConfirm({
      title: "🚪 Вихід",
      text: "Вийти з облікового запису?",
      okText: "Вийти",
      cancelText: "Скасувати"
    });
  },

  onLoginChanged: async ({ isLoggedIn }) => {
    if (!isLoggedIn){
      setEventsSafe([]);
      hideLoadError();
      return;
    }
    await reloadCalendarData("login");
  }
});

// ========================================================
// [БЛОК 13.6] SAFE widget.setEvents (щоб не падало на datesSet під час init)
// ========================================================
let widgetRef = null;
let pendingEventsToSet = null;

function setEventsSafe(events){
  if (widgetRef){
    widgetRef.setEvents(events);
  } else {
    pendingEventsToSet = events;
  }
}

// ========================================================
// [БЛОК 14] КАЛЕНДАРЬ: ИНИЦИАЛИЗАЦИЯ + ХУКИ
// ========================================================
const widget = new ERPDayCalendar("#calendar", {
  ctx: { el: ctx, hintEl: ctxHint, btnCreate: ctxCreate, btnClear: ctxClear },

  onRangeChanged: async ({ from, to }) => {
    showPageSpinner("datesSet");
    try{
      if (!auth.isLoggedIn()){
        setEventsSafe([]);
        hideLoadError();
        return;
      }

      const [jobs, skd] = await Promise.all([
        apiGetListJobs(from, to),
        apiGetSkd(from, to)
      ]);

      const events = [
        ...jobs.map(jobToEvent),
        ...skdIntervalsToMarkerEvents(skd)
      ];

      setEventsSafe(events);
      hideLoadError();

    } catch(e){
      err("LIST+SKD failed:", e);
      showLoadError("Не вдалося завантажити записи/СКД.\nПомилка: " + (e?.message || e));
    } finally {
      hidePageSpinner("datesSet");
    }
  },

  onLoginClick: async () => {
    await auth.handleLoginButtonClick();
  },

  onCreateRequested: async ({ start, end }) => {
    if (!await requireLogin()) return;
    openModal("create", { start, end });
  },

  onEditRequested: async  ({ event }) => {
    if (event.extendedProps?.__skd_marker) return;
    if (!await requireLogin()) return;

    if (isTempId(event.id)){
      openModal("create", {
        start: event.start,
        end: event.end,
        description: event.extendedProps?.description || "",
        placeWork: event.extendedProps?.placeWork || "",
        kpld: event.extendedProps?.kpld || 0,
        errorText: event.extendedProps?.__create_error || ""
      });
      currentEvent = event;
      modalMode = "create";
      pendingCreate = { start: event.start, end: event.end, existingTempEvent: event };
      return;
    }

    const del = event.extendedProps?.__delete_error || "";
    const upd = event.extendedProps?.__update_error || "";
    openModal("edit", { event, errorText: del || upd || "" });
  },

  onEventMovedOrResized: async ({ event, revert }) => {
    if (event.extendedProps?.__skd_marker) return;

    if (!await requireLogin()){
      revert?.();
      return;
    }

    if (isTempId(event.id)) return;
    await safeUpdateEvent(event);
  },

  onEventDidMount: (info) => {
    info.el.dataset.eventId = info.event.id;
    eventDomMap.set(info.event.id, info.el);

    if (editActiveEventId && info.event.id === editActiveEventId){
      info.el.classList.add("is-edit-active");
    }

    if (savingIds.has(info.event.id)) ensureSpinner(info.el);

    if (info.event.extendedProps?.__create_error) {
      info.el.classList.add("is-create-error");
      info.el.dataset.createError = info.event.extendedProps?.__create_error_short || "Помилка";
    }
    if (info.event.extendedProps?.__update_error) {
      info.el.classList.add("is-update-error");
      info.el.dataset.updateError = info.event.extendedProps?.__update_error_short || "Помилка";
    }
    if (info.event.extendedProps?.__delete_error) {
      info.el.classList.add("is-delete-error");
      info.el.dataset.deleteError = info.event.extendedProps?.__delete_error_short || "Помилка";
    }

    if (info.event.extendedProps?.__skd_marker){
      const labelText = info.event.extendedProps?.__skd_label || "СКД";
      const harness = info.el.closest(".fc-timegrid-bg-harness");
      if (harness){
        harness.classList.add("skd-marker");
        if (info.event.classNames?.includes("skd-to")) harness.classList.add("skd-to");
        if (info.event.classNames?.includes("skd-from")) harness.classList.add("skd-from");
        harness.dataset.skdLabel = labelText;
      }
    }
  },

  onEventWillUnmount: (info) => {
    const el = eventDomMap.get(info.event.id);
    if (el === info.el) eventDomMap.delete(info.event.id);
  }
});

// ========================================================
// [БЛОК 14.5] AUTH <-> WIDGET
// ========================================================
widgetRef = widget;

if (pendingEventsToSet !== null){
  widgetRef.setEvents(pendingEventsToSet);
  pendingEventsToSet = null;
}

_setLoginBtnText = (text) => widget.setLoginButtonText(text);
auth.refresh();

async function requireLogin(){
  if (auth.isLoggedIn()) return true;
  toast("Для роботи потрібно залогінитись.", "warn", "🔐 Потрібен вхід");
  return false;
}

const calendar = widget.getCalendar();

// ✅ якщо користувач робить жовте виділення — скидаємо синій active event
calendar.on("select", () => {
  clearEditActive();
});

calendar.on("unselect", () => {
  clearEditActive();
});


async function reloadCalendarData(reason = ""){
  if (!auth.isLoggedIn()){
    setEventsSafe([]);
    hideLoadError();
    return;
  }

  const view = calendar.view;
  if (!view) return;

  const pad2 = n => String(n).padStart(2,'0');
  const isoDate2 = (d) => {
    d = new Date(d);
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  };

  const from = isoDate2(view.activeStart);
  const to = isoDate2(new Date(view.activeEnd.getTime() - 1));

  log("RELOAD after auth", reason, { from, to });

  showPageSpinner("reload auth");
  try{
    const [jobs, skd] = await Promise.all([ apiGetListJobs(from, to), apiGetSkd(from, to) ]);
    const events = [...jobs.map(jobToEvent), ...skdIntervalsToMarkerEvents(skd)];
    setEventsSafe(events);
    hideLoadError();
  }catch(e){
    err("Reload after auth failed:", e);
    showLoadError("Не вдалося оновити дані після входу.\nПомилка: " + (e?.message || e));
  }finally{
    hidePageSpinner("reload auth");
  }
}

// Click: открыть модалку если есть ошибки, либо temp create
calendar.on("eventClick", async (info) => {
  info.jsEvent.preventDefault();

    // ✅ якщо був жовтий selection — прибираємо його
  widget.unselect();

  const ev = info.event;
   // ✅ 1 клик = выделили
  setEditActive(ev.id);

  if (ev.extendedProps?.__skd_marker) return;

  if (isTempId(ev.id)){
    openModal("create", {
      start: ev.start,
      end: ev.end,
      title: ev.title || "",
      kpld: ev.extendedProps?.kpld || 0,
      placeWork: ev.extendedProps?.placeWork || "",
      errorText: ev.extendedProps?.__create_error || ""
    });
    currentEvent = ev;
    modalMode = "create";
    pendingCreate = { start: ev.start, end: ev.end, existingTempEvent: ev };
    return;
  }

  const del = ev.extendedProps?.__delete_error || "";
  const upd = ev.extendedProps?.__update_error || "";
  if (del || upd){
    openModal("edit", { event: ev, errorText: del || upd });
    return;
  }
});

// ========================================================
// [БЛОК 15] CREATE (tmp event -> API -> replace id)
// ========================================================
async function createOrResubmitTempEvent(ev){
  startSaving(ev.id, "create/submit tmp");
  clearCreateError(ev);

  try {
    const m = modelFromEvent(ev);
    const payload = payloadFromModel(m);
    delete payload.id;

    const res = await apiCreateJob(payload);

    stopSaving(ev.id, "submit tmp done");
    savingIds.add(res.id);

    const snapshot = modelFromEvent(ev);
    snapshot.id = res.id;
    snapshot.objCode = res.objCode || snapshot.objCode;
    snapshot.kzajCode = res.kzajCode || snapshot.kzajCode;

    const ep = { ...(ev.extendedProps || {}) };
    scrubTempProps(ep);
    snapshot.errors.__create_error = "";
    snapshot.errors.__create_error_short = "";

    ev.remove();

    const created = calendar.addEvent(modelToEventInput(snapshot));
    // ✅ перенести подсветку на "реальный" event
    setEditActive(created.id);

    requestAnimationFrame(() => stopSaving(created.id, "create done"));

    return created.id;

  } catch(e){
    stopSaving(ev.id, "create failed");
    ev.setExtendedProp("__pending_create", false);
    applyCreateErrorText(ev, e);
    err("CREATE failed:", e);
    return null;
  }
}

async function createJobFromModal(model){
  const localId = "tmp-" + genGuid();
  const m = { ...model, id: localId, errors: ensureErrorProps({}), __pending_create:true };

  const ev = calendar.addEvent({
    id: m.id,
    title: buildTitle(m),
    start: m.start,
    end: m.end,
    extendedProps: {
      kpld: Number(m.kpld || 0) || 0,
      placeWork: String(m.placeWork || "").trim(),
      objCode: String(m.objCode || ""),
      kzajCode: String(m.kzajCode || ""),
      description: String(m.description || ""),
      __pending_create: true,
      __create_error: "",
      __create_error_short: ""
    }
  });

  // ✅ СРАЗУ делаем ярко-синим (не ждём API)
  setEditActive(ev.id);

  return await createOrResubmitTempEvent(ev);
}

// ========================================================
// [БЛОК 16] UPDATE / DELETE
// ========================================================
async function safeUpdateEvent(event){
  const id = event.id;
  startSaving(id, "update");
  clearUpdateError(event);

  try {
    const m = modelFromEvent(event);
    const payload = payloadFromModel(m);
    if (!payload.id) throw new Error("API UPDATE: invalid id=" + String(event.id));

    const res = await apiUpdateJob(payload);

    if (res && (res.objCode || res.kzajCode)){
      m.objCode = String(res.objCode || m.objCode || "");
      m.kzajCode = String(res.kzajCode || m.kzajCode || "");
      applyModelToEvent(event, m);
    }

    clearUpdateErrorText(event);
    log("UPDATE OK (API)", id, payload);
    return res;

  } catch(e){
    applyUpdateErrorText(event, e);
    err("UPDATE failed:", e);
    return {};
  } finally {
    stopSaving(id, "update done");
  }
}

async function safeDeleteEvent(event){
  const id = event.id;
  startSaving(id, "delete");
  clearDeleteError(event);

  try {
    await apiDeleteJob(id);
    event.remove();
    clearDeleteErrorText(event);
    log("DELETE OK (API)", id);

  } catch(e){
    applyDeleteErrorText(event, e);
    err("DELETE failed:", e);
    throw e;

  } finally {
    stopSaving(id, "delete done");
  }
}

// ========================================================
// [БЛОК 17] SAVE / DELETE В МОДАЛКЕ
// ========================================================
mSave.onclick = async () => {
  if (!await requireLogin()) return;

  const description = mDescription.value.trim();

  const kpldVal = Number(mKpld.value || 0) || 0;
  if (!kpldVal){
    toast("Оберіть код роботи (KPLD) зі списку.", "warn", "Перевірка даних");
    mKpldText?.focus();
    return;
  }

  const parsed = getStartEndFromModal();
  if (!parsed.ok){
    toast(parsed.error, "warn", "Перевірка дати/часу");
    return;
  }

  const placeWorkVal = (mPlaceWork?.value || "").trim();

  const modalModel = {
    id: "",
    start: parsed.start,
    end: parsed.end,
    kpld: kpldVal,
    placeWork: placeWorkVal,
    objCode: "",
    kzajCode: "",
    description,
    errors: ensureErrorProps({})
  };

  if (modalMode === "create"){
    setLastPlaceWork(placeWorkVal);

    if (pendingCreate?.existingTempEvent){
      const ev = pendingCreate.existingTempEvent;
      const m = modelFromEvent(ev);

      m.start = modalModel.start;
      m.end = modalModel.end;
      m.kpld = modalModel.kpld;
      m.description = modalModel.description;
      m.placeWork = modalModel.placeWork;

      applyModelToEvent(ev, m);

      closeModal();
      widget.unselect();
      const newId = await createOrResubmitTempEvent(ev);
      if (newId) setEditActive(newId);
      return;
    }

    closeModal();
    widget.unselect();
    const newId = await createJobFromModal(modalModel);
    if (newId) setEditActive(newId);
    return;
  }

  if (modalMode === "edit" && currentEvent){
    setModalError("");

    const ev = currentEvent;
    const m = modelFromEvent(ev);

    m.start = modalModel.start;
    m.end = modalModel.end;
    m.kpld = modalModel.kpld;
    m.description = modalModel.description;
    m.placeWork = modalModel.placeWork;

    applyModelToEvent(ev, m);

    closeModal();
    await safeUpdateEvent(ev);
  }
};

mDelete.onclick = async () => {
  if (!currentEvent) return;

  const ok = await confirmDelete();
  if (!ok) return;

  if (isTempId(currentEvent.id)){
    const ev = currentEvent;
    closeModal();
    ev.remove();
    return;
  }

  const ev = currentEvent;
  closeModal();

  try {
    await safeDeleteEvent(ev);
  } catch(e){
    // событие осталось с ошибкой
  }
};

// ========================================================
// [БЛОК 18] МЕЛОЧИ: unselect при Esc (модалка)
// ========================================================
mCancel.onclick = closeModal;
