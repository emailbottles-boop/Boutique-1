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
- `firebase/firestore.rules` — security rules to paste into the Firebase console
- `.nojekyll` — stops GitHub Pages processing the site through Jekyll
- `firebase/storage.rules` — optional/unused; only needed if you ever enable Firebase Storage
- `js/image-utils.js` — compresses photos in the browser so they fit in Firestore
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

**Architecture:** the site itself is hosted on GitHub Pages; Firebase supplies only
the database and the login. The two are independent — the dashboard reaches Firebase
straight from the visitor's browser, so it works regardless of who serves the HTML.

**Setup steps (one-time, ~15 minutes):**

1. Go to https://console.firebase.google.com and create a new project (free Spark plan).
2. **Firestore Database** → Create database → start in production mode.
3. *(Skip — Firebase Storage is intentionally not used. Product photos are
   compressed in the browser and saved into Firestore instead, so the whole
   project stays on the free Spark plan with no credit card attached. See
   "Where photos are stored" below.)*
4. **Authentication** → Sign-in method → enable **Email/Password**. Then go to the
   **Users** tab → Add user → enter the owner's email address and a **temporary
   password** (Firebase requires at least 6 characters — e.g. `Boutique2026!`).
   Note the email address — step 7 is what grants it access.
5. *(Optional — only for granting access to someone **without** editing the rules;
   see "Adding another admin later". The owner does not need this.)*
6. **Project settings** (gear icon) → General → "Your apps" → click the `</>` (Web)
   icon → register an app (nickname doesn't matter; leave "Also set up Firebase
   Hosting" UNCHECKED — the site is hosted on GitHub Pages, so Firebase Hosting
   would just be an unused extra) → copy the `firebaseConfig` object it gives you into
   `js/firebase-config.js`, replacing the placeholder values.
7. **Firestore Database** → **Rules** tab → paste in the contents of
   `firebase/firestore.rules`, **replacing the placeholder `owner@example.com`
   with the owner's real email address from step 4** → Publish.
   **This step is what actually grants access** — see the security note below.

   Leave the real address out of the copy committed to this repo if it is public.
   The rules stored in Firebase are what enforce access, and they are only
   editable from the Console.
8. *(Skip — no Storage bucket to configure. `firebase/storage.rules` is kept only
   in case you enable Storage later; see the file's header.)*
9. Add your GitHub Pages domain to **Authentication → Settings → Authorized
   domains** (see "Deploying" below) — the login will not work without this.
10. Visit `yoursite.com/admin.html` and log in with the email + temporary password
    from step 4. The dashboard shows a banner prompting the owner to set their own
    password under the **Account** tab — after that, only they know it.

Once products are added in the dashboard, they replace the demo listings on the
public site automatically.

### Security: why step 7 matters

Firebase's Email/Password sign-in lets **anyone** create an account against the
project — the API key in `firebase-config.js` is public by design and can't be
hidden. So "is this user logged in?" is not a safe permission check on its own.

The security rules therefore require the account to be on an allowlist. There are
two ways to be on it, and either is enough:

- **Its email is named in the rules** (`isAdminEmail`, step 7). This is the route
  for the owner.
- **Its UID has a document in the `admins` collection** (step 5). Kept because it
  grants access without republishing rules.

Neither can be granted from the website: the email list lives inside the rules,
which are only editable from the Console, and the rules forbid writing `admins`
documents at all. A stranger who signs themselves up lands on a "No Access" screen
and can't read inquiries or change anything.

**If you skip step 7, nobody — including the owner — can edit the site.** If you
were to loosen the rules to `request.auth != null` instead, anyone on the internet
could sign up and take over the site. Don't.

**Why email rather than UID.** A UID is 28 random characters, it is regenerated
every time an account is deleted and recreated, and the Console truncates it in the
user list. Keeping a document ID matched to one by hand is a reliable way to lock
the owner out, with nothing visibly wrong in the Console to explain it. An email is
readable, survives account recreation, and a mistake in one is obvious.

**The browser is never trusted with the answer.** `js/admin.js` does not carry a
copy of the allowlist — it asks Firestore whether it may read `adminProfile/{uid}`,
a path the rules permit only for an admin reading their own document, and treats
the refusal as the answer. Anything shipped to the browser is public, so a list
there would leak which accounts are worth attacking while protecting nothing.

Other protections already in place:
- Product photos are validated as real images and size-capped well below
  Firestore's 1 MB per-document limit.
- Contact form submissions are shape- and length-checked, so the form can't be
  used to dump arbitrary data into the database.
- `admin.html` is excluded from search engines (`robots.txt` + a `noindex` tag).
- The owner can self-recover with "Forgot your password?" on the login screen —
  Firebase emails them a reset link, so you never need to hold their password.

### Where photos are stored (and why there's no Firebase Storage)

Enabling Firebase Storage on newer projects requires upgrading to the Blaze
pay-as-you-go plan and putting a credit card on file. It would still cost $0 at a
single boutique's scale, but it's an unnecessary hurdle — so this project skips
Storage entirely.

Instead, when a photo is chosen in the dashboard, `js/image-utils.js` resizes it to
a maximum 1000px edge and compresses it to JPEG **in the browser**, then saves it
straight into the product's Firestore document as a data URL. A 9.6 MB camera photo
comes out around 70 KB; a typical product shot lands at 100-250 KB — comfortably
inside Firestore's 1 MB per-document limit, and inside the free tier's 1 GiB total.

**What this means in practice:**
- No billing account, no credit card, genuinely free.
- Photo uploads work normally in the dashboard — the owner sees no difference.
- Photos are served from the database rather than a CDN. Fine for a catalog of a
  few dozen items; if the shop ever grows into the hundreds, switching to Storage
  would be the upgrade (the rules for it are already written in
  `firebase/storage.rules`).

### How the admin password is protected

Passwords are handled entirely by Firebase Authentication — they are never stored
in this repo, in the database, or anywhere in the site's code.

- Google hashes them with **scrypt** (a memory-hard algorithm, deliberately slow
  and expensive to brute-force). Plaintext passwords are never stored.
- **Nobody can look the password up — not even you as project owner.** The Firebase
  Console shows a user's email and UID, never their password. The only available
  action is to trigger a reset.
- Logins travel over HTTPS, and Firebase rate-limits repeated failed attempts.
- The `firebaseConfig` values in `js/firebase-config.js` are *not* credentials —
  they identify which project to talk to. Access is controlled by the security
  rules and the `admins` allowlist.

**Where the real risk actually is** — not the hashing, but the handoff:

1. **The temporary password is sent in plain text** over email or SMS when you hand
   it to the owner. That message is the weakest link. This is exactly why the
   dashboard nags them to change it on first login — once they do, the password in
   that email is dead, and nobody (including you) knows the real one.
2. **A weak password** is still guessable no matter how well it's hashed. Encourage
   something that isn't the business name plus a year.
3. **A committed service account key** would bypass all of the above. See
   `.gitignore` — those filenames are blocked from being committed. If one ever
   does get committed, revoke it in Project settings → Service accounts
   immediately; removing it in a later commit does *not* remove it from git history.

### Adding another admin later

Create their user in Authentication (step 4), then grant access either way:

- **Add their email to the rules** — Firestore → Rules → add the address to the
  list in `isAdminEmail` → Publish. Readable, and obvious later who has access.
- **Add their UID to `admins`** — Firestore → `admins` → Add document → Document ID
  = their **User UID**, copied and pasted, never retyped → add any field (e.g.
  `note` = `manager`) → Save. No rules republish needed.

To remove someone, delete their line from the rules or their `admins` document —
and disable or delete their account in Authentication.

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

## Deploying (GitHub Pages)

The site is hosted on **GitHub Pages**. Firebase is used only for the backend —
the database (product items, order inquiries) and the admin login. Hosting and
backend are independent: the dashboard talks to Firebase directly from the
visitor's browser, so it works no matter who serves the HTML.

### Turning Pages on

1. Repo **Settings → Pages**.
2. Source: **Deploy from a branch**.
3. Branch: **`bridgets-boutique-website-86pp8x`**, folder: **`/ (root)`**. Save.
4. Wait a minute, then the site is live at
   `https://<your-github-username>.github.io/Boutique-1/`.

Every push to that branch redeploys automatically — there is no build step.

`.nojekyll` in the repo root stops Pages from running the files through Jekyll,
which can otherwise mangle or skip files unexpectedly.

### ⚠️ Required: authorize the domain in Firebase

**The admin login will fail until you do this.** Firebase Authentication only
accepts sign-ins from domains on its allowlist. Your GitHub Pages domain is not
on it by default, so logging in would fail with `auth/unauthorized-domain`.

Firebase Console → **Authentication → Settings → Authorized domains → Add domain**:

- `<your-github-username>.github.io`
- and later, your real custom domain once you connect one

`localhost` is already allowed, so local testing works without this step — which
is exactly why it's easy to miss until the deployed site breaks.

### Connecting a custom domain

1. Buy the domain at any registrar.
2. Repo **Settings → Pages → Custom domain** → enter it → Save. GitHub writes a
   `CNAME` file to the repo.
3. At your registrar, add the DNS records GitHub shows you.
4. Tick **Enforce HTTPS** once the certificate is issued (usually under an hour).
5. **Add the new domain to Firebase's Authorized domains too** (see above), or
   the admin login will break on the custom domain even though it worked on
   `github.io`.
6. Update the placeholder `https://www.bridgetsboutiqueenumclaw.com` in each
   page's `<head>` (canonical/OG/Twitter/JSON-LD), plus `robots.txt` and
   `sitemap.xml`, to the real domain.

### Optional: Firebase Hosting instead

`firebase.json`, `.firebaserc`, and `.github/workflows/firebase-deploy.yml` are
included in case you ever want to serve the site from Firebase Hosting instead of
Pages. The workflow is set to manual-trigger only, so it will not run (or fail)
on pushes. Nothing needs to be done with these files while using Pages.
