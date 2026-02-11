// /js/erp.calendar.bundle.js
// "ЗОЛОТОЙ" файл: FullCalendar + календарные стили + выделение/контекст-меню/drag-unselect.
// В app.js остаются только модалка + REST + спинеры.

const STYLE_ID = "erp-calendar-style-v4";

function injectCalendarCssOnce(cssText){
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement("style");
  st.id = STYLE_ID;
  st.textContent = cssText;
  document.head.appendChild(st);
}

const CALENDAR_CSS = `
/* off-hours */
.fc .fc-timegrid-slot-lane.offhours-slot{
  background: var(--offhours) !important;
}

/* event look */
.fc .fc-timegrid-event{
  border: 1px solid var(--event-border) !important;
  background: var(--event-bg) !important;
  color: #0a0a0a !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  overflow: hidden;
}
.fc .fc-timegrid-event::before{
  content:"";
  position:absolute;
  left:0; top:0; bottom:0;
  width: 4px;
  background: var(--event-accent);
  pointer-events: none;
}
.fc .fc-timegrid-event .fc-event-main{ padding-left: 6px; }
.fc .fc-event-time{ font-weight: 700; font-size: 11px; color: rgba(0,0,0,.78) !important; }
.fc .fc-event-title{ font-weight: 700; font-size: 12px; line-height: 1.2; color: rgba(0,0,0,.92) !important; }

/* grid */
.fc .fc-timegrid-slot{ border-top: 1px solid var(--grid-minor); }
.fc td.fc-timegrid-slot[data-time$=":00:00"]{ border-top: 1px solid var(--grid-hour) !important; }
.fc td.fc-timegrid-slot[data-time$=":15:00"],
.fc td.fc-timegrid-slot[data-time$=":30:00"],
.fc td.fc-timegrid-slot[data-time$=":45:00"]{
  border-top-style: dashed !important;
  border-top-color: rgba(0,0,0,.10) !important;
}

/* resizers */
.fc .fc-event-resizer { height: 8px; }
.fc .fc-event-resizer-start { cursor: n-resize; }
.fc .fc-event-resizer-end { cursor: s-resize; }

/* today */
.fc .fc-day-today,
.fc .fc-timegrid-col.fc-day-today,
.fc .fc-timegrid-col.fc-day-today .fc-timegrid-col-bg{ background: transparent !important; }

/* selection highlight -> transparent */
.fc .fc-highlight{
  background: transparent !important;
  border-top: none !important;
  border-bottom: none !important;
  pointer-events: none !important;
}

/* mirror selection -> orange block with time */
.fc .fc-timegrid-event.fc-event-mirror,
.fc .fc-timegrid-event.fc-mirror,
.fc .fc-event.fc-event-mirror{
  background: var(--sel-bg) !important;
  border: 1px solid var(--sel-line) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  color: #111 !important;
  pointer-events: none !important;
}
.fc .fc-timegrid-event.fc-event-mirror::before,
.fc .fc-timegrid-event.fc-mirror::before{
  display: none !important;
}
.fc .fc-timegrid-event.fc-event-mirror .fc-event-time,
.fc .fc-timegrid-event.fc-mirror .fc-event-time{
  font-weight: 800 !important;
  color: rgba(0,0,0,.85) !important;
}

/* FullCalendar добавляет " - " после времени — убираем */
.fc .fc-event-time:after,
.fc .fc-event-time::after{
  content: "" !important;
  display: none !important;
}



/* ===================== SKD (background) поверх робіт ===================== */


/* 1) піднімаємо весь шар background над подіями */







.fc .fc-timegrid-col-bg{
  z-index: 6 !important;
}
.fc .fc-timegrid-event-harness{
  z-index: 3 !important;
}








/* 2) сам harness для SKD поверх */
.fc .fc-timegrid-bg-harness.skd-marker{
  pointer-events: none !important;
  z-index: 7 !important;
}

/* 3) робимо сам background-прямокутник прозорим, малюємо лінію */
.fc .fc-timegrid-bg-harness.skd-marker > .fc-bg-event{
  background: transparent !important;
  opacity: 1 !important;
}
/* ЛІНІЯ — на всю ширину колонки */
.fc .fc-timegrid-bg-harness.skd-marker::after{
  content:"";
  position:absolute;
  left:0;
  right:0;
  top:0;
  border-top: 2px solid var(--skd-from);
  z-index: 7;
  pointer-events: none;
}

/* ПО */
.fc .fc-timegrid-bg-harness.skd-marker.skd-to::after{
  border-top-color: var(--skd-to);
}
.fc .fc-timegrid-bg-harness.skd-marker.skd-to > .fc-bg-event::after{
  border-top-color: var(--skd-to);
}

/* 4) БЕЙДЖ — малюємо НА HARNESS (бо data-skd-label стоїть саме там) */
.fc .fc-timegrid-bg-harness.skd-marker::before{
  content: attr(data-skd-label);
  position: absolute;
  right: 45px;
  top: -18px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(255,255,255,.85);
  padding: 1px 6px;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,.10);
  line-height: 1.2;
  color: var(--skd-from);
  z-index: 8;
}
.fc .fc-timegrid-bg-harness.skd-marker.skd-to::before{
  color: var(--skd-to);
}

/* ✅ FIX: Лейбл в кнопці логіну — стабільний */
.fc .fc-erpLogin-button .erp-login-label{
  pointer-events: none;
}







/* ===== REFRESH button (як "Вітаємо") ===== */
.fc .fc-erpRefresh-button{
  border-radius: 12px !important;
  padding: 6px 10px !important;
  font-weight: 600;
  display: inline-flex !important;
  align-items: center !important;
  gap: 10px !important;
  white-space: nowrap !important;

  background: #f8fafc !important;
  border: 1px solid rgba(0,0,0,.12) !important;
  color: #111 !important;

  transition: background .15s ease;
}

.fc .fc-erpRefresh-button:hover{
  background: #eef2f7 !important;
}

.fc .fc-erpRefresh-button:focus,
.fc .fc-erpRefresh-button:focus-visible{
  outline: none !important;
  box-shadow: none !important;
}

.fc .fc-erpRefresh-button .erp-refresh-label{
  display: inline-flex;
  align-items: center;
  gap: 10px;
  pointer-events: none; /* щоб клік працював по всій кнопці */
}

.fc .fc-erpRefresh-button .erp-refresh-ico{
  font-weight: 900;
  color: rgba(0,0,0,.70);
  font-size: 16px;
  line-height: 1;
}

.fc .fc-erpRefresh-button .erp-refresh-text{
  font-weight: 600;       /* як UserName у "Вітаємо" */
  __color: #111;
}




`;

function pad2(n){ return String(n).padStart(2,'0'); }
function fmtTime(d){ d = new Date(d); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

function durationUaShort(totalMinutes){
  totalMinutes = Math.max(0, Math.round(totalMinutes || 0));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h} год ${m} хв`;
  if (h > 0) return `${h} год`;
  return `${m} хв`;
}

function minutesDiff(a,b){
  return Math.round((b.getTime()-a.getTime())/60000);
}

function isoDate(d){
  d = new Date(d);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function sameDay(a,b){
  return a.getFullYear()===b.getFullYear()
    && a.getMonth()===b.getMonth()
    && a.getDate()===b.getDate();
}
function isWithinSingleDay(start, end){
  return !!start && !!end && sameDay(start, end);
}
function viewToRange(view){
  const from = isoDate(view.activeStart);
  const to = isoDate(new Date(view.activeEnd.getTime() - 1));
  return { from, to };
}


export class ERPDayCalendar {
  constructor(target, hooks = {}){
    injectCalendarCssOnce(CALENDAR_CSS);

    this.el = (typeof target === "string") ? document.querySelector(target) : target;
    if (!this.el) throw new Error("ERPDayCalendar: target not found");

    this.hooks = hooks;

    // selection state inside calendar
    this.selection = null;
    this.lastSelection = null;

    // ✅ FIX: стабільний текст кнопки логіну (не залежить від DOM)
    this._loginBtnText = "Логін";

    this.calendar = new FullCalendar.Calendar(this.el, {
      initialView: "timeGridDay",
      nowIndicator: true,

      eventResizableFromStart: true,
      editable: true,
      selectable: true,

      selectMirror: true,
      unselectAuto: false,
      selectOverlap: true,

      snapDuration: "00:05:00",
      slotDuration: "00:15:00",
      slotLabelInterval: "01:00",

      allDaySlot: false,
      firstDay: 1,
      locale: "uk",

      headerToolbar: { left: "erpRefresh,prev,next today,timeGridDay,timeGridWeek", center: "title", right: "erpLogin" },

      customButtons: {
        erpRefresh: {
    text: "↻ Оновити",
    click: () => { this.hooks.onRefreshClick?.({ calendar: this.calendar }); }
  },
        erpLogin: {
          text: "",
          click: () => { this.hooks.onLoginClick?.({ calendar: this.calendar }); }
        }
      },

viewDidMount: () => { 
  this._syncRefreshButtonDom();
  this._syncLoginButtonDom(); 
},
datesSet: async (arg) => {
  this._syncRefreshButtonDom();
  this._syncLoginButtonDom();
  const { from, to } = viewToRange(arg.view);
  if (this.hooks.onRangeChanged) {
    await this.hooks.onRangeChanged({ from, to, view: arg.view, calendar: this.calendar });
  }
},

      slotLaneClassNames: (arg) => {
        const d = arg.date;
        const mins = d.getHours() * 60 + d.getMinutes();
        if (mins < 8*60 || mins >= 21*60) return ["offhours-slot"];
        return [];
      },

      events: [],

      selectAllow: (sel) => isWithinSingleDay(sel.start, sel.end),

      select: (sel) => {
        this.selection = { start: sel.start, end: sel.end };
        this.lastSelection = this.selection;
      },

      unselect: () => { this.selection = null; },

      dateClick: (info) => {
        const start = new Date(info.date);
        start.setSeconds(0,0);
        const end = new Date(start.getTime() + 15*60*1000);

        this.calendar.select(start, end);
        this.selection = { start, end };
        this.lastSelection = this.selection;
      },

      eventAllow: (dropInfo, draggedEvent) => {
        const s = dropInfo.start;
        const e = dropInfo.end || new Date(
          dropInfo.start.getTime() + Math.max(
            15*60*1000,
            ((draggedEvent.end?.getTime()||0) - draggedEvent.start.getTime()) || 15*60*1000
          )
        );
        return isWithinSingleDay(s, e);
      },

      eventDrop: async (info) => {
        if (!isWithinSingleDay(info.event.start, info.event.end)) { info.revert(); return; }
        try {
          await this.hooks.onEventMovedOrResized?.({ event: info.event, action:"drop", calendar: this.calendar, revert: info.revert });
        } catch {
          info.revert();
        }
      },

      eventResize: async (info) => {
        if (!isWithinSingleDay(info.event.start, info.event.end)) { info.revert(); return; }
        try {
          await this.hooks.onEventMovedOrResized?.({ event: info.event, action:"resize", calendar: this.calendar, revert: info.revert });
        } catch {
          info.revert();
        }
      },

      eventDidMount: (info) => {

        info.el.addEventListener("mousedown", (e) => {
  if (e.button === 2) { // ПКМ
    e.preventDefault();
    info.el.blur();
  }
});

        info.el.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
}, true);


        info.el.addEventListener("dblclick", (e) => {
          e.preventDefault();
          const id = info.event.id;
          requestAnimationFrame(() => {
            const fresh = this.calendar.getEventById(id);
            if (!fresh) return;
            this.hooks.onEditRequested?.({ event: fresh, calendar: this.calendar });
          });
        });

        this.hooks.onEventDidMount?.(info);
      },

      eventContent: (arg) => {
        const ev = arg.event;
        if (ev.extendedProps?.__skd_marker || ev.display === "background") return true;

        const start = ev.start;
        const end = ev.end || ev.start;

        const t1 = fmtTime(start);
        const t2 = fmtTime(end);
        const dur = durationUaShort(minutesDiff(start, end));

        const timeLine = `${t1}–${t2} (${dur})`;
        const title = ev.title;

        return {
          html: `
            <div class="fc-event-main-frame">
              <div class="fc-event-time">${timeLine}</div>
              <div class="fc-event-title-container">
                <div class="fc-event-title">${title}</div>
              </div>
            </div>
          `
        };
      },

      eventWillUnmount: (info) => {
        this.hooks.onEventWillUnmount?.(info);
      },

      eventClick: (info) => { info.jsEvent.preventDefault(); }
    });

    this.calendar.render();
    this._syncLoginButtonDom();

    // unselect only on real drag start
    this._dragUnselect = null;

    const isHitSlot = (target) => !!(
      target.closest(".fc-timegrid-slot") ||
      target.closest(".fc-timegrid-slot-lane") ||
      target.closest(".fc-timegrid-col")
    );

    this.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (!isHitSlot(e.target)) return;
      this._dragUnselect = { x: e.clientX, y: e.clientY, fired: false };
    }, true);

    this.el.addEventListener("pointermove", (e) => {
      if (!this._dragUnselect || this._dragUnselect.fired) return;

      const dx = Math.abs(e.clientX - this._dragUnselect.x);
      const dy = Math.abs(e.clientY - this._dragUnselect.y);

      if (dx + dy >= 6) {
        this._dragUnselect.fired = true;
        if (this.selection) {
          this.selection = null;
          this.calendar.unselect();
          this._hideCtx();
        }
      }
    }, true);

    window.addEventListener("pointerup", () => { this._dragUnselect = null; }, true);
    window.addEventListener("pointercancel", () => { this._dragUnselect = null; }, true);

    // context menu logic inside calendar
    this.ctx = hooks.ctx || null;
    if (this.ctx?.el && this.ctx?.hintEl && this.ctx?.btnCreate && this.ctx?.btnClear){
this.el.addEventListener("contextmenu", (e) => {
  // ✅ Всегда показываем наш диалог и никогда не даём FC/браузеру выделять событие
  const insideCalendar = !!e.target.closest("#calendar, .fc");
  if (!insideCalendar) return;

  // 🔥 гасим браузерное меню + гасим обработчики FullCalendar
  e.preventDefault();
  e.stopPropagation();
  if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

  // (опционально) если ПКМ по событию — НЕ делаем выделение, НЕ открываем модалку, просто показываем меню
  this._showCtx(e.clientX, e.clientY);
}, true); // ✅ важно: CAPTURE, чтобы перехватить раньше FC



      document.addEventListener("mousedown", (e) => {
        if (this.ctx.el.style.display === "block" && !this.ctx.el.contains(e.target)) this._hideCtx();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this._hideCtx();
      });

      this.ctx.btnClear.onclick = () => {
        this.selection = null;
        this.calendar.unselect();
        this._hideCtx();
      };

      this.ctx.btnCreate.onclick = () => {
        const sel = this.selection || this.lastSelection || this._getDefaultCreateSelection();
        if (!sel) return;
        if (!isWithinSingleDay(sel.start, sel.end)) return;

        this._hideCtx();
        this.hooks.onCreateRequested?.({ start: sel.start, end: sel.end, calendar: this.calendar });
      };
    }
  } // ✅ constructor end

  // ✅ default selection (если ничего не выделено)
  _getDefaultCreateSelection(){
    const base = new Date(this.calendar.getDate());
    const now = new Date();

    base.setHours(now.getHours(), now.getMinutes(), 0, 0);

    const snap = 5;
    const mins = base.getMinutes();
    base.setMinutes(Math.floor(mins / snap) * snap, 0, 0);

    const start = new Date(base);
    const end = new Date(start.getTime() + 15 * 60 * 1000);
    return { start, end };
  }


_syncRefreshButtonDom(){
  const btn = this.el.querySelector(".fc-erpRefresh-button");
  if (!btn) return;

  // робимо як у login: чистимо і збираємо контент
  btn.textContent = "";
  btn.innerHTML = `
    <span class="erp-refresh-label">
      <span class="erp-refresh-ico">↻</span>
      <span class="erp-refresh-text">Оновити</span>
    </span>
  `;
}

  _syncLoginButtonDom(){

    const btn = this.el.querySelector(".fc-erpLogin-button");
    if (!btn) return;

    const t = String(this._loginBtnText || "Логін").trim();

    const isLoggedIn = /^Вітаємо\s+/i.test(t);
    btn.classList.toggle("is-logged-out", !isLoggedIn);

    let label = btn.querySelector(".erp-login-label");
    if (!label){
      btn.textContent = "";
      label = document.createElement("span");
      label.className = "erp-login-label";
      btn.appendChild(label);
    } else {
      label.textContent = "";
      label.innerHTML = "";
    }

    if (!isLoggedIn){
      label.textContent = t;
      return;
    }

    const m = t.match(/^\s*Вітаємо\s+(.+?)(?:\s*\[\s*Вийти\s*\]\s*)?$/i);
    const user = (m && m[1]) ? m[1].trim() : "";

    const hello = document.createElement("span");
    hello.className = "erp-login-hello";
    hello.textContent = "Вітаємо ";

    const uname = document.createElement("span");
    uname.className = "erp-login-user";
    uname.textContent = user || "";

    const sep = document.createElement("span");
    sep.className = "erp-login-sep";

    const logout = document.createElement("span");
    logout.className = "erp-login-logout";
    logout.textContent = "Вийти";

    label.appendChild(hello);
    label.appendChild(uname);
    label.appendChild(sep);
    label.appendChild(logout);
  }

  _showCtx(x, y){
    if (!this.ctx) return;
    const { el, hintEl, btnCreate } = this.ctx;

    const sel = this.selection || this.lastSelection || this._getDefaultCreateSelection();

    hintEl.textContent = `${fmtTime(sel.start)}–${fmtTime(sel.end)}`;
    btnCreate.disabled = false;
    btnCreate.style.opacity = "1";

    const margin = 8;
    el.style.display = "block";
    const rect = el.getBoundingClientRect();
    let left = x, top = y;
    if (left + rect.width > window.innerWidth - margin) left = window.innerWidth - rect.width - margin;
    if (top + rect.height > window.innerHeight - margin) top = window.innerHeight - rect.height - margin;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }

  _hideCtx(){
    if (!this.ctx) return;
    this.ctx.el.style.display = "none";
  }

  getCalendar(){ return this.calendar; }

  setLoginButtonText(text){
    this._loginBtnText = String(text ?? "Логін");
    this._syncLoginButtonDom();
  }

  setEvents(events){
    this.calendar.batchRendering(() => {
      this.calendar.getEvents().forEach(e => e.remove());
      events.forEach(e => this.calendar.addEvent(e));
    });
  }

  unselect(){
    this.selection = null;
    this.calendar.unselect();
    this._hideCtx();
  }
}

