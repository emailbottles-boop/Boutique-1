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
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      loginError.textContent = "Couldn't log in — check the email and password and try again.";
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
    loadInquiries();
  });
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

// ---------- Products ----------

async function loadProducts() {
  const list = document.getElementById("products-list");
  list.innerHTML = `<p class="admin-empty">Loading…</p>`;

  const q = query(collection(db, "products"), orderBy("sortOrder"));
  const snap = await getDocs(q);

  if (snap.empty) {
    list.innerHTML = `<p class="admin-empty">No products yet — add your first one above.</p>`;
    return;
  }

  list.innerHTML = "";
  snap.forEach((docSnap) => {
    list.appendChild(renderProductRow(docSnap.id, docSnap.data()));
  });
}

function renderProductRow(id, product) {
  const card = document.createElement("div");
  card.className = "admin-card admin-product-card";

  // Tappable photo thumbnail — tap it to pick a new photo, same as tapping
  // an avatar in most phone apps. A small pencil badge hints it's tappable.
  const thumbLabel = document.createElement("label");
  thumbLabel.className = "admin-product-thumb";
  thumbLabel.title = "Tap to change photo";
  const thumbImg = document.createElement("img");
  const thumbPlaceholder = document.createElement("span");
  thumbPlaceholder.textContent = "Add Photo";
  if (product.photoUrl) {
    thumbImg.src = product.photoUrl;
    thumbImg.alt = product.name;
    thumbLabel.appendChild(thumbImg);
  } else {
    thumbLabel.appendChild(thumbPlaceholder);
  }
  const badge = document.createElement("span");
  badge.className = "admin-product-thumb__badge";
  badge.textContent = "✎";
  thumbLabel.appendChild(badge);
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  thumbLabel.appendChild(fileInput);

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    thumbLabel.innerHTML = "";
    const preview = document.createElement("img");
    preview.src = URL.createObjectURL(file);
    thumbLabel.append(preview, badge, fileInput);
  });

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "f-name";
  nameInput.value = product.name || "";
  nameInput.setAttribute("aria-label", "Product name");

  const priceInput = document.createElement("input");
  priceInput.type = "text";
  priceInput.className = "f-price";
  priceInput.value = product.price || "";
  priceInput.setAttribute("aria-label", "Price");

  const headText = document.createElement("div");
  headText.className = "admin-product-head__text";
  headText.append(nameInput, priceInput);

  const head = document.createElement("div");
  head.className = "admin-product-head";
  head.append(thumbLabel, headText);

  const fields = document.createElement("div");
  fields.className = "admin-fields";
  fields.innerHTML = `
    <div>
      <label>Tag (optional)</label>
      <input type="text" class="f-tag" placeholder="e.g. New" value="${escapeAttr(product.tag || "")}" />
    </div>
  `;

  const actions = document.createElement("div");
  actions.className = "admin-product-actions";

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn--primary btn--small";
  saveBtn.textContent = "Save Changes";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn--outline btn--small";
  deleteBtn.textContent = "Delete";

  actions.append(saveBtn, deleteBtn);
  card.append(head, fields, actions);

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      let photoUrl = product.photoUrl || null;
      if (fileInput.files[0]) {
        photoUrl = await prepareProductPhoto(fileInput.files[0]);
      }
      await updateDoc(doc(db, "products", id), {
        name: nameInput.value,
        price: priceInput.value,
        tag: fields.querySelector(".f-tag").value || null,
        photoUrl,
      });
      product.photoUrl = photoUrl;
      showToast("Saved.");
    } catch (err) {
      console.error(err);
      showToast("Couldn't save that change — try again.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`Delete "${product.name}"? This can't be undone.`)) return;
    await deleteDoc(doc(db, "products", id));
    card.remove();
    showToast("Product deleted.");
  });

  return card;
}

// Photos are compressed in the browser and saved straight into the product's
// Firestore document, so no Firebase Storage (and therefore no billing
// account) is needed. See js/image-utils.js.
async function prepareProductPhoto(file) {
  return compressImageToDataUrl(file);
}

document.getElementById("new-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const name = document.getElementById("new-name").value;
    const price = document.getElementById("new-price").value;
    const tag = document.getElementById("new-tag").value || null;
    const file = document.getElementById("new-photo").files[0];

    const docRef = await addDoc(collection(db, "products"), {
      name,
      price,
      tag,
      photoUrl: null,
      sortOrder: Date.now(),
      createdAt: serverTimestamp(),
    });

    if (file) {
      const photoUrl = await prepareProductPhoto(file);
      await updateDoc(doc(db, "products", docRef.id), { photoUrl });
    }

    e.target.reset();
    showToast("Product added.");
    loadProducts();
  } catch (err) {
    console.error(err);
    showToast("Couldn't add that product — try again.");
  } finally {
    submitBtn.disabled = false;
  }
});

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
