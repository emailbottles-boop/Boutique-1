// @@BUSINESS_NAME@@ — shared Firebase initialization
// Imported by any page that needs live data (products.js, contact.js, admin.js).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";
import { firebaseConfig, FIREBASE_CONFIGURED } from "./firebase-config.js";

export let db = null;
export let auth = null;
export let storage = null;

if (FIREBASE_CONFIGURED) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
}

export { FIREBASE_CONFIGURED };
