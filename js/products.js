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

// How many items the homepage previews before "see everything in the shop".
const HOME_PREVIEW_COUNT = 4;

const FALLBACK_PRODUCTS = [
  { id: "p1", name: "Floral Wrap Dress",     price: "$68", tag: "Example", photoUrl: "images/product-1.jpg" },
  { id: "p2", name: "Red Skinny Jeans",      price: "$54", tag: "Example", photoUrl: "images/product-5.jpg" },
  { id: "p3", name: "Cropped Denim Jacket",  price: "$74", tag: null,      photoUrl: "images/product-2.jpg" },
  { id: "p4", name: "Suede Crossbody Bag",   price: "$58", tag: null,      photoUrl: "images/product-3.jpg" },
];

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

function productCardHTML(product) {
  const tag = product.tag ? `<span class="product-card__tag">${product.tag}</span>` : "";
  const photo = product.photoUrl || "";

  return `
    <div class="product-card">
      <div class="product-card__image">
        <img src="${photo}" alt="${product.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />
      </div>
      <div class="product-card__body">
        ${tag}
        <h3>${product.name}</h3>
        <div class="product-card__price">${product.price}</div>
        <a class="btn btn--outline btn--small btn--block" href="contact.html?item=${encodeURIComponent(product.name)}">Ask About This</a>
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
