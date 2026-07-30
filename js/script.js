// Bridget's Boutique — shared site behavior

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initActiveLink();
  initHeaderScroll();
  initReveal();
  initInstagramEmbed();
  initOpenStatus();
});

// ---- Open / closed right now ----
//
// "Are they open?" is the question the hours are there to answer, so answer
// it directly instead of leaving the visitor to compare a table against their
// own clock.
//
// Times are evaluated in the shop's timezone, not the visitor's. Someone
// checking from another state — or from a phone whose clock is set oddly —
// should still see whether the shop in Enumclaw is open, and Pacific
// switches between PST and PDT twice a year on its own.
const SHOP_TZ = "America/Los_Angeles";

// Index 0 = Sunday, matching Date.getDay(). Hours in 24h local time.
const SHOP_HOURS = [
  { open: 11, close: 17 }, // Sun
  { open: 10, close: 17 }, // Mon
  { open: 10, close: 17 }, // Tue
  { open: 10, close: 17 }, // Wed
  { open: 10, close: 17 }, // Thu
  { open: 10, close: 19 }, // Fri
  { open: 10, close: 19 }, // Sat
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function shopNow() {
  // Read the wall-clock time in the shop's timezone. Intl gives us the parts
  // directly, which avoids the usual trap of shifting a UTC timestamp by a
  // hardcoded offset and being an hour out for half the year.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SHOP_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date());

  const get = (t) => parts.find((p) => p.type === t)?.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  // "24" appears at midnight in some implementations of hour12: false.
  const hour = Number(get("hour")) % 24;
  return { day: weekday, minutes: hour * 60 + Number(get("minute")) };
}

function formatHour(h) {
  const suffix = h >= 12 ? "pm" : "am";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${suffix}`;
}

function initOpenStatus() {
  const el = document.getElementById("open-status");
  if (!el) return;

  let now;
  try {
    now = shopNow();
  } catch (err) {
    // If the timezone lookup isn't supported, leave the plain hours showing
    // rather than risk telling someone the shop is open when it isn't.
    console.warn("Couldn't work out the shop's local time:", err);
    return;
  }
  if (now.day < 0) return;

  const today = SHOP_HOURS[now.day];
  const isOpen = now.minutes >= today.open * 60 && now.minutes < today.close * 60;

  if (isOpen) {
    el.innerHTML = `<strong>Open now</strong> · until ${formatHour(today.close)}`;
    el.classList.add("is-open");
  } else {
    // Find the next opening — later today, or the next day that has one.
    let dayOffset = now.minutes < today.open * 60 ? 0 : 1;
    while (dayOffset < 8) {
      const d = (now.day + dayOffset) % 7;
      const h = SHOP_HOURS[d];
      if (h) {
        const when =
          dayOffset === 0 ? "today" : dayOffset === 1 ? "tomorrow" : DAY_NAMES[d];
        el.innerHTML = `<strong>Closed</strong> · opens ${when} at ${formatHour(h.open)}`;
        break;
      }
      dayOffset++;
    }
  }

  el.hidden = false;

  // Mark the current day in the week's list so the relevant line stands out.
  const todayIndex = [0, 1, 1, 1, 1, 2, 2][now.day]; // Sun | Mon–Thu | Fri–Sat
  const rows = document.querySelectorAll(".hours__list > div");
  const map = { 0: 2, 1: 0, 2: 1 }; // list order is Mon–Thu, Fri–Sat, Sun
  const row = rows[map[todayIndex]];
  if (row) row.classList.add("is-today");
}

// Instagram's embed.js pulls in a good chunk of script plus an iframe with its
// own assets — enough to noticeably slow first paint if it loads with the page.
// Since the embed sits well below the fold, hold off until the visitor scrolls
// near it. Most people who bounce off the hero never pay for it at all.
function initInstagramEmbed() {
  const embed = document.querySelector(".instagram-media");
  if (!embed) return;

  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.instagram.com/embed.js";
    document.body.appendChild(script);
  };

  if (!("IntersectionObserver" in window)) {
    load();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        load();
        observer.disconnect();
      }
    },
    // Start fetching a screen early so it's usually ready by the time it's seen.
    { rootMargin: "600px 0px" }
  );
  observer.observe(embed);
}

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

function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initReveal() {
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  targets.forEach((el) => observer.observe(el));
}
