// Bridget's Boutique — shared Firebase initialization
// Imported by any page that needs live data (products.js, contact.js, admin.js).
//
// Note: Firebase Storage is deliberately NOT used. Product photos are
// compressed in the browser and stored in Firestore instead, which keeps the
// whole backend on the free Spark plan with no billing account attached.
// See js/image-utils.js.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { firebaseConfig, FIREBASE_CONFIGURED } from "./firebase-config.js";

export let db = null;
export let auth = null;

if (FIREBASE_CONFIGURED) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

export { FIREBASE_CONFIGURED };
