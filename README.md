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
   **Users** tab → Add user → enter the owner's email and a password. That's their
   admin login for `/admin.html`.
5. **Project settings** (gear icon) → General → "Your apps" → click the `</>` (Web)
   icon → register an app (nickname doesn't matter, no hosting needed) → copy the
   `firebaseConfig` object it gives you into `js/firebase-config.js`, replacing the
   placeholder values.
6. **Firestore Database** → **Rules** tab → paste in the contents of
   `firebase/firestore.rules` → Publish.
7. **Storage** → **Rules** tab → paste in the contents of `firebase/storage.rules` → Publish.
8. Redeploy the site (push to GitHub — Netlify/Vercel/Pages will pick it up automatically).
9. Visit `yoursite.com/admin.html` and log in with the email/password from step 4.

Once products are added in the dashboard, they replace the demo listings on the
public site automatically. `admin.html` is excluded from search engines
(`robots.txt` + a `noindex` tag) since it's not meant to be publicly discoverable —
it's still only reachable by whoever has the login, but there's no reason for it
to show up in search results either.

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

## To go fully live

1. **Backend** — set up Firebase (see above) so the owner can manage products and see inquiries without touching code.
2. **Domain** — once a real domain is live, replace the placeholder `https://www.bridgetsboutiqueenumclaw.com` in every page's `<head>` (canonical/OG/Twitter/JSON-LD tags) plus `robots.txt` and `sitemap.xml` with the actual domain.

## Deploying

No build step — any static host works. Easiest options: drag-and-drop the folder into Netlify, or serve via GitHub Pages from this branch/`main`.
