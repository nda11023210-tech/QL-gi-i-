/* Quản lý giải đấu — giao diện & chức năng. Dữ liệu lưu trong trình duyệt (localStorage). */
(() => {
"use strict";

/* =====================================================================
   TIỆN ÍCH
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const pad = n => String(n).padStart(2, "0");
const dm = s => { if (!s) return "—"; const d = L.parseISO(s); return pad(d.getDate()) + "." + pad(d.getMonth() + 1); };
const dmy = s => { if (!s) return "—"; const d = L.parseISO(s); return dm(s) + "." + d.getFullYear(); };
const range = (a, b) => dm(a) + " - " + dmy(b);
const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const slug = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

function shade(hex, p) {
  const n = parseInt(String(hex || "#888888").slice(1), 16), c = [n >> 16, n >> 8 & 255, n & 255];
  return "#" + c.map(v => Math.max(0, Math.min(255, Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p))).toString(16).padStart(2, "0")).join("");
}
function isLight(hex) {
  const n = parseInt(String(hex || "#000000").slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 170;
}

function toast(msg, type = "ok", action) {
  const ic = { ok: "fa-circle-check", err: "fa-triangle-exclamation", info: "fa-circle-info" }[type];
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.innerHTML = `<i class="fa-solid ${ic}"></i><span>${esc(msg)}</span>${action ? `<button class="btn b-blue xs">${esc(action.label)}</button>` : ""}`;
  if (action) el.querySelector("button").onclick = () => { el.remove(); action.fn(); };
  $("#toasts").appendChild(el);
  setTimeout(() => { el.classList.add("bye"); setTimeout(() => el.remove(), 300); }, action ? 6000 : 2800);
}

// gợn sóng khi bấm nút
document.addEventListener("pointerdown", e => {
  const b = e.target.closest(".btn,.tab,.icon-btn"); if (!b) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, sp = document.createElement("span");
  sp.className = "ripple";
  sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(b).position === "static") b.style.position = "relative";
  b.style.overflow = "hidden";
  b.appendChild(sp); setTimeout(() => sp.remove(), 650);
});

function pickFiles(accept, multiple) {
  return new Promise(res => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = accept; i.multiple = !!multiple;
    i.onchange = () => res([...i.files]);
    i.click();
  });
}
// đọc ảnh và thu nhỏ để vừa bộ nhớ trình duyệt
function readImage(file, max, type = "image/png", q = 0.9) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL(type, q));
      };
      img.onerror = rej; img.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

/* =====================================================================
   DỮ LIỆU
   ===================================================================== */
const KEY = "qlgd-v1";
const DEMO_TEAMS = [
  ["A1", "FC Xóm Trung", "#facc15"], ["A2", "FC Xóm Chính", "#ef4444"], ["A3", "FC Xóm Tây", "#2563eb"], ["A4", "FC Xóm Đông", "#f1f5f9"],
  ["A5", "FC 12Ha", "#3b82f6"], ["A6", "FC Túc Tác", "#f97316"], ["A7", "FC Vui Vẻ", "#78716c"], ["A8", "FC Rượu Cần", "#2563eb"],
  ["A9", "FC Bắc Nghệ", "#f4511e"], ["A10", "FC Liên Quân", "#1d4ed8"], ["A11", "FC 2K", "#22c55e"], ["A12", "FC Lão Tướng", "#7c3aed"],
  ["A13", "FC Trẻ", "#f9a8d4"], ["A14", "FC 8X", "#dc2626"], ["A15", "FC 9X", "#eab308"], ["A16", "FC FairPlay", "#2563eb"]
];

function newTournament(name, demo) {
  const T = {
    id: L.uid(), name: name || "Giải đấu mới", start: "2026-09-12", end: "2026-10-26",
    venue: "", slogan: "", banner: "", logo: "",
    teams: [], groups: [], matches: [], koOrder: [], news: [], gallery: [], bans: [],
    format: { type: "groups", groups: 4, advance: 2, random: true, drawMethod: "random", third: false, rrSize: 4 },
    sched: { start: "2026-09-12", end: "2026-10-26", pitches: 2, perDay: 4, time: "15:30", gap: 90,
      balance: true, noBackToBack: true, avoidSameGroup: true, orderByCode: true },
    settings: { win: 3, draw: 1, loss: 0, yellowBan: 2, yellowBanGames: 1, redBanGames: 1 }
  };
  if (demo) {
    T.name = "Giải bóng đá phủi Lũng Giang Cup 2026";
    T.venue = "Sân bóng Makadala 12Ha - Phương Liễu - Bắc Ninh";
    T.slogan = "Kết nối đam mê - Lan tỏa phong trào";
    T.teams = DEMO_TEAMS.map(([code, n, color]) => ({ id: L.uid(), code, name: n, color, region: "", logo: "", players: [] }));
    T.format.random = false;
    T.groups = L.draw(T);
    T.format.random = true;
    buildSchedule(T);
    T.news.push({ id: L.uid(), date: "2026-09-01", title: "Khai mạc giải đấu", body: "Lễ khai mạc diễn ra lúc 15:00 ngày 12.09 tại sân Makadala 12Ha. Mời các đội có mặt trước 30 phút." });
  }
  return T;
}

let DB;
try { DB = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { DB = null; }
if (!DB || !DB.list || !DB.list.length) { const t = newTournament("", true); DB = { current: t.id, list: [t] }; }
if (!DB.list.some(t => t.id === DB.current)) DB.current = DB.list[0].id;
// bổ sung trường mới cho dữ liệu cũ
function migrate(t) {
  const b = newTournament(t.name);
  ["logo", "banner", "venue", "slogan"].forEach(k => { if (t[k] == null) t[k] = ""; });
  ["bans", "news", "gallery", "koOrder", "groups", "matches", "teams"].forEach(k => { if (!Array.isArray(t[k])) t[k] = []; });
  t.settings = Object.assign(b.settings, t.settings); t.sched = Object.assign(b.sched, t.sched); t.format = Object.assign(b.format, t.format);
  return t;
}
DB.list.forEach(migrate);
if (!Array.isArray(DB.users) || !DB.users.length) DB.users = [{ id: "admin", name: DB.admin || "Admin", role: "admin", pin: "" }];
if (!DB.users.some(u => u.id === DB.user)) DB.user = DB.users[0].id;
DB.theme = DB.theme || "#1f6bff"; DB.orgName = DB.orgName || ""; DB.orgLogo = DB.orgLogo || "";

const T = () => DB.list.find(t => t.id === DB.current);

/* ---------- tài khoản & phân quyền ----------
   Lưu ý: chỉ là phân quyền trên máy này (dữ liệu nằm trong trình duyệt), không thay cho đăng nhập máy chủ. */
const ROLES = { admin: "Quản trị viên", editor: "Ban tổ chức", scorer: "Thư ký trận đấu", viewer: "Chỉ xem" };
const ROLE_DESC = { admin: "Toàn quyền, kể cả cài đặt, tài khoản, xóa dữ liệu", editor: "Quản lý giải, đội, lịch, kết quả, truyền thông", scorer: "Chỉ nhập kết quả, bàn thắng, thẻ phạt", viewer: "Chỉ xem, không sửa được gì" };
const me = () => DB.users.find(u => u.id === DB.user) || DB.users[0];
function can(p) {
  const r = me().role;
  if (r === "admin") return true;
  if (r === "editor") return p !== "admin";
  if (r === "scorer") return p === "results";
  return false;
}
function deny(p) { if (can(p)) return false; toast(`Tài khoản "${ROLES[me().role]}" không có quyền làm việc này`, "err"); return true; }
let quotaWarned = false;
function saveDB() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); quotaWarned = false; }
  catch (e) { if (!quotaWarned) toast("Bộ nhớ trình duyệt đã đầy — hãy xóa bớt ảnh hoặc dùng ảnh nhỏ hơn", "err"); quotaWarned = true; }
}
function resolveAll(t) { for (let i = 0; i < 7; i++) L.resolve(t); } // lặp để lan kết quả qua nhiều vòng knock-out
function commit() { resolveAll(T()); saveDB(); autoSnapshot(); render(); }

/* ---------- sao lưu tự động (IndexedDB, giữ 15 bản gần nhất) ---------- */
const SNAP_DB = "qlgd-backup", SNAP_KEEP = 15, SNAP_EVERY = 5 * 60 * 1000;
function idb() {
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error("Trình duyệt không hỗ trợ"));
    const r = indexedDB.open(SNAP_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("snaps", { keyPath: "at" });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function snapshot(reason) {
  try {
    const db = await idb(), tx = db.transaction("snaps", "readwrite"), st = tx.objectStore("snaps");
    st.put({ at: Date.now(), reason, names: DB.list.map(t => t.name).join(", "), data: JSON.stringify(DB) });
    const keys = await new Promise(r => { const q = st.getAllKeys(); q.onsuccess = () => r(q.result); });
    keys.sort((a, b) => a - b).slice(0, Math.max(0, keys.length - SNAP_KEEP)).forEach(k => st.delete(k));
    await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
    DB.lastSnap = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {}
  } catch (e) { /* trình duyệt chặn IndexedDB: bỏ qua, vẫn còn sao lưu thủ công */ }
}
async function listSnapshots() {
  try {
    const db = await idb();
    return await new Promise(r => { const q = db.transaction("snaps").objectStore("snaps").getAll(); q.onsuccess = () => r(q.result.sort((a, b) => b.at - a.at)); q.onerror = () => r([]); });
  } catch (e) { return []; }
}
function autoSnapshot() { if (!DB.lastSnap || Date.now() - DB.lastSnap > SNAP_EVERY) snapshot("Tự động"); }

const team = id => T().teams.find(t => t.id === id);
const logoCache = {};
function defaultLogo(t) {
  const k = t.code + t.color + t.name;
  if (logoCache[k]) return logoCache[k];
  const c = t.color || "#1f6bff", fg = isLight(c) ? "#0b1a3a" : "#fff", txt = esc(String(t.code || "?").slice(0, 3));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${shade(c, .25)}"/><stop offset="1" stop-color="${shade(c, -.3)}"/></linearGradient></defs>
    <path d="M50 4 L90 16 V48 C90 74 70 90 50 97 C30 90 10 74 10 48 V16 Z" fill="url(#g)" stroke="#fff" stroke-width="5"/>
    <path d="M50 14 L80 23 V48 C80 66 66 79 50 86" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="3"/>
    <text x="50" y="62" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="${txt.length > 2 ? 26 : 32}" fill="${fg}">${txt}</text></svg>`;
  return (logoCache[k] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
}
const logoOf = t => t ? (t.logo || defaultLogo(t)) : "";
const sortedTeams = () => T().teams.slice().sort(L.byCode);

function slotName(m, side) {
  const id = side === "home" ? m.home : m.away, t = id && team(id);
  if (t) return t.code + " - " + t.name;
  return m.src ? L.srcLabel(T(), m.src[side]) : "Chưa xác định";
}
function teamCell(m, side, plain) {
  const id = side === "home" ? m.home : m.away, t = id && team(id);
  if (!t) return `<div class="team-cell"><i class="fa-regular fa-circle-question" style="width:24px;text-align:center;color:var(--dim)"></i><span class="muted">${esc(slotName(m, side))}</span></div>`;
  return `<div class="team-cell"><img class="logo" src="${logoOf(t)}" alt=""><span>${esc(plain ? t.name : t.code + " - " + t.name)}</span></div>`;
}
const visibleMatches = () => T().matches.filter(m => !m.bye)
  .slice().sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "").localeCompare(b.time || "") || a.pitch - b.pitch);

/* =====================================================================
   XẾP LỊCH
   ===================================================================== */
function buildSchedule(t) {
  if (t.format.type !== "ko" && !t.groups.length) t.groups = L.draw(t);
  if (t.format.type === "ko" && (!t.koOrder || !t.koOrder.length)) L.draw(t);
  const phases = L.buildPhases(t);
  const last = L.assignDates(phases, t.sched);
  t.matches = phases.flat();
  resolveAll(t);
  t.matches.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "").localeCompare(b.time || "") || a.pitch - b.pitch);
  return last;
}

/* =====================================================================
   HỘP THOẠI
   ===================================================================== */
let modalClose = null;
function openModal({ title, body, foot = "", wide = false, onMount }) {
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
    <div class="modal-h"><h3>${title}</h3><button class="icon-btn ghost" data-close aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button></div>
    <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ""}</div>`;
  root.classList.add("open");
  const close = () => { root.classList.remove("open"); root.innerHTML = ""; modalClose = null; };
  modalClose = close;
  root.onclick = e => { if (e.target === root || e.target.closest("[data-close]")) close(); };
  if (onMount) onMount(root.querySelector(".modal"), close);
  return close;
}
function ask(title, msg, okLabel = "Đồng ý", danger = true) {
  return new Promise(res => {
    let done = false;
    openModal({
      title, body: `<p style="margin:0;line-height:1.6">${msg}</p>`,
      foot: `<button class="btn b-ghost" data-close>Hủy</button><button class="btn ${danger ? "b-red" : "b-blue"}" data-ok>${okLabel}</button>`,
      onMount: (m, close) => {
        m.querySelector("[data-ok]").onclick = () => { done = true; close(); res(true); };
        const obs = new MutationObserver(() => { if (!$("#modalRoot").classList.contains("open")) { obs.disconnect(); if (!done) res(false); } });
        obs.observe($("#modalRoot"), { attributes: true });
      }
    });
  });
}
function lightbox(src) { openModal({ title: "Xem ảnh", wide: true, body: `<div class="lightbox"><img src="${src}" alt=""></div>` }); }
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (modalClose) modalClose(); else if (!$("#tv").hidden) closeTV(); } });

/* =====================================================================
   GIAO DIỆN CHÍNH
   ===================================================================== */
const NAV = [
  ["overview", "fa-house", "Tổng quan"], ["info", "fa-futbol", "Thông tin giải đấu"], ["teams", "fa-shield-halved", "Đội bóng"],
  ["format", "fa-calendar-days", "Hình thức & Lịch thi đấu"], ["results", "fa-flag-checkered", "Kết quả thi đấu"],
  ["standings", "fa-ranking-star", "Bảng xếp hạng"], ["players", "fa-person-running", "Thống kê cá nhân"],
  ["cards", "fa-clone", "Thẻ phạt"], ["media", "fa-bullhorn", "Truyền thông"], ["poster", "fa-image", "Poster & Ảnh"],
  ["public", "fa-globe", "Giao diện công khai"], ["export", "fa-file-arrow-down", "Xuất dữ liệu & Sao lưu"]
];
const ui = { view: "overview", schedTab: "all", editSched: false, stdGroup: null, tourMenu: false, animDraw: false, poster: { kind: "match", match: "", date: "" }, media: { kind: "schedule", date: "" } };
try { const v = localStorage.getItem(KEY + ":view"); if (v && NAV.some(n => n[0] === v) || v === "settings") ui.view = v; } catch (e) {}

function render() {
  const t = T();
  document.title = t.name + " — Quản lý giải đấu";
  $("#tourPicker").innerHTML = `<button class="tour-btn" data-act="tourMenu"><span>${esc(t.name)}</span><i class="fa-solid fa-chevron-down"></i></button>
    ${ui.tourMenu ? `<div class="tour-menu">${DB.list.map(x => `<button data-act="switchTour" data-id="${x.id}" class="${x.id === t.id ? "on" : ""}"><i class="fa-solid fa-trophy"></i>${esc(x.name)}</button>`).join("")}
      <hr><button data-act="newTour"><i class="fa-solid fa-plus"></i>Tạo giải đấu mới</button>
      <button data-act="dupTour"><i class="fa-regular fa-copy"></i>Nhân bản giải này</button>
      ${DB.list.length > 1 ? `<button data-act="delTour" style="color:#ff8d9c"><i class="fa-solid fa-trash"></i>Xóa giải này</button>` : ""}</div>` : ""}`;
  $("#topMeta").innerHTML = `<i class="fa-regular fa-calendar-days"></i><div><b>${range(t.start, t.end)}</b><br>${esc((t.venue || "Chưa có địa điểm").split(" - ")[0])}</div>`;
  const u = me();
  $("#adminBox").innerHTML = `<button class="user-btn" data-act="userMenu" title="Đổi tài khoản"><div class="avatar">${esc(u.name.trim().charAt(0).toUpperCase() || "?")}</div><div><b>${esc(u.name)}</b><span>${ROLES[u.role]}</span></div><i class="fa-solid fa-chevron-down small muted"></i></button>`;
  $("#brand").innerHTML = `<div class="brand-cup">${DB.orgLogo ? `<img src="${DB.orgLogo}" alt="">` : `<i class="fa-solid fa-trophy"></i>`}</div>
    <div class="brand-text"><b>${esc(DB.orgName || "QUẢN LÝ GIẢI ĐẤU")}</b><span>FOOTBALL TOURNAMENT MANAGER</span></div>`;
  applyTheme();
  document.body.classList.toggle("ro", !can("manage"));
  $("#sidebar").innerHTML = NAV.map(([k, ic, lab]) => `<button class="nav ${ui.view === k ? "on" : ""}" data-act="go" data-view="${k}" title="${lab}"><i class="fa-solid ${ic}"></i><span>${lab}</span></button>`).join("")
    + `<button class="nav nav-bottom ${ui.view === "settings" ? "on" : ""}" data-act="go" data-view="settings" title="Cài đặt"><i class="fa-solid fa-gear"></i><span>Cài đặt</span></button>`;
  const V = VIEWS[ui.view] || VIEWS.overview;
  $("#view").innerHTML = V();
  ui.animDraw = false;
  if (ui.view === "poster") drawPoster();
  if (ui.view === "public") { const f = $("#pubFrame"); if (f) f.srcdoc = PublicPage.build(publicData()); }
  if (ui.view === "export") fillSnapshots();
}

function title(h, p, actions = "") {
  return `<div class="view-title"><div><h1>${h}</h1>${p ? `<p>${p}</p>` : ""}</div>${actions ? `<div class="sp">${actions}</div>` : ""}</div>`;
}
function card(cls, h, body, acts = "", flush = false) {
  return `<section class="card ${cls}"><div class="card-h"><h2>${h}</h2>${acts ? `<div class="acts">${acts}</div>` : ""}</div><div class="card-b ${flush ? "flush" : ""}">${body}</div></section>`;
}

/* ---------- 0. banner lớn ---------- */
function heroParts(name) {
  let n = String(name).trim(), year = "";
  const m = n.match(/^(.*?)[\s-]*((?:19|20)\d{2})$/); if (m) { n = m[1]; year = m[2]; }
  const w = n.split(/\s+/).filter(Boolean), ci = w.findIndex(x => /^cup$/i.test(x));
  let big, small;
  if (ci >= 1) { const s = Math.max(0, ci - 2); big = w.slice(s, ci + 1); small = w.slice(0, s).concat(w.slice(ci + 1)); }
  else if (w.length >= 4) { big = w.slice(-2); small = w.slice(0, -2); }
  else { big = w; small = []; }
  return { small: small.join(" "), big: big.join(" "), year };
}
function cardHero(cls = "a-hero") {
  const t = T(), h = heroParts(t.name);
  const sparks = Array.from({ length: 14 }, (_, i) => `<i class="spark" style="left:${(i * 37) % 100}%;top:${(i * 23) % 60}%;animation-delay:${(i % 5) * .4}s"></i>`).join("");
  return `<section class="card hero ${cls} ${t.banner ? "has-img" : ""}" ${t.banner ? `style="background-image:url('${t.banner}')"` : ""}>
    ${t.banner ? "" : `<div class="hero-art"><i class="beam b1"></i><i class="beam b2"></i>${sparks}<i class="fa-solid fa-futbol ball"></i>${t.logo ? `<img class="cup cup-img" src="${t.logo}" alt="">` : `<i class="fa-solid fa-trophy cup"></i>`}</div>`}
    <div class="hero-text">${h.small ? `<div class="hero-small">${esc(h.small)}</div>` : ""}<div class="hero-big">${esc(h.big)}</div>
      ${h.year ? `<div class="hero-year">${h.year}</div>` : ""}${t.slogan ? `<div class="hero-slogan">${esc(t.slogan)}</div>` : ""}</div>
    <div class="hero-bar"><span><i class="fa-regular fa-calendar-days"></i>${range(t.start, t.end)}</span>
      <span><i class="fa-solid fa-location-dot"></i>${esc(t.venue || "Chưa có địa điểm")}</span>
      <span><i class="fa-solid fa-users"></i>${t.teams.length} đội bóng</span></div>
  </section>`;
}

/* ---------- 1. thông tin ---------- */
function cardInfo(cls = "a-info") {
  const t = T();
  return card(cls, `<span class="n">1.</span>Thông tin giải đấu`, `<div class="stack">
    <div class="f"><label>Tên giải đấu <em>*</em></label><input class="in" data-bind="name" value="${esc(t.name)}"></div>
    <div class="f"><label>Thời gian <em>*</em></label><div class="row c2"><input class="in" type="date" data-bind="start" value="${t.start}"><input class="in" type="date" data-bind="end" value="${t.end}"></div></div>
    <div class="f"><label>Địa điểm <em>*</em></label><input class="in" data-bind="venue" value="${esc(t.venue)}" placeholder="Sân bóng..."></div>
    <div class="f"><label>Slogan</label><input class="in" data-bind="slogan" value="${esc(t.slogan)}" placeholder="Khẩu hiệu của giải"></div>
    <div class="f"><label>Logo giải</label><div class="hstack"><img src="${t.logo || defaultLogo({ code: "CUP", color: "#f7b924", name: "" })}" class="logo lg" alt="">
      <button class="btn b-blue xs" data-act="pickTourLogo"><i class="fa-solid fa-upload"></i>Tải logo</button>${t.logo ? `<button class="btn b-ghost xs" data-act="clearTourLogo">Bỏ</button>` : ""}</div></div></div>`);
}
function cardBanner(cls = "a-ban") {
  const t = T();
  return card(cls, "Banner giải đấu", `<div class="stack">
    <div class="banner-box" data-act="viewBanner">${t.banner ? `<img src="${t.banner}" alt="Banner">` : `<div class="banner-ph"><div><i class="fa-solid fa-trophy"></i>${esc(heroParts(t.name).big)}<br><small class="muted" style="font-size:12px;font-family:'Be Vietnam Pro'">Chưa có ảnh banner</small></div></div>`}</div>
    <div class="row c2"><button class="btn b-blue sm" data-act="pickBanner"><i class="fa-solid fa-camera-rotate"></i>Thay ảnh</button>
      ${t.banner ? `<button class="btn b-green sm" data-act="viewBanner"><i class="fa-solid fa-up-right-and-down-left-from-center"></i>Xem lớn</button>` : `<button class="btn b-ghost sm" disabled><i class="fa-regular fa-image"></i>Xem lớn</button>`}</div>
    ${t.banner ? `<button class="btn b-ghost xs" data-act="clearBanner"><i class="fa-solid fa-rotate-left"></i>Bỏ ảnh, dùng banner tự vẽ</button>` : ""}</div>`);
}

/* ---------- 2. đội bóng ---------- */
function cardTeams(cls = "a-teams", full = false) {
  const ts = sortedTeams();
  const rows = ts.map(t => `<tr>
      <td class="c b">${esc(t.code)}</td><td class="c"><img class="logo" src="${logoOf(t)}" alt=""></td><td>${esc(t.name)}</td>
      <td class="c"><i class="fa-solid fa-shirt shirt" style="color:${esc(t.color)}"></i></td>
      ${full ? `<td>${esc(t.region || "—")}</td><td class="c">${(t.players || []).length}</td><td>${esc(groupOf(t.id) || "—")}</td>` : ""}
      <td class="c"><button class="icon-btn" data-act="editTeam" data-id="${t.id}" title="Sửa"><i class="fa-solid fa-pen"></i></button></td>
      <td class="c"><button class="icon-btn red" data-act="delTeam" data-id="${t.id}" title="Xóa"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("");
  return card(cls, `<span class="n">2.</span>Danh sách đội bóng`,
    `<div class="hstack" style="margin-bottom:10px"><button class="btn b-blue sm" data-act="addTeam"><i class="fa-solid fa-plus"></i>Thêm đội</button>
      <button class="btn b-green sm" data-act="importExcel"><i class="fa-solid fa-file-excel"></i>Nhập Excel</button>
      <button class="btn b-red sm" data-act="delAllTeams"><i class="fa-solid fa-xmark"></i>Xóa tất cả</button></div>
    ${ts.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c">Mã đội</th><th class="c">Logo</th><th>Tên đội bóng</th><th class="c">Màu áo</th>
      ${full ? "<th>Khu vực</th><th class='c'>Cầu thủ</th><th>Bảng</th>" : ""}<th class="c">Sửa</th><th class="c">Xóa</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><i class="fa-solid fa-people-group"></i>Chưa có đội nào. Bấm "Thêm đội" hoặc "Nhập Excel".</div>`}`);
}
function groupOf(id) { const g = T().groups.find(g => g.teamIds.includes(id)); return g ? (g.name === "Chung" ? "Vòng tròn" : "Bảng " + g.name) : ""; }

/* ---------- 3. hình thức ---------- */
function cardFormat(cls = "a-fmt") {
  const t = T(), f = t.format, N = t.teams.length, G = +f.groups || 1;
  const types = [["rr", "Vòng tròn"], ["groups", "Vòng bảng + Knock-out"], ["ko", "Loại trực tiếp"], ["custom", "Tùy chỉnh"]];
  const usesGroups = f.type === "groups" || f.type === "custom";
  const per = Math.ceil(N / G) || 0;
  const rrSize = +f.rrSize || 0, rrSplit = f.type === "rr" && rrSize > 0 && N > rrSize;
  const rrGroups = rrSplit ? Math.ceil(N / rrSize) : 1, rrPer = rrSplit ? rrSize : N;
  let groupView;
  if (f.type === "ko") {
    const order = (t.koOrder && t.koOrder.length === N ? t.koOrder : sortedTeams().map(x => x.id)).map(team).filter(Boolean);
    groupView = order.length ? `<div class="groups ${ui.animDraw ? "draw-anim" : ""}" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">${pairsPreview(order)}</div>` : `<div class="empty">Chưa có đội</div>`;
  } else if (!t.groups.length) groupView = `<div class="empty small"><i class="fa-solid fa-shuffle"></i>Chưa chia bảng</div>`;
  else groupView = `<div class="groups ${ui.animDraw ? "draw-anim" : ""}">${t.groups.map((g, gi) => `<div class="gbox gc${gi % 8}"><h4>${g.name === "Chung" ? "Vòng tròn" : "Bảng " + g.name}</h4>
      <ul>${g.teamIds.map((id, i) => { const x = team(id); return x ? `<li style="animation-delay:${(i * t.groups.length + gi) * 45}ms" title="${esc(x.name)}">${esc(x.code)}</li>` : ""; }).join("")}</ul></div>`).join("")}</div>`;

  const manual = f.type === "custom" && t.groups.length ? `<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Chuyển đội giữa các bảng</summary>
      <div class="row c2" style="margin-top:8px">${sortedTeams().map(x => `<label class="hstack small"><span style="width:44px" class="b">${esc(x.code)}</span>
        <select class="in" style="padding:5px 26px 5px 8px" data-act-change="moveTeam" data-id="${x.id}">${t.groups.map(g => `<option value="${g.name}" ${g.teamIds.includes(x.id) ? "selected" : ""}>Bảng ${g.name}</option>`).join("")}</select></label>`).join("")}</div></details>` : "";

  return card(cls, `<span class="n">3.</span>Hình thức thi đấu`, `
    <div class="fmt-tabs">${types.map(([k, l]) => `<button class="tab ${f.type === k ? "on" : ""}" data-act="fmtType" data-type="${k}">${l}</button>`).join("")}</div>
    <div class="fmt-row">
      <div class="f"><label>Số đội tham gia</label><div class="in readonly"><b>${N}</b><span class="small muted">đội</span></div></div>
      ${usesGroups ? `<div class="f"><label>Số bảng</label><div class="seg">${[1, 2, 4, 8].map(n => `<button class="${G === n ? "on" : ""}" data-act="groupsN" data-n="${n}" ${n > Math.max(1, N) ? "disabled" : ""}>${n}</button>`).join("")}</div></div>
        <div class="f"><label>Số đội mỗi bảng</label><select class="in" data-act-change="perGroup">${[2, 3, 4, 5, 6, 8].map(n => `<option value="${n}" ${per === n ? "selected" : ""}>${n}</option>`).join("")}${[2, 3, 4, 5, 6, 8].includes(per) ? "" : `<option selected>${per}</option>`}</select></div>`
      : f.type === "rr" ? `<div class="f"><label>Số đội mỗi bảng</label><select class="in" data-act-change="rrSize">
          <option value="0" ${!rrSize ? "selected" : ""}>Tất cả chung 1 bảng</option>${[3, 4, 5, 6, 8].map(n => `<option value="${n}" ${rrSize === n ? "selected" : ""}>${n} đội / bảng</option>`).join("")}</select></div>
        <div class="f"><label>Kết quả</label><div class="in readonly"><b>${rrGroups} bảng</b><span class="small muted">mỗi đội đá ${Math.max(0, rrPer - 1)} trận</span></div></div>`
      : `<div class="f"><label>Số vòng đấu</label><div class="in readonly"><b>${Math.ceil(Math.log2(Math.max(2, N)))}</b><span class="small muted">vòng</span></div></div>`}
    </div>
    ${f.type === "rr" ? `<p class="small muted" style="margin:-4px 0 12px">${rrSplit
      ? `Chia ${N} đội thành ${rrGroups} bảng (khoảng ${rrSize} đội/bảng), các đội trong cùng bảng đá vòng tròn với nhau — tổng ${rrMatches(N, rrGroups)} trận, không có vòng knock-out.`
      : `Tất cả ${N} đội đá vòng tròn với nhau — tổng ${N * (N - 1) / 2} trận.`}</p>` : ""}
    <div class="fmt-cols">
      <div class="stack">
        <label class="chk between"><span>Bốc thăm ngẫu nhiên theo mã đội</span><input type="checkbox" class="switch" data-bind="format.random" ${f.random ? "checked" : ""}></label>
        ${usesGroups || rrSplit ? `<div class="lbl">Cách bốc thăm</div>
          ${[["random", "Ngẫu nhiên hoàn toàn"], ["seed", "Theo hạt giống (mã đội)"], ["region", "Theo khu vực / địa phương"]].map(([k, l]) =>
            `<label class="chk"><input type="radio" name="dm" data-bind="format.drawMethod" value="${k}" ${f.drawMethod === k ? "checked" : ""} ${f.random ? "" : "disabled"}>${l}</label>`).join("")}` : ""}
        ${usesGroups ? `<div class="f"><label>Số đội đi tiếp mỗi bảng</label><div class="seg">${[0, 1, 2].map(n => `<button class="${+f.advance === n ? "on" : ""}" data-act="advanceN" data-n="${n}">${n === 0 ? "Không" : n}</button>`).join("")}</div></div>` : ""}
        ${f.type !== "rr" ? `<label class="chk"><input type="checkbox" data-bind="format.third" ${f.third ? "checked" : ""}>Có trận tranh hạng 3</label>` : ""}
      </div>
      <div class="stack">
        <button class="btn b-blue" data-act="drawGroups"><i class="fa-solid fa-shuffle"></i>${f.type === "ko" ? "Bốc thăm cặp đấu" : f.type === "rr" ? "Lập danh sách vòng tròn" : "Tạo chia bảng ngẫu nhiên"}</button>
        <div class="lbl">${f.type === "ko" ? "Cặp đấu vòng đầu" : "Kết quả chia bảng"}</div>${groupView}${manual}
      </div>
    </div>
    <div style="margin-top:12px"><button class="btn b-green lg" data-act="autoAll"><i class="fa-solid fa-wand-magic-sparkles"></i>Tạo bảng & lịch thi đấu tự động</button></div>`);
}
// tổng số trận khi chia N đội đều vào G bảng, mỗi bảng đá vòng tròn
function rrMatches(N, G) {
  let s = 0;
  for (let g = 0; g < G; g++) { const n = Math.floor(N / G) + (g < N % G ? 1 : 0); s += n * (n - 1) / 2; }
  return s;
}
function pairsPreview(order) {
  let size = 1; while (size < order.length) size *= 2;
  const slots = order.concat(Array(size - order.length).fill(null)), out = [];
  for (let i = 0; i < size / 2; i++) {
    const a = slots[i], b = slots[size - 1 - i];
    out.push(`<div class="gbox gc${i % 8}"><h4>Cặp ${i + 1}</h4><ul><li style="animation-delay:${i * 60}ms">${esc(a.code)} ${esc(a.name)}</li><li class="muted" style="font-weight:500">vs</li><li style="animation-delay:${i * 60 + 30}ms">${b ? esc(b.code) + " " + esc(b.name) : "<span class='muted'>Miễn đấu</span>"}</li></ul></div>`);
  }
  return out.join("");
}

/* ---------- 4. thiết lập lịch ---------- */
function cardSchedSettings(cls = "a-set") {
  const s = T().sched;
  const opt = (arr, v, f = x => x) => arr.map(x => `<option value="${x}" ${+v === x ? "selected" : ""}>${f(x)}</option>`).join("");
  return card(cls, `<span class="n">4.</span>Thiết lập lịch thi đấu`, `<div class="stack">
    <div class="row c3">
      <div class="f"><label>Ngày bắt đầu</label><input class="in" type="date" data-bind="sched.start" value="${s.start}"></div>
      <div class="f"><label>Ngày kết thúc</label><input class="in" type="date" data-bind="sched.end" value="${s.end}"></div>
      <div class="f"><label>Số sân thi đấu</label><select class="in" data-bind="sched.pitches" data-type="num">${opt([1, 2, 3, 4, 5, 6], s.pitches)}</select></div>
      <div class="f"><label>Số trận mỗi ngày</label><select class="in" data-bind="sched.perDay" data-type="num">${opt([1, 2, 3, 4, 5, 6, 8, 10, 12, 16], s.perDay)}</select></div>
      <div class="f"><label>Giờ bắt đầu</label><input class="in" type="time" data-bind="sched.time" value="${s.time}"></div>
      <div class="f"><label>Cách nhau giữa các trận (phút)</label><select class="in" data-bind="sched.gap" data-type="num">${opt([30, 45, 60, 70, 75, 80, 90, 100, 105, 120], s.gap)}</select></div>
    </div>
    <div>
      <label class="chk"><input type="checkbox" data-bind="sched.balance" ${s.balance ? "checked" : ""}>Tự động sắp xếp lịch (ưu tiên cân bằng)</label>
      <label class="chk"><input type="checkbox" data-bind="sched.noBackToBack" ${s.noBackToBack ? "checked" : ""}>Không để 1 đội đá 2 trận liên tiếp / 2 trận trong 1 ngày</label>
      <label class="chk"><input type="checkbox" data-bind="sched.avoidSameGroup" ${s.avoidSameGroup ? "checked" : ""}>Tránh 2 đội cùng bảng gặp lại sớm ở vòng knock-out</label>
      <label class="chk"><input type="checkbox" data-bind="sched.orderByCode" ${s.orderByCode ? "checked" : ""}>Lịch thi đấu theo thứ tự mã đội (A1 → A${T().teams.length || 16})</label>
    </div>
    <div class="row c2">
      <button class="btn b-purple" data-act="buildSchedule"><i class="fa-solid fa-calendar-plus"></i>Tạo lịch thi đấu</button>
      <button class="btn b-gold" data-act="checkConflicts"><i class="fa-solid fa-magnifying-glass"></i>Kiểm tra trùng lịch</button>
      <button class="btn b-green" data-act="exportSchedXlsx"><i class="fa-solid fa-file-excel"></i>Xuất lịch (Excel)</button>
      <button class="btn b-red" data-act="exportSchedPdf"><i class="fa-solid fa-file-pdf"></i>Xuất lịch (PDF)</button>
    </div></div>`);
}

/* ---------- 5. lịch thi đấu ---------- */
function stageTabs() {
  const st = new Set(T().matches.filter(m => !m.bye).map(m => m.stage));
  const order = ["group", "rr", "r64", "r32", "r16", "qf", "sf", "third", "final"];
  return [["all", "Tất cả"]].concat(order.filter(k => st.has(k)).map(k => [k, L.STAGES[k]]));
}
function conflictMsg(c) {
  const t = c.team && team(c.team), when = `${dm(c.date)} ${c.time || ""}`.trim();
  const nums = c.ids.map(id => visibleMatches().findIndex(m => m.id === id) + 1).filter(Boolean).map(n => "#" + n).join(", ");
  switch (c.kind) {
    case "nodate": return `Trận ${nums} chưa có ngày/giờ thi đấu`;
    case "pitch": return `Trùng sân: trận ${nums} cùng Sân ${c.pitch} lúc ${when}`;
    case "teamTime": return `${t ? t.name : "Một đội"} phải đá 2 trận cùng lúc (${nums}, ${when})`;
    case "teamDay": return `${t ? t.name : "Một đội"} đá 2 trận trong ngày ${dm(c.date)} (${nums})`;
    case "range": return `Trận ${nums} (${dmy(c.date)}) nằm ngoài thời gian giải`;
    case "order": return `Trận ${nums.split(", ")[0]} diễn ra trước/cùng lúc trận nó phụ thuộc (${nums.split(", ")[1] || ""})`;
  }
  return "Lịch có vấn đề";
}
function stageLabel(m) { return m.stage === "group" || (m.stage === "rr" && m.group && m.group !== "Chung") ? "Bảng " + m.group : L.STAGES[m.stage] || m.stage; }
function statusBadge(m) {
  if (m.status === "done") return `<span class="badge done"><i class="fa-solid fa-check"></i>Đã đá</span>`;
  if (m.status === "postponed") return `<span class="badge warn" title="${esc(m.note || "")}"><i class="fa-solid fa-clock-rotate-left"></i>Hoãn</span>`;
  if (m.status === "live") return `<span class="badge live"><i class="fa-solid fa-circle" style="font-size:7px"></i>Đang đá</span>`;
  return `<span class="badge pending">Chưa đấu</span>`;
}
function scoreText(m) {
  if (m.status !== "done" && m.status !== "live") return "VS";
  let s = (m.hs ?? 0) + " - " + (m.as ?? 0);
  if (m.ph != null && m.pa != null && m.ph !== "" && +m.hs === +m.as) s += ` (pen ${m.ph}-${m.pa})`;
  return s;
}
function cardSchedule(cls = "a-sch", mode = "schedule") {
  const tabs = stageTabs();
  if (!tabs.some(x => x[0] === ui.schedTab)) ui.schedTab = "all";
  const all = visibleMatches(), list = all.filter(m => ui.schedTab === "all" || m.stage === ui.schedTab);
  const pitchCount = Math.max(1, +T().sched.pitches || 1);
  const edit = ui.editSched;
  const cf = all.length ? L.conflicts(T()) : [], bad = new Set(cf.flatMap(c => c.ids));
  const alert = cf.length ? `<div class="alert"><i class="fa-solid fa-triangle-exclamation"></i><div><b>Phát hiện ${cf.length} chỗ trùng / sai lịch</b>
      <ul>${cf.slice(0, 6).map(c => `<li>${esc(conflictMsg(c))}</li>`).join("")}${cf.length > 6 ? `<li>… và ${cf.length - 6} chỗ khác</li>` : ""}</ul>
      <small>Các trận lỗi được tô đỏ. Bấm "Sửa lịch" để đổi ngày/giờ/sân.</small></div></div>` : "";
  const rows = list.map(m => {
    const n = all.indexOf(m) + 1;
    const dateCell = edit ? `<input class="in" style="padding:4px 6px;width:130px" type="date" value="${m.date}" data-medit="date" data-id="${m.id}">` : dm(m.date);
    const timeCell = edit ? `<input class="in" style="padding:4px 6px;width:96px" type="time" value="${m.time}" data-medit="time" data-id="${m.id}">` : esc(m.time || "—");
    const pitchCell = edit ? `<select class="in" style="padding:4px 24px 4px 6px" data-medit="pitch" data-id="${m.id}">${Array.from({ length: Math.max(pitchCount, m.pitch) }, (_, i) => `<option value="${i + 1}" ${m.pitch === i + 1 ? "selected" : ""}>Sân ${i + 1}</option>`).join("")}</select>` : "Sân " + m.pitch;
    return `<tr class="${edit ? "" : "clickable"} ${bad.has(m.id) ? "conf" : ""} ${m.status === "postponed" ? "post" : ""}" ${edit ? "" : `data-act="openMatch" data-id="${m.id}"`}>
      <td class="c">${n}</td><td>${dateCell}</td><td>${timeCell}</td><td>${pitchCell}</td><td>${esc(stageLabel(m))}</td>
      <td>${teamCell(m, "home")}</td><td class="vs">${m.status === "pending" || m.status === "postponed" ? "VS" : `<span class="score-pill">${scoreText(m)}</span>`}</td><td>${teamCell(m, "away")}</td>
      <td class="c">${statusBadge(m)}</td></tr>`;
  }).join("");
  const acts = `<button class="btn ${edit ? "b-gold" : "b-ghost"} xs" data-act="toggleEditSched"><i class="fa-solid ${edit ? "fa-check" : "fa-pen-to-square"}"></i>${edit ? "Xong" : "Sửa lịch"}</button>
    <button class="btn b-green xs" data-act="exportSchedXlsx"><i class="fa-solid fa-file-excel"></i>Xuất Excel</button>
    <button class="btn b-red xs" data-act="exportSchedPdf"><i class="fa-solid fa-file-pdf"></i>Xuất PDF</button>`;
  return card(cls, `<span class="n">5.</span>${mode === "results" ? "Kết quả thi đấu" : "Lịch thi đấu"}`, `
    ${alert}<div class="tabs sm" style="margin-bottom:10px">${tabs.map(([k, l]) => `<button class="tab ${ui.schedTab === k ? "on" : ""}" data-act="schedTab" data-tab="${k}">${l}</button>`).join("")}</div>
    ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c">STT</th><th>Ngày</th><th>Giờ</th><th>Sân</th><th>Vòng</th><th>Đội 1</th><th class="c">VS</th><th>Đội 2</th><th class="c">Trạng thái</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${edit ? "" : `<p class="small muted" style="margin:8px 0 0"><i class="fa-regular fa-hand-pointer"></i> Bấm vào một trận để nhập kết quả, bàn thắng, thẻ phạt.</p>`}`
      : `<div class="empty"><i class="fa-regular fa-calendar-xmark"></i>Chưa có lịch. Vào phần "Hình thức thi đấu" và bấm "Tạo bảng & lịch thi đấu tự động".</div>`}`, acts);
}

/* ---------- 6. bảng xếp hạng ---------- */
function standingTable(gname, compact) {
  const rows = L.standings(T(), gname), adv = (T().format.type === "groups" || T().format.type === "custom") ? +T().format.advance : 0;
  if (!rows.length) return `<div class="empty small">Chưa có đội trong bảng</div>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c">#</th><th>Đội bóng</th><th class="c">ST</th><th class="c">T</th><th class="c">H</th><th class="c">B</th><th class="c">BT</th><th class="c">BB</th><th class="c">HS</th><th class="c">Đ</th>${compact ? "" : "<th>Phong độ</th>"}</tr></thead><tbody>
    ${rows.map((r, i) => { const x = team(r.id); return `<tr class="${i < adv ? "q" : ""}"><td class="c">${i + 1}</td><td><div class="team-cell"><img class="logo" src="${logoOf(x)}" alt=""><span>${esc(x.code + " - " + x.name)}</span></div></td>
      <td class="c">${r.p}</td><td class="c">${r.w}</td><td class="c">${r.d}</td><td class="c">${r.l}</td><td class="c">${r.gf}</td><td class="c">${r.ga}</td><td class="c">${r.gd > 0 ? "+" + r.gd : r.gd}</td><td class="c b">${r.pts}</td>
      ${compact ? "" : `<td>${r.form.slice(-5).map(f => `<span class="badge ${f === "W" ? "done" : f === "L" ? "live" : ""}" style="padding:2px 6px;animation:none">${f === "W" ? "T" : f === "L" ? "B" : "H"}</span>`).join(" ")}</td>`}</tr>`; }).join("")}
    </tbody></table></div>`;
}
function cardStandings(cls = "a-std") {
  const gs = T().groups;
  if (!gs.length) return card(cls, `<span class="n">6.</span>Bảng xếp hạng`, `<div class="empty"><i class="fa-solid fa-ranking-star"></i>${T().format.type === "ko" ? "Thể thức loại trực tiếp — xem nhánh đấu ở mục Bảng xếp hạng." : "Chưa chia bảng."}</div>`);
  if (!gs.some(g => g.name === ui.stdGroup)) ui.stdGroup = gs[0].name;
  const sel = gs.length > 1 ? `<select class="in" style="width:auto;padding:6px 30px 6px 10px" data-act-change="stdGroup">${gs.map(g => `<option value="${g.name}" ${g.name === ui.stdGroup ? "selected" : ""}>Bảng ${g.name}</option>`).join("")}</select>` : "";
  return card(cls, `<span class="n">6.</span>Bảng xếp hạng`, standingTable(ui.stdGroup, true), sel, true);
}

/* ---------- 7, 8. thống kê ---------- */
function cardScorers(cls = "a-gol", limit = 5) {
  const rows = L.playerStats(T()).filter(r => r.goals > 0).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, "vi"));
  const list = limit ? rows.slice(0, limit) : rows;
  return card(cls, `<span class="n">7.</span>Thống kê ghi bàn`, list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c">#</th><th>Cầu thủ</th><th>Đội bóng</th><th class="c">Số bàn</th></tr></thead><tbody>
    ${list.map((r, i) => { const x = team(r.teamId); return `<tr><td class="c">${i + 1}</td><td><div class="team-cell">${i < 3 ? `<i class="fa-solid fa-medal" style="color:${["#f7b924", "#cbd5e1", "#d97706"][i]}"></i>` : ""}<span>${esc(r.name)}</span></div></td>
      <td><div class="team-cell"><img class="logo" src="${logoOf(x)}" alt=""><span>${esc(x ? x.name : "")}</span></div></td><td class="c b">${r.goals}</td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty small"><i class="fa-regular fa-futbol"></i>Chưa có bàn thắng nào được ghi nhận</div>`, "", true);
}
/* thẻ phạt & treo giò */
const matchById = id => T().matches.find(m => m.id === id);
function upcomingBans(r) { return r.bans.filter(b => { const m = matchById(b.matchId); return m && m.status !== "done"; }); }
function isBanned(r) { return upcomingBans(r).length > 0 || r.queue.length > 0; }
function matchShort(m) { if (!m) return ""; return `${dm(m.date)} ${slotName(m, "home").split(" - ").pop()} vs ${slotName(m, "away").split(" - ").pop()}`; }
function banText(r) {
  const up = upcomingBans(r);
  if (up.length) return up.map(b => `${matchShort(matchById(b.matchId))} (${b.reason})`).join("; ");
  if (r.queue.length) return `${r.queue.length} trận tới (${r.queue[0]})`;
  return "";
}
function banBadge(r) {
  const yN = +T().settings.yellowBan || 2;
  if (isBanned(r)) return `<span class="badge live" style="animation:none"><i class="fa-solid fa-ban"></i>Bị cấm thi đấu</span>`;
  if (r.violations.length) return `<span class="badge warn"><i class="fa-solid fa-triangle-exclamation"></i>Đã ra sân khi bị cấm</span>`;
  if (yN > 1 && r.acc === yN - 1) return `<span class="badge warn">Thêm 1 thẻ vàng sẽ bị treo giò</span>`;
  if (r.bans.length) return `<span class="badge done">Đã chấp hành án</span>`;
  return `<span class="badge">Bình thường</span>`;
}
function cardCards(cls = "a-cdx", limit = 5) {
  const rows = L.discipline(T()).filter(r => r.yellow || r.red || r.bans.length || r.queue.length)
    .sort((a, b) => isBanned(b) - isBanned(a) || (b.red * 3 + b.yellow) - (a.red * 3 + a.yellow));
  const list = limit ? rows.slice(0, limit) : rows;
  return card(cls, `<span class="n">8.</span>Thống kê thẻ phạt`, list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c">#</th><th>Cầu thủ</th><th>Đội bóng</th><th class="c">Vàng</th><th class="c">Đỏ</th>${limit ? "" : "<th>Trạng thái</th><th>Trận bị cấm / ghi chú</th>"}</tr></thead><tbody>
    ${list.map((r, i) => { const x = team(r.teamId); return `<tr class="${isBanned(r) ? "banned" : ""}"><td class="c">${i + 1}</td><td>${isBanned(r) ? `<i class="fa-solid fa-ban" style="color:#ff6b7d" title="Bị cấm thi đấu"></i> ` : ""}${esc(r.name)}</td><td><div class="team-cell"><img class="logo" src="${logoOf(x)}" alt=""><span>${esc(x ? x.name : "")}</span></div></td>
      <td class="c"><i class="ev-ico y"></i> ${r.yellow}</td><td class="c"><i class="ev-ico r"></i> ${r.red}</td>
      ${limit ? "" : `<td>${banBadge(r)}</td><td class="small" style="white-space:normal;min-width:220px">${esc(banText(r))}${r.violations.length ? `<br><span style="color:var(--gold)">Ra sân khi đang bị cấm: ${r.violations.map(id => esc(matchShort(matchById(id)))).join("; ")}</span>` : ""}</td>`}</tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty small"><i class="fa-solid fa-clone"></i>Chưa có thẻ phạt nào</div>`, "", true);
}
function cardBans() {
  const t = T(), disc = L.discipline(t), now = disc.filter(isBanned);
  return card("span3", "Cầu thủ đang bị cấm thi đấu", (now.length ? `<div class="ban-list">${now.map(r => { const x = team(r.teamId); return `<div class="ban-item"><img class="logo lg" src="${logoOf(x)}" alt="">
      <div><b>${esc(r.name)}</b> <span class="muted">· ${esc(x ? x.name : "")}</span><br><span class="small">⛔ ${esc(banText(r))}</span></div></div>`; }).join("")}</div>`
      : `<div class="empty small"><i class="fa-solid fa-user-check"></i>Không có cầu thủ nào đang bị treo giò</div>`) +
    `<h3 class="sub-h">Án kỷ luật bổ sung của BTC</h3>${t.bans.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cầu thủ</th><th>Đội</th><th class="c">Số trận</th><th>Từ ngày</th><th>Lý do</th><th></th></tr></thead><tbody>
      ${t.bans.map(b => `<tr><td>${esc(b.player)}</td><td>${esc(team(b.teamId) ? team(b.teamId).name : "")}</td><td class="c">${b.games}</td><td>${dmy(b.from)}</td><td>${esc(b.reason)}</td><td class="c"><button class="icon-btn red" data-act="delBan" data-id="${b.id}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join("")}</tbody></table></div>`
      : `<p class="small muted">Chưa có. Dùng khi BTC phạt thêm (VD: phản ứng trọng tài, đánh nhau...).</p>`}`,
    `<button class="btn b-red xs" data-act="addBan"><i class="fa-solid fa-gavel"></i>Thêm án kỷ luật</button>`);
}
function banModal() {
  const ts = sortedTeams(); if (!ts.length) return toast("Chưa có đội", "err");
  openModal({
    title: "Thêm án kỷ luật",
    body: `<div class="stack"><div class="row c2"><div class="f"><label>Đội</label><select class="in" id="bTeam">${ts.map(x => `<option value="${x.id}">${esc(x.code + " - " + x.name)}</option>`).join("")}</select></div>
      <div class="f"><label>Cầu thủ</label><input class="in" id="bPlayer" list="bList" placeholder="Tên cầu thủ"><datalist id="bList"></datalist></div>
      <div class="f"><label>Số trận bị cấm</label><input class="in" type="number" min="1" id="bGames" value="1"></div>
      <div class="f"><label>Áp dụng từ ngày</label><input class="in" type="date" id="bFrom" value="${L.iso(new Date())}"></div></div>
      <div class="f"><label>Lý do</label><input class="in" id="bReason" placeholder="VD: Phản ứng thô bạo với trọng tài"></div></div>`,
    foot: `<button class="btn b-ghost" data-close>Hủy</button><button class="btn b-red" id="bSave"><i class="fa-solid fa-gavel"></i>Lưu án</button>`,
    onMount: (m, close) => {
      const fill = () => { const x = team($("#bTeam", m).value); $("#bList", m).innerHTML = (x.players || []).map(p => `<option value="${esc(p.name)}">`).join(""); };
      $("#bTeam", m).onchange = fill; fill();
      $("#bSave", m).onclick = () => {
        const b = { id: L.uid(), teamId: $("#bTeam", m).value, player: $("#bPlayer", m).value.trim(), games: Math.max(1, +$("#bGames", m).value || 1), from: $("#bFrom", m).value, reason: $("#bReason", m).value.trim() || "Kỷ luật của BTC" };
        if (!b.player) return toast("Cần nhập tên cầu thủ", "err");
        T().bans.push(b); close(); commit(); toast("Đã thêm án kỷ luật");
      };
    }
  });
}

/* ---------- nhánh knock-out ---------- */
function bracketView() {
  const ko = T().matches.filter(m => m.src && m.stage !== "third");
  if (!ko.length) return `<div class="empty"><i class="fa-solid fa-sitemap"></i>Chưa có vòng knock-out</div>`;
  const order = ["r64", "r32", "r16", "qf", "sf", "final"], third = T().matches.find(m => m.stage === "third");
  const cols = order.filter(s => ko.some(m => m.stage === s)).map(s => `<div class="bcol"><h4>${L.STAGES[s]}</h4>${ko.filter(m => m.stage === s).map(bm).join("")}${s === "final" && third ? `<h4 style="margin-top:14px">${L.STAGES.third}</h4>${bm(third)}` : ""}</div>`);
  return `<div class="bracket">${cols.join("")}</div>`;
  function bm(m) {
    const w = L.winner(m);
    const side = s => { const id = s === "home" ? m.home : m.away, x = id && team(id), sc = s === "home" ? m.hs : m.as;
      return `<div class="bt ${w && w === id ? "win" : ""}">${x ? `<img class="logo" src="${logoOf(x)}" alt=""><span>${esc(x.name)}</span>` : `<span class="ph">${esc(m.src ? L.srcLabel(T(), m.src[s]) : "")}</span>`}<b>${m.status !== "pending" && !m.bye ? esc(sc ?? "") : ""}</b></div>`; };
    return `<div class="bm" ${m.bye ? "" : `data-act="openMatch" data-id="${m.id}"`}>${side("home")}${side("away")}<div class="meta">${m.bye ? "Miễn đấu" : `${dm(m.date)} · ${esc(m.time)} · Sân ${m.pitch}`}</div></div>`;
  }
}

/* =====================================================================
   CÁC TRANG
   ===================================================================== */
/* ---------- quy trình 6 bước ---------- */
function workflowBar() {
  const t = T(), ms = visibleMatches(), done = ms.filter(m => m.status === "done").length, cf = ms.length ? L.conflicts(t).length : 0;
  const steps = [
    ["info", "Tạo giải đấu", "Tên giải · Logo · Thời gian · Sân bóng", t.name && t.venue && t.start && t.end ? "ok" : "todo"],
    ["teams", "Nhập danh sách đội", "Mã đội · Tên đội · Logo · Cầu thủ", t.teams.length >= 2 ? "ok" : "todo"],
    ["format", "Chọn thể thức", "Vòng tròn · Chia bảng · Loại trực tiếp", t.groups.length || (t.format.type === "ko" && t.koOrder.length) || ms.length ? "ok" : "todo"],
    ["format", "Sinh lịch thi đấu", cf ? `Có ${cf} chỗ trùng lịch cần sửa` : "Bốc thăm · Xếp sân · Xếp giờ · Kiểm tra trùng lịch", !ms.length ? "todo" : cf ? "warn" : "ok"],
    ["results", "Nhập kết quả", ms.length ? `Đã nhập ${done}/${ms.length} trận` : "Tỷ số · Bàn thắng · Thẻ phạt", !done ? "todo" : done === ms.length ? "ok" : "doing"],
    ["standings", "Tự động cập nhật", "Bảng xếp hạng · Thống kê · Đội đi tiếp · Poster kết quả", done ? "ok auto" : "todo auto"]
  ];
  const cur = steps.findIndex(s => !s[3].startsWith("ok"));
  return `<div class="workflow">${steps.map(([v, h, p, st], i) => `<button class="wf ${st} ${i === cur ? "cur" : ""}" data-act="go" data-view="${v}">
      <span class="wf-n">${st.startsWith("ok") ? `<i class="fa-solid fa-check"></i>` : st === "warn" ? `<i class="fa-solid fa-exclamation"></i>` : i + 1}</span>
      <span class="wf-t"><b>Bước ${i + 1} — ${h}</b><small>${esc(p)}</small></span></button>`).join(`<i class="fa-solid fa-chevron-right wf-arrow"></i>`)}</div>`;
}

const VIEWS = {
  overview: () => workflowBar() + `<div class="grid-ov">${cardHero()}${cardInfo()}${cardBanner()}${cardTeams()}${cardFormat()}${cardSchedSettings()}${cardSchedule()}${cardStandings()}${cardScorers()}${cardCards()}</div>`,
  info: () => title("Thông tin giải đấu", "Tên, thời gian, địa điểm và banner hiển thị") +
    `<div class="grid3">${cardHero("span3")}${cardInfo("span2")}${cardBanner()}</div>`,
  teams: () => title("Đội bóng", `${T().teams.length} đội · bấm biểu tượng bút để sửa tên, logo, màu áo, danh sách cầu thủ`,
    `<button class="btn b-ghost sm" data-act="sampleExcel"><i class="fa-solid fa-file-arrow-down"></i>Tải file Excel mẫu</button>`) + cardTeams("", true),
  format: () => title("Hình thức & lịch thi đấu") + `<div class="grid2">${cardFormat()}${cardSchedSettings()}${cardSchedule("span3")}</div>`,
  results: () => {
    const ms = visibleMatches(), done = ms.filter(m => m.status === "done").length, goals = ms.reduce((s, m) => s + (m.status === "done" ? (+m.hs || 0) + (+m.as || 0) : 0), 0);
    return title("Kết quả thi đấu", "Bấm vào trận để nhập tỉ số, cầu thủ ghi bàn, thẻ phạt") +
      `<div class="mini-stats">${stat("fa-futbol", ms.length, "Tổng số trận", "#1f6bff")}${stat("fa-circle-check", done, "Đã thi đấu", "#16a34a")}${stat("fa-hourglass-half", ms.length - done, "Còn lại", "#f7b924")}${stat("fa-bullseye", goals, "Bàn thắng", "#e5283f")}</div>` + cardSchedule("", "results");
  },
  standings: () => title("Bảng xếp hạng", "Xanh ở cột # là các đội đang trong nhóm đi tiếp") +
    `<div class="grid2">${T().groups.map(g => card("", g.name === "Chung" ? "Bảng xếp hạng chung" : "Bảng " + g.name, standingTable(g.name, false), "", true)).join("")}
      ${T().matches.some(m => m.src) ? card("span3", "Nhánh đấu knock-out", bracketView()) : ""}
      ${!T().groups.length && !T().matches.some(m => m.src) ? card("span3", "Bảng xếp hạng", `<div class="empty"><i class="fa-solid fa-ranking-star"></i>Chưa có bảng đấu. Hãy tạo lịch ở mục Hình thức & Lịch thi đấu.</div>`) : ""}</div>`,
  players: () => title("Thống kê cá nhân", "Tự cập nhật từ bàn thắng nhập ở mục Kết quả thi đấu") + `<div class="grid2">${cardScorers("", 0)}${cardCards("", 5)}</div>`,
  cards: () => { const s = T().settings; return title("Thẻ phạt & treo giò", `Tích lũy ${s.yellowBan} thẻ vàng → cấm ${s.yellowBanGames} trận · Thẻ đỏ (hoặc 2 vàng/1 trận) → cấm ${s.redBanGames} trận. Đổi quy định ở mục Cài đặt.`) +
    `<div class="grid2">${cardBans()}${cardCards("span3", 0)}</div>`; },
  media: viewMedia,
  poster: viewPoster,
  export: viewExport,
  public: viewPublic,
  settings: viewSettings
};
function stat(ic, n, l, c) { return `<div class="stat"><i class="fa-solid ${ic}" style="color:${c}"></i><div><b>${n}</b><span>${l}</span></div></div>`; }

/* ---------- Truyền thông ---------- */
function viewMedia() {
  const t = T(), dates = [...new Set(visibleMatches().map(m => m.date).filter(Boolean))];
  if (!ui.media.date || !dates.includes(ui.media.date)) ui.media.date = nextDate(dates);
  const text = postText(ui.media.kind, ui.media.date);
  return title("Truyền thông", "Soạn nhanh bài đăng Facebook / Zalo và quản lý thông báo của giải") + `<div class="grid2">
    ${card("", "Tạo bài đăng tự động", `<div class="stack">
      <div class="row c2"><div class="f"><label>Loại bài</label><select class="in" data-act-change="mediaKind">
        ${[["schedule", "Lịch thi đấu theo ngày"], ["results", "Kết quả theo ngày"], ["postpone", "Thông báo hoãn trận"], ["bans", "Danh sách treo giò"], ["standings", "Bảng xếp hạng"], ["scorers", "Vua phá lưới"]].map(([k, l]) => `<option value="${k}" ${ui.media.kind === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="f"><label>Ngày</label><select class="in" data-act-change="mediaDate" ${["standings", "scorers", "postpone", "bans"].includes(ui.media.kind) ? "disabled" : ""}>${dates.map(d => `<option value="${d}" ${d === ui.media.date ? "selected" : ""}>${WEEKDAYS[L.parseISO(d).getDay()]}, ${dmy(d)}</option>`).join("")}</select></div></div>
      <textarea class="in" id="postText" rows="14">${esc(text)}</textarea>
      <div class="hstack"><button class="btn b-blue" data-act="copyPost"><i class="fa-regular fa-copy"></i>Sao chép nội dung</button>
        <button class="btn b-ghost" data-act="go" data-view="poster"><i class="fa-regular fa-image"></i>Tạo poster kèm theo</button></div></div>`)}
    ${card("", "Thông báo của giải", `<div class="news">${t.news.length ? t.news.slice().sort((a, b) => b.date.localeCompare(a.date)).map(n => `<div class="news-item"><h4><i class="fa-solid fa-bullhorn" style="color:var(--gold)"></i><span>${esc(n.title)}</span>
        <small class="muted">${dmy(n.date)}</small><button class="icon-btn ghost" data-act="editNews" data-id="${n.id}"><i class="fa-solid fa-pen"></i></button><button class="icon-btn red" data-act="delNews" data-id="${n.id}"><i class="fa-solid fa-trash"></i></button></h4><p>${esc(n.body)}</p></div>`).join("")
      : `<div class="empty small">Chưa có thông báo</div>`}</div><p class="small muted">Thông báo sẽ chạy chữ ở chân màn hình "Giao diện TV".</p>`,
      `<button class="btn b-blue xs" data-act="editNews"><i class="fa-solid fa-plus"></i>Thêm thông báo</button>`)}
    ${card("span3", "Bảng tỉ số trực tiếp", `<p class="muted" style="margin-top:0">Khi mở một trận ở mục Kết quả, bấm <b>"Lên bảng tỉ số"</b> để đưa tên đội, logo, màu áo và tỉ số sang bảng tỉ số (file bang-ti-so.html ở thư mục bên ngoài) — mở trong cùng trình duyệt.</p>
      <div class="hstack"><a class="btn b-purple" href="../bang-ti-so.html" target="_blank"><i class="fa-solid fa-tv"></i>Mở bảng tỉ số</a><a class="btn b-ghost" href="../dieu-khien.html" target="_blank"><i class="fa-solid fa-sliders"></i>Mở bảng điều khiển</a></div>`)}
  </div>`;
}
function nextDate(dates) {
  const today = L.iso(new Date());
  return dates.find(d => d >= today) || dates[dates.length - 1] || "";
}
function postText(kind, date) {
  const t = T(), head = `🏆 ${t.name.toUpperCase()}\n`;
  const tag = `\n📍 ${t.venue || ""}\n${t.slogan ? "🔥 " + t.slogan + "\n" : ""}#${slug(t.name).replace(/-/g, "")}`;
  const day = date ? `${WEEKDAYS[L.parseISO(date).getDay()]}, ngày ${dmy(date)}` : "";
  if (kind === "schedule") {
    const ms = visibleMatches().filter(m => m.date === date);
    return head + `📅 LỊCH THI ĐẤU ${day.toUpperCase()}\n\n` + (ms.map(m => `⏰ ${m.time} | Sân ${m.pitch} | ${stageLabel(m)}\n⚽ ${slotName(m, "home")}  🆚  ${slotName(m, "away")}`).join("\n\n") || "Không có trận đấu.") + "\n" + tag;
  }
  if (kind === "results") {
    const ms = visibleMatches().filter(m => m.date === date);
    return head + `📊 KẾT QUẢ ${day.toUpperCase()}\n\n` + (ms.map(m => {
      const goals = (m.events || []).filter(e => e.type === "goal").map(e => `${e.player}${e.minute ? " " + e.minute + "'" : ""}`);
      return `${m.status === "done" ? "✅" : "⏳"} ${slotName(m, "home")}  ${m.status === "done" ? scoreText(m) : "vs"}  ${slotName(m, "away")}${goals.length ? "\n   ⚽ " + goals.join(", ") : ""}`;
    }).join("\n\n") || "Không có trận đấu.") + "\n" + tag;
  }
  if (kind === "postpone") {
    const ms = visibleMatches().filter(m => m.status === "postponed");
    return head + "⚠️ THÔNG BÁO HOÃN TRẬN\n\nBan tổ chức xin thông báo các trận đấu sau được hoãn:\n\n" + (ms.map(m =>
      `❌ ${slotName(m, "home")}  🆚  ${slotName(m, "away")} (${stageLabel(m)})\n   Lý do: ${m.note || "BTC sẽ thông báo sau"}\n   Lịch mới: ${m.date ? `${WEEKDAYS[L.parseISO(m.date).getDay()]}, ${dmy(m.date)} lúc ${m.time} – Sân ${m.pitch}` : "sẽ thông báo sau"}`).join("\n\n")
      || "Hiện không có trận nào bị hoãn.") + "\n\nMong các đội và khán giả thông cảm!\n" + tag;
  }
  if (kind === "bans") {
    const bs = L.discipline(t).filter(isBanned);
    return head + "⛔ DANH SÁCH CẦU THỦ BỊ TREO GIÒ\n\n" + (bs.map((r, i) => `${i + 1}. ${r.name} (${team(r.teamId) ? team(r.teamId).name : ""})\n   Cấm: ${banText(r)}`).join("\n\n") || "Hiện không có cầu thủ nào bị treo giò.") +
      "\n\nĐề nghị các đội chấp hành nghiêm túc.\n" + tag;
  }
  if (kind === "standings") {
    return head + "📈 BẢNG XẾP HẠNG\n" + t.groups.map(g => `\n🔹 ${g.name === "Chung" ? "BXH chung" : "Bảng " + g.name}\n` + L.standings(t, g.name).map((r, i) => {
      const x = team(r.id); return `${i + 1}. ${x.name} — ${r.pts}đ (${r.w}T ${r.d}H ${r.l}B, HS ${r.gd > 0 ? "+" : ""}${r.gd})`; }).join("\n")).join("\n") + "\n" + tag;
  }
  const sc = L.playerStats(t).filter(r => r.goals).sort((a, b) => b.goals - a.goals).slice(0, 10);
  return head + "👟 CUỘC ĐUA VUA PHÁ LƯỚI\n\n" + (sc.map((r, i) => `${["🥇", "🥈", "🥉"][i] || (i + 1) + "."} ${r.name} (${team(r.teamId) ? team(r.teamId).name : ""}) — ${r.goals} bàn`).join("\n") || "Chưa có bàn thắng.") + "\n" + tag;
}

/* ---------- Poster & ảnh ---------- */
function viewPoster() {
  const ms = visibleMatches(), dates = [...new Set(ms.map(m => m.date).filter(Boolean))];
  if (!ms.some(m => m.id === ui.poster.match)) ui.poster.match = (ms.find(m => m.status !== "done") || ms[0] || {}).id || "";
  if (!dates.includes(ui.poster.date)) ui.poster.date = nextDate(dates);
  const t = T();
  return title("Poster & Ảnh", "Tạo poster trận đấu để đăng mạng xã hội, lưu ảnh của giải") + `<div class="poster-wrap">
    ${card("", "Xem trước poster", `<canvas id="posterCanvas" class="poster-canvas" width="1080" height="1350"></canvas>`)}
    ${card("", "Tùy chọn", `<div class="stack">
      <div class="f"><label>Loại poster</label><div class="tabs sm">${[["match", "Trận đấu"], ["day", "Lịch theo ngày"]].map(([k, l]) => `<button class="tab ${ui.poster.kind === k ? "on" : ""}" data-act="posterKind" data-kind="${k}">${l}</button>`).join("")}</div></div>
      ${ui.poster.kind === "match" ? `<div class="f"><label>Chọn trận</label><select class="in" data-act-change="posterMatch">${ms.map((m, i) => `<option value="${m.id}" ${m.id === ui.poster.match ? "selected" : ""}>${i + 1}. ${dm(m.date)} ${m.time} · ${esc(slotName(m, "home"))} vs ${esc(slotName(m, "away"))}</option>`).join("")}</select></div>`
      : `<div class="f"><label>Chọn ngày</label><select class="in" data-act-change="posterDate">${dates.map(d => `<option value="${d}" ${d === ui.poster.date ? "selected" : ""}>${WEEKDAYS[L.parseISO(d).getDay()]}, ${dmy(d)}</option>`).join("")}</select></div>`}
      <p class="small muted" style="margin:0">Poster dùng ảnh banner (nếu có) làm nền và logo của các đội. Trận đã có kết quả sẽ hiện tỉ số.</p>
      <button class="btn b-green lg" data-act="downloadPoster"><i class="fa-solid fa-download"></i>Tải poster (PNG)</button></div>`)}
    ${card("span3", "Thư viện ảnh của giải", t.gallery.length ? `<div class="gallery">${t.gallery.map(g => `<div class="gitem" data-act="viewImg" data-id="${g.id}"><img src="${g.src}" alt=""><button class="icon-btn red" data-act="delImg" data-id="${g.id}" title="Xóa"><i class="fa-solid fa-trash"></i></button></div>`).join("")}</div>`
      : `<div class="empty"><i class="fa-regular fa-images"></i>Chưa có ảnh nào</div>`, `<button class="btn b-blue xs" data-act="addImg"><i class="fa-solid fa-upload"></i>Thêm ảnh</button>`)}
  </div>`;
}
let posterJob = 0;
async function drawPoster() {
  const cv = $("#posterCanvas"); if (!cv) return;
  const job = ++posterJob, t = T(), x = cv.getContext("2d"), W = 1080, H = 1350;
  const bg = t.banner ? await loadImg(t.banner) : null;
  if (job !== posterJob) return;
  // nền
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#06122e"); g.addColorStop(.55, "#0b2160"); g.addColorStop(1, "#0a3a22");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  if (bg) { const k = Math.max(W / bg.width, H / bg.height); x.globalAlpha = .45; x.drawImage(bg, (W - bg.width * k) / 2, (H - bg.height * k) / 2, bg.width * k, bg.height * k); x.globalAlpha = 1; }
  const v = x.createLinearGradient(0, 0, 0, H); v.addColorStop(0, "rgba(3,9,25,.75)"); v.addColorStop(.4, "rgba(3,9,25,.25)"); v.addColorStop(1, "rgba(3,9,25,.9)");
  x.fillStyle = v; x.fillRect(0, 0, W, H);
  [[180, "rgba(120,170,255,.25)"], [900, "rgba(120,170,255,.25)"]].forEach(([cx, c]) => { const r = x.createRadialGradient(cx, -50, 10, cx, -50, 700); r.addColorStop(0, c); r.addColorStop(1, "transparent"); x.fillStyle = r; x.fillRect(0, 0, W, H); });
  x.textAlign = "center";
  const gold = y0 => { const gg = x.createLinearGradient(0, y0 - 70, 0, y0 + 10); gg.addColorStop(0, "#fff7d1"); gg.addColorStop(.5, "#ffd45a"); gg.addColorStop(1, "#f39a00"); return gg; };
  const text = (s, y, size, color, weight = "800", font = "Barlow Condensed") => { x.font = `italic ${weight} ${size}px "${font}", Arial`; x.fillStyle = color; x.fillText(s, W / 2, y); };
  const fit = (s, max, size) => { x.font = `italic 800 ${size}px "Barlow Condensed", Arial`; while (x.measureText(s).width > max && size > 20) { size -= 2; x.font = `italic 800 ${size}px "Barlow Condensed", Arial`; } return size; };
  const hp = heroParts(t.name);
  x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 18;
  if (hp.small) text(hp.small.toUpperCase(), 110, fit(hp.small.toUpperCase(), 900, 54), "#fff");
  const bigS = (hp.big + (hp.year ? " " + hp.year : "")).toUpperCase();
  text(bigS, 200, fit(bigS, 980, 96), gold(200));
  x.shadowBlur = 0;

  if (ui.poster.kind === "match") {
    const m = t.matches.find(z => z.id === ui.poster.match);
    if (!m) { text("CHƯA CÓ TRẬN ĐẤU", 700, 60, "#fff"); return; }
    const done = m.status === "done";
    pill(done ? "KẾT QUẢ · " + stageLabel(m).toUpperCase() : stageLabel(m).toUpperCase(), 290);
    const sides = ["home", "away"].map(s => team(s === "home" ? m.home : m.away));
    const imgs = await Promise.all(sides.map(s => s ? loadImg(logoOf(s)) : null));
    if (job !== posterJob) return;
    [[255, 0], [825, 1]].forEach(([cx, i]) => {
      x.save(); x.beginPath(); x.arc(cx, 640, 165, 0, Math.PI * 2); x.fillStyle = "rgba(255,255,255,.95)"; x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = 40; x.fill(); x.restore();
      x.save(); x.beginPath(); x.arc(cx, 640, 165, 0, Math.PI * 2); x.lineWidth = 10; x.strokeStyle = sides[i] ? sides[i].color : "#888"; x.stroke(); x.restore();
      if (imgs[i]) { const k = 230 / Math.max(imgs[i].width, imgs[i].height); x.drawImage(imgs[i], cx - imgs[i].width * k / 2, 640 - imgs[i].height * k / 2, imgs[i].width * k, imgs[i].height * k); }
      else { x.fillStyle = "#0b1a3a"; x.font = "800 120px Arial"; x.fillText("?", cx, 685); }
      const nm = (sides[i] ? sides[i].name : slotName(m, i ? "away" : "home")).toUpperCase();
      x.textAlign = "center"; x.font = `italic 800 ${fit(nm, 440, 58)}px "Barlow Condensed", Arial`; x.fillStyle = "#fff"; x.fillText(nm, cx, 885);
    });
    if (done) text(`${m.hs}-${m.as}`, 680, 116, gold(680));
    else { x.shadowColor = "rgba(247,185,36,.8)"; x.shadowBlur = 30; text("VS", 685, 140, gold(685)); x.shadowBlur = 0; }
    const d = m.date ? L.parseISO(m.date) : null;
    box(1010, 220);
    text(d ? `${WEEKDAYS[d.getDay()].toUpperCase()} · ${dmy(m.date)}` : "CHƯA XẾP LỊCH", 1090, 64, "#fff");
    text(`${m.time || "--:--"}  ·  SÂN ${m.pitch}`, 1170, 80, gold(1170));
    x.font = `600 30px "Be Vietnam Pro", Arial`; x.fillStyle = "#c7d3ef"; x.fillText(t.venue || "", W / 2, 1290);
  } else {
    const ms = visibleMatches().filter(m => m.date === ui.poster.date);
    const d = ui.poster.date ? L.parseISO(ui.poster.date) : null;
    pill("LỊCH THI ĐẤU", 290);
    text(d ? `${WEEKDAYS[d.getDay()].toUpperCase()} · ${dmy(ui.poster.date)}` : "", 400, 60, "#fff");
    const imgs = await Promise.all(ms.flatMap(m => [m.home, m.away]).map(id => id ? loadImg(logoOf(team(id))) : null));
    if (job !== posterJob) return;
    const n = Math.min(ms.length, 8), rowH = Math.min(120, 760 / Math.max(1, n));
    ms.slice(0, 8).forEach((m, i) => {
      const y = 460 + i * rowH;
      x.fillStyle = i % 2 ? "rgba(255,255,255,.06)" : "rgba(31,107,255,.22)"; roundRect(60, y, 960, rowH - 12, 18); x.fill();
      const cy = y + (rowH - 12) / 2, fs = Math.min(40, rowH * .34);
      x.textAlign = "left"; x.font = `800 ${fs}px "Barlow Condensed", Arial`; x.fillStyle = "#ffd45a"; x.fillText(`${m.time}`, 85, cy + fs * .35);
      x.font = `600 ${fs * .6}px "Be Vietnam Pro", Arial`; x.fillStyle = "#9fb7e6"; x.fillText(`Sân ${m.pitch}`, 85, cy + fs * .35 + fs * .75);
      const ls = Math.min(64, rowH - 34);
      [imgs[i * 2], imgs[i * 2 + 1]].forEach((im, k) => { if (im) { const kk = ls / Math.max(im.width, im.height); x.drawImage(im, (k ? 900 : 250) - im.width * kk / 2, cy - im.height * kk / 2, im.width * kk, im.height * kk); } });
      x.font = `700 ${fs * .75}px "Be Vietnam Pro", Arial`; x.fillStyle = "#fff";
      const nm = s => { const tt = team(s === "home" ? m.home : m.away); return tt ? tt.name : slotName(m, s); };
      x.textAlign = "left"; x.fillText(clip(nm("home"), 230, x), 300, cy + fs * .28);
      x.textAlign = "right"; x.fillText(clip(nm("away"), 230, x), 850, cy + fs * .28);
      x.textAlign = "center"; x.font = `italic 800 ${fs}px "Barlow Condensed", Arial`; x.fillStyle = "#ffd45a"; x.fillText(m.status === "done" ? `${m.hs}-${m.as}` : "VS", 575, cy + fs * .35);
    });
    if (!ms.length) text("KHÔNG CÓ TRẬN ĐẤU", 700, 56, "#fff");
    x.textAlign = "center"; x.font = `600 30px "Be Vietnam Pro", Arial`; x.fillStyle = "#c7d3ef"; x.fillText(t.venue || "", W / 2, 1300);
  }
  function pill(s, y) {
    x.font = `italic 800 44px "Barlow Condensed", Arial`; const w = x.measureText(s).width + 80;
    const gr = x.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0); gr.addColorStop(0, "#9c45ff"); gr.addColorStop(.5, "#e0218a"); gr.addColorStop(1, "#ff5a1f");
    x.fillStyle = gr; roundRect(W / 2 - w / 2, y - 48, w, 68, 34); x.fill(); x.fillStyle = "#fff"; x.textAlign = "center"; x.fillText(s, W / 2, y);
  }
  function box(y, h) { x.fillStyle = "rgba(5,12,30,.75)"; roundRect(110, y, 860, h, 26); x.fill(); x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = 2; x.stroke(); }
  function roundRect(a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function clip(s, max, c) { if (c.measureText(s).width <= max) return s; while (s.length > 1 && c.measureText(s + "…").width > max) s = s.slice(0, -1); return s + "…"; }
}

/* ---------- Xuất dữ liệu ---------- */
function viewExport() {
  const item = (ic, color, h, p, btn) => `<div class="export-card"><i class="fa-solid ${ic} big" style="color:${color}"></i><h4>${h}</h4><p>${p}</p>${btn}</div>`;
  return title("Xuất dữ liệu & Sao lưu", "Xuất Excel / PDF, sao lưu tự động và khôi phục dữ liệu") + `<div class="export-grid">
    ${item("fa-user-group", "#1f6bff", "Danh sách cầu thủ (Excel)", "Toàn bộ cầu thủ của các đội kèm số áo, bàn thắng, thẻ phạt.", `<button class="btn b-blue" data-act="exportPlayersXlsx"><i class="fa-solid fa-download"></i>Tải file Excel</button>`)}
    ${item("fa-id-card", "#ef4444", "Danh sách cầu thủ (PDF)", "Bản in danh sách đăng ký cầu thủ theo từng đội.", `<button class="btn b-red" data-act="exportPlayersPdf"><i class="fa-solid fa-print"></i>In / Lưu PDF</button>`)}
    ${item("fa-square-poll-horizontal", "#ef4444", "Kết quả thi đấu (PDF)", "Các trận đã đá kèm tỉ số và cầu thủ ghi bàn.", `<button class="btn b-red" data-act="exportResultsPdf"><i class="fa-solid fa-print"></i>In / Lưu PDF</button>`)}
    ${item("fa-file-excel", "#22c55e", "Toàn bộ giải (Excel)", "Đội bóng, lịch thi đấu, kết quả, bảng xếp hạng, ghi bàn, thẻ phạt — mỗi mục 1 sheet.", `<button class="btn b-green" data-act="exportAllXlsx"><i class="fa-solid fa-download"></i>Tải file Excel</button>`)}
    ${item("fa-calendar-days", "#22c55e", "Lịch thi đấu (Excel)", "Danh sách trận với ngày, giờ, sân, tỉ số.", `<button class="btn b-green" data-act="exportSchedXlsx"><i class="fa-solid fa-download"></i>Tải file Excel</button>`)}
    ${item("fa-file-pdf", "#ef4444", "Lịch thi đấu (PDF)", "Mở bản in, chọn \"Lưu thành PDF\" trong hộp thoại in.", `<button class="btn b-red" data-act="exportSchedPdf"><i class="fa-solid fa-print"></i>In / Lưu PDF</button>`)}
    ${item("fa-ranking-star", "#ef4444", "Bảng xếp hạng (PDF)", "Bảng xếp hạng các bảng đấu, sẵn để in dán bảng tin.", `<button class="btn b-red" data-act="exportStdPdf"><i class="fa-solid fa-print"></i>In / Lưu PDF</button>`)}
    ${item("fa-people-group", "#1f6bff", "Danh sách đội (Excel)", "Mã đội, tên đội, màu áo, khu vực, cầu thủ. Dùng được để nhập lại.", `<button class="btn b-blue" data-act="exportTeamsXlsx"><i class="fa-solid fa-download"></i>Tải file Excel</button>`)}
    ${item("fa-floppy-disk", "#f7b924", "Sao lưu (.json)", "Lưu toàn bộ giải (kể cả logo, ảnh) thành 1 file để chuyển sang máy khác.", `<button class="btn b-gold" data-act="backup"><i class="fa-solid fa-download"></i>Tải bản sao lưu</button>`)}
    ${item("fa-upload", "#8b2cf5", "Khôi phục", "Mở file sao lưu .json — giải trong file sẽ được thêm vào danh sách giải.", `<button class="btn b-purple" data-act="restore"><i class="fa-solid fa-folder-open"></i>Chọn file sao lưu</button>`)}
  </div>
  <div style="margin-top:12px">${card("", "Sao lưu tự động", `<p class="small muted" style="margin-top:0">Mọi thay đổi được lưu ngay vào trình duyệt. Ngoài ra, cứ mỗi 5 phút có thay đổi, hệ thống tự chụp lại 1 bản sao lưu (giữ ${SNAP_KEEP} bản gần nhất) để quay lại khi lỡ tay xóa hoặc nhập sai.</p>
    <div id="snapList"><div class="empty small"><i class="fa-solid fa-spinner fa-spin"></i>Đang tải...</div></div>`,
    `<button class="btn b-gold xs" data-act="snapNow"><i class="fa-solid fa-camera"></i>Sao lưu ngay</button>`)}</div>`;
}
async function fillSnapshots() {
  const el = $("#snapList"); if (!el) return;
  const list = await listSnapshots();
  if (!$("#snapList")) return;
  $("#snapList").innerHTML = list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Thời điểm</th><th>Loại</th><th>Các giải trong bản sao lưu</th><th class="c">Dung lượng</th><th></th></tr></thead><tbody>
    ${list.map(s => `<tr><td>${new Date(s.at).toLocaleString("vi-VN")}</td><td>${esc(s.reason)}</td><td style="white-space:normal">${esc(s.names)}</td><td class="c">${(s.data.length / 1024).toFixed(0)} KB</td>
      <td class="c"><button class="btn b-purple xs" data-act="snapRestore" data-at="${s.at}"><i class="fa-solid fa-clock-rotate-left"></i>Khôi phục</button></td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty small"><i class="fa-regular fa-clock"></i>Chưa có bản sao lưu tự động nào (hoặc trình duyệt đang chặn bộ nhớ IndexedDB)</div>`;
}

/* ---------- Cài đặt ---------- */
const THEMES = [["#1f6bff", "Xanh dương"], ["#7c3aed", "Tím"], ["#16a34a", "Xanh lá"], ["#e5283f", "Đỏ"], ["#f97316", "Cam"], ["#0891b2", "Xanh ngọc"]];
function applyTheme() {
  const c = DB.theme || "#1f6bff", r = document.documentElement.style;
  r.setProperty("--blue", c); r.setProperty("--blue2", shade(c, -.25));
  r.setProperty("--blue-glow", c + "8c");
}
function viewSettings() {
  const s = T().settings, isAdmin = can("admin");
  return title("Cài đặt hệ thống", isAdmin ? "" : `Bạn đang dùng tài khoản "${ROLES[me().role]}" — chỉ Quản trị viên mới đổi được cài đặt`) + `<div class="grid2">
    ${card("", "Đơn vị tổ chức", `<div class="stack">
      <div class="f"><label>Tên đơn vị (hiện ở góc trên bên trái)</label><input class="in" data-act-change="orgName" value="${esc(DB.orgName)}" placeholder="VD: CLB Bóng đá Phương Liễu"></div>
      <div class="f"><label>Logo đơn vị tổ chức</label><div class="hstack"><div class="org-logo">${DB.orgLogo ? `<img src="${DB.orgLogo}" alt="">` : `<i class="fa-solid fa-trophy"></i>`}</div>
        <button class="btn b-blue sm" data-act="pickOrgLogo"><i class="fa-solid fa-upload"></i>Tải logo</button>${DB.orgLogo ? `<button class="btn b-ghost sm" data-act="clearOrgLogo">Bỏ logo</button>` : ""}</div></div>
      <div class="f"><label>Màu giao diện</label><div class="swatches">${THEMES.map(([c, n]) => `<button class="sw ${DB.theme === c ? "on" : ""}" style="--c:${c}" data-act="setTheme" data-c="${c}" title="${n}"></button>`).join("")}
        <label class="sw custom" title="Tự chọn màu"><input type="color" data-act-change="themeCustom" value="${DB.theme}"><i class="fa-solid fa-eye-dropper"></i></label></div></div></div>`)}
    ${card("", "Quy tắc tính điểm & kỷ luật", `<div class="row c3">
      <div class="f"><label>Thắng</label><input class="in" type="number" min="0" data-bind="settings.win" data-type="num" value="${s.win}"></div>
      <div class="f"><label>Hòa</label><input class="in" type="number" min="0" data-bind="settings.draw" data-type="num" value="${s.draw}"></div>
      <div class="f"><label>Thua</label><input class="in" type="number" data-bind="settings.loss" data-type="num" value="${s.loss}"></div>
      <div class="f"><label>Số thẻ vàng tích lũy bị treo giò</label><input class="in" type="number" min="1" data-bind="settings.yellowBan" data-type="num" value="${s.yellowBan}"></div>
      <div class="f"><label>Số trận cấm khi đủ thẻ vàng</label><input class="in" type="number" min="1" data-bind="settings.yellowBanGames" data-type="num" value="${s.yellowBanGames}"></div>
      <div class="f"><label>Số trận cấm khi bị thẻ đỏ</label><input class="in" type="number" min="1" data-bind="settings.redBanGames" data-type="num" value="${s.redBanGames}"></div></div>
      <p class="small muted">Xếp hạng theo: Điểm → Hiệu số → Bàn thắng → Đối đầu → Mã đội. 2 thẻ vàng trong 1 trận được tính như 1 thẻ đỏ.</p>`)}
    ${card("span3", "Tài khoản & phân quyền", `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tên</th><th>Vai trò</th><th>Quyền hạn</th><th>Mã PIN</th><th></th></tr></thead><tbody>
      ${DB.users.map(u => `<tr><td><div class="team-cell"><div class="avatar sm">${esc(u.name.charAt(0).toUpperCase())}</div><input class="in" style="padding:5px 8px;width:160px" data-user="${u.id}" data-uf="name" value="${esc(u.name)}"></div></td>
        <td><select class="in" style="padding:5px 26px 5px 8px;width:auto" data-user="${u.id}" data-uf="role">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${u.role === k ? "selected" : ""}>${l}</option>`).join("")}</select></td>
        <td class="small muted" style="white-space:normal">${ROLE_DESC[u.role]}</td>
        <td><input class="in" style="padding:5px 8px;width:110px" type="password" inputmode="numeric" maxlength="8" data-user="${u.id}" data-uf="pin" value="${esc(u.pin)}" placeholder="Không có"></td>
        <td class="c">${u.id === DB.user ? `<span class="badge done">Đang dùng</span>` : `<button class="icon-btn red" data-act="delUser" data-id="${u.id}" title="Xóa"><i class="fa-solid fa-trash"></i></button>`}</td></tr>`).join("")}</tbody></table></div>
      <div class="hstack" style="margin-top:10px"><button class="btn b-blue sm" data-act="addUser"><i class="fa-solid fa-user-plus"></i>Thêm tài khoản</button>
        <span class="small muted">Đổi tài khoản bằng cách bấm vào tên ở góc trên bên phải. Đặt mã PIN để người khác không tự chuyển sang tài khoản có quyền cao hơn.<br>
        Lưu ý: phân quyền này chỉ có tác dụng trên máy đang dùng (dữ liệu nằm trong trình duyệt), không phải bảo mật máy chủ.</span></div>`)}
    ${card("span3", "Dữ liệu", `<div class="hstack"><button class="btn b-ghost" data-act="resetResults"><i class="fa-solid fa-eraser"></i>Xóa toàn bộ kết quả</button>
        <button class="btn b-red" data-act="resetAll"><i class="fa-solid fa-triangle-exclamation"></i>Xóa hết, tạo lại giải mẫu</button>
        <button class="btn b-gold" data-act="go" data-view="export"><i class="fa-solid fa-clock-rotate-left"></i>Sao lưu & khôi phục</button></div>`)}
  </div>`;
}
function userMenu() {
  openModal({
    title: "Chọn tài khoản",
    body: `<div class="stack">${DB.users.map(u => `<button class="user-row ${u.id === DB.user ? "on" : ""}" data-uid="${u.id}"><div class="avatar">${esc(u.name.charAt(0).toUpperCase())}</div>
      <div><b>${esc(u.name)}</b><br><span class="small muted">${ROLES[u.role]} · ${ROLE_DESC[u.role]}</span></div>${u.pin ? `<i class="fa-solid fa-lock muted"></i>` : ""}${u.id === DB.user ? `<i class="fa-solid fa-check" style="color:#4ade80"></i>` : ""}</button>`).join("")}</div>`,
    onMount: (m, close) => m.addEventListener("click", e => {
      const b = e.target.closest("[data-uid]"); if (!b) return;
      const u = DB.users.find(x => x.id === b.dataset.uid);
      const go = () => { DB.user = u.id; saveDB(); close(); render(); toast(`Đang dùng tài khoản ${u.name} (${ROLES[u.role]})`); };
      if (!u.pin || u.id === DB.user) return go();
      $(".modal-b", m).innerHTML = `<div class="stack" style="align-items:center;text-align:center"><div class="avatar" style="width:60px;height:60px;font-size:24px">${esc(u.name.charAt(0).toUpperCase())}</div>
        <b>${esc(u.name)}</b><input class="in" id="pinIn" type="password" inputmode="numeric" placeholder="Nhập mã PIN" style="max-width:220px;text-align:center;font-size:20px;letter-spacing:6px">
        <button class="btn b-blue" id="pinOk"><i class="fa-solid fa-unlock"></i>Đăng nhập</button></div>`;
      const i = $("#pinIn", m); i.focus();
      const ok = () => { if (i.value === u.pin) go(); else { toast("Sai mã PIN", "err"); i.value = ""; i.focus(); } };
      $("#pinOk", m).onclick = ok; i.onkeydown = e2 => { if (e2.key === "Enter") ok(); };
    })
  });
}

/* ---------- Giao diện công khai ---------- */
function publicData() {
  const t = T(), ms = visibleMatches();
  const side = (m, s) => { const id = s === "home" ? m.home : m.away, x = id && team(id); return x ? { code: x.code, name: x.name, logo: logoOf(x) } : { label: slotName(m, s) }; };
  const disc = L.discipline(t);
  const adv = (t.format.type === "groups" || t.format.type === "custom") ? +t.format.advance : 0;
  return {
    name: t.name, slogan: t.slogan, venue: t.venue, range: range(t.start, t.end), logo: t.logo, banner: t.banner, accent: DB.theme, org: DB.orgName,
    updated: new Date().toLocaleString("vi-VN"), total: ms.length, played: ms.filter(m => m.status === "done").length,
    teams: sortedTeams().map(x => ({ code: x.code, name: x.name, logo: logoOf(x) })),
    matches: ms.map(m => ({ date: m.date, dayLabel: m.date ? `${WEEKDAYS[L.parseISO(m.date).getDay()]}, ${dmy(m.date)}` : "Chưa xếp lịch", time: m.time, pitch: m.pitch, stage: stageLabel(m),
      status: m.status, note: m.note || "", hs: m.hs, as: m.as, pens: m.ph != null && m.pa != null && +m.hs === +m.as && m.status === "done" ? `${m.ph}-${m.pa}` : "",
      home: side(m, "home"), away: side(m, "away"),
      goals: (m.events || []).filter(e => e.type === "goal" && e.player).map(e => `${e.player}${e.minute ? " " + e.minute + "'" : ""}`) })),
    groups: t.groups.map(g => ({ title: g.name === "Chung" ? "Bảng xếp hạng chung" : "Bảng " + g.name,
      rows: L.standings(t, g.name).map((r, i) => Object.assign({ q: i < adv, name: team(r.id).name, logo: logoOf(team(r.id)) }, r)) })),
    bracket: ["r64", "r32", "r16", "qf", "sf", "third", "final"].map(s => ({ label: L.STAGES[s], matches: t.matches.filter(m => m.src && m.stage === s && !m.bye) }))
      .filter(c => c.matches.length).map(c => ({ label: c.label, matches: c.matches.map(m => { const w = L.winner(m); return { home: side(m, "home"), away: side(m, "away"), hs: m.status === "pending" ? null : m.hs, as: m.status === "pending" ? null : m.as, winner: w ? (w === m.home ? "home" : "away") : "" }; }) })),
    scorers: L.playerStats(t).filter(r => r.goals).sort((a, b) => b.goals - a.goals).slice(0, 20).map(r => ({ name: r.name, goals: r.goals, team: { name: team(r.teamId).name, logo: logoOf(team(r.teamId)) } })),
    cards: disc.filter(r => r.yellow || r.red).sort((a, b) => (b.red * 3 + b.yellow) - (a.red * 3 + a.yellow)).map(r => ({ name: r.name, yellow: r.yellow, red: r.red, team: { name: team(r.teamId).name, logo: logoOf(team(r.teamId)) } })),
    bans: disc.filter(isBanned).map(r => ({ name: r.name, match: banText(r).split(" (")[0], reason: (upcomingBans(r)[0] || {}).reason || r.queue[0] || "", team: { name: team(r.teamId).name, logo: logoOf(team(r.teamId)) } })),
    news: t.news.slice().sort((a, b) => b.date.localeCompare(a.date)).map(n => ({ date: dmy(n.date), title: n.title, body: n.body }))
  };
}
function viewPublic() {
  return title("Giao diện công khai", "Trang xem lịch, kết quả, bảng xếp hạng dành cho khán giả") + `<div class="grid2">
    ${card("", "Chia sẻ cho khán giả", `<div class="stack">
      <p style="margin:0;line-height:1.6">Trang công khai là <b>1 file HTML duy nhất</b> chứa sẵn toàn bộ lịch, kết quả, bảng xếp hạng, thống kê, thông báo — khán giả chỉ xem được, không sửa được.</p>
      <ol class="small" style="margin:0;padding-left:18px;line-height:1.8;color:#c7d3ef">
        <li>Bấm <b>Tải trang công khai</b> để lấy file <code>.html</code>.</li>
        <li>Gửi file qua Zalo/Messenger, hoặc đưa lên hosting miễn phí (Netlify Drop, GitHub Pages...) để có đường link chia sẻ.</li>
        <li>Mỗi khi có kết quả mới, tải lại file và thay file cũ.</li></ol>
      <div class="row c2"><button class="btn b-green lg" data-act="downloadPublic"><i class="fa-solid fa-download"></i>Tải trang công khai</button>
        <button class="btn b-blue lg" data-act="openPublic"><i class="fa-solid fa-arrow-up-right-from-square"></i>Mở ở tab mới</button></div></div>`)}
    ${card("", "Xem trước", `<iframe class="pub-frame" id="pubFrame" title="Xem trước trang công khai" sandbox="allow-scripts"></iframe>`)}
  </div>`;
}

/* =====================================================================
   SỰ KIỆN
   ===================================================================== */
function setPath(obj, path, v) { const ks = path.split("."), last = ks.pop(); ks.reduce((o, k) => o[k], obj)[last] = v; }

document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.user) {
    if (deny("admin")) return render();
    const u = DB.users.find(x => x.id === el.dataset.user); if (!u) return;
    const f = el.dataset.uf, v = el.value.trim();
    if (f === "role" && u.role === "admin" && v !== "admin" && DB.users.filter(x => x.role === "admin").length === 1) { toast("Phải còn ít nhất 1 Quản trị viên", "err"); return render(); }
    if (f === "name" && !v) return render();
    u[f] = v; saveDB(); render(); return;
  }
  if (el.dataset.bind) {
    if (deny(el.dataset.bind.startsWith("settings.") ? "admin" : "manage")) return render();
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.dataset.type === "num") v = +v;
    if (el.type === "radio" && !el.checked) return;
    setPath(T(), el.dataset.bind, v);
    const t = T();
    if (el.dataset.bind === "start" && t.sched.start < t.start) t.sched.start = t.start;
    if (el.dataset.bind === "end") t.sched.end = t.end;
    commit();
    return;
  }
  if (el.dataset.medit) {
    if (deny("manage")) return render();
    const m = T().matches.find(x => x.id === el.dataset.id); if (!m) return;
    m[el.dataset.medit] = el.dataset.medit === "pitch" ? +el.value : el.value;
    saveDB(); return;
  }
  const a = el.dataset.actChange; if (!a) return;
  const t = T();
  if ((a === "perGroup" || a === "moveTeam" || a === "rrSize") && deny("manage")) return render();
  if (a === "rrSize") { t.format.rrSize = +el.value; t.groups = []; commit(); return; }
  if ((a === "orgName" || a === "themeCustom") && deny("admin")) return render();
  if (a === "orgName") { DB.orgName = el.value.trim(); saveDB(); render(); return; }
  if (a === "themeCustom") { DB.theme = el.value; saveDB(); render(); return; }
  if (a === "stdGroup") { ui.stdGroup = el.value; render(); }
  else if (a === "perGroup") { t.format.groups = Math.max(1, Math.ceil(t.teams.length / +el.value)); t.groups = []; commit(); }
  else if (a === "moveTeam") { t.groups.forEach(g => g.teamIds = g.teamIds.filter(id => id !== el.dataset.id)); t.groups.find(g => g.name === el.value).teamIds.push(el.dataset.id); commit(); toast("Đã chuyển đội. Bấm \"Tạo lịch thi đấu\" để cập nhật lịch.", "info"); }
  else if (a === "mediaKind") { ui.media.kind = el.value; render(); }
  else if (a === "mediaDate") { ui.media.date = el.value; render(); }
  else if (a === "posterMatch") { ui.poster.match = el.value; drawPoster(); }
  else if (a === "posterDate") { ui.poster.date = el.value; drawPoster(); }
});

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) {
    if (ui.tourMenu && !e.target.closest(".tour-picker")) { ui.tourMenu = false; render(); }
    return;
  }
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.tagName === "A") return;
  e.preventDefault();
  const need = PERM[el.dataset.act];
  if (need && deny(need)) return;
  fn(el, e);
});

// quyền cần có cho từng thao tác (không có trong danh sách = ai cũng dùng được)
const PERM = {};
"newTour dupTour pickBanner clearBanner pickTourLogo clearTourLogo addTeam editTeam delTeam delAllTeams importExcel fmtType groupsN advanceN drawGroups autoAll buildSchedule toggleEditSched editNews delNews addImg delImg addBan delBan"
  .split(" ").forEach(k => PERM[k] = "manage");
"delTour resetResults resetAll restore snapRestore setTheme pickOrgLogo clearOrgLogo addUser delUser".split(" ").forEach(k => PERM[k] = "admin");

const MORE_ACT = {
  pickTourLogo: async () => { const [f] = await pickFiles("image/*"); if (!f) return; T().logo = await readImage(f, 300); commit(); toast("Đã cập nhật logo giải"); },
  clearTourLogo: () => { T().logo = ""; commit(); },
  checkConflicts: () => {
    const cf = L.conflicts(T());
    if (!T().matches.length) return toast("Chưa có lịch thi đấu", "info");
    if (!cf.length) return toast("Lịch hợp lệ: không trùng sân, không trùng giờ, đúng thời gian giải");
    toast(`Phát hiện ${cf.length} chỗ trùng / sai lịch — xem danh sách ở bảng Lịch thi đấu`, "err");
    ui.schedTab = "all"; if (ui.view !== "format" && ui.view !== "overview") ui.view = "format"; render();
    const a = $(".alert"); if (a) a.scrollIntoView({ behavior: "smooth", block: "center" });
  },
  addBan: () => banModal(),
  delBan: async el => { if (!await ask("Xóa án kỷ luật", "Xóa án kỷ luật này?", "Xóa")) return; T().bans = T().bans.filter(b => b.id !== el.dataset.id); commit(); },
  userMenu: () => userMenu(),
  setTheme: el => { DB.theme = el.dataset.c; saveDB(); render(); },
  pickOrgLogo: async () => { const [f] = await pickFiles("image/*"); if (!f) return; DB.orgLogo = await readImage(f, 200); saveDB(); render(); toast("Đã cập nhật logo đơn vị"); },
  clearOrgLogo: () => { DB.orgLogo = ""; saveDB(); render(); },
  addUser: () => { DB.users.push({ id: L.uid(), name: "Thư ký " + DB.users.length, role: "scorer", pin: "" }); saveDB(); render(); toast("Đã thêm tài khoản — sửa tên, vai trò, mã PIN trong bảng"); },
  delUser: async el => { const u = DB.users.find(x => x.id === el.dataset.id); if (!await ask("Xóa tài khoản", `Xóa tài khoản <b>${esc(u.name)}</b>?`, "Xóa")) return; DB.users = DB.users.filter(x => x.id !== u.id); saveDB(); render(); },
  downloadPublic: () => {
    const blob = new Blob([PublicPage.build(publicData())], { type: "text/html" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = slug(T().name) + "-cong-khai.html"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast("Đã tải trang công khai — gửi file này cho khán giả hoặc đưa lên hosting");
  },
  openPublic: () => { const url = URL.createObjectURL(new Blob([PublicPage.build(publicData())], { type: "text/html" })); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 60000); },
  exportPlayersXlsx: () => exportXlsx("players"),
  exportPlayersPdf: () => printPlayers(),
  exportResultsPdf: () => printResults(),
  snapNow: async () => { await snapshot("Thủ công"); fillSnapshots(); toast("Đã tạo bản sao lưu"); },
  snapRestore: async el => {
    const s = (await listSnapshots()).find(x => String(x.at) === el.dataset.at); if (!s) return;
    if (!await ask("Khôi phục sao lưu", `Quay lại dữ liệu lúc <b>${new Date(s.at).toLocaleString("vi-VN")}</b>?<br><span class="muted">Dữ liệu hiện tại sẽ được sao lưu lại trước khi khôi phục.</span>`, "Khôi phục", false)) return;
    await snapshot("Trước khi khôi phục");
    const keep = { users: DB.users, user: DB.user };
    DB = Object.assign(JSON.parse(s.data), keep); DB.list.forEach(migrate); DB.lastSnap = Date.now(); saveDB(); render(); toast("Đã khôi phục dữ liệu");
  }
};

const ACT = {
  go: el => { ui.view = el.dataset.view; ui.editSched = false; document.body.classList.remove("menu-open"); try { localStorage.setItem(KEY + ":view", ui.view); } catch (e) {} render(); window.scrollTo({ top: 0, behavior: "smooth" }); },
  toggleMenu: () => document.body.classList.toggle("menu-open"),
  tourMenu: () => { ui.tourMenu = !ui.tourMenu; render(); },
  switchTour: el => { DB.current = el.dataset.id; ui.tourMenu = false; ui.stdGroup = null; saveDB(); render(); },
  newTour: () => {
    ui.tourMenu = false;
    openModal({ title: "Tạo giải đấu mới", body: `<div class="f"><label>Tên giải đấu</label><input class="in" id="ntName" placeholder="VD: Giải bóng đá phủi Mùa Hè Cup 2027"></div>`,
      foot: `<button class="btn b-ghost" data-close>Hủy</button><button class="btn b-blue" id="ntOk"><i class="fa-solid fa-plus"></i>Tạo giải</button>`,
      onMount: (m, close) => { const i = $("#ntName", m); i.focus(); const ok = () => { const t = newTournament(i.value.trim() || "Giải đấu mới"); DB.list.push(t); DB.current = t.id; saveDB(); close(); ui.view = "info"; render(); toast("Đã tạo giải mới"); };
        $("#ntOk", m).onclick = ok; i.onkeydown = e => { if (e.key === "Enter") ok(); }; } });
  },
  dupTour: () => { const c = clone(T()); c.id = L.uid(); c.name += " (bản sao)"; DB.list.push(c); DB.current = c.id; ui.tourMenu = false; saveDB(); render(); toast("Đã nhân bản giải"); },
  delTour: async () => { ui.tourMenu = false; if (!await ask("Xóa giải đấu", `Xóa hẳn giải <b>${esc(T().name)}</b> cùng toàn bộ đội, lịch, kết quả?`, "Xóa giải")) return render();
    DB.list = DB.list.filter(t => t.id !== DB.current); DB.current = DB.list[0].id; saveDB(); render(); toast("Đã xóa giải"); },
  openTV: () => openTV(),

  pickBanner: async () => { const [f] = await pickFiles("image/*"); if (!f) return; T().banner = await readImage(f, 1600, "image/jpeg", .85); commit(); toast("Đã cập nhật banner"); },
  viewBanner: () => { if (T().banner) lightbox(T().banner); },
  clearBanner: () => { T().banner = ""; commit(); },

  addTeam: () => teamModal(null),
  editTeam: el => teamModal(el.dataset.id),
  delTeam: async el => {
    const x = team(el.dataset.id);
    const n = T().matches.filter(m => m.home === x.id || m.away === x.id).length;
    if (!await ask("Xóa đội", `Xóa đội <b>${esc(x.code)} - ${esc(x.name)}</b>?${n ? `<br><span class="muted">Lịch thi đấu sẽ được xóa, bạn cần tạo lại lịch.</span>` : ""}`, "Xóa đội")) return;
    const t = T(); t.teams = t.teams.filter(y => y.id !== x.id); t.groups.forEach(g => g.teamIds = g.teamIds.filter(id => id !== x.id));
    if (n) t.matches = [];
    commit(); toast("Đã xóa đội");
  },
  delAllTeams: async () => { if (!T().teams.length) return; if (!await ask("Xóa tất cả đội", "Xóa toàn bộ đội bóng, chia bảng và lịch thi đấu của giải này?", "Xóa tất cả")) return;
    const t = T(); t.teams = []; t.groups = []; t.matches = []; t.koOrder = []; commit(); toast("Đã xóa tất cả đội"); },
  importExcel: () => importModal(),
  sampleExcel: () => sampleExcel(),

  fmtType: el => { const t = T(); if (t.format.type === el.dataset.type) return; t.format.type = el.dataset.type; t.groups = []; t.koOrder = []; commit(); },
  groupsN: el => { const t = T(); t.format.groups = +el.dataset.n; t.groups = []; commit(); },
  advanceN: el => { T().format.advance = +el.dataset.n; commit(); },
  drawGroups: () => {
    const t = T(); if (t.teams.length < 2) return toast("Cần ít nhất 2 đội", "err");
    t.groups = L.draw(t); ui.animDraw = true; commit(); toast(t.format.type === "ko" ? "Đã bốc thăm cặp đấu" : "Đã chia bảng");
  },
  autoAll: async () => {
    const t = T(); if (t.teams.length < 2) return toast("Cần ít nhất 2 đội", "err");
    if (t.matches.some(m => m.status !== "pending" && !m.bye) && !await ask("Tạo lại lịch", "Giải đã có kết quả. Tạo lại bảng & lịch sẽ <b>xóa toàn bộ kết quả</b>. Tiếp tục?", "Tạo lại")) return;
    t.groups = L.draw(t); ui.animDraw = true;
    const last = buildSchedule(t); commit(); scheduleToast(last);
  },
  buildSchedule: async () => {
    const t = T(); if (t.teams.length < 2) return toast("Cần ít nhất 2 đội", "err");
    if (t.matches.some(m => m.status !== "pending" && !m.bye) && !await ask("Tạo lại lịch", "Giải đã có kết quả. Tạo lại lịch sẽ <b>xóa toàn bộ kết quả</b>. Tiếp tục?", "Tạo lại")) return;
    const last = buildSchedule(t); commit(); scheduleToast(last);
  },
  schedTab: el => { ui.schedTab = el.dataset.tab; render(); },
  toggleEditSched: () => { ui.editSched = !ui.editSched; if (!ui.editSched) { T().matches.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.time || "").localeCompare(b.time || "") || a.pitch - b.pitch); commit(); toast("Đã lưu lịch"); } else render(); },
  openMatch: el => matchModal(el.dataset.id),
  exportSchedXlsx: () => exportXlsx("schedule"),
  exportAllXlsx: () => exportXlsx("all"),
  exportTeamsXlsx: () => exportXlsx("teams"),
  exportSchedPdf: () => printSchedule(),
  exportStdPdf: () => printStandings(),
  backup: () => backup(),
  restore: () => restore(),

  copyPost: () => { const ta = $("#postText"); navigator.clipboard ? navigator.clipboard.writeText(ta.value).then(() => toast("Đã sao chép bài đăng"), () => { ta.select(); document.execCommand("copy"); toast("Đã sao chép bài đăng"); }) : (ta.select(), document.execCommand("copy"), toast("Đã sao chép")); },
  editNews: el => newsModal(el.dataset.id),
  delNews: async el => { if (!await ask("Xóa thông báo", "Xóa thông báo này?", "Xóa")) return; T().news = T().news.filter(n => n.id !== el.dataset.id); commit(); },

  posterKind: el => { ui.poster.kind = el.dataset.kind; render(); },
  downloadPoster: () => { const cv = $("#posterCanvas"); const a = document.createElement("a"); a.download = "poster-" + slug(T().name) + ".png"; a.href = cv.toDataURL("image/png"); a.click(); },
  addImg: async () => {
    const fs = await pickFiles("image/*", true); if (!fs.length) return;
    for (const f of fs) T().gallery.push({ id: L.uid(), src: await readImage(f, 1100, "image/jpeg", .8) });
    commit(); toast(`Đã thêm ${fs.length} ảnh`);
  },
  viewImg: (el, e) => { if (e.target.closest("[data-act='delImg']")) return; const g = T().gallery.find(x => x.id === el.dataset.id); if (g) lightbox(g.src); },
  delImg: async (el, e) => { e.stopPropagation(); if (!await ask("Xóa ảnh", "Xóa ảnh này khỏi thư viện?", "Xóa")) return; T().gallery = T().gallery.filter(x => x.id !== el.dataset.id); commit(); },

  resetResults: async () => { if (!await ask("Xóa kết quả", "Xóa toàn bộ tỉ số, bàn thắng và thẻ phạt (giữ nguyên lịch)?", "Xóa kết quả")) return;
    T().matches.forEach(m => { if (m.bye) return; m.hs = m.as = m.ph = m.pa = null; m.status = "pending"; m.events = []; }); commit(); toast("Đã xóa kết quả"); },
  resetAll: async () => { if (!await ask("Xóa hết dữ liệu", "Xóa <b>tất cả các giải</b> và tạo lại giải mẫu?<br><span class='muted'>Bản hiện tại sẽ được tự sao lưu trước, có thể khôi phục ở mục Sao lưu.</span>", "Xóa hết")) return;
    await snapshot("Trước khi xóa hết");
    const t = newTournament("", true); DB = Object.assign({}, DB, { current: t.id, list: [t] }); saveDB(); ui.view = "overview"; render(); toast("Đã tạo lại giải mẫu"); }
};
Object.assign(ACT, MORE_ACT);
// thẻ <a> vẫn chạy bình thường
document.addEventListener("click", e => { const a = e.target.closest("a[data-act]"); if (a) e.stopPropagation(); }, true);

function scheduleToast(last) {
  const t = T(), n = t.matches.filter(m => !m.bye).length;
  if (last > t.sched.end) toast(`Đã tạo ${n} trận, nhưng lịch kéo dài tới ${dmy(last)} — quá ngày kết thúc. Hãy tăng số trận mỗi ngày hoặc số sân.`, "err");
  else toast(`Đã tạo ${n} trận, từ ${dmy(t.sched.start)} đến ${dmy(last)}`);
}

/* =====================================================================
   HỘP THOẠI: ĐỘI BÓNG
   ===================================================================== */
function nextCode() {
  const ts = T().teams; if (!ts.length) return "A1";
  const m = ts.map(t => String(t.code).match(/^([A-Za-z]*)(\d+)$/)).filter(Boolean);
  if (!m.length) return "A" + (ts.length + 1);
  return m[0][1] + (Math.max(...m.map(x => +x[2])) + 1);
}
function teamModal(id) {
  const x = id ? clone(team(id)) : { id: L.uid(), code: nextCode(), name: "", color: "#1f6bff", region: "", logo: "", players: [] };
  const playersText = (x.players || []).map(p => (p.num ? p.num + " " : "") + p.name).join("\n");
  const preview = () => { const im = $("#tmLogo"); if (im) im.src = logoOf(x); };
  openModal({
    title: id ? "Sửa đội bóng" : "Thêm đội bóng",
    body: `<div class="row" style="grid-template-columns:110px 1fr;gap:16px;align-items:start">
      <div class="stack" style="align-items:center"><img id="tmLogo" src="${logoOf(x)}" style="width:96px;height:96px;object-fit:contain;background:rgba(255,255,255,.05);border-radius:14px;padding:6px" alt="">
        <button class="btn b-blue xs" id="tmPick"><i class="fa-solid fa-upload"></i>Logo</button><button class="btn b-ghost xs" id="tmClear">Mặc định</button></div>
      <div class="stack"><div class="row c2"><div class="f"><label>Mã đội <em>*</em></label><input class="in" id="tmCode" value="${esc(x.code)}"></div>
        <div class="f"><label>Màu áo</label><input class="in" type="color" id="tmColor" value="${esc(x.color)}"></div></div>
        <div class="f"><label>Tên đội bóng <em>*</em></label><input class="in" id="tmName" value="${esc(x.name)}" placeholder="FC ..."></div>
        <div class="f"><label>Khu vực / địa phương</label><input class="in" id="tmRegion" value="${esc(x.region || "")}" placeholder="VD: Xóm Trung (dùng khi bốc thăm theo khu vực)"></div></div></div>
      <div class="f" style="margin-top:12px"><label>Danh sách cầu thủ (mỗi dòng 1 người, có thể ghi số áo ở đầu)</label>
        <textarea class="in" id="tmPlayers" rows="7" placeholder="10 Nguyễn Văn A&#10;7 Trần Văn B">${esc(playersText)}</textarea></div>`,
    foot: `<button class="btn b-ghost" data-close>Hủy</button><button class="btn b-blue" id="tmSave"><i class="fa-solid fa-floppy-disk"></i>Lưu</button>`,
    onMount: (m, close) => {
      $("#tmPick", m).onclick = async () => { const [f] = await pickFiles("image/*"); if (!f) return; x.logo = await readImage(f, 200); preview(); };
      $("#tmClear", m).onclick = () => { x.logo = ""; preview(); };
      $("#tmColor", m).oninput = e => { x.color = e.target.value; preview(); };
      $("#tmCode", m).oninput = e => { x.code = e.target.value; preview(); };
      $("#tmName", m).focus();
      $("#tmSave", m).onclick = () => {
        x.code = $("#tmCode", m).value.trim(); x.name = $("#tmName", m).value.trim(); x.region = $("#tmRegion", m).value.trim();
        if (!x.code || !x.name) return toast("Cần nhập mã đội và tên đội", "err");
        if (T().teams.some(y => y.id !== x.id && y.code.toLowerCase() === x.code.toLowerCase())) return toast("Mã đội đã tồn tại", "err");
        x.players = parsePlayers($("#tmPlayers", m).value);
        const t = T(), i = t.teams.findIndex(y => y.id === x.id);
        if (i >= 0) t.teams[i] = x; else t.teams.push(x);
        close(); commit(); toast(id ? "Đã lưu đội" : "Đã thêm đội. Nhớ chia bảng & tạo lại lịch.");
      };
    }
  });
}
function parsePlayers(s) {
  return String(s || "").split(/[\n;]+/).map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(\d{1,3})[\s.\-:]+(.+)$/); return m ? { num: m[1], name: m[2].trim() } : { num: "", name: l }; });
}

/* ---------- nhập Excel ---------- */
const COLOR_WORDS = { "đỏ": "#ef4444", "do": "#ef4444", "xanh": "#2563eb", "xanh dương": "#2563eb", "xanh duong": "#2563eb", "xanh lá": "#22c55e", "xanh la": "#22c55e", "vàng": "#facc15", "vang": "#facc15",
  "trắng": "#f1f5f9", "trang": "#f1f5f9", "đen": "#111827", "den": "#111827", "cam": "#f97316", "tím": "#7c3aed", "tim": "#7c3aed", "hồng": "#f9a8d4", "hong": "#f9a8d4", "xám": "#78716c", "xam": "#78716c", "nâu": "#92400e" };
function toColor(v) { v = String(v || "").trim().toLowerCase(); if (/^#[0-9a-f]{6}$/i.test(v)) return v; return COLOR_WORDS[v] || "#1f6bff"; }
function importModal() {
  openModal({
    title: "Nhập danh sách đội từ Excel",
    body: `<p style="margin-top:0;line-height:1.6">File Excel cần có dòng tiêu đề với các cột: <b>Mã đội</b>, <b>Tên đội</b>, <b>Màu áo</b> (VD: đỏ, xanh, #ff0000), <b>Khu vực</b>, <b>Cầu thủ</b> (cách nhau bởi dấu ;). Chỉ bắt buộc cột Tên đội.</p>
      <label class="chk"><input type="checkbox" id="imReplace" checked>Thay thế danh sách hiện tại (bỏ chọn để thêm vào)</label>`,
    foot: `<button class="btn b-ghost" id="imSample"><i class="fa-solid fa-file-arrow-down"></i>Tải file mẫu</button><button class="btn b-green" id="imPick"><i class="fa-solid fa-file-excel"></i>Chọn file Excel</button>`,
    onMount: (m, close) => {
      $("#imSample", m).onclick = sampleExcel;
      $("#imPick", m).onclick = async () => {
        if (!window.XLSX) return toast("Chưa tải được thư viện Excel — cần kết nối mạng", "err");
        const [f] = await pickFiles(".xlsx,.xls,.csv"); if (!f) return;
        try {
          const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array" });
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
          const col = (r, ...keys) => { const k = Object.keys(r).find(h => keys.some(w => h.toLowerCase().normalize("NFC").includes(w))); return k ? r[k] : ""; };
          const replace = $("#imReplace", m).checked, t = T();
          if (replace) { t.teams = []; t.groups = []; t.matches = []; t.koOrder = []; }
          let n = 0;
          rows.forEach(r => {
            const name = String(col(r, "tên", "ten", "name")).trim(); if (!name) return;
            let code = String(col(r, "mã", "ma ", "code")).trim() || nextCode();
            if (t.teams.some(y => y.code.toLowerCase() === code.toLowerCase())) code = nextCode();
            t.teams.push({ id: L.uid(), code, name, color: toColor(col(r, "màu", "mau", "color")), region: String(col(r, "khu", "region")).trim(), logo: "", players: parsePlayers(col(r, "cầu thủ", "cau thu", "player")) });
            n++;
          });
          close(); commit(); toast(`Đã nhập ${n} đội`);
        } catch (err) { toast("Không đọc được file: " + err.message, "err"); }
      };
    }
  });
}
function sampleExcel() {
  if (!window.XLSX) return toast("Chưa tải được thư viện Excel — cần kết nối mạng", "err");
  const rows = [["Mã đội", "Tên đội", "Màu áo", "Khu vực", "Cầu thủ"]].concat(
    (T().teams.length ? sortedTeams() : DEMO_TEAMS.map(([code, name, color]) => ({ code, name, color, region: "", players: [] })))
      .map(x => [x.code, x.name, x.color, x.region || "", (x.players || []).map(p => (p.num ? p.num + " " : "") + p.name).join("; ")]));
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws, "Đội bóng"); XLSX.writeFile(wb, "danh-sach-doi-mau.xlsx");
}

/* =====================================================================
   HỘP THOẠI: KẾT QUẢ TRẬN
   ===================================================================== */
function matchModal(id) {
  const t = T(), m0 = t.matches.find(x => x.id === id); if (!m0) return;
  if (!m0.home || !m0.away) return toast("Trận này chưa xác định đủ 2 đội", "info");
  const d = clone(m0); d.events = d.events || [];
  const H = team(d.home), A = team(d.away), isKO = !!d.src;
  const bannedHere = L.discipline(t).filter(r => r.bans.some(b => b.matchId === id));
  const isBannedName = (side, name) => bannedHere.some(r => r.teamId === (side === "home" ? d.home : d.away) && r.name.toLowerCase() === String(name || "").trim().toLowerCase());
  const banAlert = bannedHere.length ? `<div class="alert"><i class="fa-solid fa-ban"></i><div><b>Cầu thủ bị cấm thi đấu trận này</b><ul>${bannedHere.map(r =>
    `<li>${esc(r.name)} (${esc(team(r.teamId).name)}) — ${esc(r.bans.find(b => b.matchId === id).reason)}</li>`).join("")}</ul></div></div>` : "";
  const names = side => { const x = side === "home" ? H : A, set = new Set((x.players || []).map(p => p.name));
    L.playerStats(t).filter(r => r.teamId === x.id).forEach(r => set.add(r.name)); return [...set]; };

  const evRows = () => d.events.map((e, i) => `<div class="ev">
      <select class="in" data-ev="type" data-i="${i}"><option value="goal" ${e.type === "goal" ? "selected" : ""}>⚽ Bàn thắng</option><option value="yellow" ${e.type === "yellow" ? "selected" : ""}>🟨 Thẻ vàng</option><option value="red" ${e.type === "red" ? "selected" : ""}>🟥 Thẻ đỏ</option></select>
      <select class="in" data-ev="side" data-i="${i}"><option value="home" ${e.side === "home" ? "selected" : ""}>${esc(H.name)}</option><option value="away" ${e.side === "away" ? "selected" : ""}>${esc(A.name)}</option></select>
      <input class="in ${isBannedName(e.side, e.player) ? "in-bad" : ""}" data-ev="player" data-i="${i}" list="pl-${e.side}" value="${esc(e.player)}" placeholder="Tên cầu thủ" ${isBannedName(e.side, e.player) ? `title="Cầu thủ này đang bị cấm thi đấu"` : ""}>
      <input class="in" data-ev="minute" data-i="${i}" type="number" min="0" max="130" value="${esc(e.minute)}" placeholder="Phút">
      <button class="icon-btn red" data-evdel="${i}" title="Xóa"><i class="fa-solid fa-xmark"></i></button></div>`).join("");
  const body = () => `
    <div class="res-head">
      <div class="res-team"><img src="${logoOf(H)}" alt=""><span>${esc(H.name)}</span></div>
      <div class="res-score">
        <div class="step"><button class="btn b-ghost xs" data-sc="hs" data-d="1">+</button><button class="btn b-ghost xs" data-sc="hs" data-d="-1">−</button></div>
        <input class="in" type="number" min="0" id="rHs" value="${d.hs ?? ""}" placeholder="0"><b>-</b><input class="in" type="number" min="0" id="rAs" value="${d.as ?? ""}" placeholder="0">
        <div class="step"><button class="btn b-ghost xs" data-sc="as" data-d="1">+</button><button class="btn b-ghost xs" data-sc="as" data-d="-1">−</button></div>
      </div>
      <div class="res-team"><img src="${logoOf(A)}" alt=""><span>${esc(A.name)}</span></div>
    </div>
    <p class="small muted" style="text-align:center;margin:8px 0 14px">${esc(stageLabel(d))} · ${dm(d.date)} · ${esc(d.time)} · Sân ${d.pitch}</p>
    ${banAlert}
    <div class="row c2"><div class="f"><label>Trạng thái</label><select class="in" id="rStatus">
      <option value="pending" ${d.status === "pending" ? "selected" : ""}>Chưa đấu</option><option value="live" ${d.status === "live" ? "selected" : ""}>Đang đá</option><option value="done" ${d.status === "done" ? "selected" : ""}>Đã đá (kết thúc)</option><option value="postponed" ${d.status === "postponed" ? "selected" : ""}>Hoãn trận</option></select></div>
      ${isKO ? `<div class="f"><label>Đá luân lưu (nếu hòa)</label><div class="hstack" style="flex-wrap:nowrap"><input class="in" type="number" min="0" id="rPh" value="${d.ph ?? ""}" placeholder="${esc(H.code)}"><b>-</b><input class="in" type="number" min="0" id="rPa" value="${d.pa ?? ""}" placeholder="${esc(A.code)}"></div></div>` : "<div></div>"}</div>
    <div class="row c4" style="margin-top:10px">
      <div class="f"><label>Ngày thi đấu</label><input class="in" type="date" id="rDate" value="${d.date || ""}"></div>
      <div class="f"><label>Giờ</label><input class="in" type="time" id="rTime" value="${d.time || ""}"></div>
      <div class="f"><label>Sân</label><input class="in" type="number" min="1" id="rPitch" value="${d.pitch || 1}"></div>
      <div class="f"><label>${d.status === "postponed" ? "Lý do hoãn" : "Ghi chú"}</label><input class="in" id="rNote" value="${esc(d.note || "")}" placeholder="${d.status === "postponed" ? "VD: Mưa lớn, sân ngập" : "Không bắt buộc"}"></div></div>
    <div class="hstack" style="margin-top:14px"><b style="flex:1">Diễn biến</b>
      <button class="btn b-green xs" data-add="goal"><i class="fa-solid fa-futbol"></i>Bàn thắng</button>
      <button class="btn b-gold xs" data-add="yellow"><i class="fa-solid fa-square"></i>Thẻ vàng</button>
      <button class="btn b-red xs" data-add="red"><i class="fa-solid fa-square"></i>Thẻ đỏ</button></div>
    <div class="events" id="rEvents">${evRows() || `<p class="small muted" style="margin:6px 0">Chưa có diễn biến. Thêm bàn thắng sẽ tự cộng tỉ số.</p>`}</div>
    <datalist id="pl-home">${names("home").map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <datalist id="pl-away">${names("away").map(n => `<option value="${esc(n)}">`).join("")}</datalist>`;

  openModal({
    title: "Kết quả trận đấu", wide: true, body: body(),
    foot: `<button class="btn b-purple" id="rBoard" style="margin-right:auto"><i class="fa-solid fa-tv"></i>Lên bảng tỉ số</button><button class="btn b-ghost" data-close>Hủy</button><button class="btn b-blue" id="rSave"><i class="fa-solid fa-floppy-disk"></i>Lưu kết quả</button>`,
    onMount: (m, close) => {
      const B = $(".modal-b", m);
      const read = () => {
        const v = s => { const el = $(s, m); return el && el.value !== "" ? Math.max(0, +el.value) : null; };
        d.hs = v("#rHs"); d.as = v("#rAs"); d.status = $("#rStatus", m).value;
        d.date = $("#rDate", m).value; d.time = $("#rTime", m).value; d.pitch = Math.max(1, +$("#rPitch", m).value || 1); d.note = $("#rNote", m).value.trim();
        if (isKO) { d.ph = v("#rPh"); d.pa = v("#rPa"); }
      };
      const redraw = () => { read(); B.innerHTML = body(); };
      const bump = (k, n) => { read(); d[k] = Math.max(0, (d[k] || 0) + n); if (d.status === "pending") d.status = "live"; B.innerHTML = body(); };
      B.addEventListener("click", e => {
        const s = e.target.closest("[data-sc]"), a = e.target.closest("[data-add]"), del = e.target.closest("[data-evdel]");
        if (s) bump(s.dataset.sc, +s.dataset.d);
        if (a) { read(); const side = "home"; d.events.push({ type: a.dataset.add, side, player: "", minute: "" }); if (a.dataset.add === "goal") { d.hs = (d.hs || 0) + 1; if (d.status === "pending") d.status = "live"; } B.innerHTML = body(); }
        if (del) { read(); const e2 = d.events.splice(+del.dataset.evdel, 1)[0]; if (e2.type === "goal") { const k = e2.side === "home" ? "hs" : "as"; d[k] = Math.max(0, (d[k] || 0) - 1); } B.innerHTML = body(); }
      });
      B.addEventListener("input", e => { const el = e.target; if (el.dataset.ev === "player" || el.dataset.ev === "minute") d.events[+el.dataset.i][el.dataset.ev] = el.value; });
      B.addEventListener("change", e => {
        const el = e.target, k = el.dataset.ev; if (k !== "type" && k !== "side") return;
        read(); const ev = d.events[+el.dataset.i], before = { ...ev }; ev[k] = el.value;
        const g = x => x.type === "goal" ? (x.side === "home" ? "hs" : "as") : null, a = g(before), b = g(ev);
        if (a !== b) { if (a) d[a] = Math.max(0, (d[a] || 0) - 1); if (b) d[b] = (d[b] || 0) + 1; }
        B.innerHTML = body();
      });
      // đổi trạng thái sang "Hoãn" thì đổi nhãn ô ghi chú ngay
      B.addEventListener("change", e => { if (e.target.id === "rStatus") redraw(); });
      $("#rSave", m).onclick = () => {
        if (deny("results")) return;
        read();
        if (d.status === "done" && (d.hs == null || d.as == null)) { d.hs = d.hs ?? 0; d.as = d.as ?? 0; }
        if (d.status === "done" && isKO && d.hs === d.as && (d.ph == null || d.pa == null || d.ph === d.pa)) return toast("Trận knock-out hòa — hãy nhập tỉ số đá luân lưu", "err");
        d.events = d.events.filter(e => String(e.player || "").trim() || e.type === "goal");
        const wasPost = m0.status === "postponed";
        Object.assign(m0, { hs: d.hs, as: d.as, ph: d.ph, pa: d.pa, status: d.status, events: d.events, date: d.date, time: d.time, pitch: d.pitch, note: d.note });
        close(); commit();
        const bad = d.events.filter(e => isBannedName(e.side, e.player));
        if (bad.length) toast(`Cảnh báo: ${bad.map(e => e.player).join(", ")} đang bị cấm thi đấu trận này`, "err");
        else if (d.status === "done") toast("Đã lưu kết quả — BXH, thống kê đã tự cập nhật", "ok", { label: "Tạo poster kết quả", fn: () => { ui.poster = { kind: "match", match: m0.id, date: "" }; ACT.go({ dataset: { view: "poster" } }); } });
        else if (d.status === "postponed" && !wasPost) toast("Đã hoãn trận", "ok", { label: "Soạn thông báo hoãn", fn: () => { ui.media.kind = "postpone"; ACT.go({ dataset: { view: "media" } }); } });
        else toast("Đã lưu");
      };
      $("#rBoard", m).onclick = () => { read(); pushScoreboard(d, H, A); };
    }
  });
}

// gửi tên đội, logo, màu, tỉ số sang bảng tỉ số (../bang-ti-so.html) qua bộ nhớ trình duyệt
function pushScoreboard(d, H, A) {
  const key = "bang-ti-so:tran-1";
  const def = { home: { score: 0 }, away: { score: 0 }, league: "", center: "#3a0a40", accent: "#c31cff", period: "", clock: 0, clockAt: 0, add: "", bg: "field", mode: "both" };
  let S = def;
  try { S = Object.assign(def, JSON.parse(localStorage.getItem(key) || "{}")); } catch (e) {}
  const short = x => { const w = x.name.replace(/^FC\s+/i, "").trim().split(/\s+/); return (w.length > 1 ? w.map(s => s[0]).join("") : w[0].slice(0, 3)).toUpperCase().slice(0, 4); };
  const side = (x, sc) => ({ name: x.name, short: short(x), c1: shade(x.color, .25), c2: x.color, logo: x.logo || defaultLogo(x), score: sc || 0 });
  S.home = side(H, d.hs); S.away = side(A, d.as);
  S.period = stageLabel(d); S.mode = S.mode === "none" ? "both" : S.mode;
  try {
    localStorage.setItem(key, JSON.stringify(S));
    if ("BroadcastChannel" in window) { const ch = new BroadcastChannel(key); ch.postMessage({ state: S, fx: { mode: true } }); ch.close(); }
    toast("Đã đưa trận đấu lên bảng tỉ số (mở bang-ti-so.html trong cùng trình duyệt)");
  } catch (e) { toast("Không gửi được: bộ nhớ trình duyệt đầy", "err"); }
}

/* ---------- thông báo ---------- */
function newsModal(id) {
  const n = id ? T().news.find(x => x.id === id) : { id: L.uid(), date: L.iso(new Date()), title: "", body: "" };
  openModal({
    title: id ? "Sửa thông báo" : "Thêm thông báo",
    body: `<div class="stack"><div class="row" style="grid-template-columns:1fr 170px"><div class="f"><label>Tiêu đề</label><input class="in" id="nTitle" value="${esc(n.title)}"></div>
      <div class="f"><label>Ngày</label><input class="in" type="date" id="nDate" value="${n.date}"></div></div>
      <div class="f"><label>Nội dung</label><textarea class="in" id="nBody" rows="6">${esc(n.body)}</textarea></div></div>`,
    foot: `<button class="btn b-ghost" data-close>Hủy</button><button class="btn b-blue" id="nSave"><i class="fa-solid fa-floppy-disk"></i>Lưu</button>`,
    onMount: (m, close) => {
      $("#nTitle", m).focus();
      $("#nSave", m).onclick = () => {
        n.title = $("#nTitle", m).value.trim(); n.body = $("#nBody", m).value.trim(); n.date = $("#nDate", m).value;
        if (!n.title) return toast("Cần nhập tiêu đề", "err");
        if (!id) T().news.push(n);
        close(); commit(); toast("Đã lưu thông báo");
      };
    }
  });
}

/* =====================================================================
   XUẤT DỮ LIỆU
   ===================================================================== */
function scheduleRows() {
  return visibleMatches().map((m, i) => [i + 1, dmy(m.date), m.time, "Sân " + m.pitch, stageLabel(m), slotName(m, "home"),
    m.status === "pending" ? "" : scoreText(m), slotName(m, "away"), { pending: "Chưa đấu", live: "Đang đá", done: "Đã đá" }[m.status]]);
}
function exportXlsx(kind) {
  if (!window.XLSX) return toast("Chưa tải được thư viện Excel — cần kết nối mạng", "err");
  const t = T(), wb = XLSX.utils.book_new();
  const add = (name, rows, cols) => { const ws = XLSX.utils.aoa_to_sheet(rows); if (cols) ws["!cols"] = cols.map(w => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
  if (kind === "teams" || kind === "all") add("Đội bóng", [["Mã đội", "Tên đội", "Màu áo", "Khu vực", "Bảng", "Cầu thủ"]].concat(sortedTeams().map(x => [x.code, x.name, x.color, x.region || "", groupOf(x.id), (x.players || []).map(p => (p.num ? p.num + " " : "") + p.name).join("; ")])), [8, 24, 10, 16, 10, 60]);
  if (kind === "players" || kind === "all") {
    const ps = L.playerStats(t), stat = (tid, n) => ps.find(r => r.teamId === tid && r.name.toLowerCase() === n.toLowerCase()) || { goals: 0, yellow: 0, red: 0 };
    const rows = [];
    sortedTeams().forEach(x => {
      const names = new Map((x.players || []).map(p => [p.name.toLowerCase(), p]));
      ps.filter(r => r.teamId === x.id && !names.has(r.name.toLowerCase())).forEach(r => names.set(r.name.toLowerCase(), { num: "", name: r.name }));
      [...names.values()].forEach(p => { const s = stat(x.id, p.name); rows.push([x.code, x.name, p.num, p.name, s.goals, s.yellow, s.red]); });
    });
    add("Cầu thủ", [["Mã đội", "Đội", "Số áo", "Cầu thủ", "Bàn thắng", "Thẻ vàng", "Thẻ đỏ"]].concat(rows), [8, 24, 7, 26, 10, 9, 8]);
  }
  if (kind === "schedule" || kind === "all") add("Lịch thi đấu", [["STT", "Ngày", "Giờ", "Sân", "Vòng", "Đội 1", "Tỉ số", "Đội 2", "Trạng thái"]].concat(scheduleRows()), [5, 12, 7, 7, 12, 26, 14, 26, 11]);
  if (kind === "all") {
    t.groups.forEach(g => add((g.name === "Chung" ? "BXH" : "BXH bảng " + g.name).slice(0, 31), [["#", "Đội", "ST", "T", "H", "B", "BT", "BB", "HS", "Điểm"]].concat(L.standings(t, g.name).map((r, i) => [i + 1, team(r.id).code + " - " + team(r.id).name, r.p, r.w, r.d, r.l, r.gf, r.ga, r.gd, r.pts])), [4, 28, 5, 5, 5, 5, 5, 5, 5, 7]));
    const ps = L.playerStats(t);
    add("Ghi bàn", [["#", "Cầu thủ", "Đội", "Số bàn"]].concat(ps.filter(r => r.goals).sort((a, b) => b.goals - a.goals).map((r, i) => [i + 1, r.name, team(r.teamId) ? team(r.teamId).name : "", r.goals])), [4, 24, 24, 8]);
    add("Thẻ phạt", [["#", "Cầu thủ", "Đội", "Vàng", "Đỏ"]].concat(ps.filter(r => r.yellow || r.red).map((r, i) => [i + 1, r.name, team(r.teamId) ? team(r.teamId).name : "", r.yellow, r.red])), [4, 24, 24, 7, 7]);
  }
  XLSX.writeFile(wb, `${slug(t.name)}-${{ all: "toan-bo", teams: "doi-bong", players: "cau-thu", schedule: "lich-thi-dau" }[kind]}.xlsx`);
  toast("Đã xuất file Excel");
}
function printDoc(heading, html) {
  const t = T(), w = window.open("", "_blank");
  if (!w) return toast("Trình duyệt chặn cửa sổ mới — hãy cho phép popup", "err");
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(heading)} - ${esc(t.name)}</title>
    <style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{margin:0;font-size:22px;text-transform:uppercase}h2{font-size:16px;margin:18px 0 6px}
    .sub{color:#555;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:10px}th,td{border:1px solid #bbb;padding:5px 6px;text-align:left}
    th{background:#0b2160;color:#fff}tr:nth-child(even) td{background:#f2f5fb}.c{text-align:center}@page{margin:12mm}</style></head>
    <body><h1>${esc(t.name)}</h1><div class="sub">${esc(heading)} · ${range(t.start, t.end)} · ${esc(t.venue)}</div>${html}
    <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
  w.document.close();
}
function printSchedule() {
  const rows = scheduleRows();
  if (!rows.length) return toast("Chưa có lịch thi đấu", "err");
  printDoc("Lịch thi đấu", `<table><thead><tr>${["STT", "Ngày", "Giờ", "Sân", "Vòng", "Đội 1", "Tỉ số", "Đội 2", "Trạng thái"].map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${[0, 6].includes(i) ? "c" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
}
function printStandings() {
  const t = T(); if (!t.groups.length) return toast("Chưa có bảng đấu", "err");
  printDoc("Bảng xếp hạng", t.groups.map(g => `<h2>${g.name === "Chung" ? "Bảng xếp hạng chung" : "Bảng " + g.name}</h2><table><thead><tr>${["#", "Đội", "ST", "T", "H", "B", "BT", "BB", "HS", "Điểm"].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>
    ${L.standings(t, g.name).map((r, i) => `<tr><td class="c">${i + 1}</td><td>${esc(team(r.id).code + " - " + team(r.id).name)}</td>${[r.p, r.w, r.d, r.l, r.gf, r.ga, r.gd, r.pts].map(v => `<td class="c">${v}</td>`).join("")}</tr>`).join("")}</tbody></table>`).join(""));
}
function printPlayers() {
  const ts = sortedTeams(); if (!ts.length) return toast("Chưa có đội", "err");
  printDoc("Danh sách cầu thủ", ts.map(x => `<h2>${esc(x.code)} - ${esc(x.name)}${x.region ? ` <small style="font-weight:normal;color:#666">(${esc(x.region)})</small>` : ""}</h2>
    ${(x.players || []).length ? `<table><thead><tr><th class="c" style="width:40px">STT</th><th class="c" style="width:60px">Số áo</th><th>Họ tên</th><th style="width:30%">Ký tên</th></tr></thead><tbody>
      ${x.players.map((p, i) => `<tr><td class="c">${i + 1}</td><td class="c">${esc(p.num)}</td><td>${esc(p.name)}</td><td></td></tr>`).join("")}</tbody></table>` : "<p><i>Chưa có danh sách cầu thủ</i></p>"}`).join(""));
}
function printResults() {
  const ms = visibleMatches().filter(m => m.status === "done");
  if (!ms.length) return toast("Chưa có trận nào kết thúc", "err");
  printDoc("Kết quả thi đấu", `<table><thead><tr>${["Ngày", "Vòng", "Đội 1", "Tỉ số", "Đội 2", "Ghi bàn"].map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>
    ${ms.map(m => `<tr><td>${dmy(m.date)}</td><td>${esc(stageLabel(m))}</td><td>${esc(slotName(m, "home"))}</td><td class="c"><b>${esc(scoreText(m))}</b></td><td>${esc(slotName(m, "away"))}</td>
      <td>${(m.events || []).filter(e => e.type === "goal" && e.player).map(e => esc(e.player + (e.minute ? " " + e.minute + "'" : ""))).join(", ")}</td></tr>`).join("")}</tbody></table>`);
}
function backup() {
  const blob = new Blob([JSON.stringify({ app: "qlgd", version: 1, tournament: T() })], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = slug(T().name) + "-sao-luu.json"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast("Đã tải bản sao lưu");
}
async function restore() {
  const [f] = await pickFiles(".json,application/json"); if (!f) return;
  try {
    const data = JSON.parse(await f.text()), t = data.tournament;
    if (!t || !Array.isArray(t.teams)) throw new Error("File không đúng định dạng");
    const base = newTournament(t.name);
    const merged = Object.assign(base, t, { id: L.uid(), format: Object.assign(base.format, t.format), sched: Object.assign(base.sched, t.sched), settings: Object.assign(base.settings, t.settings) });
    DB.list.push(merged); DB.current = merged.id; saveDB(); ui.view = "overview"; render(); toast("Đã khôi phục: " + merged.name);
  } catch (e) { toast("Không khôi phục được: " + e.message, "err"); }
}

/* =====================================================================
   GIAO DIỆN TV
   ===================================================================== */
let tvTimer = null, tvClock = null, tvIdx = 0;
function tvSlides() {
  const t = T(), ms = visibleMatches(), s = [];
  const row = m => `<div class="tv-match"><div class="when">${dm(m.date)} · ${esc(m.time)}<br>Sân ${m.pitch} · ${esc(stageLabel(m))}</div>
    <div class="tm r">${tvTeam(m, "home")}</div><div class="sc">${m.status === "pending" ? "VS" : esc(scoreText(m))}</div><div class="tm">${tvTeam(m, "away", true)}</div></div>`;
  const live = ms.filter(m => m.status === "live");
  if (live.length) s.push(`<h2><i class="fa-solid fa-circle" style="color:#ef4444;font-size:.5em;vertical-align:middle"></i> Đang diễn ra</h2>${live.slice(0, 6).map(row).join("")}`);
  const up = ms.filter(m => m.status === "pending" && m.home && m.away).slice(0, 6);
  if (up.length) s.push(`<h2>Lịch thi đấu sắp tới</h2>${up.map(row).join("")}`);
  const done = ms.filter(m => m.status === "done").slice(-6).reverse();
  if (done.length) s.push(`<h2>Kết quả mới nhất</h2>${done.map(row).join("")}`);
  for (let i = 0; i < t.groups.length; i += 2) {
    const gs = t.groups.slice(i, i + 2);
    s.push(`<h2>Bảng xếp hạng</h2><div class="tv-groups">${gs.map(g => `<div><h2 style="font-size:3.4vh;margin-bottom:1vh">${g.name === "Chung" ? "Xếp hạng chung" : "Bảng " + g.name}</h2>${standingTable(g.name, true)}</div>`).join("")}</div>`);
  }
  if (t.matches.some(m => m.src)) s.push(`<h2>Nhánh đấu knock-out</h2>${bracketView()}`);
  const sc = L.playerStats(t).filter(r => r.goals).sort((a, b) => b.goals - a.goals).slice(0, 8);
  if (sc.length) s.push(`<h2>Vua phá lưới</h2><table class="tbl"><thead><tr><th class="c">#</th><th>Cầu thủ</th><th>Đội</th><th class="c">Bàn</th></tr></thead><tbody>${sc.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${esc(r.name)}</td><td><div class="team-cell"><img class="logo" src="${logoOf(team(r.teamId))}" alt="">${esc(team(r.teamId) ? team(r.teamId).name : "")}</div></td><td class="c b">${r.goals}</td></tr>`).join("")}</tbody></table>`);
  if (!s.length) s.push(`<h2>${esc(t.name)}</h2><p style="font-size:3vh">Chưa có lịch thi đấu.</p>`);
  return s;
}
function tvTeam(m, side, right) {
  const id = side === "home" ? m.home : m.away, x = id && team(id);
  if (!x) return `<span style="color:#7f93bd">${esc(slotName(m, side))}</span>`;
  return right ? `<img src="${logoOf(x)}" alt=""><span>${esc(x.name)}</span>` : `<span>${esc(x.name)}</span><img src="${logoOf(x)}" alt="">`;
}
function openTV() {
  const tv = $("#tv"), t = T();
  const ticker = t.news.map(n => `📢 ${n.title}: ${n.body}`).join("     •     ") || `${t.name} — ${t.slogan || ""} — ${t.venue || ""}`;
  tv.innerHTML = `<div class="tv-bg"></div><div class="tv-head"><i class="fa-solid fa-trophy"></i><div class="t">${esc(t.name)}</div><div class="clock" id="tvClock"></div></div>
    <div class="tv-body" id="tvBody"></div><div class="tv-dots" id="tvDots"></div>
    <div class="tv-ctrl"><button class="btn b-ghost sm" data-tv="-1"><i class="fa-solid fa-chevron-left"></i></button><button class="btn b-ghost sm" data-tv="1"><i class="fa-solid fa-chevron-right"></i></button>
      <button class="btn b-ghost sm" data-tv="fs"><i class="fa-solid fa-expand"></i>Toàn màn hình</button><button class="btn b-red sm" data-tv="x"><i class="fa-solid fa-xmark"></i>Thoát (Esc)</button></div>
    <div class="tv-foot"><span class="lab"><i class="fa-solid fa-bullhorn"></i> Thông báo</span><div class="tv-ticker"><span>${esc(ticker)}</span></div></div>`;
  tv.hidden = false; tvIdx = 0; tvShow();
  tv.onclick = e => { const b = e.target.closest("[data-tv]"); if (!b) return; const v = b.dataset.tv;
    if (v === "x") closeTV(); else if (v === "fs") { document.fullscreenElement ? document.exitFullscreen() : tv.requestFullscreen && tv.requestFullscreen().catch(() => {}); } else { tvIdx += +v; tvShow(); } };
  const tick = () => { const d = new Date(); const c = $("#tvClock"); if (c) c.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); };
  tick(); clearInterval(tvClock); tvClock = setInterval(tick, 1000);
}
function tvShow() {
  const s = tvSlides(); tvIdx = (tvIdx % s.length + s.length) % s.length;
  $("#tvBody").innerHTML = `<div class="tv-slide">${s[tvIdx]}</div>`;
  $("#tvDots").innerHTML = s.map((_, i) => `<i class="${i === tvIdx ? "on" : ""}"></i>`).join("");
  clearTimeout(tvTimer); tvTimer = setTimeout(() => { tvIdx++; tvShow(); }, 10000);
}
function closeTV() { $("#tv").hidden = true; clearTimeout(tvTimer); clearInterval(tvClock); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
document.addEventListener("keydown", e => { if ($("#tv").hidden) return; if (e.key === "ArrowRight") { tvIdx++; tvShow(); } if (e.key === "ArrowLeft") { tvIdx--; tvShow(); } });

/* ===================================================================== */
resolveAll(T());
render();
if (document.fonts) document.fonts.ready.then(() => { if (ui.view === "poster") drawPoster(); });
})();
