// Bridget's Boutique — showcase items
//
// This is a showcase of what's in the shop right now, not a full catalog.
// A handful of current pieces, swapped out as the racks change — deliberately
// uncluttered, and quick for the owner to keep accurate.
//
// If Firebase is configured (see js/firebase-config.js), items are loaded live
// from the "products" Firestore collection and managed from admin.html.
// Until then the site falls back to the demo data below, whose photos point at
// predictable local filenames so they can also be swapped by uploading files
// into /images (see README.md).

// Firebase is imported lazily (inside loadProducts) rather than at the top of
// this file on purpose. A static import of the Firebase CDN would mean that if
// that CDN is ever unreachable — an outage, an ad blocker, a restrictive
// network — this whole module fails to load and the showcase renders empty.
// Loading it lazily lets the demo items below display no matter what.

import { STARTER_ITEMS, HOME_PREVIEW_COUNT } from "./starter-items.js";

const FALLBACK_PRODUCTS = STARTER_ITEMS.map((item, i) => ({ id: `starter-${i}`, ...item }));

async function loadProducts() {
  try {
    const { db, FIREBASE_CONFIGURED } = await import("./firebase-init.js");
    if (!FIREBASE_CONFIGURED || !db) return FALLBACK_PRODUCTS;

    const { collection, getDocs, query, orderBy } = await import(
      "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"
    );

    const q = query(collection(db, "products"), orderBy("sortOrder"));
    const snap = await getDocs(q);
    if (snap.empty) return FALLBACK_PRODUCTS;
    return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.warn("Couldn't load live items, showing the built-in list instead:", err);
    return FALLBACK_PRODUCTS;
  }
}

// Product text is typed by the owner in the dashboard and stored in Firestore,
// so it is not attacker-controlled — but it still must be escaped before being
// built into HTML. An unescaped apostrophe or ampersand in an ordinary name
// ("Mom & Me Dress") renders wrong, and a double quote in a name closes the
// alt attribute early, which turns a typo into markup injection.
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function productCardHTML(product) {
  const name = escapeHtml(product.name);
  const tag = product.tag
    ? `<span class="product-card__tag">${escapeHtml(product.tag)}</span>`
    : "";
  const photo = escapeHtml(product.photoUrl || "");

  return `
    <div class="product-card">
      <div class="product-card__image">
        <img src="${photo}" alt="${name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />
      </div>
      <div class="product-card__body">
        ${tag}
        <h3>${name}</h3>
        <div class="product-card__price">${escapeHtml(product.price)}</div>
        <a class="btn btn--outline btn--small btn--block" href="contact.html?item=${encodeURIComponent(product.name ?? "")}">Ask About This</a>
      </div>
    </div>
  `;
}

// If a photo fails to load (missing file, or a product with no photo yet),
// swap it for a clean placeholder box instead of a broken-image icon.
function attachImageFallbacks(container) {
  container.querySelectorAll(".product-card__image img").forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        const placeholder = document.createElement("div");
        placeholder.className = "placeholder-img";
        placeholder.innerHTML = `<div class="placeholder-img__inner">Product Photo<br>${escapeHtml(img.alt)}</div>`;
        img.replaceWith(placeholder);
      },
      { once: true }
    );
  });
}

async function renderProducts() {
  const products = await loadProducts();

  const featured = document.querySelector("#featured-products");
  if (featured) {
    featured.innerHTML = products.slice(0, HOME_PREVIEW_COUNT).map(productCardHTML).join("");
    attachImageFallbacks(featured);
  }

  const fullGrid = document.querySelector("#all-products");
  if (fullGrid) {
    fullGrid.innerHTML = products.map(productCardHTML).join("");
    attachImageFallbacks(fullGrid);
  }
}

renderProducts();
