// Jessie James site API. Runs as a Netlify Function, stores data in Netlify Blobs.
//
// Public:  GET  /api/gigs      upcoming + past gigs
//          GET  /api/public    request status + set list (for the request page)
//          POST /api/request   a fan's song request
// Stage (needs the STAGE_PASSWORD env var, sent as the x-stage-key header):
//          GET  /api/admin/data      settings, gigs, songs
//          GET  /api/admin/queue     tonight's requests
//          POST /api/admin/played    clear requests
//          POST /api/admin/settings  open/close requests, start a new gig
//          PUT  /api/admin/gigs      replace the gig list
//          PUT  /api/admin/songs     replace the set list

import { getStore } from "@netlify/blobs";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";

const MAX_PER_PHONE = 8;     // requests per phone per gig
const MAX_PER_NIGHT = 600;   // safety cap
const LEN = { song: 120, artist: 120, name: 40, message: 200, venue: 80, town: 60, label: 40, time: 10, url: 300 };

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const fail = (error, status = 400) => json({ error }, status);
const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const sha = s => createHash("sha256").update(String(s)).digest();

async function seeded(store, req, key, file, field) {
  const saved = await store.get(key, { type: "json" });
  if (Array.isArray(saved)) return saved;
  try {
    const r = await fetch(new URL(`/content/${file}`, req.url));
    if (r.ok) return (await r.json())[field] || [];
  } catch {}
  return [];
}

async function settings(store) {
  const saved = await store.get("settings", { type: "json" });
  return { open: false, venue: "", label: "", night: "0", ...(saved || {}) };
}

function checkGig(g) {
  const date = clean(g?.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const venue = clean(g.venue, LEN.venue);
  if (!venue) return null;
  const ticketUrl = clean(g.ticketUrl, LEN.url);
  return {
    date, venue,
    time: clean(g.time, LEN.time),
    act: g.act === "band" ? "band" : "solo",
    town: clean(g.town, LEN.town),
    ticketUrl: /^https:\/\//.test(ticketUrl) ? ticketUrl : ""
  };
}

function checkSong(s) {
  const title = clean(s?.title, LEN.song);
  if (!title) return null;
  return { title, artist: clean(s.artist, LEN.artist), original: !!s.original };
}

function isStage(req) {
  const pw = process.env.STAGE_PASSWORD;
  if (!pw) return null;
  return timingSafeEqual(sha(req.headers.get("x-stage-key") || ""), sha(pw));
}

async function deletePrefix(store, prefix) {
  const { blobs } = await store.list({ prefix });
  await Promise.all(blobs.map(b => store.delete(b.key)));
}

export default async (req, context) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");
  const method = req.method;
  const store = getStore({ name: "jessie-site", consistency: "strong" });

  let body = {};
  if (method === "POST" || method === "PUT") {
    try { body = await req.json(); } catch { return fail("Bad request"); }
  }

  try {
    // ---------- public ----------
    if (path === "gigs" && method === "GET") {
      return json({ gigs: await seeded(store, req, "gigs", "gigs.json", "gigs") });
    }

    if (path === "public" && method === "GET") {
      const st = await settings(store);
      return json({
        open: st.open, venue: st.venue, label: st.label, night: st.night,
        songs: await seeded(store, req, "songs", "setlist.json", "songs")
      });
    }

    if (path === "request" && method === "POST") {
      const st = await settings(store);
      if (!st.open) return fail("Requests are closed right now.", 409);
      const song = clean(body.song, LEN.song);
      if (!song) return fail("Add a song name.");

      const phone = clean(req.headers.get("x-device"), 64) || context.ip || "unknown";
      const countKey = `phones/${st.night}/${sha(phone).toString("hex").slice(0, 20)}`;
      const totalKey = `total/${st.night}`;
      const [mine, total] = await Promise.all([
        store.get(countKey, { type: "json" }), store.get(totalKey, { type: "json" })
      ]);
      if ((mine || 0) >= MAX_PER_PHONE) return fail("That's the most requests from one phone tonight.", 429);
      if ((total || 0) >= MAX_PER_NIGHT) return fail("Requests are full for tonight.", 429);

      const item = {
        song,
        artist: clean(body.artist, LEN.artist),
        name: clean(body.name, LEN.name),
        message: clean(body.message, LEN.message),
        offList: !!body.offList,
        at: Date.now()
      };
      const key = `req/${st.night}/${String(Date.now()).padStart(15, "0")}-${randomUUID().slice(0, 6)}`;
      await Promise.all([
        store.setJSON(key, item),
        store.setJSON(countKey, (mine || 0) + 1),
        store.setJSON(totalKey, (total || 0) + 1)
      ]);
      return json({ ok: true });
    }

    // ---------- stage ----------
    if (!path.startsWith("admin/")) return fail("Not found", 404);
    const ok = isStage(req);
    if (ok === null) return fail("The stage password isn't set up yet. Add STAGE_PASSWORD in Netlify and redeploy.", 503);
    if (!ok) return fail("Wrong password.", 401);
    const route = path.slice("admin/".length);

    if (route === "data" && method === "GET") {
      const [st, gigs, songs] = await Promise.all([
        settings(store),
        seeded(store, req, "gigs", "gigs.json", "gigs"),
        seeded(store, req, "songs", "setlist.json", "songs")
      ]);
      return json({ settings: st, gigs, songs });
    }

    if (route === "queue" && method === "GET") {
      const st = await settings(store);
      const after = url.searchParams.get("night") === st.night ? url.searchParams.get("after") || "" : "";
      const { blobs } = await store.list({ prefix: `req/${st.night}/` });
      const keys = blobs.map(b => b.key).sort();
      const fresh = keys.filter(k => k > after);
      const items = (await Promise.all(fresh.map(async k => {
        const v = await store.get(k, { type: "json" });
        return v ? { key: k, ...v } : null;
      }))).filter(Boolean);
      return json({ night: st.night, open: st.open, keys, items });
    }

    if (route === "played" && method === "POST") {
      const keys = (Array.isArray(body.keys) ? body.keys : []).filter(k => typeof k === "string" && k.startsWith("req/")).slice(0, 200);
      await Promise.all(keys.map(k => store.delete(k)));
      return json({ ok: true });
    }

    if (route === "settings" && method === "POST") {
      const st = await settings(store);
      if (body.start) {
        await Promise.all([deletePrefix(store, "req/"), deletePrefix(store, "phones/"), deletePrefix(store, "total/")]);
        Object.assign(st, {
          open: true,
          venue: clean(body.start.venue, LEN.venue),
          label: clean(body.start.label, LEN.label),
          night: Date.now().toString(36)
        });
      } else if (typeof body.open === "boolean") {
        st.open = body.open;
      } else {
        return fail("Nothing to change.");
      }
      await store.setJSON("settings", st);
      return json({ settings: st });
    }

    if (route === "gigs" && method === "PUT") {
      const list = Array.isArray(body.gigs) ? body.gigs.slice(0, 300) : null;
      if (!list) return fail("Bad gig list.");
      const gigs = list.map(checkGig);
      const bad = gigs.indexOf(null);
      if (bad !== -1) return fail(`Gig ${bad + 1} needs a date and a venue.`);
      gigs.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      await store.setJSON("gigs", gigs);
      return json({ gigs });
    }

    if (route === "songs" && method === "PUT") {
      const list = Array.isArray(body.songs) ? body.songs.slice(0, 500) : null;
      if (!list) return fail("Bad set list.");
      const songs = list.map(checkSong);
      if (songs.includes(null)) return fail("Every song needs a title.");
      await store.setJSON("songs", songs);
      return json({ songs });
    }

    return fail("Not found", 404);
  } catch (err) {
    console.error(err);
    return fail("Something went wrong. Try again.", 500);
  }
};

export const config = { path: "/api/*" };
