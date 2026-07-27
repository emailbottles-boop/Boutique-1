// Bridget's Boutique — admin dashboard logic
// Requires Firebase to be configured (see js/firebase-config.js).

import { db, auth, FIREBASE_CONFIGURED } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { compressImageToDataUrl } from "./image-utils.js";
import { loadSiteImages } from "./site-images.js";

const notConfiguredEl = document.getElementById("not-configured");
const loginView = document.getElementById("login-view");
const deniedView = document.getElementById("denied-view");
const dashboardView = document.getElementById("dashboard-view");
const logoutBtn = document.getElementById("logout-btn");
const userEmailEl = document.getElementById("user-email");
const toastEl = document.getElementById("toast");
const passwordBanner = document.getElementById("password-banner");

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("is-visible");
  setTimeout(() => toastEl.classList.remove("is-visible"), 2600);
}

// Tells the inline watchdog in admin.html that this module loaded, so it
// doesn't show the "couldn't load" message.
window.__adminStarted = true;

if (!FIREBASE_CONFIGURED) {
  notConfiguredEl.style.display = "block";
} else {
  initAuth();
}

let tabsReady = false;

function showView(view) {
  loginView.style.display = view === "login" ? "block" : "none";
  deniedView.style.display = view === "denied" ? "block" : "none";
  dashboardView.style.display = view === "dashboard" ? "block" : "none";
  logoutBtn.style.display = view === "dashboard" ? "inline-flex" : "none";
}

function initAuth() {
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const resetStatus = document.getElementById("reset-status");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.remove("is-visible");
    resetStatus.classList.remove("is-visible");
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      // Report the actual cause. Several of these have nothing to do with the
      // password, and saying "check your password" for them sends people
      // chasing the wrong problem.
      console.error("Login failed:", err.code, err);
      loginError.textContent = loginErrorMessage(err.code);
      loginError.classList.add("is-visible");
    }
  });

  // "Forgot your password?" — Firebase emails a reset link, so the owner
  // can recover on their own without anyone resetting it for them.
  document.getElementById("forgot-password-btn").addEventListener("click", async () => {
    const email = document.getElementById("login-email").value.trim();
    resetStatus.classList.remove("is-visible", "form-status--success", "form-status--error");
    if (!email) {
      resetStatus.textContent = "Type your email address above first, then tap this again.";
      resetStatus.classList.add("form-status--error", "is-visible");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      resetStatus.textContent = `Sent — check ${email} for a link to set a new password.`;
      resetStatus.classList.add("form-status--success", "is-visible");
    } catch (err) {
      console.error(err);
      resetStatus.textContent = "Couldn't send the reset email — double-check the address.";
      resetStatus.classList.add("form-status--error", "is-visible");
    }
  });

  logoutBtn.addEventListener("click", () => signOut(auth));
  document.getElementById("denied-logout-btn").addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showView("login");
      return;
    }

    // Being signed in is NOT enough — anyone can create an account against
    // a Firebase project. Only UIDs present in the `admins` collection
    // (added from the Firebase Console) can manage the site. The security
    // rules enforce this too; this check just avoids showing a dashboard
    // where every action would fail.
    let isAdmin = false;
    try {
      const adminDoc = await getDoc(doc(db, "admins", user.uid));
      isAdmin = adminDoc.exists();
    } catch (err) {
      console.error("Couldn't verify admin access:", err);
    }

    if (!isAdmin) {
      showView("denied");
      return;
    }

    showView("dashboard");
    userEmailEl.textContent = user.email;
    initTabs();
    initAccount(user);
    loadProducts();
    loadSiteImageSlots();
    loadInquiries();
  });
}

// Firebase lumps very different problems into the same failed sign-in. Spell
// out which one actually happened so setup mistakes aren't mistaken for a
// forgotten password.
function loginErrorMessage(code) {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/user-not-found":
      return "That email and password don't match an account. Check for typos, or use \"Forgot your password?\" below.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/unauthorized-domain":
      return "This website's address isn't authorized in Firebase yet. Add it under Authentication → Settings → Authorized domains. (Nothing is wrong with your password.)";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in isn't switched on for this Firebase project. Enable it under Authentication → Sign-in method.";
    case "auth/too-many-requests":
      return "Too many failed attempts — Firebase has paused sign-in for a bit. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Couldn't reach Firebase. Check your internet connection and try again.";
    case "auth/user-disabled":
      return "That account has been disabled in the Firebase Console.";
    default:
      return `Couldn't log in (${code || "unknown error"}). Check the browser console for details.`;
  }
}

function goToTab(name) {
  document.querySelectorAll(".admin-tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.tab === name);
  });
  document.querySelectorAll(".admin-panel").forEach((p) => {
    p.classList.toggle("is-active", p.id === `${name}-panel`);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initTabs() {
  if (tabsReady) return;
  tabsReady = true;

  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => goToTab(tab.dataset.tab));
  });
  document.querySelectorAll("[data-goto-tab]").forEach((el) => {
    el.addEventListener("click", () => goToTab(el.dataset.gotoTab));
  });
}

// ---------- Account / password ----------

async function initAccount(user) {
  // Nudge the owner to replace the temporary password they were handed,
  // until they've actually changed it once.
  try {
    const profile = await getDoc(doc(db, "adminProfile", user.uid));
    if (!profile.exists() || !profile.data().passwordChangedAt) {
      passwordBanner.style.display = "block";
    } else {
      passwordBanner.style.display = "none";
    }
  } catch (err) {
    console.error("Couldn't read admin profile:", err);
  }

  const form = document.getElementById("password-form");
  if (form.dataset.ready) return;
  form.dataset.ready = "true";

  const status = document.getElementById("password-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = document.getElementById("current-password").value;
    const next = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;

    status.classList.remove("is-visible", "form-status--success", "form-status--error");

    function fail(message) {
      status.textContent = message;
      status.classList.add("form-status--error", "is-visible");
    }

    if (next !== confirm) return fail("The two new passwords don't match.");
    if (next.length < 6) return fail("Your new password needs to be at least 6 characters.");
    if (next === current) return fail("That's the same as your current password — pick a new one.");

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Updating…";

    try {
      // Firebase requires a recent login before changing a password.
      const credential = EmailAuthProvider.credential(user.email, current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, next);
      await setDoc(
        doc(db, "adminProfile", user.uid),
        { passwordChangedAt: serverTimestamp() },
        { merge: true }
      );
      form.reset();
      passwordBanner.style.display = "none";
      status.textContent = "Password updated. Use the new one next time you log in.";
      status.classList.add("form-status--success", "is-visible");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        fail("That current password isn't right.");
      } else if (err.code === "auth/weak-password") {
        fail("That new password is too weak — try a longer one.");
      } else {
        fail("Couldn't update the password — try again.");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Update Password";
    }
  });
}

// ---------- Page photos (hero / storefront) ----------
//
// These are the big photos that aren't product items. They live in a single
// Firestore doc so the owner can swap them here rather than uploading files
// to GitHub.

const SITE_SLOTS = [
  {
    key: "hero",
    elId: "slot-hero",
    prompt: "Add the big photo for the top of your page",
    overlayText: "Change this photo",
    mockCopy: "Women's fashion, hand-picked weekly.",
  },
  {
    key: "storefront",
    elId: "slot-storefront",
    prompt: "Add a photo of your shop",
    overlayText: "Change this photo",
  },
];

async function loadSiteImageSlots() {
  const saved = (await loadSiteImages()) || {};
  SITE_SLOTS.forEach((slot) => buildSiteSlot(slot, saved[slot.key] || null));
}

function buildSiteSlot(slot, savedUrl) {
  const host = document.getElementById(slot.elId);
  if (!host) return;
  host.innerHTML = "";

  // Turn the div into a label so tapping anywhere opens the file picker.
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";

  const img = document.createElement("img");
  const emptyState = document.createElement("span");
  emptyState.className = "page-map__slot-empty";
  emptyState.innerHTML = `<strong>+</strong>${slot.prompt}`;

  const overlay = document.createElement("span");
  overlay.className = "page-map__slot-overlay";
  overlay.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>${slot.overlayText}`;

  // The site ships with a default photo in the HTML, so an unset slot still
  // shows something on the real page — reflect that here rather than
  // pretending the spot is blank.
  const fallback = slot.key === "hero" ? "images/store-display.jpg" : "images/storefront.jpg";
  const current = savedUrl || fallback;

  img.src = current;
  img.alt = "";
  host.appendChild(img);
  host.appendChild(overlay);

  if (slot.mockCopy) {
    const copy = document.createElement("span");
    copy.className = "page-map__hero-copy";
    copy.textContent = slot.mockCopy;
    host.appendChild(copy);
  }

  host.appendChild(fileInput);
  host.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    overlay.textContent = "Saving…";
    try {
      const dataUrl = await compressImageToDataUrl(file);
      img.src = dataUrl;
      await setDoc(
        doc(db, "site", "images"),
        { [slot.key]: dataUrl, updatedAt: serverTimestamp() },
        { merge: true }
      );
      showToast("Photo updated — it's live on the site now.");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Couldn't save that photo — try again.");
      img.src = current;
    } finally {
      overlay.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>${slot.overlayText}`;
    }
  });
}

// ---------- Products (live preview editor) ----------
//
// The products tab renders the same cards the public site shows, with the
// editing controls built into them: tap the photo to swap it, type over the
// name or price. The idea is that the owner edits the thing that looks like
// the thing, instead of translating between a form and the real page.

async function loadProducts() {
  const list = document.getElementById("products-list");
  list.innerHTML = `<p class="admin-empty">Loading…</p>`;

  let docs = [];
  try {
    const snap = await getDocs(query(collection(db, "products"), orderBy("sortOrder")));
    docs = snap.docs;
  } catch (err) {
    console.error("Couldn't load products:", err);
    list.innerHTML = `<p class="admin-empty">Couldn't load your items. Reload the page to try again.</p>`;
    return;
  }

  list.innerHTML = "";
  docs.forEach((d) => list.appendChild(renderProductCard(d.id, d.data())));
  list.appendChild(renderAddCard());
}

function renderAddCard() {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "admin-add-card";
  card.innerHTML = `<span class="admin-add-card__plus">+</span><span>Add an item</span>`;

  card.addEventListener("click", async () => {
    card.disabled = true;
    try {
      await addDoc(collection(db, "products"), {
        name: "New item",
        price: "",
        tag: null,
        photoUrl: null,
        sortOrder: Date.now(),
        createdAt: serverTimestamp(),
      });
      showToast("Item added — now add a photo and a name.");
      loadProducts();
    } catch (err) {
      console.error(err);
      showToast("Couldn't add that item — try again.");
      card.disabled = false;
    }
  });

  return card;
}

function renderProductCard(id, product) {
  const card = document.createElement("div");
  card.className = "admin-preview-card";

  // --- photo, tappable to replace ---
  const photoLabel = document.createElement("label");
  photoLabel.className = "admin-preview-photo";
  photoLabel.title = "Tap to change this photo";

  const img = document.createElement("img");
  const empty = document.createElement("span");
  empty.className = "admin-preview-photo__empty";
  empty.textContent = "Tap to add a photo";

  if (product.photoUrl) {
    img.src = product.photoUrl;
    img.alt = product.name || "";
    photoLabel.appendChild(img);
  } else {
    // The empty state already reads "tap to add a photo", so the overlay
    // would just repeat it.
    photoLabel.classList.add("is-empty");
    photoLabel.appendChild(empty);
  }

  const overlay = document.createElement("span");
  overlay.className = "admin-preview-photo__overlay";
  overlay.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
    Change photo`;
  photoLabel.appendChild(overlay);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  photoLabel.appendChild(fileInput);

  // --- text fields, styled to read like the live card ---
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "admin-preview-name";
  nameInput.value = product.name || "";
  nameInput.placeholder = "Item name";
  nameInput.setAttribute("aria-label", "Item name");

  const priceInput = document.createElement("input");
  priceInput.type = "text";
  priceInput.className = "admin-preview-price";
  priceInput.value = product.price || "";
  priceInput.placeholder = "$0";
  priceInput.setAttribute("aria-label", "Price");

  const tagInput = document.createElement("input");
  tagInput.type = "text";
  tagInput.className = "admin-preview-tag";
  tagInput.value = product.tag || "";
  tagInput.placeholder = "Add a label (optional)";
  tagInput.setAttribute("aria-label", "Label, for example New");

  const body = document.createElement("div");
  body.className = "admin-preview-body";
  body.append(tagInput, nameInput, priceInput);

  // --- actions ---
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn--primary btn--small admin-preview-save";
  saveBtn.textContent = "Save";
  saveBtn.disabled = true;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "admin-preview-delete";
  deleteBtn.title = "Remove this item";
  deleteBtn.setAttribute("aria-label", `Remove ${product.name || "this item"}`);
  deleteBtn.innerHTML = "&times;";

  const actions = document.createElement("div");
  actions.className = "admin-preview-actions";
  actions.appendChild(saveBtn);

  card.append(deleteBtn, photoLabel, body, actions);

  // Save only lights up once something actually changed, so it's obvious
  // whether there's unsaved work on the card.
  let pendingPhoto = null;
  const markDirty = () => {
    saveBtn.disabled = false;
    card.classList.add("is-dirty");
  };
  [nameInput, priceInput, tagInput].forEach((el) => el.addEventListener("input", markDirty));

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      // Compress immediately so the preview shows exactly what will be saved.
      pendingPhoto = await compressImageToDataUrl(file);
      img.src = pendingPhoto;
      img.alt = nameInput.value;
      if (!img.isConnected) {
        empty.remove();
        photoLabel.classList.remove("is-empty");
        photoLabel.prepend(img);
      }
      markDirty();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Couldn't read that photo.");
    }
  });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      const update = {
        name: nameInput.value.trim(),
        price: priceInput.value.trim(),
        tag: tagInput.value.trim() || null,
      };
      if (pendingPhoto) update.photoUrl = pendingPhoto;

      await updateDoc(doc(db, "products", id), update);
      if (pendingPhoto) {
        product.photoUrl = pendingPhoto;
        pendingPhoto = null;
      }
      card.classList.remove("is-dirty");
      saveBtn.textContent = "Saved";
      showToast("Saved — it's live on the site now.");
      setTimeout(() => {
        saveBtn.textContent = "Save";
        saveBtn.disabled = true;
      }, 1400);
    } catch (err) {
      console.error(err);
      showToast("Couldn't save that — try again.");
      saveBtn.textContent = "Save";
      saveBtn.disabled = false;
    }
  });

  deleteBtn.addEventListener("click", async () => {
    const label = nameInput.value.trim() || "this item";
    if (!confirm(`Remove ${label} from your site?`)) return;
    try {
      await deleteDoc(doc(db, "products", id));
      card.remove();
      showToast("Removed.");
    } catch (err) {
      console.error(err);
      showToast("Couldn't remove that — try again.");
    }
  });

  return card;
}


// ---------- Inquiries ----------

async function loadInquiries() {
  const list = document.getElementById("inquiries-list");
  list.innerHTML = `<p class="admin-empty">Loading…</p>`;

  const q = query(collection(db, "inquiries"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    list.innerHTML = `<p class="admin-empty">No inquiries yet.</p>`;
    document.getElementById("inquiry-count-badge").textContent = "";
    return;
  }

  let newCount = 0;
  list.innerHTML = "";
  snap.forEach((docSnap) => {
    const inquiry = docSnap.data();
    if (inquiry.status === "new") newCount++;
    list.appendChild(renderInquiryRow(docSnap.id, inquiry));
  });

  document.getElementById("inquiry-count-badge").textContent = newCount ? `(${newCount})` : "";
}

function renderInquiryRow(id, inquiry) {
  const card = document.createElement("div");
  card.className = "admin-card admin-inquiry";

  const when = inquiry.createdAt?.toDate ? inquiry.createdAt.toDate().toLocaleString() : "";

  const info = document.createElement("div");
  info.innerHTML = `
    <div class="admin-inquiry__meta">${escapeHtml(when)} · ${escapeHtml(inquiry.inquiryType || "")}</div>
    <strong>${escapeHtml(inquiry.name || "")}</strong>
    ${inquiry.item ? `<div>Item: ${escapeHtml(inquiry.item)}</div>` : ""}
    <div>${escapeHtml(inquiry.message || "")}</div>
    <div style="margin-top:0.5rem; font-size:0.85rem; color:var(--color-charcoal-soft);">
      ${escapeHtml(inquiry.email || "")}${inquiry.phone ? " · " + escapeHtml(inquiry.phone) : ""}
    </div>
  `;

  const right = document.createElement("div");
  right.style.textAlign = "right";

  const statusBadge = document.createElement("div");
  statusBadge.className = "admin-inquiry__status" + (inquiry.status === "handled" ? " is-handled" : "");
  statusBadge.textContent = inquiry.status === "handled" ? "Handled" : "New";

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "btn btn--outline btn--small";
  toggleBtn.style.marginTop = "0.6rem";
  toggleBtn.textContent = inquiry.status === "handled" ? "Mark New" : "Mark Handled";
  toggleBtn.addEventListener("click", async () => {
    const nextStatus = inquiry.status === "handled" ? "new" : "handled";
    await updateDoc(doc(db, "inquiries", id), { status: nextStatus });
    loadInquiries();
  });

  right.append(statusBadge, document.createElement("br"), toggleBtn);
  card.append(info, right);
  return card;
}

// ---------- helpers ----------

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}
