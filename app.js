(() => {
"use strict";
const T = window.TRIP;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enc = encodeURIComponent;

/* ---------- Speicher: lokal zuerst, dann Abgleich ---------- */
const K = { state: "sc27-state", out: "sc27-outbox", cur: "sc27-cursor", sync: "sc27-sync" };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
let state = load(K.state, {});
let outbox = load(K.out, {});
let syncCfg = load(K.sync, {});
const fileCfg = window.SYNC_CONFIG || {};
const cfg = () => ({ url: syncCfg.url || fileCfg.url || "", key: syncCfg.key || fileCfg.anonKey || "", code: syncCfg.code || "" });

function get(id, d) { const e = state[id]; return e && !e.del ? e.d : d; }
function put(id, d) { state[id] = { d, ts: Date.now(), del: false }; outbox[id] = state[id].ts; persist(); queueSync(); }
function remove(id) { state[id] = { d: null, ts: Date.now(), del: true }; outbox[id] = state[id].ts; persist(); queueSync(); }
function all(prefix) { return Object.entries(state).filter(([k, v]) => k.startsWith(prefix) && !v.del).map(([k, v]) => ({ id: k, ...v.d })); }
function persist() { save(K.state, state); save(K.out, outbox); }

// Beitritt per Link: #join=CODE&u=URL&k=KEY
(function join() {
  const h = location.hash;
  if (!h.includes("join=")) return;
  const p = new URLSearchParams(h.slice(1));
  syncCfg = { code: p.get("join") || "", url: p.get("u") || syncCfg.url || "", key: p.get("k") || syncCfg.key || "" };
  save(K.sync, syncCfg);
  localStorage.removeItem(K.cur);
  history.replaceState(null, "", location.pathname + location.search + "#heute");
})();

let syncing = false, syncTimer = null, status = "off", lastSync = null, pendingRender = false;
function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(sync, 1200); }
async function rpc(fn, body) {
  const c = cfg();
  const r = await fetch(c.url.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: c.key, Authorization: "Bearer " + c.key },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}
async function sync() {
  const c = cfg();
  if (!c.url || !c.key || !c.code) return setStatus("off");
  if (!navigator.onLine) return setStatus("offline");
  if (syncing) return;
  syncing = true; setStatus("busy");
  try {
    const ids = Object.keys(outbox);
    if (ids.length) {
      const sent = {};
      const items = ids.map(id => { sent[id] = state[id].ts; return { id, data: state[id].d, ts: state[id].ts, deleted: !!state[id].del }; });
      await rpc("sc_push", { p_code: c.code, p_items: items });
      ids.forEach(id => { if (outbox[id] === sent[id]) delete outbox[id]; });
    }
    const cursor = localStorage.getItem(K.cur) || "1970-01-01T00:00:00+00:00";
    const rows = await rpc("sc_pull", { p_code: c.code, p_since: cursor });
    let max = cursor, changed = false;
    for (const r of rows) {
      if (Date.parse(r.server_at) > Date.parse(max)) max = r.server_at;
      const cur = state[r.id];
      if (!cur || Number(r.ts) > cur.ts) { state[r.id] = { d: r.data, ts: Number(r.ts), del: r.deleted }; changed = true; }
    }
    localStorage.setItem(K.cur, max);
    persist();
    lastSync = new Date();
    setStatus("ok");
    if (changed) safeRender();
  } catch (e) {
    console.warn("Sync", e);
    setStatus(navigator.onLine ? "error" : "offline");
  } finally { syncing = false; }
}
function setStatus(s) {
  status = s;
  const el = $("#sync");
  if (!el) return;
  const n = Object.keys(outbox).length;
  const txt = { off: "Nur auf diesem Handy", ok: "Verbunden", busy: "Gleicht ab", offline: n ? "Offline, wird später geteilt" : "Offline", error: "Nicht verbunden" }[s];
  el.textContent = txt;
  el.dataset.s = s;
}
function safeRender() {
  const a = document.activeElement;
  if (a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT")) { pendingRender = true; return; }
  render();
}
document.addEventListener("focusout", () => setTimeout(() => { if (pendingRender) { pendingRender = false; safeRender(); } }, 50));
window.addEventListener("online", sync);
window.addEventListener("offline", () => setStatus("offline"));
document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
setInterval(() => { if (!document.hidden) sync(); }, 30000);

/* ---------- Datum und Uhrzeit ---------- */
const qs = new URLSearchParams(location.search);
const testDate = qs.get("date"), testTime = qs.get("time");
const today = () => testDate || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const nowHM = () => testTime || new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const fmtDate = s => { const [y, m, d] = s.split("-"); return `${d}.${m}.`; };
const wd = (s, style) => new Date(s + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: style, timeZone: "UTC" });
const longDate = s => new Date(s + "T12:00:00Z").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const WORDS = { vormittags: "10:30", mittags: "12:30", nachmittags: "15:00", abends: "19:00" };
const stopTime = s => { const m = String(s).match(/(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, "0") + ":" + m[2] : WORDS[s] || "12:00"; };

/* ---------- Links ---------- */
const MAPS = "sc27-maps", ME = "sc27-me";
const mapsApp = () => { try { return localStorage.getItem(MAPS) || "google"; } catch (e) { return "google"; } };
const walking = d => d.drive === "kein Auto";
const gNav = (addr, walk) => `https://www.google.com/maps/dir/?api=1&destination=${enc(addr)}&travelmode=${walk ? "walking" : "driving"}`;
const aNav = (addr, walk) => `https://maps.apple.com/?daddr=${enc(addr)}&dirflg=${walk ? "w" : "d"}`;
const navLink = (addr, walk) => mapsApp() === "apple" ? aNav(addr, walk) : gNav(addr, walk);
function dayRoute(d) {
  const pts = d.route || d.stops.map(s => s[2]).filter((a, i, arr) => a !== arr[i - 1]);
  if (pts.length < 2) return "";
  const [o, ...rest] = pts, dest = rest.pop();
  let u = `https://www.google.com/maps/dir/?api=1&origin=${enc(o)}&destination=${enc(dest)}&travelmode=${walking(d) ? "walking" : "driving"}`;
  if (rest.length) u += `&waypoints=${enc(rest.join("|"))}`;
  return u;
}
const hotelLink = h => `https://www.booking.com/searchresults.html?ss=${enc(h[0])}&checkin=${h[1]}&checkout=${h[2]}&group_adults=${h[3]}&no_rooms=1&selected_currency=EUR`;

/* ---------- Symbole ---------- */
const I = {
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 4.5 20.3l.7.7L12 18l6.8 3 .7-.7z"/></svg>',
  go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17h14M7 17l1.5-6h7l1.5 6M7.5 20v-3M16.5 20v-3"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 7v3M5.5 11.5l1.5 1.5M18.5 11.5 17 13"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M9 11v5M15 11v5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  wheel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 14.5V21M9.6 11.2 3.5 9.5M14.4 11.2l6.1-1.7"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
  coins: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>'
};

/* ---------- Landschaften (Farben aus den Tokens, Dark Mode automatisch) ---------- */
const stars = pts => `<g style="opacity:var(--stars)" fill="#fff">${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}"/>`).join("")}</g>`;
const SCENE = {
  loch: `<svg class="scene" viewBox="0 0 358 170" aria-hidden="true"><defs><linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sky-top)"/><stop offset="1" style="stop-color:var(--sky-bot)"/></linearGradient><radialGradient id="glowA"><stop offset="0" style="stop-color:var(--sun);stop-opacity:.55"/><stop offset="1" style="stop-color:var(--sun);stop-opacity:0"/></radialGradient></defs>
    <rect width="358" height="170" fill="url(#skyA)"/>${stars([[40, 22, 1], [92, 40, .8], [150, 16, 1.2], [196, 34, .8], [318, 20, 1], [300, 52, .7], [64, 58, .7]])}
    <circle cx="262" cy="74" r="60" fill="url(#glowA)"/><circle cx="262" cy="74" r="20" style="fill:var(--sun)"/>
    <path d="M0 104 L46 70 L78 88 L120 52 L160 84 L196 66 L236 96 L282 70 L322 92 L358 78 V170 H0Z" style="fill:var(--hill-far)"/>
    <path d="M0 118 L38 98 L70 110 L112 82 L150 106 L190 94 L232 114 L276 96 L318 112 L358 102 V170 H0Z" style="fill:var(--hill-mid)"/>
    <rect y="122" width="358" height="48" style="fill:var(--water)"/>
    <g style="stroke:var(--water-line)" stroke-width="1.4" stroke-linecap="round"><path d="M226 132h70M244 140h40M30 136h50M110 146h34M190 154h60"/></g>
    <path d="M0 138 C40 128 70 132 98 142 C124 151 150 150 172 170 H0Z" style="fill:var(--hill-near)"/><path d="M358 144 C330 136 300 142 284 152 C272 160 268 166 266 170 H358Z" style="fill:var(--hill-near)"/></svg>`,
  viaduct: `<svg class="scene" viewBox="0 0 358 150" aria-hidden="true"><defs><linearGradient id="skyB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sky-top)"/><stop offset="1" style="stop-color:var(--sky-bot)"/></linearGradient>
    <mask id="arch"><rect width="358" height="150" fill="#fff"/><g fill="#000">${[[34, 112], [60, 110], [86, 108], [112, 107], [138, 106], [164, 106], [190, 106], [216, 107], [242, 108], [268, 110], [294, 112]].map(a => `<path d="M${a[0]} 140V${a[1]}a10 10 0 0 1 20 0V140Z"/>`).join("")}</g></mask></defs>
    <rect width="358" height="150" fill="url(#skyB)"/>${stars([[30, 18, 1], [120, 12, .8], [210, 26, 1], [330, 14, .9]])}
    <circle cx="72" cy="46" r="13" style="fill:var(--sun)"/>
    <path d="M0 92 L40 50 L66 70 L104 30 L146 74 L176 56 L214 84 L262 38 L300 70 L358 52 V150 H0Z" style="fill:var(--hill-far)"/>
    <path d="M0 112 L52 84 L98 102 L150 80 L210 100 L268 82 L320 98 L358 90 V150 H0Z" style="fill:var(--hill-mid)"/>
    <rect y="128" width="358" height="22" style="fill:var(--water)"/>
    <path d="M24 98 C120 88 238 88 334 98 V140 H24Z" style="fill:var(--viaduct)" mask="url(#arch)"/>
    <g style="fill:var(--train)"><rect x="196" y="82" width="28" height="9" rx="2"/><rect x="226" y="83" width="24" height="8" rx="1.5"/><rect x="252" y="84" width="24" height="8" rx="1.5"/><rect x="278" y="85" width="22" height="8" rx="1.5"/></g>
    <g fill="#fff" opacity=".8"><circle cx="200" cy="76" r="4"/><circle cx="192" cy="70" r="5"/><circle cx="182" cy="66" r="5.5"/><circle cx="171" cy="64" r="4.5"/></g>
    <path d="M0 150 V136 C40 130 80 134 110 150Z" style="fill:var(--hill-near)"/></svg>`
};
const POST = {
  train: `<rect width="150" height="84" style="fill:var(--loch-soft)"/><path d="M0 50 L30 26 L58 44 L92 18 L124 40 L150 30 V84 H0Z" style="fill:var(--hill-far)" opacity=".7"/><rect y="56" width="150" height="28" style="fill:var(--hill-near)"/><g style="fill:var(--viaduct)"><path d="M8 46h134v5H8z"/><path d="M12 51h6v20h-6zM30 51h6v20h-6zM48 51h6v20h-6zM66 51h6v20h-6zM84 51h6v20h-6zM102 51h6v20h-6zM120 51h6v20h-6z"/></g><g style="fill:var(--train)"><rect x="54" y="38" width="22" height="8" rx="2"/><rect x="78" y="39" width="18" height="7" rx="1.5"/><rect x="98" y="39" width="18" height="7" rx="1.5"/></g><g fill="#fff" opacity=".75"><circle cx="58" cy="32" r="3.5"/><circle cx="52" cy="26" r="4.5"/><circle cx="44" cy="22" r="5"/></g>`,
  nessie: `<rect width="150" height="84" style="fill:var(--sky-bot)"/><path d="M0 40 L40 22 L80 38 L120 20 L150 32 V84 H0Z" style="fill:var(--hill-mid)"/><rect y="46" width="150" height="38" style="fill:var(--water)"/><path d="M96 26h10v-10h4v4h4v-4h4v10h6v20H96z" style="fill:var(--viaduct)"/><g style="fill:var(--hill-near)"><path d="M30 62c4-10 12-10 16 0zM52 62c3-7 9-7 12 0zM68 62c2-5 6-5 8 0z"/><circle cx="28" cy="58" r="3"/></g><g style="stroke:var(--water-line)" stroke-width="1.2" stroke-linecap="round"><path d="M20 70h70M50 76h40"/></g>`,
  castle: `<rect width="150" height="84" style="fill:var(--ember-soft)"/><path d="M0 84 V60 C30 50 50 46 70 40 L150 40 V84Z" style="fill:var(--hill-mid)"/><g style="fill:var(--viaduct)"><path d="M70 40v-14h6v-6h4v6h8v-10h4v4h4v-4h4v10h10v-6h4v6h6v14z"/></g><circle cx="122" cy="18" r="7" style="fill:var(--sun)"/>`,
  cliffs: `<rect width="150" height="84" style="fill:var(--loch-soft)"/><rect y="56" width="150" height="28" style="fill:var(--water)"/><path d="M60 84 V40 C80 30 110 28 150 26 V84Z" style="fill:var(--hill-near)"/><rect x="118" y="12" width="8" height="16" style="fill:var(--surface)"/><path d="M116 12h12l-6-5z" style="fill:var(--train)"/><g style="stroke:var(--water-line)" stroke-width="1.2" stroke-linecap="round"><path d="M10 66h30M20 74h36"/></g>`
};
const post = k => `<svg viewBox="0 0 150 84" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${POST[k]}</svg>`;
const DAYSCENE = { d1: "castle", d2: "loch", d3: "viaduct", d4: "nessie", d5: "castle", d6: "cliffs", d7: "castle", d8: "loch" };
const heroScene = id => { const k = DAYSCENE[id] || "loch"; return SCENE[k] || `<svg class="scene short" viewBox="0 10 150 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${POST[k]}</svg>`; };
const HIGHLIGHTS = [["d3", "train", "Glenfinnan-Viadukt"], ["d4", "nessie", "Loch Ness und Urquhart Castle"], ["d5", "castle", "Edinburgh Castle"], ["d6", "cliffs", "Klippen von St Abb's Head"]];

/* ---------- Karte ---------- */
const W = 600, H = 640;
const xy = k => { const p = T.points[k]; return [((p[1] + 6.15) / 4.25) * W, ((57.62 - p[0]) / 1.85) * H]; };
function mapSvg(sel) {
  const lab = { edi: [-6, -16, "end"], gla: [0, 30, "middle"], glc: [14, 5, "start"], fw: [14, 6, "start"], glf: [-10, -10, "end"], com: [12, -8, "start"], urq: [-12, 5, "end"], car: [12, 5, "start"], tan: [0, -14, "middle"], sta: [0, 26, "end"], air: [-8, 26, "end"] };
  const big = { edi: 1, gla: 1, fw: 1 };
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Schematische Karte der Route">`;
  T.days.forEach(d => d.legs.forEach(l => {
    const on = !sel || sel === d.id;
    s += `<polyline points="${l.map(k => xy(k).join(",")).join(" ")}" fill="none" style="stroke:var(${sel && on ? "--ember" : "--hill-mid"})" stroke-width="${sel && on ? 7 : 4}" stroke-linecap="round" stroke-linejoin="round" opacity="${on ? (sel ? 1 : .55) : .2}"/>`;
  }));
  for (const k in lab) {
    const [x, y] = xy(k), o = lab[k];
    s += `<circle cx="${x}" cy="${y}" r="${big[k] ? 9 : 6}" style="fill:var(${big[k] ? "--heather" : "--surface"});stroke:var(--loch)" stroke-width="${big[k] ? 0 : 3}"/>`;
    s += `<text x="${x + o[0]}" y="${y + o[1]}" text-anchor="${o[2]}" font-size="${big[k] ? 21 : 17}" font-weight="${big[k] ? 700 : 500}" style="fill:var(--ink);stroke:var(--surface)" paint-order="stroke" stroke-width="5">${esc(T.points[k][2])}</text>`;
  }
  return s + `</svg>`;
}

/* ---------- Bausteine ---------- */
const dayNo = d => T.days.indexOf(d) + 1;
const place = d => d.night || "Heimweg";
function chipsFor(d, past, short) {
  if (past) return `<span class="chip ok">erlebt</span>`;
  const drive = walking(d) ? `<span class="chip">zu Fuß</span>` : `<span class="chip">${I.car}${esc(d.drive)} Fahrt</span>`;
  return drive + (d.friend ? '<span class="chip friend">zu dritt</span>' : "") + (short ? "" : `<span class="chip sun">${I.sun}hell bis ${d.sun[1]}</span>`);
}
const shortAddr = (a, name) => { const p = String(a).split(",")[0]; return name.includes(p) ? "" : p; };
function stopState(d) {
  // done: Stopps, deren Zeit vorbei ist. next: der nächste Stopp, Abfahrt oder Landung wird übersprungen.
  if (d.date !== today()) return { done: d.date < today() ? d.stops.length : 0, next: -1 };
  const n = nowHM();
  let next = d.stops.findIndex(s => stopTime(s[0]) > n);
  if (next === 0 && /^(Abfahrt|Landung)/.test(d.stops[0][1]) && d.stops.length > 1) next = 1;
  const done = next === -1 ? d.stops.length : d.stops.findIndex(s => stopTime(s[0]) > n);
  return { done: Math.max(0, done), next };
}
function timeline(d) {
  const walk = walking(d), st = stopState(d);
  return `<ol class="stops">${d.stops.map((s, i) => {
    const cls = i === st.next ? "now" : i < st.done ? "done" : "";
    const sub = shortAddr(s[2], s[1]);
    return `<li class="${cls}"><a class="stop" href="${navLink(s[2], walk)}" target="_blank" rel="noopener"><span><span class="time">${esc(s[0])}${cls === "now" ? " · als Nächstes" : ""}</span><b>${esc(s[1])}</b>${sub ? `<span class="addr">${esc(sub)}</span>` : ""}</span>${I.go}</a></li>`;
  }).join("")}</ol>`;
}
function noteField(d) {
  const note = get("note:" + d.id, { text: "" }).text;
  return `<details class="more" ${note ? "open" : ""}><summary>${note ? "Unsere Notiz" : "Notiz zum Tag"}</summary>
    <textarea id="n-${d.id}" data-note="${d.id}" rows="3" placeholder="Lieblingsmoment, Restaurant, Foto-Spot">${esc(note)}</textarea></details>`;
}
function hotelTonight(d) {
  if (!d.night) return "";
  const b = T.bookings.find(x => x.hotel && x.hotel[1] <= d.date && x.hotel[2] > d.date);
  const ref = b ? get("book:" + b.id, {}).ref : "";
  const name = b ? b.hotel[0] : d.night;
  return `<p class="night">${I.moon}Heute Nacht: ${esc(name)}${ref ? ` · Nr. ${esc(ref)}` : ""}</p>`;
}
function dayCard(d, open) {
  const t = today(), past = d.date < t, isToday = d.date === t;
  const route = dayRoute(d);
  return `<details class="day ${past ? "past" : ""} ${isToday ? "today" : ""}" id="${d.id}" ${open ? "open" : ""}>
    <summary><span class="date"><b>${Number(d.date.slice(8))}</b><i>${isToday ? "Heute" : wd(d.date, "short").replace(".", "")}</i></span>
      <span><span class="daynum">Tag ${dayNo(d)} · ${esc(place(d))}</span><h3>${esc(d.title)}</h3><span class="chips">${chipsFor(d, past, true)}</span></span>${I.chev}</summary>
    <div class="inner">
      ${timeline(d)}
      <div class="row">
        ${route ? `<a class="btn" href="${route}" target="_blank" rel="noopener">${I.arrow}Ganze Route</a>` : ""}
        <a class="btn ghost" href="https://www.bbc.co.uk/weather/${d.weather}" target="_blank" rel="noopener">Wetter</a>
        <button class="btn ghost" data-map="${d.id}">Karte</button>
      </div>
      ${hotelTonight(d)}
      ${d.tips.length ? `<details class="more"><summary>Tipps für den Tag</summary><ul class="tips" style="margin-top:0">${d.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}
      ${noteField(d)}
    </div>
  </details>`;
}
const bookingDone = b => ["gebucht", "bezahlt", "entfällt"].includes(get("book:" + b.id, {}).status);
function openItems() {
  const t = today(), items = [];
  T.bookings.forEach(b => { if (!bookingDone(b)) items.push({ text: b.title, due: b.due, go: "#buchen" }); });
  T.todos.forEach(x => { if (!get("todo:" + x.id, {}).done) items.push({ text: x.text, due: x.due || "", go: "#check" }); });
  all("citem:").filter(c => c.list === "todo" && !c.done).forEach(c => items.push({ text: c.text, due: "", go: "#check" }));
  items.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  return items.map(i => ({ ...i, late: i.due && i.due < t }));
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "");
function counts() {
  const ct = list => all("citem:").filter(c => c.list === list);
  return {
    book: [T.bookings.filter(bookingDone).length, T.bookings.length],
    todo: [T.todos.filter(x => get("todo:" + x.id, {}).done).length + ct("todo").filter(c => c.done).length, T.todos.length + ct("todo").length],
    pack: [T.packing.filter(p => get("pack:" + slug(p), {}).done).length + ct("pack").filter(c => c.done).length, T.packing.length + ct("pack").length]
  };
}
const pct = ([a, b]) => b ? Math.round((a / b) * 100) : 0;
const tile = (l, c, href) => `<a class="prog" href="${href}"><span>${l}</span><b>${c[0]} <small>von ${c[1]}</small></b><i style="--p:${pct(c)}%"></i></a>`;
const rowlink = (href, ic, icCls, title, sub, extra = "", attrs = "") => `<li><a class="rowlink" href="${href}" ${attrs}><span class="ic ${icCls}">${ic}</span><span>${title}${sub ? `<small>${sub}</small>` : ""}</span><span class="due">${extra}</span>${I.chev}</a></li>`;
const backTo = (href, label) => `<a class="back" href="${href}">${I.back}${label}</a>`;

/* ---------- Ansichten ---------- */
function vHeute() {
  const t = today(), d = T.days.find(x => x.date === t);
  if (t < T.start) {
    const n = dayDiff(t, T.start), c = counts(), items = openItems();
    return `<section class="hero">${SCENE.loch}<div class="body">
        <p class="kicker">${esc(T.people.join(" & "))} · 18. bis 25. Februar</p>
        <div class="count"><b class="num">${n}</b><span>${n === 1 ? "Tag" : "Tage"} bis<br>Schottland</span></div>
        <p class="muted" style="margin:0">Dann landet ihr um 12:45 in Edinburgh.</p></div></section>
      <section><div class="sechead"><h2>Darauf freut ihr euch</h2></div>
        <div class="cards-x">${HIGHLIGHTS.map(h => { const day = T.days.find(x => x.id === h[0]); return `<a class="post" href="#route/${h[0]}">${post(h[1])}<div><b>${esc(h[2])}</b><span>${wd(day.date, "short").replace(".", "")} ${fmtDate(day.date)}</span></div></a>`; }).join("")}</div></section>
      <section class="card"><div class="sechead"><h2>Koffer</h2><a href="#listen">Packliste</a></div>
        <p style="margin:0">${c.pack[0] === c.pack[1] ? "Alles gepackt. Es kann losgehen!" : `${c.pack[0]} von ${c.pack[1]} Sachen gepackt`}</p><div class="bar" style="--p:${pct(c.pack)}%"></div></section>
      ${items.length ? `<section class="card"><div class="sechead"><h2>Als Nächstes</h2><a href="#planung">Alle ${items.length}</a></div>
        <ul class="rows">${items.slice(0, 3).map(i => `<li><a class="rowlink noic" href="${i.go}"><span>${esc(i.text)}</span><span class="due ${i.late ? "late" : ""}">${i.due ? "bis " + fmtDate(i.due) : ""}</span>${I.chev}</a></li>`).join("")}</ul></section>` : ""}
      <section class="card"><div class="sechead"><h2>Vorbereitung</h2></div>
        <div class="progs">${tile("Gebucht", c.book, "#buchen")}${tile("Erledigt", c.todo, "#check")}${tile("Gepackt", c.pack, "#listen")}</div></section>`;
  }
  if (d) {
    const i = T.days.indexOf(d), next = T.days[i + 1], st = stopState(d), walk = walking(d);
    const target = st.next >= 0 ? d.stops[st.next] : null, route = dayRoute(d);
    const go = target
      ? `<a class="btn go" href="${navLink(target[2], walk)}" target="_blank" rel="noopener">${I.arrow}<span>${walk ? "Hinlaufen" : "Hinfahren"}<small>Als Nächstes: ${esc(target[1])}</small></span></a>`
      : route ? `<a class="btn go" href="${route}" target="_blank" rel="noopener">${I.arrow}<span>Ganze Tagesroute<small>Alle Stopps von heute</small></span></a>` : "";
    const [tip, ...moreTips] = d.tips;
    return `<section class="hero">${heroScene(d.id)}<div class="body">
        <p class="kicker">Tag ${i + 1} von ${T.days.length} · ${esc(longDate(d.date))}</p>
        <h1>${esc(d.title)}</h1>
        <div class="chips" style="margin:var(--s3) 0 var(--s4)">${chipsFor(d, false)}</div>
        ${go}</div></section>
      <section class="card"><div class="sechead"><h2>Der Tag</h2>${route ? `<a href="${route}" target="_blank" rel="noopener">Ganze Route</a>` : ""}</div>
        ${timeline(d)}${hotelTonight(d)}${noteField(d)}</section>
      ${tip ? `<section class="card tip">${I.bulb}<div><p><b>Gut zu wissen.</b> ${esc(tip)}</p>${moreTips.length ? `<details class="more"><summary>Mehr Tipps</summary>${moreTips.map(x => `<p>${esc(x)}</p>`).join("")}</details>` : ""}</div></section>` : ""}
      ${next ? `<a class="card" href="#route/${next.id}" style="text-decoration:none;color:inherit"><p class="kicker quiet">Morgen</p><h3>${esc(next.title)}</h3><p class="muted" style="margin:4px 0 0">${esc(next.stops[0][1].startsWith("Abfahrt") ? "Abfahrt " + next.stops[0][0] : "Los geht's " + next.stops[0][0])}</p></a>` : ""}`;
  }
  const s = settle(), notes = T.days.map(x => [x, get("note:" + x.id, { text: "" }).text]).filter(x => x[1]);
  const stops = T.days.reduce((a, x) => a + x.stops.length, 0);
  return `<section class="hero">${SCENE.loch}<div class="body"><p class="kicker">Reise vorbei</p><h1>Willkommen zurück</h1>
      <div class="stats"><div><b>${T.days.length}</b><span>Tage</span></div><div><b>880</b><span>km</span></div><div><b>${stops}</b><span>Stopps</span></div></div></div></section>
    <section class="card diary"><h2>Unser Tagebuch</h2>${notes.map(([x, n]) => `<p><b>${esc(wd(x.date, "long"))}, ${fmtDate(x.date)}</b>${esc(n)}</p>`).join("") || "<p class='muted'>Keine Notizen geschrieben. Dafür viele Fotos?</p>"}</section>
    <a class="card" href="#geld" style="text-decoration:none;color:inherit"><p class="kicker quiet">Abrechnung</p><p class="balance" style="margin:0">${esc(s.line)}</p></a>`;
}
function vRoute(sel) {
  const t = today(), autoOpen = sel || (T.days.some(d => d.date === t) ? T.days.find(d => d.date === t).id : "");
  return `<section class="pagehead"><p class="kicker">Rund 880 km in 8 Tagen</p><h1>Eine Schleife durch die Highlands</h1></section>
    <section class="card mapbox" id="mapbox">${mapSvg(sel)}</section>
    <div class="days">${T.days.map(d => dayCard(d, d.id === autoOpen)).join("")}</div>`;
}
function rate() { return Number(get("set:rate", { v: T.gbpToEur }).v) || T.gbpToEur; }
function settle() {
  const ex = all("exp:"), r = rate(), [a, b] = T.people;
  const paid = { [a]: 0, [b]: 0 };
  ex.forEach(e => { paid[e.who] = (paid[e.who] || 0) + (e.cur === "GBP" ? e.amount * r : e.amount); });
  const total = paid[a] + paid[b], diff = (paid[a] - paid[b]) / 2;
  const line = Math.abs(diff) < 0.5 ? "Ihr seid quitt." : `${diff > 0 ? b : a} schuldet ${diff > 0 ? a : b} ${Math.abs(diff).toFixed(2).replace(".", ",")} €.`;
  return { ex, paid, total, line };
}
const eur = n => n.toFixed(2).replace(".", ",") + " €";
const money = (cur, n) => (cur === "GBP" ? "£ " : "€ ") + Number(n).toFixed(2).replace(".", ",");
const CATS = ["Essen", "Tanken", "Eintritt", "Parken", "Einkauf", "Sonstiges"];
function me() { try { return localStorage.getItem(ME) || T.people[0]; } catch (e) { return T.people[0]; } }
function vGeld() {
  const s = settle(), r = rate(), [a, b] = T.people;
  const list = s.ex.sort((x, y) => (y.date || "").localeCompare(x.date || "") || y.ts - x.ts);
  return `<section class="pagehead"><h1>Geld</h1></section>
    <section class="card"><p class="kicker quiet">Stand</p><p class="balance big">${esc(s.line)}</p>
      <div class="who"><div><span>${esc(a)} hat bezahlt</span><b>${eur(s.paid[a])}</b></div><div><span>${esc(b)} hat bezahlt</span><b>${eur(s.paid[b])}</b></div></div></section>
    <section class="card"><h2>Ausgabe eintragen</h2>
      <form id="expform" class="formstack" autocomplete="off">
        <div class="amount"><input name="amount" inputmode="decimal" required placeholder="0,00" aria-label="Betrag">
          <div class="pick" role="radiogroup" aria-label="Währung"><label><input type="radio" name="cur" value="GBP" checked>£</label><label><input type="radio" name="cur" value="EUR">€</label></div></div>
        <div><p class="lbl">Wofür</p><div class="pick">${CATS.map(c => `<label><input type="radio" name="cat" value="${c}">${c}</label>`).join("")}</div>
          <input name="label" placeholder="Notiz, z. B. Abendessen Ashton Lane" style="margin-top:var(--s2)"></div>
        <div><p class="lbl">Wer hat bezahlt?</p><div class="pick two">${T.people.map(p => `<label><input type="radio" name="who" value="${esc(p)}" ${p === me() ? "checked" : ""}>${esc(p)}</label>`).join("")}</div></div>
        <button class="btn wide">Speichern</button>
        <p class="saved" id="saved" aria-live="polite"></p>
      </form></section>
    <section class="card"><h2>Alle Ausgaben</h2>${list.length ? `<ul class="exp">${list.map(e => `<li><span>${esc(e.label)}<small>${esc(e.who)}${e.date ? " · " + fmtDate(e.date) : ""}</small></span><b>${money(e.cur, e.amount)}</b><button class="x" data-del="${e.id}" aria-label="Löschen">×</button></li>`).join("")}</ul>` : "<p class='muted' style='margin:0'>Noch nichts eingetragen.</p>"}
      <details class="more"><summary>Wechselkurs</summary><label class="muted" style="display:flex;align-items:center;gap:8px">1 £ =<input id="rate" inputmode="decimal" value="${String(r).replace(".", ",")}" style="width:90px">€</label></details></section>`;
}
function listBlock(kind, base) {
  const custom = all("citem:").filter(c => c.list === kind);
  const rows = base.map(x => {
    const id = kind === "todo" ? "todo:" + x.id : "pack:" + slug(x);
    const text = kind === "todo" ? x.text : x, done = get(id, {}).done;
    return `<li><label><input type="checkbox" data-check="${id}" ${done ? "checked" : ""}><span>${esc(text)}${x.due ? ` <span class="due">bis ${fmtDate(x.due)}</span>` : ""}</span></label></li>`;
  }).concat(custom.map(c => `<li><label><input type="checkbox" data-citem="${c.id}" ${c.done ? "checked" : ""}><span>${esc(c.text)}</span></label><button class="x" data-del="${c.id}" aria-label="Entfernen">×</button></li>`));
  return `<ul class="todo">${rows.join("")}</ul>
    <form class="add" data-add="${kind}"><input name="t" placeholder="Etwas hinzufügen" autocomplete="off"><button class="btn sm">Dazu</button></form>`;
}
function vListen() {
  const c = counts().pack;
  return `${backTo("#mehr", "Mehr")}<section class="pagehead"><h1>Packliste</h1><p class="muted">${c[0]} von ${c[1]} gepackt</p></section>
    <section class="card">${listBlock("pack", T.packing)}</section>`;
}
function vCheck() {
  return `${backTo("#planung", "Planung")}<section class="pagehead"><h1>Checkliste</h1></section>
    <section class="card">${listBlock("todo", T.todos)}</section>`;
}
function vBuchen() {
  const opts = ["offen", "gebucht", "bezahlt", "entfällt"];
  return `${backTo("#planung", "Planung")}<section class="pagehead"><h1>Buchungen</h1><p class="muted">Nummern und Fristen sehen nur ihr beide.</p></section>
    ${T.bookings.map(b => {
      const s = get("book:" + b.id, {}), st = s.status || "offen";
      const link = b.hotel ? hotelLink(b.hotel) : b.link;
      return `<section class="card book" data-st="${st}">
        <div class="bhead"><h3>${esc(b.title)}</h3><span class="due ${!bookingDone(b) && b.due < today() ? "late" : ""}">bis ${fmtDate(b.due)}</span></div>
        <p class="muted">${esc(b.info)}</p>
        ${link ? `<a class="btn sm ghost" href="${link}" target="_blank" rel="noopener">${b.hotel ? "Bei Booking.com ansehen" : "Zur Seite"}</a>` : ""}
        <div class="pick full" role="group" aria-label="Status">${opts.map(o => `<button data-book="${b.id}" data-status="${o}" class="${o === st ? "on" : ""}">${o}</button>`).join("")}</div>
        <details class="more" ${s.ref || s.cancel || s.note ? "open" : ""}><summary>Nummer und Notizen</summary><div class="fields" style="margin-top:0">
          <label>Bestätigungsnummer<input data-bf="${b.id}" data-k="ref" value="${esc(s.ref)}" autocomplete="off"></label>
          <label>Kostenlos stornierbar bis<input type="date" data-bf="${b.id}" data-k="cancel" value="${esc(s.cancel)}"></label>
          <label>Preis und Notiz<input data-bf="${b.id}" data-k="note" value="${esc(s.note)}" autocomplete="off"></label>
        </div></details></section>`;
    }).join("")}`;
}
function vBudget() {
  return `${backTo("#planung", "Planung")}<section class="pagehead"><h1>Budget</h1><p class="muted">Richtwerte ohne Flug und Essen.</p></section>
    <section class="card"><table><tbody>${T.budget.map((x, i) => `<tr class="${i === T.budget.length - 1 ? "sum" : ""}"><td>${esc(x[0])}<small>${esc(x[2])}</small></td><td class="num">${esc(x[1])}</td></tr>`).join("")}</tbody></table></section>
    <section class="card"><h2>Quellen</h2><ul class="rows">${T.sources.map(s => `<li><a class="rowlink noic" href="${s[1]}" target="_blank" rel="noopener"><span>${esc(s[0])}</span><span></span>${I.chev}</a></li>`).join("")}</ul>
      <p class="muted" style="margin:var(--s2) 0 0">Faktencheck vom 17.11.2026.</p></section>`;
}
function vMehr() {
  const c = counts(), m = mapsApp();
  return `<section class="pagehead"><h1>Mehr</h1></section>
    <section class="card"><ul class="rows">
      ${rowlink("#listen", I.bag, "h", "Packliste", `${c.pack[0]} von ${c.pack[1]} gepackt`)}
      ${rowlink("#fahren", I.wheel, "", "Fahren in Schottland", "Links fahren, Meilen, Single Track Roads")}
    </ul></section>
    <section class="card"><h2>Notfall</h2>${T.emergency.map(e => `<a class="tel" href="tel:${e[1]}"><b>${e[1]}</b><span>${esc(e[0])}</span></a>`).join("")}
      <p class="muted" style="margin:var(--s2) 0 0">Pannenhilfe: Nummer steht im Mietvertrag.</p></section>
    <section class="card"><h2>Karten-App</h2><p class="muted">Womit sich die Navigation öffnet.</p>
      <div class="pick two"><button data-maps="google" class="${m === "google" ? "on" : ""}">Google Maps</button><button data-maps="apple" class="${m === "apple" ? "on" : ""}">Apple Karten</button></div></section>
    <section class="card"><ul class="rows">${rowlink("#planung", I.check, "m", "Planung", "Buchungen, Checkliste, Budget, Verbindung")}</ul></section>`;
}
function vPlanung() {
  const c = counts();
  return `${backTo("#mehr", "Mehr")}<section class="pagehead"><h1>Planung</h1><p class="muted">Alles zum Buchen und Vorbereiten.</p></section>
    <section class="card"><ul class="rows">
      ${rowlink("#buchen", I.cal, "", "Buchungen", "", `${c.book[0]} von ${c.book[1]}`)}
      ${rowlink("#check", I.check, "m", "Checkliste", "", `${c.todo[0]} von ${c.todo[1]}`)}
      ${rowlink("#budget", I.coins, "e", "Budget und Quellen", "")}
      ${rowlink("#verbinden", I.link, "h", "Zweites Handy verbinden", "")}
    </ul></section>
    <section class="card"><h2>Exporte</h2><p class="muted">Ein Kalendertermin pro Tag mit allen Stopps, oder die Stoppliste für Google My Maps.</p>
      <div class="row"><button class="btn" id="ics">In den Kalender</button><button class="btn ghost" id="csv">Stoppliste</button></div></section>`;
}
function vFahren() {
  return `${backTo("#mehr", "Mehr")}<section class="pagehead"><h1>Fahren in Schottland</h1></section>
    <section class="card"><ul class="tips" style="margin:0">
      <li><b>Links fahren</b>, rechts überholen. Im Kreisverkehr im Uhrzeigersinn, wer von rechts kommt, hat Vorfahrt.</li>
      <li><b>Tempo in Meilen:</b> 30 im Ort, 60 auf Landstraßen, 70 auf Schnellstraßen.</li>
      <li><b>Single Track Roads:</b> An Ausweichstellen (Passing Places) links halten oder warten. Nie dort parken.</li>
      <li><b>Im Winter</b> morgens Traffic Scotland prüfen, vor allem die A82 durch Glencoe und die A9.</li>
      <li><b>Edinburgh:</b> Parkhaus über Nacht ca. 20 bis 25 £. Altstadt lieber zu Fuß.</li>
      <li><b>Umweltzonen</b> in Glasgow und Edinburgh: Mietwagen erfüllen sie praktisch immer.</li>
    </ul><div class="row"><a class="btn ghost" href="https://trafficscotland.org/" target="_blank" rel="noopener">Traffic Scotland</a></div></section>`;
}
function vVerbinden() {
  const c = cfg();
  const joinLink = c.url && c.key && c.code ? `${location.origin}${location.pathname}#join=${enc(c.code)}&u=${enc(c.url)}&k=${enc(c.key)}` : "";
  const say = { off: "Noch nicht verbunden", ok: "Verbunden", busy: "Verbunden, gleicht gerade ab", offline: "Gerade offline", error: "Verbindung klappt nicht" }[status];
  return `${backTo("#planung", "Planung")}<section class="pagehead"><h1>Zweites Handy verbinden</h1><p class="muted">Dann sehen beide dieselben Haken, Ausgaben und Notizen.</p></section>
    <section class="card" id="syncbox"><p class="ok-line" data-s="${status}">${say}${lastSync ? ` <span class="muted" style="font-weight:400">· zuletzt ${lastSync.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>` : ""}</p>
      ${joinLink ? `<p>Schick diesen Link einmal privat ans andere Handy. Einmal öffnen, fertig.</p>
        <div class="row"><button class="btn" id="share">Link teilen</button><button class="btn ghost" id="sync-now">Jetzt abgleichen</button></div>` : ""}
      <details class="more setup"><summary>Zugangsdaten eintragen</summary>
        <form id="syncform" class="fields">
          <label>Supabase URL<input name="url" value="${esc(c.url)}" placeholder="https://xyz.supabase.co" autocomplete="off"></label>
          <label>Anon Key<input name="key" value="${esc(c.key)}" autocomplete="off"></label>
          <label>Reisecode<input name="code" value="${esc(c.code)}" autocomplete="off"></label>
          <button class="btn sm">Speichern und abgleichen</button>
        </form></details></section>
    <section class="card"><h2>Als App installieren</h2><ol style="margin:0;padding-left:20px"><li>Seite in Safari öffnen.</li><li>Teilen antippen, dann „Zum Home-Bildschirm“.</li><li>Einmal mit Netz öffnen. Danach läuft sie auch im Flugmodus.</li></ol></section>`;
}
/* ---------- Exporte ---------- */
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const icsEsc = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsT = (date, hm) => date.replace(/-/g, "") + "T" + hm.replace(":", "") + "00Z"; // Februar: GMT = UTC
function exportIcs() {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//schottland-2027//DE", "CALSCALE:GREGORIAN"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  T.days.forEach(d => {
    const desc = d.stops.map(s => `${s[0]} ${s[1]} (${s[2]})`).join("\n") + (dayRoute(d) ? "\n\nRoute: " + dayRoute(d) : "");
    L.push("BEGIN:VEVENT", `UID:${d.id}@schottland-2027`, `DTSTAMP:${stamp}`, `DTSTART:${icsT(d.date, d.start)}`, `DTEND:${icsT(d.date, d.end)}`,
      `SUMMARY:${icsEsc("Schottland: " + d.title)}`, `LOCATION:${icsEsc(d.stops[0][2])}`, `DESCRIPTION:${icsEsc(desc)}`, "END:VEVENT");
  });
  L.push("END:VCALENDAR");
  download("schottland-2027.ics", L.join("\r\n"), "text/calendar");
}
function exportCsv() {
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [["Tag", "Datum", "Uhrzeit", "Name", "Adresse"]];
  T.days.forEach(d => d.stops.forEach(s => rows.push([d.label.split(" · ")[0], d.date, s[0], s[1], s[2]])));
  download("schottland-2027-stopps.csv", "\ufeff" + rows.map(r => r.map(q).join(",")).join("\r\n"), "text/csv");
}

/* ---------- Render und Ereignisse ---------- */
const views = { heute: vHeute, route: vRoute, geld: vGeld, mehr: vMehr, listen: vListen, check: vCheck, buchen: vBuchen, budget: vBudget, planung: vPlanung, fahren: vFahren, verbinden: vVerbinden };
const alias = { infos: "mehr" };
const tabOf = { heute: "heute", route: "route", geld: "geld" };
function render() {
  let [v, arg] = (location.hash.slice(1) || "heute").split("/");
  v = alias[v] || v;
  const view = views[v] ? v : "heute";
  const y = window.scrollY;
  $("#main").innerHTML = views[view](arg);
  const tab = tabOf[view] || "mehr";
  document.querySelectorAll("nav.tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === tab));
  if (arg && view === "route") { const el = document.getElementById(arg); if (el) el.scrollIntoView({ block: "start" }); }
  else if (render.last === view) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  render.last = view;
  setStatus(status);
}
window.addEventListener("hashchange", () => { render(); sync(); });

document.addEventListener("click", e => {
  const t = e.target.closest("button,a") || e.target;
  if (t.dataset.map) {
    $("#mapbox").innerHTML = mapSvg(t.dataset.map);
    $("#mapbox").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (t.dataset.maps) { try { localStorage.setItem(MAPS, t.dataset.maps); } catch (err) {} render(); }
  if (t.dataset.book) { const s = get("book:" + t.dataset.book, {}); put("book:" + t.dataset.book, { ...s, status: t.dataset.status }); render(); }
  if (t.dataset.del) { if (confirmDel(t)) { remove(t.dataset.del); render(); } }
  if (t.id === "ics") exportIcs();
  if (t.id === "csv") exportCsv();
  if (t.id === "sync-now") sync().then(render);
  if (t.id === "share") {
    const c = cfg(), link = `${location.origin}${location.pathname}#join=${enc(c.code)}&u=${enc(c.url)}&k=${enc(c.key)}`;
    if (navigator.share) navigator.share({ title: "Schottland 2027", text: "Unsere Reise-App. Einmal öffnen, dann sind wir verbunden:", url: link }).catch(() => {});
    else navigator.clipboard.writeText(link).then(() => { t.textContent = "Link kopiert"; });
  }
});
function confirmDel(t) {
  if (t.dataset.armed) return true;
  t.dataset.armed = "1"; t.textContent = "Sicher?"; t.classList.add("armed");
  setTimeout(() => { if (t.isConnected) { delete t.dataset.armed; t.textContent = "×"; t.classList.remove("armed"); } }, 3000);
  return false;
}
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.check) { put(t.dataset.check, { done: t.checked }); refreshCount(); }
  if (t.dataset.citem) { const c = get(t.dataset.citem, {}); put(t.dataset.citem, { ...c, done: t.checked }); refreshCount(); }
  if (t.dataset.bf) { const s = get("book:" + t.dataset.bf, {}); put("book:" + t.dataset.bf, { ...s, [t.dataset.k]: t.value.trim() }); }
  if (t.dataset.note) put("note:" + t.dataset.note, { text: t.value });
  if (t.id === "rate") { const v = parseFloat(t.value.replace(",", ".")); if (v > 0) { put("set:rate", { v }); render(); } }
  if (t.name === "who") { try { localStorage.setItem(ME, t.value); } catch (err) {} }
});
function refreshCount() {
  // Packliste: Zähler oben aktualisieren, ohne die Liste neu zu zeichnen
  const p = $(".pagehead .muted");
  if (p && render.last === "listen") { const c = counts().pack; p.textContent = `${c[0]} von ${c[1]} gepackt`; }
}
document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, fd = new FormData(f);
  if (f.dataset.add) {
    const text = (fd.get("t") || "").trim();
    if (text) { put("citem:" + uid(), { list: f.dataset.add, text, done: false }); render(); }
  }
  if (f.id === "expform") {
    const amount = parseFloat(String(fd.get("amount")).replace(",", "."));
    if (!(amount > 0)) { f.amount.focus(); return; }
    const note = String(fd.get("label") || "").trim(), cat = fd.get("cat") || "";
    const label = note && cat ? `${cat}: ${note}` : note || cat || "Ausgabe";
    put("exp:" + uid(), { label, amount, cur: fd.get("cur") || "GBP", who: fd.get("who") || me(), date: today(), ts: Date.now() });
    render();
    const s = $("#saved"); if (s) { s.textContent = "Gespeichert ✓"; setTimeout(() => { if (s.isConnected) s.textContent = ""; }, 2500); }
  }
  if (f.id === "syncform") {
    syncCfg = { url: fd.get("url").trim(), key: fd.get("key").trim(), code: fd.get("code").trim() };
    save(K.sync, syncCfg);
    localStorage.removeItem(K.cur);
    Object.keys(state).forEach(id => { outbox[id] = state[id].ts; });
    persist();
    sync().then(render);
  }
});
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

render();
sync();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
