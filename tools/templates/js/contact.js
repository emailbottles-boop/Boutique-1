// @@BUSINESS_NAME@@ — contact / order inquiry form
//
// Prefills the "item" field from a ?item= query param (used by "@@CTA_CONTACT_LABEL@@"
// buttons elsewhere on the site). If Firebase is configured (see
// js/firebase-config.js), submissions are saved to the "inquiries"
// Firestore collection and show up in admin.html. Until then, submitting
// shows a friendly "not connected yet" message instead.

import { db, FIREBASE_CONFIGURED } from "./firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#order-form");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const item = params.get("item");
  const itemField = form.querySelector("#item");
  if (item && itemField) {
    itemField.value = decodeURIComponent(item);
  }

  const status = form.querySelector(".form-status");
  const submitBtn = form.querySelector('button[type="submit"]');

  function showStatus(message, ok) {
    if (!status) return;
    status.textContent = message;
    status.classList.remove("form-status--success", "form-status--error");
    status.classList.add(ok ? "form-status--success" : "form-status--error", "is-visible");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!FIREBASE_CONFIGURED) {
      showStatus(
        "Online form submission isn't connected yet — please call @@PHONE_DISPLAY@@@@SOCIAL_DM_HINT@@ to place this order for now.",
        false
      );
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      await addDoc(collection(db, "inquiries"), {
        name: form.name.value,
        email: form.email.value,
        phone: form.phone.value,
        inquiryType: form.inquiry_type.value,
        item: form.item.value,
        message: form.message.value,
        status: "new",
        createdAt: serverTimestamp(),
      });
      form.reset();
      showStatus("Thanks! We got your message and will follow up soon.", true);
    } catch (err) {
      console.error("Failed to submit inquiry:", err);
      showStatus("Something went wrong sending that — please call @@PHONE_DISPLAY@@ instead.", false);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
