import { TIP_URL } from "./config.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

// A random id per phone, so the "requests per phone" limit works on shared pub wifi
let device = store.get("jj-device");
if (!device) { device = (crypto.randomUUID?.() || String(Math.random()).slice(2)); store.set("jj-device", device); }

let state = null, songs = [], mine = [];
const mineKey = () => "jj-req-" + (state?.night || "");

function toast(t) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 2200); }

if (TIP_URL) { $("tipbox").href = TIP_URL; $("tipbox").hidden = false; }

function render() {
  const open = !!state?.open;
  $("g-status").classList.toggle("off", !open);
  $("g-status").lastElementChild.textContent = open ? "Requests open" : "Requests closed";
  $("g-when").textContent = open ? "Live tonight" + (state.label ? " · " + state.label : "") : "Jessie James live";
  $("g-venue").textContent = open ? state.venue || "" : "";
  $("open").hidden = !open;
  $("closed").hidden = open;
  if (!open) return;

  const q = $("search").value.trim().toLowerCase();
  const list = songs.filter(s => (s.title + " " + s.artist).toLowerCase().includes(q));
  $("songs").innerHTML = list.map(s => {
    const i = songs.indexOf(s), done = mine.includes(s.title);
    return `<div class="item${s.original ? " original" : ""}">
      <div class="item-body"><span class="item-title">${esc(s.title)}</span><span class="item-sub">${s.original ? "Original · " : ""}${esc(s.artist)}</span></div>
      <button class="btn btn-ghost btn-sm pick${done ? " done" : ""}" data-i="${i}" ${done ? "disabled" : ""}>${done ? "Requested" : "Request"}</button></div>`;
  }).join("") || `<p class="item empty-row">No match. Use the box below.</p>`;
}

async function refresh() {
  const r = await fetch("/api/public", { cache: "no-store" });
  if (!r.ok) throw new Error("load");
  state = await r.json();
  songs = [...state.songs.filter(s => s.original), ...state.songs.filter(s => !s.original)];
  try { mine = JSON.parse(store.get(mineKey())) || []; } catch { mine = []; }
  render();
}

async function send(row) {
  try {
    const r = await fetch("/api/request", {
      method: "POST", headers: { "content-type": "application/json", "x-device": device }, body: JSON.stringify(row)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { toast(data.error || "Couldn't send. Try again."); if (r.status === 409) refresh().catch(() => {}); return false; }
    return true;
  } catch { toast("No signal. Try again in a moment."); return false; }
}

$("songs").addEventListener("click", async e => {
  const b = e.target.closest("button[data-i]"); if (!b) return;
  const s = songs[b.dataset.i]; b.disabled = true; b.textContent = "Sending…";
  if (await send({ song: s.title, artist: s.artist })) {
    mine.push(s.title); store.set(mineKey(), JSON.stringify(mine)); toast(`${s.title} requested`);
  }
  render();
});
$("search").addEventListener("input", render);
$("custom").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = e.target.querySelector("button"); btn.disabled = true;
  const ok = await send({ song: $("c-song").value, name: $("c-name").value, message: $("c-msg").value, offList: true });
  btn.disabled = false;
  if (ok) { e.target.reset(); toast("Request sent"); }
});

try { await refresh(); }
catch {
  $("g-status").lastElementChild.textContent = "Offline";
  $("closed").textContent = "Couldn't connect. Check your signal and refresh the page.";
  $("closed").hidden = false;
}
// pick up Jessie opening or closing requests
setInterval(() => { if (!document.hidden) refresh().catch(() => {}); }, 20000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh().catch(() => {}); });
