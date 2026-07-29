#!/usr/bin/env python3
"""
generate_site.py — scaffold a brand-new small-business website from the
Bridget's Boutique template.

Usage:
    python3 generate_site.py --config business.json --out ../my-new-site
    python3 generate_site.py --config business.json --out ../my-new-site --force

Only the Python 3 standard library is used — no pip install required.

See tools/README.md for the full field reference and a worked example.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import urllib.parse
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = TOOLS_DIR / "templates"

TOKEN_RE = re.compile(r"@@([A-Z0-9_]+)@@")

DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DAY_ABBREV = {
    "monday": "Mon", "tuesday": "Tue", "wednesday": "Wed", "thursday": "Thu",
    "friday": "Fri", "saturday": "Sat", "sunday": "Sun",
}
DAY_TITLE = {
    "monday": "Monday", "tuesday": "Tuesday", "wednesday": "Wednesday", "thursday": "Thursday",
    "friday": "Friday", "saturday": "Saturday", "sunday": "Sunday",
}

DEFAULT_COLORS = {
    "cream": "#faf6f1",
    "cream_dark": "#f1e9df",
    "accent": "#d9a9a0",
    "accent_dark": "#c48b81",
    "charcoal": "#2b2523",
    "charcoal_soft": "#4a423e",
    "gold": "#b08d57",
}
DEFAULT_FONTS = {"heading": "Playfair Display", "body": "Jost"}

# Terms that must never survive into generated output unless the config
# itself intentionally introduces them (see self_check()).
LEAKAGE_TERMS = [
    "bridget", "bridget's boutique", "enumclaw", "6258032", "625-8032",
    "bridgetsboutiqueenumclaw", "cole st",
]


class ConfigError(Exception):
    """Raised for a config problem the user needs to fix. Message is user-facing."""


# --------------------------------------------------------------------------
# Config loading (JSON with // and /* */ comments allowed) + validation
# --------------------------------------------------------------------------

def strip_json_comments(text: str) -> str:
    """Strip `//` line comments and `/* ... */` block comments from JSONC.

    A small character-by-character scan that tracks whether we're inside a
    JSON string (respecting backslash escapes), so `//` inside a URL like
    `"https://example.com"` is never touched, but a real trailing comment
    like `"x": 1,  // note` is stripped correctly.
    """
    out = []
    i, n = 0, len(text)
    in_string = False
    while i < n:
        ch = text[i]

        if in_string:
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                out.append(text[i + 1])
                i += 2
                continue
            if ch == '"':
                in_string = False
            i += 1
            continue

        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue

        if ch == "/" and i + 1 < n and text[i + 1] == "/":
            # Line comment — skip to end of line (keep the newline itself).
            j = text.find("\n", i)
            i = n if j == -1 else j
            continue

        if ch == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            i = n if j == -1 else j + 2
            continue

        out.append(ch)
        i += 1

    return "".join(out)


def load_config(path: Path) -> dict:
    if not path.exists():
        raise ConfigError(f"Config file not found: {path}")
    raw = path.read_text(encoding="utf-8")
    cleaned = strip_json_comments(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ConfigError(
            f"Couldn't parse {path.name} as JSON: {e}\n"
            f"  (Line {e.lineno}, column {e.colno}. Comments starting with // "
            f"are allowed but only on their own line.)"
        )


def require(cfg: dict, dotted_path: str, expected_type=None, human=None):
    """Fetch a required config value by dotted path, or raise a friendly ConfigError."""
    parts = dotted_path.split(".")
    node = cfg
    for i, part in enumerate(parts):
        if not isinstance(node, dict) or part not in node or node[part] in (None, ""):
            label = human or dotted_path
            raise ConfigError(
                f"Missing required field \"{dotted_path}\" ({label}). "
                f"Add it to your config file — see tools/business.example.json."
            )
        node = node[part]
    if expected_type is not None and not isinstance(node, expected_type):
        raise ConfigError(
            f"Field \"{dotted_path}\" should be a {expected_type.__name__}, "
            f"got {type(node).__name__} instead."
        )
    return node


def validate_config(cfg: dict) -> None:
    """Raise ConfigError with a clear message for any missing/invalid required field."""
    require(cfg, "business_name", str, "the business's display name")
    require(cfg, "tagline", str, "a short one-line tagline")
    require(cfg, "description", str, "a 1-2 sentence description used in SEO meta tags")
    require(cfg, "phone", str, "a phone number, e.g. \"(360) 555-0100\"")
    require(cfg, "email", str, "a contact email address")
    require(cfg, "domain", str, "the site's canonical URL, e.g. \"https://www.example.com\"")
    require(cfg, "schema_type", str, "a schema.org business type, e.g. \"ClothingStore\"")

    address = require(cfg, "address", dict, "street/city/state/zip")
    for field in ("street", "city", "state", "zip"):
        if not address.get(field):
            raise ConfigError(
                f"Missing required field \"address.{field}\". "
                f"Add it under the \"address\" object in your config file."
            )

    domain = cfg["domain"]
    if not re.match(r"^https?://", domain):
        raise ConfigError(
            f"\"domain\" should start with http:// or https:// — got \"{domain}\"."
        )

    hours = cfg.get("hours")
    if hours is not None and not isinstance(hours, dict):
        raise ConfigError("\"hours\" should be an object keyed by day name (monday..sunday).")
    if isinstance(hours, dict):
        for day in hours:
            if day.lower() not in DAY_KEYS:
                raise ConfigError(
                    f"Unrecognized day \"{day}\" in \"hours\" — expected one of: "
                    + ", ".join(DAY_KEYS)
                )

    catalog = cfg.get("catalog")
    if catalog is not None and not isinstance(catalog, dict):
        raise ConfigError("\"catalog\" should be an object (or omitted entirely).")
    if isinstance(catalog, dict):
        items = catalog.get("items", [])
        if not isinstance(items, list):
            raise ConfigError("\"catalog.items\" should be a list.")
        for i, item in enumerate(items):
            if not isinstance(item, dict) or not item.get("name") or not item.get("price"):
                raise ConfigError(
                    f"catalog.items[{i}] needs at least \"name\" and \"price\" fields."
                )

    colors = cfg.get("colors")
    if colors is not None and not isinstance(colors, dict):
        raise ConfigError("\"colors\" should be an object (or omitted to use the default palette).")
    if isinstance(colors, dict):
        hex_re = re.compile(r"^#[0-9a-fA-F]{3,8}$")
        for key, val in colors.items():
            if val and not hex_re.match(str(val)):
                raise ConfigError(
                    f"colors.{key} = \"{val}\" doesn't look like a hex color (e.g. \"#2b2523\")."
                )


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------

def slugify_initials(name: str) -> str:
    stop = {"the", "and", "of", "&", "a", "an"}
    words = [w for w in re.split(r"[\s'’\-]+", name) if w and w.lower() not in stop]
    if not words:
        words = [name]
    letters = "".join(w[0] for w in words[:3]).upper()
    return letters[:3] or "?"


def digits_only(s: str) -> str:
    return re.sub(r"\D", "", s)


def phone_tel_link(phone: str, country_code: str = "1") -> str:
    d = digits_only(phone)
    if len(d) == 10:
        d = country_code + d
    return "+" + d


def fmt12(hhmm: str) -> str:
    h, m = (int(x) for x in hhmm.split(":"))
    suffix = "am" if h < 12 else "pm"
    h12 = h % 12 or 12
    return f"{h12}{suffix}" if m == 0 else f"{h12}:{m:02d}{suffix}"


def fmt_compact(hhmm: str) -> str:
    h, m = (int(x) for x in hhmm.split(":"))
    h12 = h % 12 or 12
    return f"{h12}" if m == 0 else f"{h12}:{m:02d}"


def group_hours(hours_cfg: dict) -> list:
    """Return list of (day_start, day_end, open, close) grouping consecutive
    identical days in Mon..Sun order. open/close are None if closed."""
    normalized = {}
    for day in DAY_KEYS:
        entry = hours_cfg.get(day) or hours_cfg.get(day.capitalize())
        if entry:
            normalized[day] = (entry.get("open"), entry.get("close"))
        else:
            normalized[day] = (None, None)

    groups = []
    current = None
    for day in DAY_KEYS:
        val = normalized[day]
        if current and current[2] == val:
            current = (current[0], day, val)
        else:
            if current:
                groups.append(current)
            current = (day, day, val)
    if current:
        groups.append(current)
    return groups


def day_label(start: str, end: str) -> str:
    if start == end:
        return DAY_ABBREV[start]
    return f"{DAY_ABBREV[start]} – {DAY_ABBREV[end]}"


def build_hours_table_rows(groups: list) -> str:
    rows = []
    for start, end, (open_, close_) in groups:
        hours_str = "Closed" if not open_ else f"{fmt12(open_)} – {fmt12(close_)}"
        rows.append(f"            <tr><td>{day_label(start, end)}</td><td>{hours_str}</td></tr>")
    return "\n".join(rows)


def build_hours_footer_summary(groups: list) -> str:
    parts = []
    for start, end, (open_, close_) in groups:
        label = day_label(start, end)
        if open_:
            parts.append(f"{label} {fmt_compact(open_)}–{fmt_compact(close_)}")
        else:
            parts.append(f"{label} Closed")
    return " · ".join(parts)


def build_hours_jsonld(groups: list) -> str:
    entries = []
    for start, end, (open_, close_) in groups:
        if not open_:
            continue
        if start == end:
            day_field = f"\"{DAY_TITLE[start]}\""
        else:
            idx_start, idx_end = DAY_KEYS.index(start), DAY_KEYS.index(end)
            days = DAY_KEYS[idx_start:idx_end + 1]
            day_field = "[" + ", ".join(f"\"{DAY_TITLE[d]}\"" for d in days) + "]"
        entries.append(
            "    { \"@type\": \"OpeningHoursSpecification\", \"dayOfWeek\": "
            f"{day_field}, \"opens\": \"{open_}\", \"closes\": \"{close_}\" }}"
        )
    return ",\n".join(entries)


def esc_attr(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


def js_str(s: str) -> str:
    """A safe JS/JSON string literal."""
    return json.dumps(s if s is not None else "")


def make_placeholder_svg(width: int, height: int, bg: str, bg2: str, fg: str, title: str, subtitle: str = "") -> str:
    title = esc_attr(title)
    subtitle = esc_attr(subtitle)
    sub_el = (
        f'<text x="50%" y="58%" font-family="Helvetica, Arial, sans-serif" '
        f'font-size="{max(12, width // 44)}" fill="{fg}" fill-opacity="0.75" '
        f'text-anchor="middle">{subtitle}</text>' if subtitle else ""
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{bg}" />
      <stop offset="100%" stop-color="{bg2}" />
    </linearGradient>
  </defs>
  <rect width="{width}" height="{height}" fill="url(#g)" />
  <text x="50%" y="48%" font-family="Georgia, 'Playfair Display', serif" font-size="{max(20, width // 22)}" fill="{fg}" text-anchor="middle">{title}</text>
  {sub_el}
</svg>
'''


def make_logo_svg(initials: str, bg: str, fg: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="20" fill="{bg}" />
  <text x="20" y="26" font-family="Georgia, 'Playfair Display', serif" font-size="16" fill="{fg}" text-anchor="middle">{esc_attr(initials)}</text>
</svg>
'''


SOCIAL_ICON_PATHS = {
    "instagram": (
        'M12 2.2c3.2 0 3.6 0 4.9.07 3.3.15 4.8 1.7 4.95 4.95.06 1.3.07 1.6.07 4.8s-.01 3.5-.07 4.8c-.15 '
        '3.25-1.65 4.8-4.95 4.95-1.3.06-1.6.07-4.9.07s-3.6 0-4.9-.07c-3.3-.15-4.8-1.7-4.95-4.95C2.09 15.5 '
        '2.08 15.2 2.08 12s.01-3.5.07-4.8C2.3 3.95 3.8 2.4 7.1 2.27 8.4 2.21 8.8 2.2 12 2.2Zm0 1.8c-3.15 '
        '0-3.52 0-4.76.07-2.35.1-3.44 1.2-3.54 3.54C3.63 8.85 3.63 9.2 3.63 12s0 3.15.07 4.4c.1 2.33 1.19 '
        '3.44 3.54 3.53 1.24.06 1.6.07 4.76.07s3.52 0 4.76-.07c2.35-.09 3.44-1.2 3.54-3.53.06-1.25.07-1.6.'
        '07-4.4s0-3.15-.07-4.39c-.1-2.34-1.2-3.44-3.54-3.54C15.52 4 15.15 4 12 4Zm0 3.4a4.6 4.6 0 1 1 0 9.2 '
        '4.6 4.6 0 0 1 0-9.2Zm0 1.8a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm4.8-2.1a1.07 1.07 0 1 1 0 2.14 '
        '1.07 1.07 0 0 1 0-2.14Z'
    ),
    "facebook": (
        'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 '
        '0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z'
    ),
}


def social_icon_link(platform: str, url: str, extra_class: str = "") -> str:
    path = SOCIAL_ICON_PATHS[platform]
    cls = f' class="{extra_class}"' if extra_class else ""
    return (
        f'<a{cls} href="{url}" target="_blank" rel="noopener" aria-label="{platform.capitalize()}">'
        f'<svg viewBox="0 0 24 24"><path d="{path}"/></svg></a>'
    )


# --------------------------------------------------------------------------
# Building the token dictionary from config
# --------------------------------------------------------------------------

class SiteBuilder:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.tokens: dict[str, str] = {}
        self._build()

    # -- top level orchestration --------------------------------------
    def _build(self):
        cfg = self.cfg
        t = self.tokens

        business_name = cfg["business_name"]
        t["BUSINESS_NAME"] = business_name
        t["TAGLINE"] = cfg["tagline"]

        address = cfg["address"]
        t["STREET"] = address["street"]
        t["CITY"] = address["city"]
        t["STATE"] = address["state"]
        t["ZIP"] = address["zip"]
        t["STATE_FULL"] = address.get("state_full", address["state"])
        addr_query = f"{address['street']} {address['city']} {address['state']} {address['zip']}"
        t["MAPS_QUERY"] = urllib.parse.quote_plus(addr_query)
        t["MAPS_URL"] = f"https://maps.google.com/?q={t['MAPS_QUERY']}"
        embed_query = urllib.parse.quote(f"{address['street']}, {address['city']}, {address['state']} {address['zip']}")
        t["MAPS_EMBED_SRC"] = (
            f"https://maps.google.com/maps?q={embed_query}&t=&z=15&ie=UTF8&iwloc=&output=embed"
        )
        t["BUSINESS_LOCATION_SUFFIX"] = f", a business in {address['city']}, {address['state']}"

        t["PHONE_DISPLAY"] = cfg["phone"]
        t["PHONE_TEL"] = phone_tel_link(cfg["phone"], cfg.get("country_code", "1"))
        t["EMAIL"] = cfg["email"]

        domain = cfg["domain"].rstrip("/")
        t["DOMAIN"] = domain
        t["SCHEMA_TYPE"] = cfg["schema_type"]
        t["PRICE_RANGE"] = cfg.get("price_range", "$$")
        t["FIREBASE_PROJECT_ID"] = cfg.get("firebase_project_id", "YOUR_FIREBASE_PROJECT_ID")
        t["DEPLOY_BRANCH"] = cfg.get("deploy_branch", "main")
        t["CONFIG_BASENAME"] = cfg.get("_config_basename", "business.json")

        # Colors
        colors = {**DEFAULT_COLORS, **(cfg.get("colors") or {})}
        t["COLOR_CREAM"] = colors["cream"]
        t["COLOR_CREAM_DARK"] = colors["cream_dark"]
        t["COLOR_ACCENT"] = colors["accent"]
        t["COLOR_ACCENT_DARK"] = colors["accent_dark"]
        t["COLOR_CHARCOAL"] = colors["charcoal"]
        t["COLOR_CHARCOAL_SOFT"] = colors["charcoal_soft"]
        t["COLOR_GOLD"] = colors["gold"]
        self.colors = colors

        # Fonts
        fonts = {**DEFAULT_FONTS, **(cfg.get("fonts") or {})}
        t["FONT_HEADING"] = fonts["heading"]
        t["FONT_BODY"] = fonts["body"]
        heading_weights = fonts.get("heading_weights", "500;600;700")
        body_weights = fonts.get("body_weights", "400;500;600")
        heading_family = fonts["heading"].replace(" ", "+")
        body_family = fonts["body"].replace(" ", "+")
        t["GOOGLE_FONTS_HREF"] = (
            f"https://fonts.googleapis.com/css2?family={heading_family}:wght@{heading_weights}"
            f"&family={body_family}:wght@{body_weights}&display=swap"
        )

        # Socials
        socials = cfg.get("socials") or {}
        self.socials = socials
        self.instagram = socials.get("instagram")
        self.facebook = socials.get("facebook")
        self.others = socials.get("others") or []
        self.instagram_post_url = socials.get("instagram_post_url")

        # Catalog
        self._build_catalog()

        # Hours
        hours_cfg = {k.lower(): v for k, v in (cfg.get("hours") or {}).items()}
        groups = group_hours(hours_cfg)
        t["HOURS_TABLE_ROWS"] = build_hours_table_rows(groups) or "            <tr><td colspan=\"2\">Hours coming soon</td></tr>"
        t["HOURS_FOOTER_SUMMARY"] = build_hours_footer_summary(groups) or "Hours coming soon"
        self._hours_jsonld = build_hours_jsonld(groups)

        # Labels / CTAs
        labels = cfg.get("labels") or {}
        t["CTA_CONTACT_LABEL"] = labels.get("contact_cta", "Inquire to Order" if self.catalog_enabled else "Get In Touch")
        t["CATALOG_NAV_LABEL"] = self.catalog_nav_label
        t["CATALOG_ITEM_SINGULAR_TITLE"] = self.item_singular.capitalize()
        t["CATALOG_ITEM_SINGULAR_LOWER"] = self.item_singular.lower()
        t["ITEM_PLACEHOLDER"] = f"e.g. {self.catalog_items[0]['name']}" if self.catalog_items else f"Describe the {self.item_singular}"

        # Images
        self._build_images()

        # Nav / footer / convenience bar (shared across index/shop/about/contact)
        self._build_chrome()

        # Home page specific
        self._build_home()

        # About page specific
        self._build_about()

        # Shop / contact / 404 specifics
        self._build_shop_page()
        self._build_contact_extras()
        self._build_404_extras()

        # Meta descriptions per page
        desc = cfg["description"]
        t["META_DESCRIPTION_HOME"] = desc
        t["META_DESCRIPTION_CATALOG"] = cfg.get(
            "catalog_description",
            f"Browse {self.catalog_nav_label.lower()} at {business_name} in {address['city']}, {address['state']}."
        )
        t["META_DESCRIPTION_ABOUT"] = cfg.get("about", {}).get(
            "meta_description", f"{business_name} is locally owned in {address['city']}, {address['state']}."
        )
        t["META_DESCRIPTION_CONTACT"] = cfg.get(
            "contact_description",
            f"Get in touch with {business_name} in {address['city']}, {address['state']}."
        )

        t["JSONLD_BLOCK"] = self._jsonld(f"{domain}/")
        t["JSONLD_BLOCK_SHOP"] = self._jsonld(f"{domain}/shop.html")
        t["JSONLD_BLOCK_ABOUT"] = self._jsonld(f"{domain}/about.html")
        t["JSONLD_BLOCK_CONTACT"] = self._jsonld(f"{domain}/contact.html")

    # -- catalog ---------------------------------------------------------
    def _build_catalog(self):
        cfg = self.cfg
        catalog = cfg.get("catalog")
        self.catalog_enabled = bool(catalog and catalog.get("items") is not None or (catalog and catalog.get("categories")))
        # Explicit disable wins.
        if catalog is not None and catalog.get("enabled") is False:
            self.catalog_enabled = False
        if catalog is None:
            self.catalog_enabled = False

        catalog = catalog or {}
        self.catalog_nav_label = catalog.get("nav_label", "Shop")
        self.item_singular = catalog.get("item_singular", "item")
        self.item_plural = catalog.get("item_plural", "items")
        self.catalog_items = catalog.get("items", []) or []

        categories = catalog.get("categories")
        if not categories:
            seen = {}
            for item in self.catalog_items:
                key = (item.get("category") or "general").strip().lower().replace(" ", "-")
                if key not in seen:
                    seen[key] = key.replace("-", " ").title()
            categories = [{"key": k, "label": v} for k, v in seen.items()] or [
                {"key": "general", "label": "General"}
            ]
        self.categories = categories

        t = self.tokens
        t["DEFAULT_CATEGORY_KEY"] = categories[0]["key"] if categories else "general"

        t["CATEGORY_FILTER_BUTTONS"] = "\n".join(
            f'        <button class="filter-btn" data-filter="{c["key"]}">{c["label"]}</button>'
            for c in categories
        )
        t["CATEGORY_OPTIONS"] = "\n".join(
            f'              <option value="{c["key"]}">{c["label"]}</option>' for c in categories
        )

        lines = []
        for i, item in enumerate(self.catalog_items, start=1):
            name = item["name"]
            price = item["price"]
            category = (item.get("category") or categories[0]["key"]).strip().lower().replace(" ", "-")
            tag = item.get("tag")
            tag_js = js_str(tag) if tag else "null"
            lines.append(
                f'  {{ id: "p{i}", name: {js_str(name)}, category: {js_str(category)}, '
                f'price: {js_str(price)}, tag: {tag_js}, photoUrl: null }},'
            )
        t["FALLBACK_PRODUCTS_JS"] = "\n".join(lines)

    # -- images ------------------------------------------------------
    def _build_images(self):
        t = self.tokens
        business_name = self.cfg["business_name"]
        initials = slugify_initials(business_name)
        self.images = {
            "images/logo.svg": make_logo_svg(initials, self.colors["charcoal"], self.colors["cream"]),
            "images/hero-display.svg": make_placeholder_svg(
                1600, 1000, self.colors["charcoal"], self.colors["charcoal_soft"], self.colors["cream"],
                business_name, self.cfg.get("tagline", "")
            ),
            "images/storefront.svg": make_placeholder_svg(
                1200, 900, self.colors["accent"], self.colors["accent_dark"], self.colors["charcoal"],
                business_name
            ),
        }
        t["HERO_IMAGE"] = "images/hero-display.svg"
        t["DISPLAY_IMAGE"] = "images/hero-display.svg"
        t["STOREFRONT_IMAGE"] = "images/storefront.svg"
        t["OG_IMAGE"] = "images/storefront.svg"

    # -- shared header / footer / convenience bar --------------------
    def _build_chrome(self):
        t = self.tokens
        business_name = t["BUSINESS_NAME"]

        nav_catalog_li = (
            f'      <li><a href="shop.html">{self.catalog_nav_label}</a></li>' if self.catalog_enabled else ""
        )
        t["NAV_CATALOG_LI"] = nav_catalog_li
        footer_catalog_li = (
            f'          <li><a href="shop.html">{self.catalog_nav_label}</a></li>' if self.catalog_enabled else ""
        )

        nav_social_icons = []
        footer_social_icons = []
        if self.instagram:
            nav_social_icons.append(social_icon_link("instagram", self.instagram))
            footer_social_icons.append(social_icon_link("instagram", self.instagram))
        if self.facebook:
            nav_social_icons.append(social_icon_link("facebook", self.facebook))
            footer_social_icons.append(social_icon_link("facebook", self.facebook))
        nav_social_block = (
            f'      <div class="nav__social">\n        ' + "\n        ".join(nav_social_icons) + "\n      </div>\n"
            if nav_social_icons else ""
        )
        footer_social_block = (
            '        <div class="social-icons">\n          ' + "\n          ".join(footer_social_icons) + "\n        </div>\n"
            if footer_social_icons else ""
        )

        header = f'''<header class="site-header">
  <nav class="nav">
    <a href="index.html" class="nav__brand">
      <img src="images/logo.svg" alt="" />
      {business_name}
    </a>
    <ul class="nav__links">
      <li><a href="index.html">Home</a></li>
{nav_catalog_li}
      <li><a href="about.html">About</a></li>
      <li><a href="contact.html">Contact / Order</a></li>
    </ul>
    <div class="nav__cta">
{nav_social_block}      <a class="nav__phone" href="tel:{t['PHONE_TEL']}">{t['PHONE_DISPLAY']}</a>
      <a class="btn btn--primary btn--small" href="contact.html">{t['CTA_CONTACT_LABEL']}</a>
      <button class="nav__toggle" aria-label="Toggle menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>
</header>'''
        t["SITE_HEADER"] = header

        footer_tagline = self.cfg.get("footer_tagline", self.cfg["description"])
        footer = f'''<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="footer-brand">{business_name}</div>
        <p>{footer_tagline}</p>
{footer_social_block}      </div>
      <div class="footer-col">
        <h4>Explore</h4>
        <ul>
{footer_catalog_li}
          <li><a href="about.html">About</a></li>
          <li><a href="contact.html">Contact / Order</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Visit</h4>
        <ul>
          <li>{t['STREET']}, {t['CITY']}, {t['STATE']} {t['ZIP']}</li>
          <li><a href="tel:{t['PHONE_TEL']}">{t['PHONE_DISPLAY']}</a></li>
          <li>{t['HOURS_FOOTER_SUMMARY']}</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <span id="year"></span> {business_name}. All rights reserved.</span>
      <span>{t['CITY']}, {t['STATE_FULL']}</span>
    </div>
  </div>
</footer>'''
        t["SITE_FOOTER"] = footer

        convenience_bar = f'''<nav class="convenience-bar" aria-label="Quick actions">
  <a href="tel:{t['PHONE_TEL']}">
    <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    Call
  </a>
  <a class="convenience-bar__primary" href="contact.html">
    <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    Order
  </a>
  <a href="{t['MAPS_URL']}" target="_blank" rel="noopener">
    <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    Directions
  </a>
</nav>'''
        t["CONVENIENCE_BAR"] = convenience_bar

    # -- home page -----------------------------------------------------
    def _build_home(self):
        cfg = self.cfg
        t = self.tokens
        home = cfg.get("home") or {}
        business_name = t["BUSINESS_NAME"]
        city, state = t["CITY"], t["STATE"]

        t["HERO_EYEBROW"] = home.get("eyebrow", f"{city}, {state}")
        t["HERO_HEADLINE"] = home.get("headline", cfg["tagline"])
        t["HERO_SUBCOPY"] = home.get(
            "subcopy",
            f"{business_name} has been serving {city} — come see what's new, or get in touch and we'll take care of you."
        )

        stats = home.get("stats") or []
        if stats:
            stat_html = "\n".join(
                f'        <div class="hero__stat">\n          <strong>{s["value"]}</strong>\n          <span>{s["label"]}</span>\n        </div>'
                for s in stats
            )
            t["HERO_STATS_BLOCK"] = f'      <div class="hero__stats">\n{stat_html}\n      </div>'
        else:
            t["HERO_STATS_BLOCK"] = ""

        hero_buttons = []
        if self.catalog_enabled:
            hero_buttons.append(f'        <a class="btn btn--primary" href="shop.html">Shop {self.catalog_nav_label}</a>')
            hero_buttons.append(f'        <a class="btn btn--outline" href="contact.html">{t["CTA_CONTACT_LABEL"]}</a>')
        else:
            hero_buttons.append(f'        <a class="btn btn--primary" href="contact.html">{t["CTA_CONTACT_LABEL"]}</a>')
            hero_buttons.append('        <a class="btn btn--outline" href="about.html">Our Story</a>')
        t["HERO_BUTTONS"] = "\n".join(hero_buttons)

        if self.catalog_enabled:
            t["FEATURED_SECTION"] = f'''  <section class="section">
    <div class="container">
      <div class="section-header reveal">
        <span class="eyebrow">Fresh This Week</span>
        <h2>{self.catalog_nav_label}</h2>
        <p>A preview of what's available — see everything and inquire to order on the full {self.catalog_nav_label} page.</p>
      </div>

      <div class="grid grid--4" id="featured-products"></div>

      <div class="btn-row" style="justify-content:center; margin-top: 2.5rem;">
        <a class="btn btn--outline" href="shop.html">View All {self.catalog_nav_label}</a>
      </div>
    </div>
  </section>'''
            t["PRODUCTS_SCRIPT_TAG"] = '<script type="module" src="js/products.js"></script>'
        else:
            t["FEATURED_SECTION"] = ""
            t["PRODUCTS_SCRIPT_TAG"] = ""

        t["IMPACT_EYEBROW"] = home.get("impact_eyebrow", f"{city}")
        t["IMPACT_HEADING"] = home.get("impact_heading", f"Proud to serve the {city} community.")
        t["IMPACT_BODY"] = home.get(
            "impact_body",
            f"{business_name} is locally owned and operated — every customer gets personal attention, not a call center."
        )
        if self.catalog_enabled:
            t["IMPACT_BUTTON"] = f'        <a class="btn btn--outline" href="shop.html">Shop {self.catalog_nav_label}</a>'
        else:
            t["IMPACT_BUTTON"] = f'        <a class="btn btn--outline" href="contact.html">{t["CTA_CONTACT_LABEL"]}</a>'

        t["LOCAL_HEADING"] = home.get("local_heading", f"A {city} favorite.")
        t["LOCAL_BODY"] = home.get(
            "local_body",
            f"{business_name} has built a loyal following in {city} — the kind of place people come back to "
            f"again and again. Now it's easier than ever to reach us online, too."
        )

        # Social strip (home)
        t["SOCIAL_STRIP_SECTION"] = self._build_social_strip(is_shop=False)
        t["SOCIAL_STRIP_SECTION_SHOP"] = self._build_social_strip(is_shop=True)

        if self.instagram_post_url:
            t["INSTAGRAM_EMBED_SCRIPT"] = '<script async src="//www.instagram.com/embed.js"></script>'
        else:
            t["INSTAGRAM_EMBED_SCRIPT"] = ""

    def _build_social_strip(self, is_shop: bool) -> str:
        if not (self.instagram or self.facebook or self.others):
            return ""
        t = self.tokens
        names = []
        buttons = []
        if self.instagram:
            names.append("Instagram")
            buttons.append(f'<a class="btn btn--light" href="{self.instagram}" target="_blank" rel="noopener">Follow on Instagram</a>')
        if self.facebook:
            names.append("Facebook")
            buttons.append(f'<a class="btn btn--light" href="{self.facebook}" target="_blank" rel="noopener">Follow on Facebook</a>')
        for o in self.others:
            names.append(o.get("label", "Social"))
            buttons.append(f'<a class="btn btn--light" href="{o.get("url", "#")}" target="_blank" rel="noopener">{o.get("label", "Follow us")}</a>')

        names_joined = " and ".join([", ".join(names[:-1]), names[-1]]) if len(names) > 1 else names[0]
        buttons_html = "\n        ".join(buttons)

        if not is_shop:
            embed_block = ""
            if self.instagram_post_url:
                embed_block = f'''      <div style="max-width: 420px; margin: 0 auto;">
        <blockquote
          class="instagram-media"
          data-instgrm-permalink="{self.instagram_post_url}"
          data-instgrm-version="14"
          style="background:#FFF; border-radius:4px; margin: 0 auto; max-width:420px; width:100%;">
        </blockquote>
      </div>
'''
            return f'''  <section class="section social-strip">
    <div class="container">
      <div class="section-header reveal">
        <span class="eyebrow">Follow Along</span>
        <h2>See what's new</h2>
        <p>We post updates first on {names_joined} — follow along so you never miss one.</p>
      </div>
{embed_block}      <div class="btn-row" style="justify-content:center;">
        {buttons_html}
      </div>
    </div>
  </section>'''
        else:
            label = self.catalog_nav_label
            return f'''  <section class="section section--tight social-strip">
    <div class="container">
      <div class="section-header reveal">
        <span class="eyebrow">Can't Find It Here Yet</span>
        <h2>New {self.item_plural} post first on social</h2>
        <p>Follow along on {names_joined} to see new {self.item_plural} before they even make it onto this page.</p>
      </div>
      <div class="btn-row" style="justify-content:center;">
        {buttons_html}
      </div>
    </div>
  </section>'''

    # -- about page ------------------------------------------------------
    def _build_about(self):
        cfg = self.cfg
        t = self.tokens
        about = cfg.get("about") or {}
        business_name = t["BUSINESS_NAME"]
        city, state = t["CITY"], t["STATE"]

        t["ABOUT_SUBHEAD"] = about.get("subhead", f"Locally owned in {city}, {state}.")
        t["ABOUT_EYEBROW"] = about.get("eyebrow", f"{city}, {state}")
        t["ABOUT_HEADING"] = about.get("heading", "Our story, in progress since day one.")

        paragraphs = about.get("paragraphs") or [
            f"{business_name} is proud to serve {city} with genuine care and attention to detail.",
            "We believe in personal service and making sure every customer leaves happy.",
        ]
        t["ABOUT_PARAGRAPHS"] = "\n".join(f"        <p>{p}</p>" for p in paragraphs)

        why_cards = cfg.get("why_cards") or [
            {"title": "Personal Service", "body": "Not sure what you need? Our team is happy to help — in store or by message."},
            {"title": "Trusted Locally", "body": f"We're proud to be part of the {city} community — come see why customers keep coming back."},
            {"title": "Easy to Reach", "body": "Call, message us on social, or send an inquiry online — whatever's easiest for you."},
        ]
        t["WHY_CARDS"] = "\n".join(
            f'''        <div class="info-card reveal">
          <h3>{c["title"]}</h3>
          <p>{c["body"]}</p>
        </div>'''
            for c in why_cards
        )

    # -- shop page ---------------------------------------------------
    def _build_shop_page(self):
        t = self.tokens
        t["CATALOG_INTRO"] = self.cfg.get(
            "catalog_intro",
            f"Browse our {self.catalog_nav_label.lower()}. Don't see what you're looking for? Inquire and we'll get back to you."
        )

    # -- contact page --------------------------------------------------
    def _build_contact_extras(self):
        t = self.tokens
        dm_parts = []
        if self.instagram:
            dm_parts.append("Instagram")
        if self.facebook:
            dm_parts.append("Facebook")
        if dm_parts:
            t["SOCIAL_DM_HINT"] = " or message us on " + " or ".join(dm_parts)
        else:
            t["SOCIAL_DM_HINT"] = ""

        if self.instagram or self.facebook or self.others:
            btn_parts = []
            if self.instagram:
                btn_parts.append(f'<a class="btn btn--outline btn--small" href="{self.instagram}" target="_blank" rel="noopener">Instagram DM</a>')
            if self.facebook:
                btn_parts.append(f'<a class="btn btn--outline btn--small" href="{self.facebook}" target="_blank" rel="noopener">Facebook Message</a>')
            for o in self.others:
                btn_parts.append(f'<a class="btn btn--outline btn--small" href="{o.get("url","#")}" target="_blank" rel="noopener">{o.get("label","Message Us")}</a>')
            t["CONTACT_SOCIAL_CARD"] = f'''        <div class="info-card reveal">
          <h3>💬 Message Us</h3>
          <p>Send us a message on social — it's how most of our regulars get in touch.</p>
          <div class="btn-row">
            {"".join(btn_parts)}
          </div>
        </div>
'''
        else:
            t["CONTACT_SOCIAL_CARD"] = ""

    # -- 404 page ------------------------------------------------------
    def _build_404_extras(self):
        t = self.tokens
        if self.catalog_enabled:
            t["CATALOG_NAV_LABEL_OR_HOME"] = self.catalog_nav_label
            t["FOUROFOUR_SECONDARY_BTN"] = f'        <a class="btn btn--outline" href="shop.html">Shop {self.catalog_nav_label}</a>'
        else:
            t["CATALOG_NAV_LABEL_OR_HOME"] = "our Contact page"
            t["FOUROFOUR_SECONDARY_BTN"] = '        <a class="btn btn--outline" href="contact.html">Contact Us</a>'

    # -- JSON-LD ---------------------------------------------------------
    def _jsonld(self, url: str) -> str:
        t = self.tokens
        same_as = []
        if self.instagram:
            same_as.append(self.instagram)
        if self.facebook:
            same_as.append(self.facebook)
        for o in self.others:
            if o.get("url"):
                same_as.append(o["url"])
        same_as_json = ",\n    ".join(f'"{u}"' for u in same_as)
        same_as_block = f',\n  "sameAs": [\n    {same_as_json}\n  ]' if same_as else ""
        hours_block = f',\n  "openingHoursSpecification": [\n{self._hours_jsonld}\n  ]' if self._hours_jsonld else ""
        return f'''{{
  "@context": "https://schema.org",
  "@type": "{t['SCHEMA_TYPE']}",
  "name": "{t['BUSINESS_NAME']}",
  "image": "{t['DOMAIN']}/{t['OG_IMAGE']}",
  "telephone": "{t['PHONE_TEL']}",
  "priceRange": "{t['PRICE_RANGE']}",
  "address": {{
    "@type": "PostalAddress",
    "streetAddress": "{t['STREET']}",
    "addressLocality": "{t['CITY']}",
    "addressRegion": "{t['STATE']}",
    "postalCode": "{t['ZIP']}",
    "addressCountry": "{self.cfg["address"].get("country", "US")}"
  }}{hours_block}{same_as_block},
  "url": "{url}"
}}'''

    # -- sitemap -----------------------------------------------------
    def sitemap_urls(self) -> list:
        domain = self.tokens["DOMAIN"]
        urls = [f"{domain}/", f"{domain}/about.html", f"{domain}/contact.html"]
        if self.catalog_enabled:
            urls.insert(1, f"{domain}/shop.html")
        return urls


# --------------------------------------------------------------------------
# Template rendering
# --------------------------------------------------------------------------

def render_template(text: str, tokens: dict, template_name: str) -> str:
    def repl(m):
        key = m.group(1)
        if key not in tokens:
            raise ConfigError(
                f"Internal template error: token @@{key}@@ in {template_name} has no value. "
                f"This is a bug in generate_site.py / the templates, not your config — please report it."
            )
        return str(tokens[key])
    return TOKEN_RE.sub(repl, text)


PASSTHROUGH_FILES = [
    "firebase/firestore.rules",
    "firebase/storage.rules",
    "firebase.json",
]


def generate(cfg: dict, out_dir: Path, force: bool) -> SiteBuilder:
    builder = SiteBuilder(cfg)
    tokens = builder.tokens

    if out_dir.exists():
        if not force:
            raise ConfigError(
                f"Output directory already exists: {out_dir}\n"
                f"  Pass --force to overwrite, or choose a different --out path."
            )
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    # Template-driven text files (token substitution).
    templated_files = [
        "index.html", "shop.html", "about.html", "contact.html", "admin.html", "404.html",
        "css/style.css", "css/admin.css",
        "js/script.js", "js/products.js", "js/contact.js", "js/admin.js", "js/firebase-config.js", "js/firebase-init.js",
        ".firebaserc", ".github/workflows/firebase-deploy.yml",
        "robots.txt", "sitemap.xml",
    ]
    if not builder.catalog_enabled:
        templated_files.remove("shop.html")

    sitemap_urls = builder.sitemap_urls()
    tokens["SITEMAP_URLS"] = "\n".join(f"  <url><loc>{u}</loc></url>" for u in sitemap_urls)

    for rel in templated_files:
        src = TEMPLATES_DIR / rel
        dest = out_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        text = src.read_text(encoding="utf-8")
        rendered = render_template(text, tokens, rel)
        dest.write_text(rendered, encoding="utf-8")

    # Verbatim passthrough files (no business-specific content).
    for rel in PASSTHROUGH_FILES:
        src = TEMPLATES_DIR / rel
        dest = out_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)

    # README (also templated).
    readme_src = TEMPLATES_DIR / "README.md.tmpl"
    readme_text = readme_src.read_text(encoding="utf-8")
    if builder.catalog_enabled:
        tokens["README_SHOP_LINE"] = f"- `shop.html` — {builder.catalog_nav_label} gallery (filterable by category)"
        tokens["README_PRODUCTS_JS_LINE"] = "- `js/products.js` — loads items (live from Firebase once configured, otherwise a small built-in demo list)"
    else:
        tokens["README_SHOP_LINE"] = ""
        tokens["README_PRODUCTS_JS_LINE"] = ""
    tokens["CATALOG_ITEM_PLURAL_LOWER"] = builder.item_plural.lower()
    social_lines = []
    if builder.instagram:
        social_lines.append(f"- Instagram: {builder.instagram}")
    if builder.facebook:
        social_lines.append(f"- Facebook: {builder.facebook}")
    for o in builder.others:
        social_lines.append(f"- {o.get('label', 'Social')}: {o.get('url', '')}")
    tokens["README_SOCIAL_LINES"] = "\n".join(social_lines)
    (out_dir / "README.md").write_text(render_template(readme_text, tokens, "README.md.tmpl"), encoding="utf-8")

    # Generated placeholder images.
    for rel, svg in builder.images.items():
        dest = out_dir / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(svg, encoding="utf-8")

    return builder


# --------------------------------------------------------------------------
# Self-check: make sure no template leftovers survived
# --------------------------------------------------------------------------

def self_check(out_dir: Path, cfg: dict) -> list:
    warnings = []

    # 1. Any un-substituted @@TOKEN@@ markers left in output?
    for path in out_dir.rglob("*"):
        if path.is_file() and path.suffix in (".html", ".css", ".js", ".json", ".xml", ".txt", ".md", ".yml", ".svg"):
            text = path.read_text(encoding="utf-8", errors="replace")
            leftover = TOKEN_RE.findall(text)
            if leftover:
                warnings.append(
                    f"{path.relative_to(out_dir)}: unfilled template token(s): "
                    + ", ".join(sorted(set(leftover)))
                )

    # 2. Old template business identity leaking through, unless the new
    #    config genuinely reuses that term itself. Compare against both the
    #    raw config text (for things like "Enumclaw") and a digits-only
    #    version of the phone number (since the phone leakage terms are
    #    digit sequences, but the config stores punctuated phone numbers).
    cfg_text = json.dumps(cfg).lower()
    cfg_phone_digits = digits_only(str(cfg.get("phone", "")))
    for term in LEAKAGE_TERMS:
        if term in cfg_text or (term.isdigit() and cfg_phone_digits and term in cfg_phone_digits):
            continue  # the business itself legitimately uses this term
        for path in out_dir.rglob("*"):
            if path.is_file() and path.suffix in (".html", ".css", ".js", ".json", ".xml", ".txt", ".md", ".yml"):
                text = path.read_text(encoding="utf-8", errors="replace").lower()
                if term in text:
                    warnings.append(f"{path.relative_to(out_dir)}: contains leftover template text \"{term}\"")

    # 3. Security wiring sanity check — the admin dashboard, the security
    #    rules, and this generator's templates must all agree on the
    #    "isAdmin" allowlist model, or a generated site could ship with a
    #    dashboard that silently fails every write (stale admin.js) or,
    #    worse, rules that don't actually gate writes (stale rules).
    #    This exists so a future template/source desync (like the one this
    #    generator was built to survive once already) gets caught here
    #    instead of shipping to a client.
    firestore_rules = out_dir / "firebase" / "storage.rules"
    rules_path = out_dir / "firebase" / "firestore.rules"
    admin_js_path = out_dir / "js" / "admin.js"

    if rules_path.exists():
        rules_text = rules_path.read_text(encoding="utf-8")
        missing_rules_bits = [
            needle for needle in ("isAdmin", "isAdminEmail", "admins/")
            if needle not in rules_text
        ]
        if missing_rules_bits:
            warnings.append(
                "firebase/firestore.rules: doesn't reference the expected admin allowlist "
                f"({', '.join(missing_rules_bits)}) — this generator's admin.js expects that "
                "security model. If firestore.rules was updated upstream, re-sync "
                "tools/templates/firebase/firestore.rules."
            )
    else:
        warnings.append("firebase/firestore.rules is missing from the generated output.")

    if admin_js_path.exists():
        admin_js_text = admin_js_path.read_text(encoding="utf-8")
        # The dashboard asks the rules whether it may read adminProfile/{uid}
        # rather than checking an allowlist itself, so these needles track
        # that call — not the `admins` document lookup the check originally
        # looked for, which the dashboard no longer performs.
        missing_admin_js_bits = [
            needle for needle in ("checkAdminAccess", 'doc(db, "adminProfile"',
                                  "permission-denied", "denied")
            if needle not in admin_js_text
        ]
        if missing_admin_js_bits:
            warnings.append(
                "js/admin.js: missing expected admin-allowlist verification logic "
                f"({', '.join(missing_admin_js_bits)}) — the dashboard may render for anyone who "
                "can log in even though the security rules will reject their writes. Re-sync "
                "tools/templates/js/admin.js with the current js/admin.js."
            )
    else:
        warnings.append("js/admin.js is missing from the generated output.")

    if firestore_rules.exists():
        storage_rules_text = firestore_rules.read_text(encoding="utf-8")
        if "firestore.exists" not in storage_rules_text and "isAdmin" not in storage_rules_text:
            warnings.append(
                "firebase/storage.rules: doesn't appear to check Firestore admin membership before "
                "allowing uploads — re-sync tools/templates/firebase/storage.rules."
            )

    return warnings


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def main(argv=None):
    parser = argparse.ArgumentParser(description="Generate a business website from the shared template.")
    parser.add_argument("--config", required=True, help="Path to a business config JSON file.")
    parser.add_argument("--out", required=True, help="Output directory for the generated site.")
    parser.add_argument("--force", action="store_true", help="Overwrite --out if it already exists.")
    args = parser.parse_args(argv)

    config_path = Path(args.config).resolve()
    out_dir = Path(args.out).resolve()

    try:
        cfg = load_config(config_path)
        cfg["_config_basename"] = config_path.name
        validate_config(cfg)
        builder = generate(cfg, out_dir, args.force)
    except ConfigError as e:
        print(f"\nCould not generate site:\n  {e}\n", file=sys.stderr)
        return 1

    warnings = self_check(out_dir, cfg)

    print(f"\nGenerated \"{cfg['business_name']}\" website at: {out_dir}\n")
    print("Next steps:")
    print(f"  1. cd {out_dir}")
    print("  2. Preview it locally:  python3 -m http.server 8000   (then open http://localhost:8000)")
    print("  3. Swap the generated placeholder images in images/ for real photos when you have them.")
    print("  4. Set up Firebase (see README.md → \"Free Backend Setup\") and fill in js/firebase-config.js.")
    print("  5. Replace \"YOUR_FIREBASE_PROJECT_ID\" in .firebaserc with the real Firebase project ID.")
    print("  6. Deploy: firebase deploy --only hosting  (or push to trigger the GitHub Actions workflow).")

    if not builder.catalog_enabled:
        print("\nNote: no catalog was configured, so shop.html was not generated and nav/footer links to it were omitted.")

    if warnings:
        print(f"\n⚠️  Self-check found {len(warnings)} issue(s) that should be reviewed before shipping this site:")
        for w in warnings:
            print(f"  - {w}")
        print()
        return 2

    print("\nSelf-check passed: no leftover template tokens or old template business info found.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
