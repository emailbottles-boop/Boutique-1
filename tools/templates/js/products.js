// @@BUSINESS_NAME@@ — product/@@CATALOG_ITEM_SINGULAR_LOWER@@ data
//
// If Firebase is configured (see js/firebase-config.js), items are loaded
// live from the "products" Firestore collection — managed from admin.html.
// Until then, the site falls back to the demo data below, and every
// item's `photoUrl` points at a predictable local filename, so photos can
// still be swapped by uploading a file into /images with a matching name
// (see README.md).

import { db, FIREBASE_CONFIGURED } from "./firebase-init.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const FALLBACK_PRODUCTS = [
@@FALLBACK_PRODUCTS_JS@@
];

async function loadProducts() {
  if (!FIREBASE_CONFIGURED) return FALLBACK_PRODUCTS;

  try {
    const q = query(collection(db, "products"), orderBy("sortOrder"));
    const snap = await getDocs(q);
    if (snap.empty) return FALLBACK_PRODUCTS;
    return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  } catch (err) {
    console.error("Couldn't load live products from Firebase, showing demo data instead:", err);
    return FALLBACK_PRODUCTS;
  }
}

function productCardHTML(product) {
  const tag = product.tag ? `<span class="product-card__tag">${product.tag}</span>` : "";

  const image = product.photoUrl
    ? `<img src="${product.photoUrl}" alt="${product.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div class="placeholder-img"><div class="placeholder-img__inner">Photo Coming Soon<br>${product.name}</div></div>`;

  return `
    <div class="product-card" data-category="${product.category}">
      <div class="product-card__image">
        ${image}
      </div>
      <div class="product-card__body">
        ${tag}
        <h3>${product.name}</h3>
        <div class="product-card__price">${product.price}</div>
        <a class="btn btn--outline btn--small btn--block" href="contact.html?item=${encodeURIComponent(product.name)}">@@CTA_CONTACT_LABEL@@</a>
      </div>
    </div>
  `;
}

// If a photo fails to load (broken URL), swap it for a clean placeholder
// box instead of a broken-image icon.
function attachImageFallbacks(container) {
  container.querySelectorAll(".product-card__image img").forEach((img) => {
    img.addEventListener(
      "error",
      () => {
        const placeholder = document.createElement("div");
        placeholder.className = "placeholder-img";
        placeholder.innerHTML = `<div class="placeholder-img__inner">Photo Coming Soon<br>${img.alt}</div>`;
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
    featured.innerHTML = products.slice(0, 4).map(productCardHTML).join("");
    attachImageFallbacks(featured);
  }

  const fullGrid = document.querySelector("#all-products");
  if (fullGrid) {
    fullGrid.innerHTML = products.map(productCardHTML).join("");
    attachImageFallbacks(fullGrid);
  }
}

renderProducts();
