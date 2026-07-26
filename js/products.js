// Bridget's Boutique — product/new-arrival data
//
// If Firebase is configured (see js/firebase-config.js), products are loaded
// live from the "products" Firestore collection — managed from admin.html.
// Until then, the site falls back to the demo data below, and every
// product's `photoUrl` points at a predictable local filename, so photos can
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
  { id: "p1", name: "Floral Wrap Dress",     category: "dresses",     price: "$68", tag: "Example", photoUrl: "images/product-1.jpg" },
  { id: "p2", name: "Cropped Denim Jacket",  category: "outerwear",   price: "$74", tag: "New",      photoUrl: "images/product-2.jpg" },
  { id: "p3", name: "Ribbed Knit Top",       category: "tops",        price: "$38", tag: "New",      photoUrl: "images/product-3.jpg" },
  { id: "p4", name: "Gold Layered Necklace", category: "accessories", price: "$26", tag: "New",      photoUrl: "images/product-4.jpg" },
  { id: "p5", name: "Red Skinny Jeans",      category: "dresses",     price: "$54", tag: "Example",  photoUrl: "images/product-5.jpg" },
  { id: "p6", name: "Suede Crossbody Bag",   category: "accessories", price: "$58", tag: null,       photoUrl: "images/product-6.jpg" },
  { id: "p7", name: "Off-Shoulder Blouse",   category: "tops",        price: "$42", tag: null,       photoUrl: "images/product-7.jpg" },
  { id: "p8", name: "Sherpa-Lined Vest",     category: "outerwear",   price: "$66", tag: null,       photoUrl: "images/product-8.jpg" },
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
  const photo = product.photoUrl || "";

  return `
    <div class="product-card" data-category="${product.category}">
      <div class="product-card__image">
        <img src="${photo}" alt="${product.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />
      </div>
      <div class="product-card__body">
        ${tag}
        <h3>${product.name}</h3>
        <div class="product-card__price">${product.price}</div>
        <a class="btn btn--outline btn--small btn--block" href="contact.html?item=${encodeURIComponent(product.name)}">Inquire to Order</a>
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
        placeholder.innerHTML = `<div class="placeholder-img__inner">Product Photo<br>${img.alt}</div>`;
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
