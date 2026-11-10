# Jessie James website

Everything runs on Netlify: static pages, a small Netlify Function for the API, and Netlify Blobs for storage. There's no build step, nothing to sign up for besides Netlify and GitHub, and no external CDNs (the fonts are bundled in `assets/`).

## The look
A gig poster: League Gothic for headlines, Alfa Slab One for names (the band, venues), IBM Plex Sans for reading. Three colours do the work: violet, black and bone. Marigold is kept for tickets and live things only, so it always means "there's a show". All of it is set at the top of `assets/css/style.css`.

Photos are tinted violet to match (the `duo` class). Take `duo` off the photo's box in the HTML if you'd rather show one in natural colour.

## Pages
- `/` Jessie solo (home)
- `/band/` Jessie & The Revolvers: player, singles, proof, live dates, mailing list
- `/epk/` press kit for promoters and press (copyable bio, highlights, releases)
- `/links/` one page of links. Put this in the Instagram and Facebook bios instead of a Linktree, so every click lands on her own site
- `/merch/` merch shop. Shows "on the way" plus a mailing list signup until there's a product, then it and its menu link appear
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
- Bios and social links: `index.html`, `band/index.html`, `epk/index.html`
- Releases and videos: `content/music.json`. Newest first; the first one is featured on every page. Empty links are hidden, and the Watch section appears once a video has a url
- Awards, radio, press quotes, line-up, stages played: `content/band.json`. The line-up shows once two or more members are listed
- Photos are optional and appear on their own when the file exists:
  - `assets/img/jessie.jpg` home page hero (portrait, about 1200x1500)
  - `assets/img/band.jpg` band page (landscape, about 1800x1200)
  - `assets/img/releases/better-off.jpg`, `25.jpg`, `long-gone.jpg`, `self-obsessed.jpg` single artwork (square, 1000px+)
  - `assets/img/share.jpg` and `share-band.jpg` are the link-preview images (1200x630); swap for photo versions when you have them
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

## When a new single comes out
1. Add it to the top of `content/music.json` (copy an existing entry; `spotify` is the part of the link after `open.spotify.com/`).
2. Drop the artwork in `assets/img/releases/` named after its `slug`.
3. Add it to the set list from the stage page. The home page, band page, press kit and links page all update from that one file.

## Sources for the copy (check with Jessie before launch)
Bio facts come from the band's Spotify profile, BabyStep Magazine's January 2026 feature and the Music Awards of Staffordshire & Cheshire results. The wording is a draft for her to approve.

## Tips with Apple Pay
The site doesn't take payments itself (no card details ever touch it). Tips go through a Stripe payment link, which takes cards, Apple Pay and Google Pay.
1. Jessie opens a Stripe account at stripe.com (her name, her bank account, so the money goes straight to her).
2. In Stripe: Payment Links > New > "Customers choose what to pay". Call it "Tip Jessie & The Revolvers" and copy the link.
3. Paste it into `TIP_URL` in `assets/js/config.js`. A tip button then shows on the request page and the links page.

## Merch
Each product is a Stripe payment link too, so there's no monthly shop fee.
1. In Stripe: Payment Links > New > "Products or subscriptions". Add the product, price and a photo. Turn on "Collect customers' addresses" and add a shipping rate. For sizes, add a custom dropdown field called Size.
2. Add the product to `content/merch.json` (there's an example in the file) with that link as `buyUrl`, and put a square photo in `assets/img/merch/`.
3. Orders arrive by email from Stripe with the address and size. When something runs out, set `soldOut` to true.
If she ends up with lots of products or needs stock counts, that's the point to move the shop to something like Big Cartel and link it from here.

## Photos
Supplied by Jessie. Before launch, check each photographer is happy for them to be used and whether they want a credit (it can go in the footer).
