import { BOOKING_EMAIL, SITE_URL } from "./config.js";

const root = new URL("../../", import.meta.url).href; // site root, wherever this page lives
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const load = name => fetch(root + "content/" + name, { cache: "no-cache" }).then(r => r.json());
const actName = a => a === "band" ? "Jessie & the Revolvers" : "Jessie James";

async function gigs() {
  const lists = document.querySelectorAll("[data-gigs]");
  const next = document.querySelector("[data-next-gig]");
  if (!lists.length && !next) return;
  let gigs;
  try {
    const r = await fetch("/api/gigs", { cache: "no-store" });
    if (!r.ok) throw new Error();
    ({ gigs } = await r.json());
  } catch { ({ gigs } = await load("gigs.json")); } // fallback if the API isn't reachable
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = gigs.filter(g => g.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  lists.forEach(el => {
    const list = upcoming.filter(g => el.dataset.gigs === "all" || g.act === el.dataset.gigs);
    el.innerHTML = list.length ? list.map(g => {
      const d = new Date(g.date + "T12:00");
      const btn = g.ticketUrl ? `<a class="btn btn-ghost btn-sm" href="${esc(g.ticketUrl)}" target="_blank" rel="noopener">Tickets</a>` : "";
      return `<div class="gig">
        <div class="gig-date"><strong>${d.getDate()}</strong>${MON[d.getMonth()]} &middot; ${DAY[d.getDay()]}</div>
        <div class="gig-info"><span class="gig-venue">${esc(g.venue)}<span class="tag ${g.act === "band" ? "tag-band" : ""}">${g.act === "band" ? "Band" : "Solo"}</span></span>
        <span class="gig-meta">${esc(g.town)}${g.time ? " &middot; " + esc(g.time) : ""}</span></div>${btn}</div>`;
    }).join("") : `<p class="empty">No gigs announced right now. Join the mailing list to hear first.</p>`;
  });

  if (next && upcoming[0]) {
    const g = upcoming[0], d = new Date(g.date + "T12:00");
    next.querySelector(".txt").textContent = `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} · ${g.venue}, ${g.town}`;
    next.hidden = false;
  }

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
      url: SITE_URL + (g.act === "band" ? "/band/" : "/")
    })));
    document.head.append(s);
  }
}

async function music() {
  const release = document.querySelector("[data-release]"), tracks = document.querySelector("[data-tracks]");
  const videos = document.querySelector("[data-videos]"), fTitle = document.querySelector("[data-feature-title]"), fCover = document.querySelector("[data-feature-cover]");
  if (!release && !tracks && !videos && !fTitle) return;
  const data = await load("music.json");
  const r = data.releases[0];
  const names = { spotify: "Spotify", apple: "Apple Music", youtube: "YouTube", bandcamp: "Bandcamp", soundcloud: "SoundCloud" };

  if (r && fTitle) { fTitle.textContent = `New ${r.type.toLowerCase()}: ${r.title}`; if (r.artwork) { fCover.src = root + r.artwork; fCover.alt = `${r.title} artwork`; } }

  if (r && release) {
    const links = Object.entries(r.links || {}).filter(([, u]) => u);
    const btns = links.map(([k, u], i) => `<a class="btn ${i ? "btn-ghost" : "btn-primary"}" href="${esc(u)}" target="_blank" rel="noopener">${names[k] || esc(k)}</a>`).join("");
    release.innerHTML = `<img class="cover" src="${esc(root + r.artwork)}" alt="${esc(r.title)} artwork" width="640" height="640">
      <div class="release-body"><span class="eyebrow">Latest ${esc(r.type.toLowerCase())} &middot; ${esc(r.year)}</span>
      <h2 class="release-title" id="music-h">${esc(r.title)}</h2>
      ${r.blurb ? `<p class="lede">${esc(r.blurb)}</p>` : ""}
      <div class="stream">${btns || '<span class="muted">Streaming links coming soon.</span>'}</div></div>`;
  }

  if (tracks) tracks.innerHTML = data.releases.map((t, i) => {
    const url = Object.values(t.links || {}).find(Boolean);
    const attrs = url ? `href="${esc(url)}" target="_blank" rel="noopener"` : `href="#music"`;
    return `<a class="track" ${attrs}><span class="n">${String(i + 1).padStart(2, "0")}</span><span class="name">${esc(t.title)}</span><span class="meta">${esc(t.type)} &middot; ${esc(t.year)}</span><span class="go">${url ? "Listen" : "Soon"}</span></a>`;
  }).join("");

  if (videos) videos.innerHTML = data.videos.map(v => {
    const bg = v.thumb ? ` style="background-image:url('${esc(root + v.thumb)}')"` : "";
    const href = v.url ? `href="${esc(v.url)}" target="_blank" rel="noopener"` : `href="#" aria-disabled="true"`;
    return `<a class="video" ${href}${bg}><b>${esc(v.title)}</b><small>${esc(v.note)}</small></a>`;
  }).join("");
}

document.querySelectorAll("[data-email]").forEach(e => { e.textContent = BOOKING_EMAIL; e.href = "mailto:" + BOOKING_EMAIL; });
document.querySelectorAll("[data-year]").forEach(e => e.textContent = new Date().getFullYear());
gigs().catch(console.error);
music().catch(console.error);
