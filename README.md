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

## To go fully live

1. **Photos** — `images/store-display-01.jpg` is a real in-store photo. Everything else is a labeled placeholder (dashed box). Drop real photos into `images/` and swap the `src` in the HTML, or update `js/products.js` (`image: null` → `image: "images/your-file.jpg"`) for each product.
2. **Order form** — `contact.html` posts to a Formspree placeholder (`https://formspree.io/f/YOUR_FORM_ID`). Create a form at https://formspree.io and replace `YOUR_FORM_ID`. Once it's a real endpoint, `js/script.js` automatically stops intercepting the submit and lets it post normally.
3. **Product inventory** — edit `js/products.js` to reflect real items, prices, and categories.
4. **Domain** — once a real domain is live, replace the placeholder `https://www.bridgetsboutiqueenumclaw.com` in every page's `<head>` (canonical/OG/Twitter/JSON-LD tags) plus `robots.txt` and `sitemap.xml` with the actual domain.

## Deploying

No build step — any static host works. Easiest options: drag-and-drop the folder into Netlify, or serve via GitHub Pages from this branch/`main`.
