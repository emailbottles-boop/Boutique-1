// Bridget's Boutique — shared site behavior

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initActiveLink();
  initContactForm();
  initShopFilters();
});

function initNav() {
  const toggle = document.querySelector(".nav__toggle");
  const links = document.querySelector(".nav__links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    const isOpen = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  links.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => links.classList.remove("is-open"));
  });
}

function initActiveLink() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav__links a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      link.classList.add("is-active");
    }
  });
}

// Contact / order form: prefills the "item" field from a ?item= query param
// (used by "Inquire to Order" buttons on the shop page), and — until a real
// Formspree endpoint is configured — shows a friendly placeholder message
// instead of submitting.
function initContactForm() {
  const form = document.querySelector("#order-form");
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const item = params.get("item");
  const itemField = form.querySelector("#item");
  if (item && itemField) {
    itemField.value = decodeURIComponent(item);
  }

  const FORMSPREE_CONFIGURED = form.action && !form.action.includes("YOUR_FORM_ID");

  form.addEventListener("submit", (event) => {
    if (FORMSPREE_CONFIGURED) return; // let it submit normally to Formspree

    event.preventDefault();
    const status = form.querySelector(".form-status");
    if (!status) return;
    status.textContent =
      "Online form submission isn't connected yet — please call (360) 625-8032 or message us on Instagram/Facebook to place this order for now.";
    status.classList.remove("form-status--success");
    status.classList.add("form-status--error", "is-visible");
  });
}

function initShopFilters() {
  const buttons = document.querySelectorAll(".filter-btn");
  const cards = document.querySelectorAll("[data-category]");
  if (!buttons.length || !cards.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const category = btn.dataset.filter;

      cards.forEach((card) => {
        const match = category === "all" || card.dataset.category === category;
        card.style.display = match ? "" : "none";
      });
    });
  });
}
