# Jessie James website

Everything runs on Netlify: static pages, a small Netlify Function for the API, and Netlify Blobs for storage. There's no build step, nothing to sign up for besides Netlify and GitHub, and no external CDNs (the fonts are bundled in `assets/`).

## Pages
- `/` Jessie solo (home)
- `/band/` Jessie & the Revolvers, originals first
- `/request/` what the QR code opens (also `/r`)
- `/stage/` Jessie's private page, behind a password and hidden from Google
- `/thanks/` shown after the booking or mailing list forms

## The stage page (Jessie, on her phone)
- **Tonight**: open or close requests, see requests live and ranked, tap "Played" to clear one, start a new gig.
- **Gigs**: add or delete gigs. They show on the website straight away, and past gigs hide themselves.
- **Set list**: add or delete songs fans can request. The star marks her originals, which show first.

None of this needs a redeploy or any code.

## One-time setup
1. **GitHub**: create a private repo and upload this folder's contents (GitHub's website has "Add file > Upload files"; drag everything in, including the hidden `.gitignore`).
2. **Netlify**: Add new site > Import an existing project > GitHub > pick the repo. Leave the build command empty and set the publish directory to `.`. Deploy.
3. **Stage password**: Netlify > Site configuration > Environment variables > Add `STAGE_PASSWORD` with a password Jessie will remember. Then go to Deploys > Trigger deploy so the setting takes effect.
4. **Forms**: Netlify > Forms > Enable form detection, then redeploy. Add an email notification for "booking" and "mailing-list" so enquiries land in your inbox.
5. **Save credits**: Site configuration > Build & deploy > Branches and deploy contexts. Keep the production branch as `main`, and turn off deploy previews if you don't use them.
6. **Domain**: Domain management > Add a domain. Then change `jessiejamesmusic.co.uk` in the HTML files, `assets/js/config.js`, `sitemap.xml` and `robots.txt`, and ask for a new QR card if the domain is different.

## Changing things yourself
Edit any file on github.com (pencil icon), commit, and Netlify redeploys within about a minute. Each live deploy uses 15 of the free plan's 300 monthly credits.
- Bios, line-up, social links: `index.html`, `band/index.html`
- Releases and videos: `content/music.json` (the first release is the featured one; empty links are hidden)
- Photos: replace the files in `assets/img/` and keep the same names
- Booking email and tip link: `assets/js/config.js`
- `content/gigs.json` and `content/setlist.json` are only the starting data. Once Jessie saves from the stage page, hers takes over.

## On gig night
1. Jessie opens `/stage/` on her phone and signs in once; the phone remembers it.
2. Tonight > "Start a new gig" with the venue. That clears the last gig's requests and opens requests.
3. Fans scan the QR card (`assets/img/qr-stage-card.png`, print it A6).
4. Requests appear within a few seconds, grouped and ranked. Tap "Played" to clear them, and flip the switch off at the end.

Limits: each phone can send 8 requests per gig, with 600 per gig in total.

## Costs
Free on Netlify's free plan at this size. Forms are unlimited. The API is tiny: a busy gig night uses a couple of credits. Domain is roughly £10 a year.
