// Bridget's Boutique — page photos (hero, storefront)
//
// The big photos that aren't product items live in a single Firestore
// document, `site/images`, so the owner can swap them from the dashboard
// instead of uploading files to GitHub.
//
// Every page still ships with the original photo hardcoded in its <img src>.
// This module only *overrides* that once a replacement has been saved, which
// means the site looks right even before Firebase loads (or if it never does).

// Which slot maps to which element on the public pages.
export const SITE_IMAGE_SLOTS = {
  hero: {
    label: "Big photo at the top",
    where: "Behind the headline on the home page",
    selector: '[data-site-image="hero"]',
  },
  storefront: {
    label: "Photo beside your story",
    where: 'The "A downtown Enumclaw favorite" section, and the About page',
    selector: '[data-site-image="storefront"]',
  },
};

export async function loadSiteImages() {
  try {
    const { db, FIREBASE_CONFIGURED } = await import("./firebase-init.js");
    if (!FIREBASE_CONFIGURED || !db) return null;

    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"
    );
    const snap = await getDoc(doc(db, "site", "images"));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    // Falls through to whatever is already in the HTML.
    console.warn("Couldn't load page photos, using the built-in ones:", err);
    return null;
  }
}

// Swap in any saved replacements. Safe to call on every page.
export async function applySiteImages() {
  const images = await loadSiteImages();
  if (!images) return;

  Object.entries(SITE_IMAGE_SLOTS).forEach(([key, slot]) => {
    const url = images[key];
    if (!url) return;
    document.querySelectorAll(slot.selector).forEach((el) => {
      el.src = url;
    });
  });
}
