// @@BUSINESS_NAME@@ — Firebase configuration
//
// Fill these in from: Firebase Console > Project Settings > General >
// "Your apps" > Web app > SDK setup and configuration.
//
// This is safe to be public — Firebase config values are not secrets.
// Actual security is enforced by Firestore Rules and Storage Rules
// (see /firebase/firestore.rules and /firebase/storage.rules), not by
// hiding this file.

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Until the values above are filled in, the site falls back to demo data
// and a "not connected yet" message on the contact form — nothing breaks.
export const FIREBASE_CONFIGURED = firebaseConfig.apiKey !== "YOUR_API_KEY";
