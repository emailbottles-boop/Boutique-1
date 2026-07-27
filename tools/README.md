# Site Generator

Turn the Bridget's Boutique template into a brand-new business site with one
command. Point it at a JSON config describing the business, and it writes a
complete, ready-to-deploy static site (HTML/CSS/JS + Firebase config) into an
output directory.

No dependencies beyond Python 3's standard library — no `npm install`, no
build step.

```
python3 tools/generate_site.py --config tools/business.example.json --out ../petes-auto-shop
```

## Quick start

1. Copy `business.example.json` to a new file, e.g. `petes-auto-shop.json`.
2. Edit every field for the new business (see the field reference below —
   only a handful of fields are actually required; everything else has a
   sensible default).
3. Run the generator:

   ```
   python3 tools/generate_site.py --config petes-auto-shop.json --out ../petes-auto-shop
   ```

4. `cd ../petes-auto-shop && python3 -m http.server 8000` and open
   `http://localhost:8000` to preview it.
5. Follow the "next steps" the generator prints (Firebase setup, swapping
   placeholder images for real photos, deploying).

Pass `--force` to overwrite an existing output directory (e.g. when
regenerating after editing the config).

## What gets generated

Everything in the original template, with all business-specific content
replaced: `index.html`, `shop.html` (skipped entirely if no catalog is
configured), `about.html`, `contact.html`, `admin.html`, `404.html`,
`css/`, `js/`, `firebase/firestore.rules`, `firebase/storage.rules`,
`firebase.json`, `.firebaserc`, `.github/workflows/firebase-deploy.yml`,
`robots.txt`, `sitemap.xml`, a fresh `README.md` for the new site, and a
handful of generated placeholder images (`images/logo.svg`,
`images/hero-display.svg`, `images/storefront.svg`) built from the
business's name and brand colors so the site never ships with a broken
image or someone else's photo.

## Self-check

After generating, the tool scans its own output and warns (exit code 2) if
it finds any of:

- an un-filled `@@TOKEN@@` template marker (would mean a bug in a template)
- leftover text from the original Bridget's Boutique template — the
  business name, "Enumclaw", the old phone number, the old domain — unless
  the *new* config genuinely reuses that exact text itself (e.g. a second
  Enumclaw business legitimately mentioning "Enumclaw" won't trigger a
  false alarm, because that string is present in its own config)
- the generated `firebase/firestore.rules` / `firebase/storage.rules` /
  `js/admin.js` disagreeing about the admin-allowlist security model (see
  "Keeping the generator in sync with the source site" below) — this is a
  safety net specifically for this repo, where the live source site and
  this generator's templates can drift apart if one is edited without the
  other.

A clean run prints `Self-check passed` and exits 0. Anything else is worth
reading before handing the site to a client.

## Field reference

See `tools/business.example.json` for a fully-annotated, working example
(it reproduces the original Bridget's Boutique site) — this section is a
quick reference alongside it. The config file is JSON with comments
allowed: full-line `//` comments, trailing `// ...` comments after a value,
and `/* ... */` blocks are all stripped before parsing. URLs like
`"https://example.com"` inside string values are never touched by the
comment stripper.

### Required

| Field | Example | Notes |
|---|---|---|
| `business_name` | `"Pete's Auto Shop"` | Used everywhere: nav, footer, page titles, JSON-LD. |
| `tagline` | `"Honest repairs, done right."` | One line, used in the home hero and `<title>`. |
| `description` | `"Pete's Auto Shop is a full-service..."` | 1-2 sentences, used for SEO meta descriptions. |
| `phone` | `"(360) 555-0100"` | Displayed as-is; also used to build the `tel:` link. |
| `email` | `"service@petesauto.example"` | Not currently shown publicly, but validated/reserved for future use. |
| `domain` | `"https://www.petesautoshop.example"` | Canonical URL, no trailing slash. Used in canonical/OG tags, `robots.txt`, `sitemap.xml`. |
| `schema_type` | `"AutoRepair"` | A [schema.org](https://schema.org/docs/full.html) business type — powers Google's local-business rich results. Common ones: `ClothingStore`, `AutoRepair`, `Florist`, `Restaurant`, `HairSalon`, `BeautySalon`, `Bakery`, `Store`. |
| `address.street`, `address.city`, `address.state`, `address.zip` | | Used for the map link/embed, JSON-LD, and footer. `address.state_full` and `address.country` are optional. |

### Everything else is optional

The generator fills in generic, sensible defaults for anything you skip —
this is deliberate, so a first draft of a new business's site can be
generated from just the required fields above (see the "Ridgeline Auto
Repair" example under Testing below, which used only the required fields
plus partial hours). Notable optional sections:

- **`hours`** — object keyed by lowercase day name (`monday`..`sunday`),
  each `{ "open": "HH:MM", "close": "HH:MM" }`. Omit a day entirely to show
  it as closed. Consecutive days with identical hours are automatically
  grouped in the displayed table (`Mon – Thu 10am – 5pm`) and in the
  JSON-LD `openingHoursSpecification`.
- **`socials`** — `instagram`, `facebook`, `instagram_post_url` (embeds a
  specific post on the home page), and `others` (a list of
  `{ "label", "url" }` for anything else — Yelp, TikTok, Google Business
  Profile, etc). Every social UI block (nav icons, footer icons, the
  "Follow Along" section, the contact page's "Message Us" card) is omitted
  automatically if no socials are configured at all.
- **`colors`** — hex values for `cream`, `cream_dark`, `accent`,
  `accent_dark`, `charcoal`, `charcoal_soft`, `gold`. Omit the whole object
  to use the original warm cream/blush/charcoal palette.
- **`fonts`** — `heading` and `body`, must be real Google Fonts family
  names (they're fetched from `fonts.googleapis.com`). Defaults to
  Playfair Display / Jost.
- **`labels.contact_cta`** — the wording on the primary "get in touch"
  button across the site (defaults to "Inquire to Order" if there's a
  catalog, "Get In Touch" otherwise).
- **`catalog`** — see below. Omit entirely for a business with no
  product/service listing.
- **`home`**, **`about`**, **`why_cards`** — page copy overrides. Every
  field has a generic default built from `business_name` / city / catalog
  vocabulary, so a business can ship with zero copywriting and still read
  coherently; add these to make the copy feel bespoke.
- **`catalog_description`**, **`catalog_intro`**, **`contact_description`**
  — meta-description / intro-copy overrides for those pages.
- **`deploy_branch`** — the branch the GitHub Actions workflow deploys
  from (default `"main"`).
- **`firebase_project_id`** — pre-fills `.firebaserc` if you already know
  the Firebase project ID; otherwise leave it out and fill in `.firebaserc`
  by hand after creating the project.

### The `catalog` object

Controls the product/service listing (`shop.html`, the admin dashboard's
item manager, the home page's "featured" preview). **Omit `catalog`
entirely, or set `"enabled": false`, for a business that doesn't sell
discrete items** (e.g. a service business that only wants a contact form) —
`shop.html` won't be generated at all, and every nav/footer link to it is
removed automatically.

| Field | Purpose |
|---|---|
| `nav_label` | What the catalog is called in nav/page titles — `"New Arrivals"`, `"Inventory"`, `"Bouquets"`, `"Menu"`. |
| `item_singular` / `item_plural` | Vocabulary used in admin labels and copy — `"item"/"items"`, `"vehicle"/"vehicles"`, `"bouquet"/"bouquets"`. |
| `categories` | List of `{ "key", "label" }`. `key` must be lowercase with no spaces. If omitted, categories are auto-derived from whichever `category` values the seed items below use. |
| `items` | Seed/demo items: `{ "name", "price", "category", "tag" }` (`tag` is optional, e.g. `"New"`). These show up until the owner adds real ones from `admin.html` — or forever, if Firebase is never connected. |

### Colors, at a glance

```
cream         — main page background
cream_dark    — secondary background (page-hero strips, card backgrounds)
accent        — warm highlight (hover states, badges, "closed" status pill)
accent_dark   — darker accent (button hover)
charcoal      — primary text / dark sections (header, footer, hero overlay)
charcoal_soft — secondary/muted text
gold          — fine-line accent (underlines, focus rings, tab highlight)
```

## Keeping the generator in sync with the source site

`tools/templates/` holds tokenized copies of the real site files
(`index.html`, `js/admin.js`, `firebase/firestore.rules`, etc). If someone
edits the *live* site directly (e.g. `admin.html`, `js/admin.js`, or the
Firebase security rules) without also updating the matching file under
`tools/templates/`, every site generated afterward will carry the old,
stale behavior — this already happened once during development, when the
live site's admin dashboard was upgraded with an `admins`-collection
allowlist (so a random signup can't edit the site) while the templates
still reflected the older, less secure version.

If you change one of these files at the repo root, re-sync its template:

- `index.html`, `shop.html`, `about.html`, `contact.html`, `admin.html`,
  `404.html` → matching file under `tools/templates/`
- `css/style.css`, `css/admin.css` → `tools/templates/css/`
- `js/*.js` → `tools/templates/js/`
- `firebase/firestore.rules`, `firebase/storage.rules`, `firebase.json` →
  `tools/templates/firebase/`
- `.github/workflows/firebase-deploy.yml` → same path under `tools/templates/`

When re-syncing a file that has business-specific text, re-apply the
`@@TOKEN@@` placeholders it had before (business name, colors, catalog
vocabulary, category lists, etc. — search the previous version of the
template for `@@` to see exactly what was tokenized). The generator's
self-check (see above) will catch the specific case of `js/admin.js` and
the Firebase rules disagreeing about the `admins` allowlist model, but it
cannot catch every possible drift — treat template sync as part of the
review for any PR that touches the live site's HTML/CSS/JS/rules.

## Worked example: spinning up a florist site end-to-end

This is exactly what `tools/business.florist.example.json` contains, if you
want to see the finished config rather than build it from scratch.

1. **Copy the example and rename it:**

   ```
   cp tools/business.example.json tools/maple-and-stem.json
   ```

2. **Fill in the basics** — name, tagline, description, phone, email,
   domain, and set `schema_type` to `"Florist"`:

   ```jsonc
   "business_name": "Maple & Stem Floral",
   "tagline": "Fresh-cut arrangements, made daily.",
   "description": "Maple & Stem Floral is a full-service flower shop in downtown Enumclaw, WA, offering fresh bouquets, event florals, and same-day local delivery.",
   "phone": "(360) 555-0148",
   "email": "hello@mapleandstemfloral.com",
   "domain": "https://www.mapleandstemfloral.com",
   "schema_type": "Florist",
   ```

3. **Set the address and hours** — this shop is closed Sundays and Mondays,
   so those two days are simply left out of `hours`:

   ```jsonc
   "address": { "street": "220 Railroad St", "city": "Enumclaw", "state": "WA", "zip": "98022" },
   "hours": {
     "tuesday":   { "open": "09:00", "close": "17:30" },
     "wednesday": { "open": "09:00", "close": "17:30" },
     "thursday":  { "open": "09:00", "close": "17:30" },
     "friday":    { "open": "09:00", "close": "18:00" },
     "saturday":  { "open": "10:00", "close": "16:00" }
   }
   ```

4. **Rename the catalog vocabulary and categories** — flowers aren't
   "New Arrivals" with "Dresses & Tops" categories:

   ```jsonc
   "catalog": {
     "nav_label": "Bouquets",
     "item_singular": "bouquet",
     "item_plural": "bouquets",
     "categories": [
       { "key": "everyday", "label": "Everyday" },
       { "key": "seasonal", "label": "Seasonal" },
       { "key": "weddings", "label": "Weddings & Events" },
       { "key": "sympathy", "label": "Sympathy" }
     ],
     "items": [
       { "name": "Sunlit Garden Bouquet", "category": "everyday", "price": "$45", "tag": "Popular" }
     ]
   }
   ```

5. **Pick brand colors** — a green/gold palette instead of the boutique's
   cream/blush:

   ```jsonc
   "colors": {
     "cream": "#f8f5ee", "cream_dark": "#eee7d8",
     "accent": "#8fa877", "accent_dark": "#6f8a5c",
     "charcoal": "#31352c", "charcoal_soft": "#535a49",
     "gold": "#c98a3e"
   }
   ```

6. **Generate it:**

   ```
   python3 tools/generate_site.py --config tools/maple-and-stem.json --out ../maple-and-stem-floral
   ```

7. **Preview it:**

   ```
   cd ../maple-and-stem-floral && python3 -m http.server 8000
   ```

   Open `http://localhost:8000` — the nav says "Bouquets" instead of "New
   Arrivals", the shop page's filter pills read "Everyday / Seasonal /
   Weddings & Events / Sympathy", the About page's hours table shows
   "Closed" for Sunday and Monday, and every color on the page is the new
   green/gold palette. Nothing says "Bridget" or "Enumclaw" (this example
   happens to legitimately be in Enumclaw too, so that word does
   appear — but only where the new config put it, e.g. the address and
   copy, never in an unedited template string).

8. **Set up Firebase and deploy** — follow the generated
   `../maple-and-stem-floral/README.md`, which has the same instructions
   as the original template's README, customized for this business.

## Testing performed on this generator

- Ran it against `business.example.json` (recreates the original
  boutique) and `business.florist.example.json` (a different business
  type, different catalog vocabulary, partial week hours, no Instagram
  post embed, a second business also legitimately located in Enumclaw —
  to make sure the leftover-template-text check doesn't false-positive on
  a shared city name).
- Ran it against a minimal config with only the required fields plus a
  partial `hours` object and no `catalog` key at all, to exercise every
  "optional field omitted" default path and confirm `shop.html` is
  correctly skipped along with every nav/footer link to it.
- Verified friendly error messages for: a missing required field, invalid
  JSON, a missing config file, and re-running without `--force` into an
  existing output directory.
- Served each generated site with `python3 -m http.server` and `curl`ed
  every page and static asset (HTML, CSS, JS, SVG, `robots.txt`,
  `sitemap.xml`) to confirm all internal links and asset paths resolve
  with HTTP 200.
- Parsed every generated HTML file with Python's `html.parser` to catch
  malformed markup, and checked every generated `.js` file with
  `node --check` for syntax errors.
- Validated every generated JSON-LD block and `.firebaserc` with
  `json.loads`.
- Confirmed the self-check's security-sync warning actually fires by
  intentionally corrupting a generated `firestore.rules` copy and
  re-running the check against it.

## Known limitations / rough edges

- **Placeholder images are illustrative, not photographic.** `images/*.svg`
  are generated solid/gradient graphics with the business name overlaid —
  fine for a first preview, but every real client site needs its actual
  photos swapped in before launch (the generated `README.md` explains
  where each one is used).
- **`og:image` points at an `.svg`.** Most social platforms render SVG
  Open Graph images fine today, but a few older crawlers don't support
  SVG `og:image` — swap in a real `.jpg`/`.png` and update that one meta
  tag (and the JSON-LD `image` field) before relying on link-preview cards
  for a real launch.
- **`js/products.js` and `admin.html`'s item-manager are always generated**
  even when `catalog` is disabled — they're simply unused (nothing links
  to `shop.html`, and the admin dashboard's Products tab remains, since
  the "Inquiries" and "Account" functionality still applies to every
  business). This is intentional but means a no-catalog site's admin
  dashboard still has a Products tab that isn't wired to anything.
- **Only two social platforms get real icons** (Instagram, Facebook) — an
  entry under `socials.others` renders as a plain text button, not a
  matching brand icon, since the template only ships those two SVG icon
  paths.
- **No automated visual regression testing.** Everything above is
  structural/functional verification (links resolve, HTML parses, JS is
  valid, JSON-LD is valid); nobody has visually inspected every generated
  page in a real browser across breakpoints.
