// Jessie's stage view: live requests, gigs and set list. Talks to /api/admin/*.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const store = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} }
};
function toast(t) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 2200); }

let key = store.get("jj-stage");
let data = null;                       // { settings, gigs, songs }
let queue = new Map(), night = "", lastKey = "", timer = null;

class AuthError extends Error {}
async function api(path, method = "GET", body) {
  const r = await fetch("/api/admin/" + path, {
    method, cache: "no-store",
    headers: { "content-type": "application/json", "x-stage-key": key },
    body: body ? JSON.stringify(body) : undefined
  });
  const out = await r.json().catch(() => ({}));
  if (r.status === 401) throw new AuthError(out.error || "Wrong password.");
  if (!r.ok) throw new Error(out.error || "Something went wrong.");
  return out;
}

// ---------- sign in ----------
function showLogin(msg) {
  clearInterval(timer);
  $("panel").hidden = true; $("signout").hidden = true; $("login").hidden = false;
  $("l-err").hidden = !msg; $("l-err").textContent = msg || "";
}
async function start() {
  if (!key) return showLogin();
  try { data = await api("data"); }
  catch (e) { if (e instanceof AuthError) { key = ""; store.set("jj-stage", ""); } return showLogin(e.message); }
  $("login").hidden = true; $("panel").hidden = false; $("signout").hidden = false;
  renderSettings(); renderGigs(); renderSongs();
  poll(); clearInterval(timer); timer = setInterval(poll, 4000);
  try { await navigator.wakeLock?.request("screen"); } catch {}
}
$("login").addEventListener("submit", e => { e.preventDefault(); key = $("l-pw").value; store.set("jj-stage", key); start(); });
$("signout").addEventListener("click", () => { key = ""; store.set("jj-stage", ""); showLogin(); });

// ---------- tabs ----------
const tabs = ["tonight", "gigs", "songs"];
tabs.forEach(t => $("tab-" + t).addEventListener("click", () => {
  tabs.forEach(o => { $("tab-" + o).setAttribute("aria-selected", String(o === t)); $("p-" + o).hidden = o !== t; });
}));

// ---------- tonight ----------
function renderSettings() {
  const s = data.settings;
  $("toggle").setAttribute("aria-checked", String(s.open));
  $("openlbl").textContent = s.open ? "Open" + (s.venue ? " · " + s.venue : "") : "Closed";
}

async function poll() {
  if (document.hidden || !data) return;
  try {
    const q = await api(`queue?night=${encodeURIComponent(night)}&after=${encodeURIComponent(lastKey)}`);
    if (q.night !== night) { queue.clear(); night = q.night; }
    const live = new Set(q.keys);
    for (const k of queue.keys()) if (!live.has(k)) queue.delete(k);
    q.items.forEach(i => queue.set(i.key, i));
    lastKey = q.keys[q.keys.length - 1] || "";
    if (q.open !== data.settings.open) { data.settings.open = q.open; renderSettings(); }
    renderQueue();
    $("synced").textContent = "Live";
  } catch (e) {
    if (e instanceof AuthError) return showLogin(e.message);
    $("synced").textContent = "Reconnecting…";
  }
}

let groups = [];
function renderQueue() {
  const map = new Map();
  for (const r of queue.values()) {
    const k = r.song.toLowerCase().trim();
    const g = map.get(k) || { song: r.song, artist: r.artist, off: r.offList, keys: [], notes: [] };
    g.keys.push(r.key);
    if (r.name || r.message) g.notes.push((r.name ? r.name + ": " : "") + (r.message || ""));
    map.set(k, g);
  }
  groups = [...map.values()].sort((a, b) => b.keys.length - a.keys.length);
  $("s-total").textContent = queue.size;
  $("s-songs").textContent = groups.length;
  $("s-off").textContent = groups.filter(g => g.off).length;
  $("queue").innerHTML = groups.length ? groups.map((g, i) => `<div class="item"><span class="count">${g.keys.length}</span>
    <div class="item-body"><span class="item-title">${esc(g.song)}</span><span class="item-sub">${g.off ? "Off-list" : esc(g.artist)}</span>${g.notes.map(n => `<q>${esc(n)}</q>`).join("")}</div>
    <button class="btn btn-ghost btn-sm" data-played="${i}">Played</button></div>`).join("")
    : `<p class="item empty-row">${data.settings.open ? "Requests are open. Waiting for the first one." : "Requests are closed."}</p>`;
}
$("queue").addEventListener("click", async e => {
  const b = e.target.closest("[data-played]"); if (!b) return;
  const g = groups[b.dataset.played]; b.disabled = true;
  try { await api("played", "POST", { keys: g.keys }); g.keys.forEach(k => queue.delete(k)); renderQueue(); }
  catch (err) { b.disabled = false; toast(err.message); }
});

$("toggle").addEventListener("click", async () => {
  try { ({ settings: data.settings } = await api("settings", "POST", { open: !data.settings.open })); renderSettings(); renderQueue(); }
  catch (e) { toast(e.message); }
});
$("night").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    ({ settings: data.settings } = await api("settings", "POST", { start: { venue: $("n-venue").value, label: $("n-when").value } }));
    queue.clear(); lastKey = ""; e.target.reset(); e.target.closest("details").open = false;
    renderSettings(); renderQueue(); toast("Requests open"); poll();
  } catch (err) { toast(err.message); }
});

// ---------- delete buttons need two taps ----------
function twoTap(btn) {
  if (btn.classList.contains("confirm")) return true;
  btn.classList.add("confirm"); btn.textContent = "Sure?";
  setTimeout(() => { btn.classList.remove("confirm"); btn.textContent = "Delete"; }, 3000);
  return false;
}

// ---------- gigs ----------
function renderGigs() {
  const today = new Date().toISOString().slice(0, 10);
  const gigs = data.gigs.map((g, i) => ({ ...g, i })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const upcoming = gigs.filter(g => g.date >= today), past = gigs.filter(g => g.date < today).reverse().slice(0, 5);
  const row = g => { const d = new Date(g.date + "T12:00");
    return `<div class="item${g.date < today ? " past" : ""}"><span class="when"><strong>${d.getDate()}</strong>${MON[d.getMonth()]} ${DAY[d.getDay()]}</span>
      <div class="item-body"><span class="item-title">${esc(g.venue)}</span><span class="item-sub">${g.act === "band" ? "Band" : "Solo"}${g.town ? " · " + esc(g.town) : ""}${g.time ? " · " + esc(g.time) : ""}</span></div>
      <button class="btn btn-ghost btn-sm del" data-gig="${g.i}">Delete</button></div>`; };
  $("gig-list").innerHTML = (upcoming.map(row).join("") || `<p class="item empty-row">No gigs coming up. Add one above.</p>`) + past.map(row).join("");
}
async function saveGigs(gigs, msg) {
  try { ({ gigs: data.gigs } = await api("gigs", "PUT", { gigs })); renderGigs(); toast(msg); return true; }
  catch (e) { toast(e.message); return false; }
}
$("gig-form").addEventListener("submit", async e => {
  e.preventDefault();
  const gig = { date: $("g-date").value, time: $("g-time").value, venue: $("g-venue").value, town: $("g-town").value, act: $("g-act").value, ticketUrl: $("g-url").value };
  if (await saveGigs([...data.gigs, gig], "Gig added")) { const act = $("g-act").value; e.target.reset(); $("g-act").value = act; }
});
$("gig-list").addEventListener("click", e => {
  const b = e.target.closest("[data-gig]"); if (!b || !twoTap(b)) return;
  saveGigs(data.gigs.filter((_, i) => i !== +b.dataset.gig), "Gig deleted");
});

// ---------- set list ----------
function renderSongs() {
  const q = $("song-search").value.trim().toLowerCase();
  const list = data.songs.map((s, i) => ({ ...s, i })).filter(s => (s.title + " " + s.artist).toLowerCase().includes(q))
    .sort((a, b) => (b.original - a.original) || a.title.localeCompare(b.title));
  $("song-count").textContent = `${data.songs.length} songs`;
  $("song-list").innerHTML = list.map(s => `<div class="item${s.original ? " original" : ""}">
      <button class="star${s.original ? " on" : ""}" data-star="${s.i}" aria-label="${s.original ? "Unmark" : "Mark"} ${esc(s.title)} as an original" aria-pressed="${s.original}">&#9733;</button>
      <div class="item-body"><span class="item-title">${esc(s.title)}</span><span class="item-sub">${esc(s.artist)}</span></div>
      <button class="btn btn-ghost btn-sm del" data-song="${s.i}">Delete</button></div>`).join("")
    || `<p class="item empty-row">${q ? "No match." : "No songs yet. Add one above."}</p>`;
}
async function saveSongs(songs, msg) {
  try { ({ songs: data.songs } = await api("songs", "PUT", { songs })); renderSongs(); if (msg) toast(msg); return true; }
  catch (e) { toast(e.message); return false; }
}
$("song-form").addEventListener("submit", async e => {
  e.preventDefault();
  const song = { title: $("sg-title").value, artist: $("sg-artist").value, original: $("sg-orig").checked };
  if (await saveSongs([...data.songs, song], "Song added")) { e.target.reset(); $("sg-title").focus(); }
});
$("song-search").addEventListener("input", renderSongs);
$("song-list").addEventListener("click", e => {
  const star = e.target.closest("[data-star]");
  if (star) return saveSongs(data.songs.map((s, i) => i === +star.dataset.star ? { ...s, original: !s.original } : s));
  const b = e.target.closest("[data-song]"); if (!b || !twoTap(b)) return;
  saveSongs(data.songs.filter((_, i) => i !== +b.dataset.song), "Song deleted");
});

document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
start();
