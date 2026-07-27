// Bridget's Boutique — contact / order inquiry form
//
// Prefills the "item" field from a ?item= query param (used by "Inquire to
// Order" buttons elsewhere on the site). If Firebase is configured (see
// js/firebase-config.js), submissions are saved to the "inquiries"
// Firestore collection and show up in admin.html. Until then, submitting
// shows a friendly "not connected yet" message instead.

// Firebase is imported lazily inside the submit handler, not at the top of the
// file. With a static import, an unreachable Firebase CDN would stop this whole
// module from loading — which would silently kill the submit handler and let
// the form do nothing at all. Loading it on demand means the worst case is a
// clear "call us instead" message rather than a dead button.

const CALL_INSTEAD =
  "Online form submission isn't available right now — please call (360) 625-8032 " +
  "or message us on Instagram/Facebook and we'll take care of you.";

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
    if (submitBtn) submitBtn.disabled = true;

    try {
      const { db, FIREBASE_CONFIGURED } = await import("./firebase-init.js");
      if (!FIREBASE_CONFIGURED || !db) {
        showStatus(CALL_INSTEAD, false);
        return;
      }

      const { collection, addDoc, serverTimestamp } = await import(
        "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js"
      );

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
      showStatus(CALL_INSTEAD, false);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
