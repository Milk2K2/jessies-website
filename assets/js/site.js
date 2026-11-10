import { BOOKING_EMAIL, SITE_URL, TIP_URL } from "./config.js";

const root = new URL("../../", import.meta.url).href; // site root, wherever this page lives
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const BAND = "Jessie & The Revolvers";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const load = name => fetch(root + "content/" + name, { cache: "no-cache" }).then(r => r.json());
const actName = a => a === "band" ? BAND : "Jessie James";
const $$ = sel => document.querySelectorAll(sel);
const section = el => el.closest("[data-optional]") || el;

/* ---------- gigs ---------- */
async function gigs() {
  const lists = $$("[data-gigs]"), nexts = $$("[data-next-gig]");
  if (!lists.length && !nexts.length) return;
  let gigs;
  try {
    const r = await fetch("/api/gigs", { cache: "no-store" });
    if (!r.ok) throw new Error();
    ({ gigs } = await r.json());
  } catch { ({ gigs } = await load("gigs.json")); } // fallback if the API isn't reachable
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = gigs.filter(g => g.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const scoped = scope => upcoming.filter(g => !scope || scope === "all" || g.act === scope);

  const when = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); if (!m) return t || ""; const h = +m[1]; return `${h % 12 || 12}${m[2] === "00" ? "" : "." + m[2]}${h < 12 ? "am" : "pm"}`; };

  lists.forEach(el => {
    const all = el.dataset.gigs === "all", list = scoped(el.dataset.gigs);
    el.innerHTML = list.length ? list.map(g => {
      const d = new Date(g.date + "T12:00");
      const meta = [g.town, when(g.time), all ? (g.act === "band" ? "with The Revolvers" : "solo") : ""].filter(Boolean).map(esc).join(", ");
      const btn = g.ticketUrl ? `<a class="btn btn-sm" href="${esc(g.ticketUrl)}" target="_blank" rel="noopener">Tickets</a>` : "";
      return `<div class="gig">
        <div class="gig-date"><strong>${d.getDate()}</strong><span>${MON[d.getMonth()]}</span><span>${DAY[d.getDay()]}</span></div>
        <div class="gig-info"><span class="gig-venue">${esc(g.venue)}</span><span class="gig-meta">${meta}</span></div>${btn}</div>`;
    }).join("") : `<p class="empty">No dates announced right now. Join the mailing list to hear first.</p>`;
  });

  nexts.forEach(next => {
    const g = scoped(next.dataset.nextGig)[0];
    if (!g) return;
    const d = new Date(g.date + "T12:00"), wrap = next.closest("[data-next-wrap]") || next;
    (next.querySelector(".txt") || next).textContent = `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}, ${g.venue}, ${g.town}`;
    if (next.dataset.nextHref === "tickets" && g.ticketUrl) {
      const a = next.closest("a"); a.href = g.ticketUrl; a.target = "_blank"; a.rel = "noopener";
      const go = wrap.querySelector("[data-next-go]"); if (go) go.textContent = "Get tickets";
    }
    wrap.hidden = false;
  });

  if (upcoming.length) {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(upcoming.map(g => ({
      "@context": "https://schema.org", "@type": "MusicEvent",
      name: `${actName(g.act)} at ${g.venue}`,
      startDate: g.date + (g.time ? "T" + g.time : ""),
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: { "@type": "Place", name: g.venue, address: g.town + ", UK" },
      performer: { "@type": g.act === "band" ? "MusicGroup" : "Person", name: actName(g.act) },
      ...(g.ticketUrl ? { offers: { "@type": "Offer", url: g.ticketUrl } } : {}),
      url: SITE_URL + (g.act === "band" ? "/band/" : "/")
    })));
    document.head.append(s);
  }
}

/* ---------- music ---------- */
const NAMES = { spotify: "Spotify", apple: "Apple Music", youtube: "YouTube", bandcamp: "Bandcamp", soundcloud: "SoundCloud" };
const art = r => root + (r.artwork || `assets/img/releases/${r.slug}.jpg`);
const streamBtns = (r, first = "btn-primary") => Object.entries(r.links || {}).filter(([, u]) => u)
  .map(([k, u], i) => `<a class="btn ${i ? "btn-ghost" : first}" href="${esc(u)}" target="_blank" rel="noopener">${NAMES[k] || esc(k)}</a>`).join("");

// The Spotify player only loads when someone presses play, so the page stays fast and nothing third-party loads uninvited.
function player(spotify, title, height) {
  const f = document.createElement("iframe");
  f.className = "player-frame";
  f.src = `https://open.spotify.com/embed/${spotify}?utm_source=generator&theme=0`;
  f.height = height; f.title = `${title} on Spotify`; f.loading = "lazy";
  f.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
  return f;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-play]");
  if (!b) return;
  const frame = player(b.dataset.play, b.dataset.title, b.dataset.height || 152);
  const slot = b.dataset.slot ? document.getElementById(b.dataset.slot) : null;
  if (!slot) return b.replaceWith(frame);
  slot.replaceChildren(frame); slot.hidden = false;
  const deck = b.closest("[data-deck]");
  if (deck) { deck.classList.add("playing"); b.removeAttribute("data-play"); b.querySelector(".sleeve-play")?.remove(); b.style.cursor = "default"; }
  else b.remove();
});
// artwork is optional: use it when the file loads, fall back to the designed sleeve when it doesn't
document.addEventListener("load", e => { if (e.target.matches?.("img[data-art]")) e.target.parentElement.classList.add("has-art"); }, true);
document.addEventListener("error", e => {
  const t = e.target;
  if (t.matches?.("img[data-art]")) t.remove();
  if (t.matches?.("img[data-optional-img]")) dropMissing(t);
}, true);

async function music() {
  const hero = document.querySelector("[data-release]"), list = document.querySelector("[data-releases]");
  const videos = document.querySelector("[data-videos]"), feature = document.querySelector("[data-feature]");
  const latest = $$("[data-latest]"), kit = document.querySelector("[data-kit-releases]");
  if (!hero && !list && !videos && !feature && !latest.length && !kit) return;
  const data = await load("music.json");
  const r = data.releases[0];

  const disc = rel => `<div class="rel-art"><img data-art src="${esc(art(rel))}" alt="" loading="lazy"></div>`;

  if (r && hero) hero.innerHTML = `<div class="deck" data-deck>
      <div class="disc" aria-hidden="true"><div class="disc-spin"></div></div>
      <button class="sleeve" type="button" data-play="${esc(r.spotify)}" data-title="${esc(r.title)}" data-height="152" data-slot="deck-player" aria-label="Play ${esc(r.title)}">
        <img data-art src="${esc(art(r))}" alt="">
        <span class="sleeve-play"><i class="play-ico"></i>Play</span>
        <span class="sleeve-kind">${esc(r.type)}, ${esc(r.year)}</span>
        <strong class="sleeve-title">${esc(r.title)}</strong>
        <span class="sleeve-artist">${esc(BAND)}</span></button></div>
    <div id="deck-player" hidden></div>
    <div class="stream">${streamBtns(r, "btn-ghost")}<a class="btn btn-ghost" href="https://open.spotify.com/${esc(data.artist)}" target="_blank" rel="noopener">Follow on Spotify</a></div>`;

  if (r && feature) feature.innerHTML = `${disc(r)}
      <div class="feature-body"><p>New ${esc(r.type.toLowerCase())} from ${esc(BAND)}</p>
      <h2>${esc(r.title)}</h2>${r.blurb ? `<p>${esc(r.blurb)}</p>` : ""}</div>
      <a class="btn btn-primary" href="${root}band/#music"><i class="play-ico"></i>Listen</a>`;

  latest.forEach(el => { el.textContent = r.title; });

  if (list) list.innerHTML = data.releases.map((t, i) => `<div class="rel">
      ${disc(t)}
      <div class="rel-body"><span class="rel-title">${esc(t.title)}</span><span class="rel-meta">${esc(t.type)}, ${esc(t.year)}</span>${t.blurb ? `<span class="rel-blurb">${esc(t.blurb)}</span>` : ""}</div>
      <div class="rel-actions">${t.spotify ? `<button class="btn btn-primary btn-sm" type="button" data-play="${esc(t.spotify)}" data-title="${esc(t.title)}" data-slot="rp-${i}"><i class="play-ico"></i>Play</button>` : ""}${t.links?.spotify ? `<a class="btn btn-ghost btn-sm" href="${esc(t.links.spotify)}" target="_blank" rel="noopener">Spotify</a>` : ""}</div>
      <div class="rel-player" id="rp-${i}" hidden></div></div>`).join("");

  if (kit) kit.innerHTML = data.releases.map(t => `<div class="member"><b>${esc(t.title)}</b><span>${esc(t.type)}, ${esc(t.year)}${t.links?.spotify ? `, <a href="${esc(t.links.spotify)}" target="_blank" rel="noopener">Listen</a>` : ""}</span></div>`).join("");

  if (videos) {
    const vids = (data.videos || []).filter(v => v.url);
    if (!vids.length) section(videos).remove();
    else videos.innerHTML = vids.map(v => {
      const bg = v.thumb ? ` style="background-image:url('${esc(root + v.thumb)}')"` : "";
      return `<a class="video" href="${esc(v.url)}" target="_blank" rel="noopener"${bg}><b>${esc(v.title)}</b><small>${esc(v.note || "")}</small></a>`;
    }).join("");
  }
}

/* ---------- proof, press, line-up ---------- */
async function band() {
  const proof = document.querySelector("[data-proof]"), quotes = $$("[data-quotes]"), lineup = document.querySelector("[data-lineup]");
  const stages = document.querySelector("[data-stages]"), kitHi = document.querySelector("[data-kit-highlights]");
  if (!proof && !quotes.length && !lineup && !stages && !kitHi) return;
  const d = await load("band.json");
  if (proof) proof.innerHTML = (d.highlights || []).map(h => h.url
    ? `<a href="${esc(h.url)}" target="_blank" rel="noopener"><b>${esc(h.title)}</b><span>${esc(h.detail)}</span></a>`
    : `<div><b>${esc(h.title)}</b><span>${esc(h.detail)}</span></div>`).join("");
  if (kitHi) kitHi.innerHTML = (d.highlights || []).map(h => `<div class="member"><b>${esc(h.title)}</b><span>${esc(h.detail)}</span></div>`).join("");
  quotes.forEach(el => {
    const qs = (d.quotes || []).slice(0, +el.dataset.quotes || 99);
    if (!qs.length) return section(el).remove();
    el.innerHTML = qs.map(q => `<blockquote class="quote"><p>${esc(q.text)}</p><cite>${q.url ? `<a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.source)}</a>` : esc(q.source)}</cite></blockquote>`).join("");
  });
  if (lineup) {
    if ((d.members || []).length < 2) section(lineup).remove();
    else lineup.innerHTML = d.members.map(m => `<div class="member"><b>${esc(m.name)}</b><span>${esc(m.role)}</span></div>`).join("");
  }
  if (stages) stages.innerHTML = (d.stages || []).map(esc).join("<br>");
}

/* ---------- merch ---------- */
async function merch() {
  const links = $$("[data-merch-link]"), grid = document.querySelector("[data-merch]");
  if (!links.length && !grid) return;
  const d = await load("merch.json"), items = d.items || [];
  if (items.length) links.forEach(a => { a.hidden = false; });
  if (!grid) return;
  if (!items.length) { grid.remove(); document.querySelector("[data-merch-empty]").hidden = false; return; }
  grid.innerHTML = items.map(m => {
    const ok = /^https:\/\//.test(m.buyUrl || "") && !m.soldOut;
    return `<article class="product${m.soldOut ? " sold" : ""}">
      <div class="product-img">${m.image ? `<img src="${esc(root + m.image)}" alt="${esc(m.name)}" loading="lazy">` : ""}</div>
      <h3 class="product-name">${esc(m.name)}</h3>
      ${m.detail ? `<p class="muted">${esc(m.detail)}</p>` : ""}
      <div class="product-buy"><span class="product-price">${esc(m.price || "")}</span>${ok ? `<a class="btn btn-primary" href="${esc(m.buyUrl)}" target="_blank" rel="noopener">Buy</a>` : `<span class="btn btn-ghost" aria-disabled="true">${m.soldOut ? "Sold out" : "Coming soon"}</span>`}</div>
    </article>`;
  }).join("");
  const note = document.querySelector("[data-merch-note]");
  if (d.note) { note.textContent = d.note; note.hidden = false; }
}

/* ---------- small things ---------- */
$$("[data-tip]").forEach(a => { if (/^https:\/\//.test(TIP_URL || "")) { a.href = TIP_URL; a.hidden = false; } });
// photos are optional too: if a file isn't there (or failed before this script ran), drop its box
function dropMissing(t) { const box = t.closest("[data-media]") || t; const hero = t.closest(".hero"); box.remove(); hero?.classList.add("no-media"); }
$$("img[data-optional-img]").forEach(i => { if (i.complete && !i.naturalWidth) dropMissing(i); });
$$("[data-email]").forEach(e => { if (!BOOKING_EMAIL) return (e.closest("p") || e).remove(); e.textContent = BOOKING_EMAIL; e.href = "mailto:" + BOOKING_EMAIL; });
$$("[data-year]").forEach(e => e.textContent = new Date().getFullYear());
$$("[data-copy]").forEach(b => b.addEventListener("click", async () => {
  const text = document.getElementById(b.dataset.copy).innerText.trim();
  try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; } catch { b.textContent = "Select the text to copy"; }
  setTimeout(() => { b.textContent = b.dataset.label; }, 1800);
}));
gigs().catch(console.error);
music().catch(console.error);
band().catch(console.error);
merch().catch(console.error);
