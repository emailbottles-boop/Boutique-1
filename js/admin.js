// Bridget's Boutique — admin dashboard logic
// Requires Firebase to be configured (see js/firebase-config.js).

import { db, auth, storage, FIREBASE_CONFIGURED } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

const notConfiguredEl = document.getElementById("not-configured");
const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const logoutBtn = document.getElementById("logout-btn");
const userEmailEl = document.getElementById("user-email");
const toastEl = document.getElementById("toast");

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

function initAuth() {
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.classList.remove("is-visible");
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      loginError.textContent = "Couldn't log in — check the email and password and try again.";
      loginError.classList.add("is-visible");
    }
  });

  logoutBtn.addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginView.style.display = "none";
      dashboardView.style.display = "block";
      logoutBtn.style.display = "inline-flex";
      userEmailEl.textContent = user.email;
      initTabs();
      loadProducts();
      loadInquiries();
    } else {
      loginView.style.display = "block";
      dashboardView.style.display = "none";
      logoutBtn.style.display = "none";
    }
  });
}

function initTabs() {
  const tabs = document.querySelectorAll(".admin-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("is-active"));
      document.getElementById(`${tab.dataset.tab}-panel`).classList.add("is-active");
    });
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
      <label>Category</label>
      <select class="f-category">
        <option value="dresses">Dresses &amp; Bottoms</option>
        <option value="tops">Tops</option>
        <option value="outerwear">Outerwear</option>
        <option value="accessories">Accessories</option>
      </select>
    </div>
    <div>
      <label>Tag (optional)</label>
      <input type="text" class="f-tag" placeholder="e.g. New" value="${escapeAttr(product.tag || "")}" />
    </div>
  `;
  fields.querySelector(".f-category").value = product.category || "dresses";

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
        photoUrl = await uploadProductPhoto(id, fileInput.files[0]);
      }
      await updateDoc(doc(db, "products", id), {
        name: nameInput.value,
        price: priceInput.value,
        category: fields.querySelector(".f-category").value,
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

async function uploadProductPhoto(productId, file) {
  const path = `product-photos/${productId}-${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

document.getElementById("new-product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const name = document.getElementById("new-name").value;
    const price = document.getElementById("new-price").value;
    const category = document.getElementById("new-category").value;
    const tag = document.getElementById("new-tag").value || null;
    const file = document.getElementById("new-photo").files[0];

    const docRef = await addDoc(collection(db, "products"), {
      name,
      price,
      category,
      tag,
      photoUrl: null,
      sortOrder: Date.now(),
      createdAt: serverTimestamp(),
    });

    if (file) {
      const photoUrl = await uploadProductPhoto(docRef.id, file);
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
