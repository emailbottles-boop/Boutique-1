// Bridget's Boutique — Firebase configuration
//
// From: Firebase Console > Project Settings > General > "Your apps" > Web app.
//
// These values are safe to be public — they are identifiers, not secrets, and
// they ship in the browser on every page load by design. Access is controlled
// by the Firestore security rules plus the `admins` allowlist (see
// /firebase/firestore.rules), never by hiding this file.

export const firebaseConfig = {
  apiKey: "AIzaSyDdVqfDgXRI0HIE0s9p3mckOrLjopvIWrc",
  authDomain: "boutique-1-56fac.firebaseapp.com",
  projectId: "boutique-1-56fac",
  storageBucket: "boutique-1-56fac.firebasestorage.app",
  messagingSenderId: "866636488987",
  appId: "1:866636488987:web:00222c73ca65838c4f33be",
};

// Guard so the site degrades gracefully if this is ever blanked out: the
// showcase falls back to its built-in items and the contact form shows a
// "call us instead" message rather than failing silently.
export const FIREBASE_CONFIGURED =
  Boolean(firebaseConfig.apiKey) && !firebaseConfig.apiKey.startsWith("YOUR_");
