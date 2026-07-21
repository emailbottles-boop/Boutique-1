# Bridget's Boutique — Website

A static website for Bridget's Boutique, a women's clothing boutique in downtown Enumclaw, WA. No build step required — plain HTML/CSS/JS.

## Structure

- `index.html` — home page
- `shop.html` — New Arrivals gallery (filterable by category)
- `about.html` — story, hours, map
- `contact.html` — contact / order inquiry form
- `css/style.css` — all styles
- `js/script.js` — nav toggle, active-link highlighting, contact form handling
- `js/products.js` — product/new-arrival data used on the home and shop pages
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

## Replacing photos (no code editing required)

Every photo on the site has a fixed, predictable filename. To swap one out:

1. On GitHub, open the `images` folder.
2. Click **Add file → Upload files**, then drag in your new photo, named **exactly** the same as the file you're replacing (e.g. `store-display.jpg`).
3. GitHub will show it replacing the existing file — commit the change, and it's live.

| File | Where it's used |
|---|---|
| `images/store-display.jpg` | Home page hero background, About page photo |
| `images/storefront.jpg` | Home page "Locally Owned" section, social-share preview image |
| `images/product-1.jpg` through `images/product-8.jpg` | The 8 New Arrivals product cards (shop page + home page featured section) |
| `images/logo.svg` | Logo shown in the nav and browser tab |

**Adding a product photo that doesn't exist yet** (e.g. `product-3.jpg`) works the same way — just upload a file with that name and it appears automatically. Until it's uploaded, that product shows a clean placeholder box instead of a broken image, so nothing ever looks broken mid-update.

To change a product's *name, price, or category* (not just its photo), that one line does need editing — open `js/products.js` on GitHub, click the pencil icon, edit the relevant line, and commit.

## To go fully live

1. **Order form** — `contact.html` posts to a Formspree placeholder (`https://formspree.io/f/YOUR_FORM_ID`). Create a form at https://formspree.io and replace `YOUR_FORM_ID`. Once it's a real endpoint, `js/script.js` automatically stops intercepting the submit and lets it post normally.
2. **Product inventory** — edit `js/products.js` to reflect real items, prices, and categories (see above).
3. **Domain** — once a real domain is live, replace the placeholder `https://www.bridgetsboutiqueenumclaw.com` in every page's `<head>` (canonical/OG/Twitter/JSON-LD tags) plus `robots.txt` and `sitemap.xml` with the actual domain.

## Deploying

No build step — any static host works. Easiest options: drag-and-drop the folder into Netlify, or serve via GitHub Pages from this branch/`main`.
