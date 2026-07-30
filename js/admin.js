// Bridget's Boutique — admin dashboard logic
// Requires Firebase to be configured (see js/firebase-config.js).

import { db, auth, FIREBASE_CONFIGURED } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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
import { STARTER_ITEMS, HOME_PREVIEW_COUNT } from "./starter-items.js";

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

// Firebase runs a background bot-check (reCAPTCHA Enterprise) before it even
// looks at the password. If a browser extension — most commonly an ad
// blocker — blocks that check's script, sign-in fails with
// auth/invalid-credential even when the email and password are correct. This
// can't be fixed from our code (the block happens in the browser, outside
// anything this site controls), but the failure is often transient rather
// than deterministic, so one silent retry recovers a real slice of these
// without the person ever seeing an error at all.
async function signInWithRetry(email, password) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err.code !== "auth/invalid-credential") throw err;
    await new Promise((resolve) => setTimeout(resolve, 700));
    return await signInWithEmailAndPassword(auth, email, password);
  }
}

function initAuth() {
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.remove("is-visible");
    // Lowercased because phone keyboards commonly auto-capitalize the first
    // letter of an email field (Owner@... instead of owner@...), which
    // happens far more often on mobile than when typing on a desktop.
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in…";

    try {
      await signInWithRetry(email, password);
    } catch (err) {
      // Report the actual cause. Several of these have nothing to do with the
      // password, and saying "check your password" for them sends people
      // chasing the wrong problem.
      console.error("Login failed:", err.code, err);
      loginError.textContent = loginErrorMessage(err.code);
      loginError.classList.add("is-visible");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log In";
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
    // a Firebase project. Authorization is decided by the security rules,
    // and this asks them rather than keeping a second copy of the answer in
    // the browser. See checkAdminAccess.
    const access = await checkAdminAccess(user);

    if (!access.allowed) {
      showDenied(user, access.error);
      return;
    }

    showView("dashboard");
    userEmailEl.textContent = user.email;
    initTabs();
    initAccount(user, access.profile);
    loadProducts();
    loadSiteImageSlots();
    loadInquiries();
  });
}

// Works out whether this account may manage the site — by asking Firestore,
// not by consulting a list shipped in the page.
//
// Anything the browser holds to make this decision is public: it is in the
// downloaded source, and in a public repository besides. An allowlist there
// leaks whose accounts are worth attacking while adding no protection at all,
// since the rules are the only thing that can actually stop a request.
//
// So this reads the one document whose rule is exactly "is this person an
// admin, and is it their own": adminProfile/{uid}. The read succeeding means
// authorized; permission-denied means not. Both routes in the rules — the
// email list and the `admins` collection — are covered automatically, because
// the rule for this path already accepts either.
//
// The document itself need not exist. Firestore permits reading a missing
// document you would be allowed to read, so a brand-new admin is allowed
// through and the returned snapshot is reused by initAccount rather than
// costing a second read.
async function checkAdminAccess(user) {
  try {
    const profile = await getDoc(doc(db, "adminProfile", user.uid));
    return { allowed: true, profile, error: null };
  } catch (err) {
    // A refusal is a definite "not an admin" and gets the plain No Access
    // screen. Anything else — offline, rules broken, SDK blocked — is a
    // failure to determine the answer, which is a different message.
    if (err.code === "permission-denied") {
      return { allowed: false, profile: null, error: null };
    }
    console.error("Couldn't verify admin access:", err);
    return { allowed: false, profile: null, error: err };
  }
}

// Fills in the "No Access" screen. If the admin lookup threw rather than
// simply coming back empty, say so plainly and name the likely cause — the
// account and its password are demonstrably fine at this point, so pointing
// at authorization would be actively misleading.
function showDenied(user, err) {
  const title = document.getElementById("denied-title");
  const message = document.getElementById("denied-message");
  const detail = document.getElementById("denied-detail");
  const copyBtn = document.getElementById("copy-uid-btn");

  copyBtn.style.display = "inline-flex";
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(user.uid);
      copyBtn.textContent = "Copied — now paste it as the document ID";
    } catch {
      // Clipboard access can be refused (permissions, insecure context).
      // Selecting the text is the fallback that always works.
      const range = document.createRange();
      range.selectNodeContents(detail);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      copyBtn.textContent = "Selected — press Ctrl+C to copy";
    }
    setTimeout(() => { copyBtn.textContent = "Copy UID"; }, 4000);
  };

  if (!err) {
    title.textContent = "No Access";
    message.textContent =
      "That account is signed in, but it isn't authorized to manage this site. " +
      "If this should be your account, the site owner needs to add you as an " +
      "admin in the Firebase Console.";
    detail.style.display = "block";
    detail.textContent = `Signed in as ${user.email} · User UID: ${user.uid}`;
    showView("denied");
    return;
  }

  title.textContent = "Couldn't Check Access";
  message.textContent = deniedErrorMessage(err.code);
  detail.style.display = "block";
  detail.textContent = `Signed in as ${user.email} · User UID: ${user.uid} · (${err.code || "unknown error"})`;
  showView("denied");
}

function deniedErrorMessage(code) {
  switch (code) {
    case "permission-denied":
      // Firestore's own answer was "no", which is a rules problem rather than
      // a missing admin document. The overwhelmingly common cause is a
      // database still on the console's test-mode rules, which stop allowing
      // anything 30 days after the database is created — hence sites that
      // work fine and then break one day with nothing having changed.
      return "Your login worked, but the database refused to answer whether you're an admin. " +
        "That's a Firestore Rules problem, not a password or account problem. In the Firebase " +
        "Console open Firestore Database → Rules and publish the rules from firebase/firestore.rules. " +
        "If the rules there contain a date, they were temporary test rules and have now expired.";
    case "unavailable":
    case "failed-precondition":
      return "Your login worked, but the site couldn't reach the database to check your access. " +
        "Check your internet connection and reload. An ad blocker or a network that blocks Google " +
        "services can also cause this.";
    case "unauthenticated":
      return "Your login worked, but the database didn't accept the session. Sign out, reload the " +
        "page, and log in again.";
    default:
      return "Your login worked, but the check for whether you're an admin failed to complete. " +
        "Reload the page and try again — the browser console has the details.";
  }
}

// Firebase lumps very different problems into the same failed sign-in. Spell
// out which one actually happened so setup mistakes aren't mistaken for a
// forgotten password.
function loginErrorMessage(code) {
  switch (code) {
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match an account. Check for typos and try again.";
    case "auth/invalid-credential":
      // We already retried once automatically (see signInWithRetry) before
      // this message is ever shown. Kept short and single-action on purpose
      // — the fuller explanation lives in the standing tip below the form,
      // not stacked into the error text itself.
      return "That didn't work. Try opening this page in a Private/Incognito window and logging in there.";
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

// `profile` is the snapshot already fetched by checkAdminAccess — the access
// check and this banner want the same document, so it is read once.
async function initAccount(user, profile) {
  // Nudge the owner to replace the temporary password they were handed,
  // until they've actually changed it once.
  const changed = profile && profile.exists() && profile.data().passwordChangedAt;
  passwordBanner.style.display = changed ? "none" : "block";

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
  const featuredHost = document.getElementById("featured-slots");
  const moreHost = document.getElementById("more-slots");
  featuredHost.innerHTML = `<p class="admin-empty">Loading…</p>`;
  moreHost.innerHTML = "";

  let docs = [];
  try {
    docs = (await getDocs(query(collection(db, "products"), orderBy("sortOrder")))).docs;

    // The public site falls back to a built-in starter list when the database
    // is empty — which meant the site showed four items the dashboard knew
    // nothing about, and they couldn't be edited. Seed those same items once
    // so the two always agree.
    if (docs.length === 0 && !(await hasBeenSeeded())) {
      await seedStarterItems();
      docs = (await getDocs(query(collection(db, "products"), orderBy("sortOrder")))).docs;
    }
  } catch (err) {
    console.error("Couldn't load products:", err);
    featuredHost.innerHTML = `<p class="admin-empty">Couldn't load your items. Reload the page to try again.</p>`;
    return;
  }

  const items = docs.map((d) => ({ id: d.id, data: d.data() }));
  const featured = items.slice(0, HOME_PREVIEW_COUNT);
  const rest = items.slice(HOME_PREVIEW_COUNT);

  // Always draw all four home-page positions, so an empty one reads as a
  // slot waiting to be filled rather than as nothing at all.
  featuredHost.innerHTML = "";
  for (let i = 0; i < HOME_PREVIEW_COUNT; i++) {
    featuredHost.appendChild(
      featured[i]
        ? renderProductCard(featured[i].id, featured[i].data)
        : renderAddCard(`Add item ${i + 1}`)
    );
  }

  moreHost.innerHTML = "";
  rest.forEach((item) => moreHost.appendChild(renderProductCard(item.id, item.data)));
  moreHost.appendChild(renderAddCard("Add another item"));
}

async function hasBeenSeeded() {
  try {
    const snap = await getDoc(doc(db, "site", "config"));
    return snap.exists() && snap.data().seeded === true;
  } catch (err) {
    // If we can't tell, don't seed — better to show an empty dashboard than
    // to keep re-creating items the owner deliberately deleted.
    console.warn("Couldn't check seed state:", err);
    return true;
  }
}

async function seedStarterItems() {
  try {
    const base = Date.now();
    await Promise.all(
      STARTER_ITEMS.map((item, i) =>
        addDoc(collection(db, "products"), {
          ...item,
          sortOrder: base + i,
          createdAt: serverTimestamp(),
        })
      )
    );
    await setDoc(doc(db, "site", "config"), { seeded: true }, { merge: true });
    showToast("Loaded the items currently on your site.");
  } catch (err) {
    console.error("Couldn't seed starter items:", err);
  }
}

function renderAddCard(label = "Add an item") {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "admin-add-card";
  card.innerHTML = `<span class="admin-add-card__plus">+</span><span>${label}</span>`;

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
    // If the file behind that URL has gone missing, fall back to the empty
    // state instead of showing a broken-image icon.
    img.addEventListener("error", () => {
      img.remove();
      photoLabel.classList.add("is-empty");
      photoLabel.prepend(empty);
    }, { once: true });
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
