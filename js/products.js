// Bridget's Boutique — product/new-arrival data
//
// HOW TO ADD OR REPLACE A PRODUCT PHOTO (no code editing needed):
//   Each product below has a `photo` filename. Upload an image with that
//   exact name into the /images folder (GitHub: open /images, click
//   "Add file" > "Upload files", drop in a file named e.g. "product-2.jpg").
//   If a matching file doesn't exist yet, the site automatically shows a
//   placeholder box instead — nothing breaks. As soon as the real file is
//   uploaded with the right name, it appears on the site automatically.
//
// To change a product's name, price, or category, edit the fields below.
// categories used for shop.html filters: "dresses", "tops", "outerwear", "accessories"

const PRODUCTS = [
  { id: "p1", name: "Floral Wrap Dress",     category: "dresses",     price: "$68", tag: "Example", photo: "product-1.jpg" },
  { id: "p2", name: "Cropped Denim Jacket",  category: "outerwear",   price: "$74", tag: "New",      photo: "product-2.jpg" },
  { id: "p3", name: "Ribbed Knit Top",       category: "tops",        price: "$38", tag: "New",      photo: "product-3.jpg" },
  { id: "p4", name: "Gold Layered Necklace", category: "accessories", price: "$26", tag: "New",      photo: "product-4.jpg" },
  { id: "p5", name: "Red Skinny Jeans",      category: "dresses",     price: "$54", tag: "Example",  photo: "product-5.jpg" },
  { id: "p6", name: "Suede Crossbody Bag",   category: "accessories", price: "$58", tag: null,       photo: "product-6.jpg" },
  { id: "p7", name: "Off-Shoulder Blouse",   category: "tops",        price: "$42", tag: null,       photo: "product-7.jpg" },
  { id: "p8", name: "Sherpa-Lined Vest",     category: "outerwear",   price: "$66", tag: null,       photo: "product-8.jpg" },
];

function productCardHTML(product) {
  const tag = product.tag ? `<span class="product-card__tag">${product.tag}</span>` : "";

  return `
    <div class="product-card" data-category="${product.category}">
      <div class="product-card__image">
        <img src="images/${product.photo}" alt="${product.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" />
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

// If a product photo hasn't been uploaded yet, swap the broken image for a
// clean placeholder box instead of showing a broken-image icon.
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

document.addEventListener("DOMContentLoaded", () => {
  const featured = document.querySelector("#featured-products");
  if (featured) {
    featured.innerHTML = PRODUCTS.slice(0, 4).map(productCardHTML).join("");
    attachImageFallbacks(featured);
  }

  const fullGrid = document.querySelector("#all-products");
  if (fullGrid) {
    fullGrid.innerHTML = PRODUCTS.map(productCardHTML).join("");
    attachImageFallbacks(fullGrid);
  }
});
