// Bridget's Boutique — product/new-arrival data
//
// This is placeholder content standing in for real inventory. To go live:
// 1. Drop real photos into /images (e.g. images/product-dress-01.jpg)
// 2. Update the `image` field below to point at them
// 3. Update name/price/category to match actual stock
//
// categories used for shop.html filters: "dresses", "tops", "outerwear", "accessories"

const PRODUCTS = [
  {
    id: "p1",
    name: "Floral Wrap Dress",
    category: "dresses",
    price: "$68",
    tag: "New",
    image: null,
  },
  {
    id: "p2",
    name: "Cropped Denim Jacket",
    category: "outerwear",
    price: "$74",
    tag: "New",
    image: null,
  },
  {
    id: "p3",
    name: "Ribbed Knit Top",
    category: "tops",
    price: "$38",
    tag: "New",
    image: null,
  },
  {
    id: "p4",
    name: "Gold Layered Necklace",
    category: "accessories",
    price: "$26",
    tag: "New",
    image: null,
  },
  {
    id: "p5",
    name: "High-Waist Trousers",
    category: "dresses",
    price: "$54",
    tag: null,
    image: null,
  },
  {
    id: "p6",
    name: "Suede Crossbody Bag",
    category: "accessories",
    price: "$58",
    tag: null,
    image: null,
  },
  {
    id: "p7",
    name: "Off-Shoulder Blouse",
    category: "tops",
    price: "$42",
    tag: null,
    image: null,
  },
  {
    id: "p8",
    name: "Sherpa-Lined Vest",
    category: "outerwear",
    price: "$66",
    tag: null,
    image: null,
  },
];

function productCardHTML(product) {
  const imageInner = product.image
    ? `<img src="${product.image}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<div class="placeholder-img"><div class="placeholder-img__inner">Product Photo<br />${product.name}</div></div>`;

  const tag = product.tag ? `<span class="product-card__tag">${product.tag}</span>` : "";

  return `
    <div class="product-card" data-category="${product.category}">
      <div class="product-card__image">${imageInner}</div>
      <div class="product-card__body">
        ${tag}
        <h3>${product.name}</h3>
        <div class="product-card__price">${product.price}</div>
        <a class="btn btn--outline btn--small btn--block" href="contact.html?item=${encodeURIComponent(product.name)}">Inquire to Order</a>
      </div>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const featured = document.querySelector("#featured-products");
  if (featured) {
    featured.innerHTML = PRODUCTS.slice(0, 4).map(productCardHTML).join("");
  }

  const fullGrid = document.querySelector("#all-products");
  if (fullGrid) {
    fullGrid.innerHTML = PRODUCTS.map(productCardHTML).join("");
  }
});
