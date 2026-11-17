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
  const txt = { off: "Nur auf diesem Gerät", ok: "Synchron", busy: "Gleiche ab", offline: n ? `Offline, ${n} offen` : "Offline", error: "Sync-Fehler" }[s];
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

/* ---------- Datum ---------- */
const testDate = new URLSearchParams(location.search).get("date");
const today = () => testDate || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const fmtDate = s => { const [y, m, d] = s.split("-"); return `${d}.${m}.${y.slice(2)}`; };

/* ---------- Links ---------- */
const walking = d => d.drive === "kein Auto";
const gNav = (addr, walk) => `https://www.google.com/maps/dir/?api=1&destination=${enc(addr)}&travelmode=${walk ? "walking" : "driving"}`;
const aNav = (addr, walk) => `https://maps.apple.com/?daddr=${enc(addr)}&dirflg=${walk ? "w" : "d"}`;
function dayRoute(d) {
  const pts = d.route || d.stops.map(s => s[2]).filter((a, i, arr) => a !== arr[i - 1]);
  if (pts.length < 2) return "";
  const [o, ...rest] = pts, dest = rest.pop();
  let u = `https://www.google.com/maps/dir/?api=1&origin=${enc(o)}&destination=${enc(dest)}&travelmode=${walking(d) ? "walking" : "driving"}`;
  if (rest.length) u += `&waypoints=${enc(rest.join("|"))}`;
  return u;
}
const hotelLink = h => `https://www.booking.com/searchresults.html?ss=${enc(h[0])}&checkin=${h[1]}&checkout=${h[2]}&group_adults=${h[3]}&no_rooms=1&selected_currency=EUR`;

/* ---------- Karte ---------- */
const W = 600, H = 640;
const xy = k => { const p = T.points[k]; return [((p[1] + 6.15) / 4.25) * W, ((57.62 - p[0]) / 1.85) * H]; };
function mapSvg(sel) {
  const lab = { edi: [4, -14, "end"], gla: [0, 26, "middle"], glc: [12, 5, "start"], fw: [12, 20, "start"], glf: [-6, -12, "middle"], com: [10, -8, "start"], urq: [-12, 5, "end"], inv: [12, 2, "start"], car: [12, 5, "start"], tan: [0, -12, "middle"], sta: [0, 22, "end"], air: [-10, 18, "end"] };
  const big = { edi: 1, gla: 1, fw: 1 };
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Schematische Karte der Route">`;
  T.days.forEach(d => d.legs.forEach(l => {
    const on = !sel || sel === d.id;
    s += `<polyline points="${l.map(k => xy(k).join(",")).join(" ")}" fill="none" stroke="var(--loch)" stroke-width="${on && sel ? 6 : 4}" stroke-linecap="round" stroke-linejoin="round" opacity="${on ? 1 : 0.15}"/>`;
  }));
  for (const k in lab) {
    const [x, y] = xy(k), o = lab[k];
    s += `<circle cx="${x}" cy="${y}" r="${big[k] ? 8 : 5}" fill="${big[k] ? "var(--heather)" : "var(--surface)"}" stroke="var(--ink)" stroke-width="${big[k] ? 0 : 2}"/>`;
    s += `<text x="${x + o[0]}" y="${y + o[1]}" text-anchor="${o[2]}" font-size="${big[k] ? 18 : 14}" font-weight="${big[k] ? 700 : 400}" fill="var(--ink)" paint-order="stroke" stroke="var(--surface)" stroke-width="4">${esc(T.points[k][2])}</text>`;
  }
  return s + `<text x="${W - 12}" y="22" text-anchor="end" font-size="13" fill="var(--muted)">Schematisch. Große Punkte: Übernachtungen</text></svg>`;
}

/* ---------- Bausteine ---------- */
function dayCard(d, open) {
  const walk = walking(d);
  const chips = `<span class="chip">${esc(d.drive)}</span>${d.friend ? '<span class="chip friend">zu dritt</span>' : ""}<span class="chip sun">hell ${d.sun[0]} bis ${d.sun[1]}</span>`;
  const stops = d.stops.map(s => `<li><div class="stop"><span class="time">${esc(s[0])}</span><div><b>${esc(s[1])}</b><span class="addr">${esc(s[2])}</span></div></div>
      <div class="nav"><a class="btn sm" href="${gNav(s[2], walk)}" target="_blank" rel="noopener">Google Maps</a><a class="btn sm ghost" href="${aNav(s[2], walk)}" target="_blank" rel="noopener">Apple Karten</a></div></li>`).join("");
  const route = dayRoute(d);
  const note = get("note:" + d.id, { text: "" }).text;
  return `<details class="day" id="${d.id}" ${open ? "open" : ""}>
    <summary><span class="daynum">${esc(d.label)}</span><h3>${esc(d.title)}</h3><span class="chips">${chips}</span></summary>
    <ol class="stops">${stops}</ol>
    <div class="row">
      ${route ? `<a class="btn" href="${route}" target="_blank" rel="noopener">Ganze Tagesroute</a>` : ""}
      <button class="btn ghost" data-map="${d.id}">Auf der Karte</button>
      <a class="btn ghost" href="https://www.bbc.co.uk/weather/${d.weather}" target="_blank" rel="noopener">Wetter</a>
      ${walk ? "" : `<a class="btn ghost" href="https://trafficscotland.org/" target="_blank" rel="noopener">Verkehr</a>`}
    </div>
    ${d.tips.length ? `<ul class="tips">${d.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    ${d.night ? `<p class="muted">Nacht in ${esc(d.night)}</p>` : ""}
    <label class="lbl" for="n-${d.id}">Notizen zum Tag (für beide sichtbar)</label>
    <textarea id="n-${d.id}" data-note="${d.id}" rows="2" placeholder="Restaurant, Foto-Spot, Erinnerung">${esc(note)}</textarea>
  </details>`;
}
const bookingDone = b => ["gebucht", "bezahlt", "entfällt"].includes(get("book:" + b.id, {}).status);
function openItems() {
  const t = today();
  const items = [];
  T.bookings.forEach(b => { if (!bookingDone(b)) items.push({ text: b.title, due: b.due, go: "#buchen" }); });
  T.todos.forEach(x => { if (!get("todo:" + x.id, {}).done) items.push({ text: x.text, due: x.due || "", go: "#listen" }); });
  all("citem:").filter(c => c.list === "todo" && !c.done).forEach(c => items.push({ text: c.text, due: "", go: "#listen" }));
  items.sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  return items.map(i => ({ ...i, late: i.due && i.due < t }));
}
function progress() {
  const b = T.bookings.filter(bookingDone).length;
  const todoAll = T.todos.length + all("citem:").filter(c => c.list === "todo").length;
  const todoDone = T.todos.filter(x => get("todo:" + x.id, {}).done).length + all("citem:").filter(c => c.list === "todo" && c.done).length;
  const packAll = T.packing.length + all("citem:").filter(c => c.list === "pack").length;
  const packDone = T.packing.filter(p => get("pack:" + slug(p), {}).done).length + all("citem:").filter(c => c.list === "pack" && c.done).length;
  return [["Buchungen", b, T.bookings.length, "#buchen"], ["Checkliste", todoDone, todoAll, "#listen"], ["Packliste", packDone, packAll, "#listen"]];
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "");
const bar = (l, a, b, href) => `<a class="prog" href="${href}"><span>${l}</span><b>${a} von ${b}</b><i style="--p:${b ? (a / b) * 100 : 0}%"></i></a>`;

/* ---------- Ansichten ---------- */
function vHeute() {
  const t = today(), d = T.days.find(x => x.date === t);
  if (t < T.start) {
    const n = dayDiff(t, T.start);
    const items = openItems().slice(0, 8);
    return `<section class="hero"><p class="kicker">Do 18.02. bis Do 25.02.2027</p><h1>Noch ${n} ${n === 1 ? "Tag" : "Tage"} bis Schottland</h1></section>
      <section class="card"><h2>Stand der Vorbereitung</h2><div class="progs">${progress().map(p => bar(...p)).join("")}</div></section>
      <section class="card"><h2>Als Nächstes</h2>${items.length ? `<ul class="next">${items.map(i => `<li><a href="${i.go}">${esc(i.text)}</a>${i.due ? `<span class="due ${i.late ? "late" : ""}">bis ${fmtDate(i.due)}</span>` : ""}</li>`).join("")}</ul>` : "<p>Alles erledigt.</p>"}</section>
      <section class="card"><h2>Die Route im Überblick</h2><ul class="plain">${T.days.map(x => `<li><a href="#route/${x.id}">${esc(x.label)}</a> ${esc(x.title)}</li>`).join("")}</ul></section>`;
  }
  if (d) {
    const i = T.days.indexOf(d), next = T.days[i + 1];
    return `<section class="hero"><p class="kicker">Heute · ${esc(d.label)}</p><h1>${esc(d.title)}</h1></section>
      ${dayCard(d, true)}
      ${next ? `<section class="card"><h2>Morgen</h2><p><a href="#route/${next.id}">${esc(next.label)}: ${esc(next.title)}</a>, Abfahrt ${esc(next.stops[0][0])}</p></section>` : ""}`;
  }
  const s = settle();
  return `<section class="hero"><p class="kicker">Reise vorbei</p><h1>Willkommen zurück</h1></section>
    <section class="card"><h2>Abrechnung</h2><p>${esc(s.line)}</p><p><a href="#geld">Alle Ausgaben</a></p></section>
    <section class="card"><h2>Notizen der Reise</h2>${T.days.map(x => { const n = get("note:" + x.id, { text: "" }).text; return n ? `<p><b>${esc(x.label)}</b><br>${esc(n)}</p>` : ""; }).join("") || "<p class='muted'>Keine Notizen.</p>"}</section>`;
}
function vRoute(sel) {
  return `<section class="hero"><h1>Route Tag für Tag</h1><p class="muted">Jeder Stopp startet die Navigation von eurem Standort. Wählt vorab die Offline-Karte in Google Maps.</p></section>
    <div class="plan"><div class="mapbox" id="mapbox">${mapSvg(sel)}</div><div class="days">${T.days.map(d => dayCard(d, d.id === sel)).join("")}</div></div>`;
}
function vBuchen() {
  const opts = ["offen", "gebucht", "bezahlt", "entfällt"];
  return `<section class="hero"><h1>Buchungen</h1><p class="muted">Status, Nummern und Stornofristen sind nur für euch beide sichtbar und liegen nicht im öffentlichen Repo.</p></section>
    ${T.bookings.map(b => {
      const s = get("book:" + b.id, {}), st = s.status || "offen";
      const link = b.hotel ? hotelLink(b.hotel) : b.link;
      return `<section class="card book" data-st="${st}">
        <div class="bhead"><h3>${esc(b.title)}</h3><span class="due ${!bookingDone(b) && b.due < today() ? "late" : ""}">bis ${fmtDate(b.due)}</span></div>
        <p class="muted">${esc(b.info)}</p>
        ${link ? `<a class="btn sm" href="${link}" target="_blank" rel="noopener">${b.hotel ? "Bei Booking.com ansehen" : "Zur Seite"}</a>` : ""}
        <div class="seg" role="group" aria-label="Status">${opts.map(o => `<button data-book="${b.id}" data-status="${o}" class="${o === st ? "on" : ""}">${o}</button>`).join("")}</div>
        <div class="fields">
          <label>Bestätigungsnummer<input data-bf="${b.id}" data-k="ref" value="${esc(s.ref)}" autocomplete="off"></label>
          <label>Kostenlos stornierbar bis<input type="date" data-bf="${b.id}" data-k="cancel" value="${esc(s.cancel)}"></label>
          <label>Preis und Notiz<input data-bf="${b.id}" data-k="note" value="${esc(s.note)}" autocomplete="off"></label>
        </div></section>`;
    }).join("")}`;
}
function listBlock(kind, base) {
  const custom = all("citem:").filter(c => c.list === kind);
  const rows = base.map(x => {
    const id = kind === "todo" ? "todo:" + x.id : "pack:" + slug(x);
    const text = kind === "todo" ? x.text : x, done = get(id, {}).done;
    return `<li><label><input type="checkbox" data-check="${id}" ${done ? "checked" : ""}><span>${esc(text)}${x.due ? ` <span class="due">bis ${fmtDate(x.due)}</span>` : ""}</span></label></li>`;
  }).concat(custom.map(c => `<li><label><input type="checkbox" data-citem="${c.id}" ${c.done ? "checked" : ""}><span>${esc(c.text)}</span></label><button class="x" data-del="${c.id}" aria-label="Entfernen">×</button></li>`));
  return `<ul class="todo">${rows.join("")}</ul>
    <form class="add" data-add="${kind}"><input name="t" placeholder="Eigenen Punkt hinzufügen" autocomplete="off"><button class="btn sm">Hinzufügen</button></form>`;
}
function vListen() {
  return `<section class="hero"><h1>Listen</h1><p class="muted">Was einer abhakt, sieht die andere auf ihrem Handy.</p></section>
    <section class="card"><h2>Checkliste</h2>${listBlock("todo", T.todos)}</section>
    <section class="card"><h2>Packliste</h2>${listBlock("pack", T.packing)}</section>`;
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
function vGeld() {
  const s = settle(), r = rate(), [a, b] = T.people;
  const list = s.ex.sort((x, y) => (y.date || "").localeCompare(x.date || "") || y.ts - x.ts);
  return `<section class="hero"><h1>Geld</h1></section>
    <section class="card"><h2>Ausgabe eintragen</h2>
      <form id="expform" class="expform">
        <label>Wofür<input name="label" required placeholder="Abendessen Ashton Lane" autocomplete="off"></label>
        <label>Betrag<input name="amount" inputmode="decimal" required placeholder="42,50"></label>
        <label>Währung<select name="cur"><option value="GBP">£</option><option value="EUR">€</option></select></label>
        <label>Bezahlt von<select name="who"><option>${esc(a)}</option><option>${esc(b)}</option></select></label>
        <button class="btn">Speichern</button>
      </form></section>
    <section class="card"><h2>Stand</h2>
      <p class="big">${esc(s.line)}</p>
      <p class="muted">Gesamt ${eur(s.total)} · ${esc(a)} ${eur(s.paid[a])} · ${esc(b)} ${eur(s.paid[b])}</p>
      <label class="inline">1 £ = <input id="rate" inputmode="decimal" value="${String(r).replace(".", ",")}" size="5"> € (Richtwert, anpassen)</label>
    </section>
    <section class="card"><h2>Alle Ausgaben</h2>${list.length ? `<ul class="exp">${list.map(e => `<li><span>${esc(e.date ? fmtDate(e.date) : "")}</span><span>${esc(e.label)}<br><small>${esc(e.who)}</small></span><b>${e.cur === "GBP" ? "£" : "€"} ${Number(e.amount).toFixed(2).replace(".", ",")}</b><button class="x" data-del="${e.id}" aria-label="Löschen">×</button></li>`).join("")}</ul>` : "<p class='muted'>Noch nichts eingetragen.</p>"}</section>
    <section class="card"><h2>Budget vorab (Richtwerte)</h2><div class="tablebox"><table><tbody>${T.budget.map((x, i) => `<tr class="${i === T.budget.length - 1 ? "sum" : ""}"><td>${esc(x[0])}</td><td class="num">${esc(x[1])}</td><td class="muted">${esc(x[2])}</td></tr>`).join("")}</tbody></table></div></section>`;
}
function vInfos() {
  const c = cfg();
  const joinLink = c.url && c.key && c.code ? `${location.origin}${location.pathname}#join=${enc(c.code)}&u=${enc(c.url)}&k=${enc(c.key)}` : "";
  return `<section class="hero"><h1>Infos</h1></section>
    <section class="card"><h2>Notfall</h2><ul class="plain">${T.emergency.map(e => `<li><a class="tel" href="tel:${e[1]}">${e[1]}</a> ${esc(e[0])}</li>`).join("")}</ul>
      <p class="muted">Pannennummer der Mietwagenfirma steht im Mietvertrag. Tragt sie unter Buchungen beim Mietwagen ein.</p></section>
    <section class="card"><h2>Fahren in Schottland</h2><ul>
      <li>Links fahren, rechts überholen. Im Kreisverkehr im Uhrzeigersinn, Vorfahrt hat, wer von rechts kommt.</li>
      <li>Single Track Roads: An Ausweichstellen (Passing Places) links halten oder warten. Nie dort parken.</li>
      <li>Tempo in Meilen: 30 innerorts, 60 auf Landstraßen, 70 auf Schnellstraßen und Autobahnen.</li>
      <li>Umweltzonen in Glasgow und Edinburgh: Benzin ab Euro 4, Diesel ab Euro 6. Mietwagen erfüllen das praktisch immer.</li>
      <li>Im Winter morgens Traffic Scotland prüfen. Kritisch: A82 durch Glencoe und A9 über den Drumochter Pass.</li>
      <li>Edinburgh: Parkhaus über Nacht ca. 20 bis 25 £. Altstadt zu Fuß.</li>
      <li>Edinburgh erhebt 5 % Visitor Levy auf Übernachtungen.</li>
    </ul></section>
    <section class="card"><h2>Exporte</h2><p class="muted">Kalender: ein Termin pro Tag mit allen Stopps. Stoppliste: als CSV in Google My Maps importieren.</p>
      <div class="row"><button class="btn" id="ics">In den Kalender</button><button class="btn ghost" id="csv">Stoppliste als CSV</button></div></section>
    <section class="card" id="syncbox"><h2>Gemeinsam nutzen</h2>
      <p>Status: <b>${esc($("#sync") ? $("#sync").textContent : "")}</b>${lastSync ? ` · zuletzt ${lastSync.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
      ${joinLink ? `<p>Diesen Link einmal an das andere Handy schicken. Er verbindet die App mit eurem gemeinsamen Speicher. Nicht öffentlich teilen.</p>
        <div class="row"><button class="btn" id="share">Link teilen</button><button class="btn ghost" id="sync-now">Jetzt abgleichen</button></div>` : `<p class="muted">Noch nicht eingerichtet. Alles wird bis dahin nur auf diesem Gerät gespeichert.</p>`}
      <details class="setup"><summary>Sync einrichten oder ändern</summary>
        <form id="syncform" class="fields">
          <label>Supabase URL<input name="url" value="${esc(c.url)}" placeholder="https://xyz.supabase.co" autocomplete="off"></label>
          <label>Anon Key<input name="key" value="${esc(c.key)}" autocomplete="off"></label>
          <label>Reisecode<input name="code" value="${esc(c.code)}" autocomplete="off"></label>
          <button class="btn sm">Speichern und abgleichen</button>
        </form></details></section>
    <section class="card"><h2>Als App installieren</h2><ol><li>Seite in Safari öffnen.</li><li>Teilen antippen, dann „Zum Home-Bildschirm“.</li><li>Einmal mit Netz öffnen. Danach läuft sie auch im Flugmodus.</li></ol></section>
    <section class="card"><h2>Quellen</h2><ul class="plain">${T.sources.map(s => `<li><a href="${s[1]}" target="_blank" rel="noopener">${esc(s[0])}</a></li>`).join("")}</ul><p class="muted">Faktencheck vom 17.11.2026. Zugzeiten am Viadukt für Februar 2027 noch offen.</p></section>`;
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
const views = { heute: vHeute, route: vRoute, buchen: vBuchen, listen: vListen, geld: vGeld, infos: vInfos };
function render() {
  const [v, arg] = (location.hash.slice(1) || "heute").split("/");
  const view = views[v] ? v : "heute";
  const y = window.scrollY;
  $("#main").innerHTML = views[view](arg);
  document.querySelectorAll("nav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + view));
  if (arg && view === "route") { const el = document.getElementById(arg); if (el) el.scrollIntoView({ block: "start" }); }
  else if (render.last === view) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  render.last = view;
  setStatus(status);
}
window.addEventListener("hashchange", () => { render(); sync(); });

document.addEventListener("click", e => {
  const t = e.target;
  if (t.dataset.map) {
    if (!$("#mapbox")) { location.hash = "#route/" + t.dataset.map; return; }
    $("#mapbox").innerHTML = mapSvg(t.dataset.map);
    $("#mapbox").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (t.dataset.book) { const s = get("book:" + t.dataset.book, {}); put("book:" + t.dataset.book, { ...s, status: t.dataset.status }); render(); }
  if (t.dataset.del) { if (confirmDel(t)) { remove(t.dataset.del); render(); } }
  if (t.id === "ics") exportIcs();
  if (t.id === "csv") exportCsv();
  if (t.id === "sync-now") sync().then(render);
  if (t.id === "share") {
    const c = cfg(), link = `${location.origin}${location.pathname}#join=${enc(c.code)}&u=${enc(c.url)}&k=${enc(c.key)}`;
    if (navigator.share) navigator.share({ title: "Schottland 2027", text: "Unsere Reise-App, einmal öffnen zum Verbinden:", url: link }).catch(() => {});
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
  if (t.dataset.check) put(t.dataset.check, { done: t.checked });
  if (t.dataset.citem) { const c = get(t.dataset.citem, {}); put(t.dataset.citem, { ...c, done: t.checked }); }
  if (t.dataset.bf) { const s = get("book:" + t.dataset.bf, {}); put("book:" + t.dataset.bf, { ...s, [t.dataset.k]: t.value.trim() }); }
  if (t.dataset.note) put("note:" + t.dataset.note, { text: t.value });
  if (t.id === "rate") { const v = parseFloat(t.value.replace(",", ".")); if (v > 0) { put("set:rate", { v }); render(); } }
});
document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, fd = new FormData(f);
  if (f.dataset.add) {
    const text = (fd.get("t") || "").trim();
    if (text) { put("citem:" + uid(), { list: f.dataset.add, text, done: false }); render(); }
  }
  if (f.id === "expform") {
    const amount = parseFloat(String(fd.get("amount")).replace(",", "."));
    if (!(amount > 0)) return;
    put("exp:" + uid(), { label: fd.get("label").trim(), amount, cur: fd.get("cur"), who: fd.get("who"), date: today(), ts: Date.now() });
    render();
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
