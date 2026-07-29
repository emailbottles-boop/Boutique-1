// Bridget's Boutique — who is allowed to manage the site
//
// Admin access was originally keyed only off a document in the `admins`
// collection whose ID had to equal the account's Firebase Auth UID. That UID
// is a 28-character random string, it is regenerated every time an account is
// deleted and recreated, and the Firebase Console truncates it in the user
// list — so keeping the two in sync meant transcribing a string that is
// hostile to transcription. A single wrong character, or a trailing space
// copied along with it, locks the owner out with no visible difference in the
// console.
//
// Email addresses have none of those problems: they are readable, they are
// stable across account recreation, and a mistake in one is obvious.
//
// SECURITY: this list must be mirrored in firebase/firestore.rules, which is
// what actually enforces access. This file only decides which screen the
// dashboard shows; a stranger who edits it in their own browser still cannot
// read or write anything, because the rules reject them server-side.
//
// The `admins` collection still works and is still checked, so any UID
// already set up there keeps functioning.

export const ADMIN_EMAILS = [
  "[redacted-admin-email]",
];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}
