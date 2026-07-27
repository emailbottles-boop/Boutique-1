// Bridget's Boutique — starter showcase items
//
// Shared by the public site and the dashboard.
//
// The public pages fall back to this list when the database has nothing in it
// yet, so a freshly deployed site never looks broken. The dashboard uses the
// same list to seed the database on first login — otherwise the site would be
// showing items the dashboard doesn't know about, which is confusing and makes
// them impossible to edit.

export const HOME_PREVIEW_COUNT = 4;

// Only the first two have real photos in /images. The other two carry a null
// photoUrl on purpose: both the site and the dashboard render a clean "no
// photo yet" placeholder for those, rather than a broken image icon.
export const STARTER_ITEMS = [
  { name: "Floral Wrap Dress",    price: "$68", tag: "Example", photoUrl: "images/product-1.jpg" },
  { name: "Red Skinny Jeans",     price: "$54", tag: "Example", photoUrl: "images/product-5.jpg" },
  { name: "Cropped Denim Jacket", price: "$74", tag: null,      photoUrl: null },
  { name: "Suede Crossbody Bag",  price: "$58", tag: null,      photoUrl: null },
];
