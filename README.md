# Bridget's Boutique — Website

A static website for Bridget's Boutique, a women's clothing boutique in downtown Enumclaw, WA. No build step required — plain HTML/CSS/JS.

## Structure

- `index.html` — home page
- `shop.html` — New Arrivals gallery (filterable by category)
- `about.html` — story, hours, map
- `contact.html` — contact / order inquiry form
- `admin.html` — password-protected dashboard for managing products/photos and viewing order inquiries (see "Free Backend" below)
- `css/style.css`, `css/admin.css` — styles
- `js/script.js` — nav toggle, active-link highlighting, scroll effects
- `js/products.js` — loads products (live from Firebase once configured, otherwise a small built-in demo list)
- `js/contact.js` — handles the contact/order form submission
- `js/admin.js`, `js/firebase-init.js`, `js/firebase-config.js` — the admin dashboard and its Firebase connection
- `firebase/firestore.rules`, `firebase/storage.rules` — security rules to paste into the Firebase console
- `404.html` — styled not-found page
- `robots.txt` / `sitemap.xml` — SEO crawling config
- `images/` — site images

## Real business info already wired up

- Address: 1617 Cole St, Enumclaw, WA 98022 (linked to Google Maps)
- Phone: (360) 625-8032 (click-to-call)
- Hours: Mon–Thu 10–5, Fri–Sat 10–7, Sun 11–5
- Instagram: https://www.instagram.com/bridgetsboutiqueenumclaw/
- Facebook: https://www.facebook.com/BridgetsBoutiqueEnumclaw/
- A real Instagram video is embedded on the home page via Instagram's official embed widget.

## Polish / "pro" features

- Full-bleed hero with dark overlay, pill-shaped CTA buttons, centered typography
- Sticky mobile "convenience bar" (Call / Order / Directions) always reachable on phones
- Circular social icon buttons in the desktop nav
- Scroll-reveal animations (respects `prefers-reduced-motion`)
- Header gains a shadow on scroll
- `ClothingStore` JSON-LD structured data on every page (real NAP, hours, social links) for local SEO / Google rich results
- Open Graph + Twitter Card meta tags with a real photo, so links look good when shared
- Accessibility: skip-to-content link, visible focus states, `aria-label`s throughout
- Image `loading="lazy"` on the map embed; hero/logo load eagerly

## Free Backend Setup (Firebase)

The site works standalone with demo product data and a "call us to order" fallback
on the contact form. Connecting Firebase turns on:

- **admin.html** — a login-protected dashboard where the owner adds/edits products,
  uploads photos, and views order inquiries — no GitHub or code editing needed.
- **Live products** — the public site pulls product data from Firebase instead of
  the hardcoded demo list, so admin edits show up immediately.
- **Real order inquiries** — the contact form saves submissions to Firebase instead
  of just showing a placeholder message.

It's genuinely free at this scale (Firebase's Spark plan) and there's no server to
host or pay for — the site talks to Firebase directly from the browser.

**Setup steps (one-time, ~15 minutes):**

1. Go to https://console.firebase.google.com and create a new project (free Spark plan).
2. **Firestore Database** → Create database → start in production mode.
3. **Storage** → Get started (accept the default bucket).
4. **Authentication** → Sign-in method → enable **Email/Password**. Then go to the
   **Users** tab → Add user → enter the owner's email address and a **temporary
   password** (Firebase requires at least 6 characters — e.g. `Boutique2026!`).
   Copy the **User UID** it generates; you need it in the next step.
5. **Firestore Database** → Start collection → collection ID `admins` → Document ID
   = the **User UID** from step 4 → add any field you like (e.g. `note` = `owner`)
   → Save. **This step is what actually grants access** — see the security note below.
6. **Project settings** (gear icon) → General → "Your apps" → click the `</>` (Web)
   icon → register an app (nickname doesn't matter, check "Also set up Firebase
   Hosting" if offered) → copy the `firebaseConfig` object it gives you into
   `js/firebase-config.js`, replacing the placeholder values.
7. **Firestore Database** → **Rules** tab → paste in the contents of
   `firebase/firestore.rules` → Publish.
8. **Storage** → **Rules** tab → paste in the contents of `firebase/storage.rules` → Publish.
9. Deploy the site to **Firebase Hosting** (see "Deploying" below) — same project,
   same login, so hosting + database + photo storage + admin login are all in one place.
10. Visit `yoursite.com/admin.html` and log in with the email + temporary password
    from step 4. The dashboard shows a banner prompting the owner to set their own
    password under the **Account** tab — after that, only they know it.

Once products are added in the dashboard, they replace the demo listings on the
public site automatically.

### Security: why step 5 matters

Firebase's Email/Password sign-in lets **anyone** create an account against the
project — the API key in `firebase-config.js` is public by design and can't be
hidden. So "is this user logged in?" is not a safe permission check on its own.

The security rules therefore require the user's UID to exist in the `admins`
Firestore collection, and those documents can only be created from the Firebase
Console (the rules forbid writing them from the website). A stranger who signs
themselves up lands on a "No Access" screen and can't read inquiries or change
anything.

**If you skip step 5, nobody — including the owner — can edit the site.** If you
were to loosen the rules to `request.auth != null` instead, anyone on the internet
could sign up and take over the site. Don't.

Other protections already in place:
- Product photo uploads are limited to real image files under 10 MB.
- Contact form submissions are shape- and length-checked, so the form can't be
  used to dump arbitrary data into the database.
- Everything outside `product-photos/` in Storage is unreachable from the website.
- `admin.html` is excluded from search engines (`robots.txt` + a `noindex` tag).
- The owner can self-recover with "Forgot your password?" on the login screen —
  Firebase emails them a reset link, so you never need to hold their password.

### Adding another admin later

Repeat steps 4–5 for the new person: create their user in Authentication, then add
their UID as a document in the `admins` collection.

## Replacing photos without Firebase (no code editing required)

If you'd rather skip the Firebase setup for now, every photo on the site still has
a fixed, predictable filename that can be swapped directly on GitHub:

1. On GitHub, open the `images` folder.
2. Click **Add file → Upload files**, then drag in your new photo, named **exactly** the same as the file you're replacing (e.g. `store-display.jpg`).
3. GitHub will show it replacing the existing file — commit the change, and it's live.

| File | Where it's used |
|---|---|
| `images/store-display.jpg` | Home page hero background, About page photo |
| `images/storefront.jpg` | Home page "Locally Owned" section, social-share preview image |
| `images/product-1.jpg` through `images/product-8.jpg` | The 8 demo New Arrivals product cards (only used when Firebase isn't configured) |
| `images/logo.svg` | Logo shown in the nav and browser tab |

## Demo mode → going live

This site currently ships in **demo mode**: it is deliberately hidden from Google
so a pre-launch demo can be shown to the client without a site carrying their
business name, address, and phone number getting indexed before they've agreed to
it. (If they decline, an indexed demo is slow and annoying to get removed.)

**To take it live once the client approves — 3 steps:**

1. Delete the `DEMO-NOINDEX` comment and the `<meta name="robots" content="noindex, nofollow" />`
   line directly below it from `index.html`, `shop.html`, `about.html`, and `contact.html`.
   (Leave the one in `admin.html` — the dashboard should stay unindexed permanently.)
2. In `robots.txt`, delete the `Disallow: /` line under `User-agent: *` and
   uncomment `Allow: /`.
3. Update the `Sitemap:` URL in `robots.txt`, and the domain in `sitemap.xml`, to
   the real domain.

Only after that should the site be submitted to Google Search Console.

## To go fully live

1. **Backend** — set up Firebase (see above) so the owner can manage products and see inquiries without touching code.
2. **Domain** — once a real domain is live, replace the placeholder `https://www.bridgetsboutiqueenumclaw.com` in every page's `<head>` (canonical/OG/Twitter/JSON-LD tags) plus `robots.txt` and `sitemap.xml` with the actual domain.

## Deploying

**Recommended: Firebase Hosting** — same project as the backend above, so there's
just one account and one dashboard for everything (site, database, photo storage,
admin login), instead of juggling a separate host.

### Manual deploy (one-time setup, ~5 minutes)

1. Install the Firebase CLI: `npm install -g firebase-tools`
2. `firebase login` (opens a browser to sign in with the Google account that owns the Firebase project)
3. In this project's folder, edit `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID` with the actual project ID (found in Firebase Console → Project settings).
4. `firebase deploy --only hosting`
5. The CLI prints the live URL (`your-project.web.app`) — that's the site, live, for free.

Run step 4 again any time you want to push an update manually.

### Auto-deploy from GitHub (recommended — no manual step ever again)

A workflow is already set up at `.github/workflows/firebase-deploy.yml` that deploys
automatically every time this branch is pushed. To turn it on:

1. In Firebase Console → Project settings → **Service accounts** → "Generate new private key" → downloads a JSON file. Keep it secret (don't commit it to the repo).
2. On GitHub, go to the repo's **Settings → Secrets and variables → Actions** → **New repository secret**:
   - `FIREBASE_SERVICE_ACCOUNT` — paste the entire contents of the JSON file from step 1.
   - `FIREBASE_PROJECT_ID` — the Firebase project ID.
3. Push any change to this branch — the "Deploy to Firebase Hosting" check runs automatically and the live site updates within a minute or two.

From then on, pushing code (including from a Claude Code session) is the only
"deploy" step needed — the admin dashboard needs no deploy at all since it reads
live from Firebase directly.

### Alternative: a different static host

If you'd rather not use Firebase Hosting, any static host still works fine for the
site itself (Netlify, Vercel, GitHub Pages, etc.) — the admin dashboard and backend
work the same way regardless of where the static files are served from, since they
talk to Firebase directly from the browser either way. The main advantage of
Firebase Hosting specifically is having one login for everything instead of two.
