#!/usr/bin/env python3
"""Build the SPARKXHR marketing website.

Edit site-wide settings in CONFIG, page bodies in src/pages/, and the
shared call-to-action band in src/partials/cta.html. Then run:

    python3 build.py

The finished pages are written next to this script (index.html, etc.).

Macros available in page sources:
    [[btn VARIANT SIZE "Label" href icon]]   VARIANT: primary | secondary | gold | ghost
                                              SIZE: lg | sm
    [[kicker icon "Label"]]                  small gold section label (light backgrounds)
    [[kicker-dark icon "Label"]]             same, for navy backgrounds
    [[arrow]] / [[arrow-dark]]               round arrow used on clickable cards
Tokens: {{PULSE_URL}}, {{CTA}}, {{SOCIAL_ICONS}}, {{EMAIL_ROWS}},
        {{CALENDAR_BLOCK}}, {{FORM_ATTRS}}
"""
import html
import pathlib
import re
import shlex

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"

# --------------------------------------------------------------------------
# Site-wide settings. Fill the empty values before launch.
# --------------------------------------------------------------------------
CONFIG = {
    # Where "Take the Pulse Check" buttons go. pulse-check.html is the
    # rules-based demo; switch to the live SPARKXHR Diagnostic Tool when it ships.
    "PULSE_URL": "pulse-check.html",
    # Google Calendar appointment page or Calendly link, embedded on Contact.
    "CALENDAR_URL": "",
    # Form endpoint (e.g. Formspree, Basin, or the platform API). Empty = preview mode.
    "FORM_ACTION": "",
    # Public contact email. Empty = email rows are hidden.
    "EMAIL": "",
    # Official SPARKXHR social-media channels: (label, lucide icon, url).
    "SOCIAL": [
        ("LinkedIn", "linkedin", ""),
        ("Facebook", "facebook", ""),
        ("Instagram", "instagram", ""),
        ("YouTube", "youtube", ""),
    ],
}

PAGES = [
    ("index.html", "home",
     "SPARKXHR · The people engine for growth",
     "AI-powered HR for growing companies in the Philippines and Southeast Asia. "
     "33 years of Group CHRO judgment, five SPARK pillars, and AI toolkits."),
    ("spark.html", "spark",
     "SPARK Pillars and Toolkits · SPARKXHR",
     "Select, Perform, Accelerate, Reward, Kindle: the five SPARK pillars and every "
     "toolkit that comes with them."),
    ("who-we-work-with.html", "who",
     "Who We Work With · SPARKXHR",
     "SPARKXHR is built for growth-stage CEOs, HR heads, and family and PE-backed "
     "companies that have outgrown DIY HR."),
    ("pricing.html", "pricing",
     "Investment Tiers · SPARKXHR",
     "From a free Pulse Check to a full five-pillar transformation, priced for the "
     "business you are actually running."),
    ("about.html", "about",
     "About Fides Tanay · SPARKXHR",
     "Fides Tanay brings more than 33 years of Group CHRO and SVP experience to "
     "growing companies, applied directly."),
    ("contact.html", "contact",
     "Contact and Book a Call · SPARKXHR",
     "Book a 30-minute call with Fides Tanay or send a message about SPARKXHR."),
]

NAV = [
    ("spark.html", "spark", "SPARK Pillars"),
    ("who-we-work-with.html", "who", "Who We Work With"),
    ("pricing.html", "pricing", "Investment"),
    ("about.html", "about", "About Fides"),
    ("contact.html", "contact", "Contact"),
]

# --------------------------------------------------------------------------
# Shared chrome
# --------------------------------------------------------------------------
TAILWIND_CONFIG = """
tailwind.config = {
  theme: {
    extend: {
      colors: {
        navy: {50:'#F3F5FB',100:'#E4E8F4',200:'#C8CFE7',300:'#9EA9D2',400:'#6F7DB7',500:'#4B5A9B',600:'#36448A',700:'#2A3778',800:'#1B2559',900:'#141B45',950:'#0B1030'},
        gold: {50:'#FCF8EE',100:'#F8EDD2',200:'#F1DBA3',300:'#E8C567',400:'#DDB14A',500:'#D4A53A',600:'#B8892E',700:'#8F6A1E',800:'#6F5217',900:'#4F3A10'},
        cream: '#F7F4EC'
      },
      fontFamily: {
        sans: ['Inter','ui-sans-serif','system-ui','-apple-system','BlinkMacSystemFont','"Segoe UI"','sans-serif']
      }
    }
  }
};
"""

LOGO = """<span class="relative h-8 w-8 shrink-0" aria-hidden="true">
  <span class="absolute left-0 top-0 h-2.5 w-2.5 rounded bg-navy-800"></span>
  <span class="absolute right-0 top-0 h-2.5 w-2.5 rounded bg-navy-800"></span>
  <span class="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded bg-gold-500"></span>
  <span class="absolute bottom-0 left-0 h-2.5 w-2.5 rounded bg-navy-800"></span>
  <span class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded bg-navy-800"></span>
</span>
<span class="text-2xl font-semibold tracking-[-0.045em] text-navy-900 sm:text-[1.7rem]">SPARK<span class="text-gold-600">X</span>HR</span>"""


def head(title, description):
    t, d = html.escape(title), html.escape(description)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{t}</title>
<meta name="description" content="{d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SPARKXHR">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta name="theme-color" content="#1B2559">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<script>
  document.documentElement.classList.add('js');
  setTimeout(function () {{ if (!window.__sparkReady) document.documentElement.classList.add('no-anim'); }}, 2500);
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com/3.4.16"></script>
<script>{TAILWIND_CONFIG}</script>
<link rel="stylesheet" href="assets/site.css">
</head>
<body class="min-h-screen bg-white text-slate-950 antialiased">
<a href="#main" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
"""


def header(active):
    links = []
    mobile = []
    for href, key, label in NAV:
        cur = ' aria-current="page"' if key == active else ""
        links.append(f'<a href="{href}" class="nav-link transition hover:text-gold-700"{cur}>{label}</a>')
        mobile.append(f'<a href="{href}" class="py-4 text-base font-medium text-navy-900"{cur}>{label}</a>')
    return f"""<header class="relative z-30 bg-white">
  <div class="frame"><div class="frame-inner">
    <div class="flex items-center justify-between border-b border-slate-200/80 px-4 py-6 sm:px-8 lg:px-12 lg:py-7 xl:px-16">
      <a href="index.html" class="flex items-center gap-3.5" aria-label="SPARKXHR home">{LOGO}</a>
      <nav class="hidden items-center gap-9 text-sm font-medium text-navy-900 xl:flex" aria-label="Main">
        {''.join(links)}
      </nav>
      <div class="flex items-center gap-3">
        <span class="hidden sm:inline-flex">[[btn primary sm "Free Pulse Check" {{{{PULSE_URL}}}} arrow-up-right]]</span>
        <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-navy-900 shadow-sm xl:hidden" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav" data-nav-toggle>
          <span data-icon-open><i data-lucide="menu" class="h-5 w-5"></i></span>
          <span data-icon-close hidden><i data-lucide="x" class="h-5 w-5"></i></span>
        </button>
      </div>
    </div>
    <span class="cross cross-bl"></span><span class="cross cross-br"></span>
  </div></div>
  <div id="mobile-nav" class="xl:hidden" hidden>
    <div class="frame"><div class="frame-inner border-b border-slate-200/80 px-4 pb-6 sm:px-8">
      <nav class="flex flex-col divide-y divide-slate-100" aria-label="Mobile">{''.join(mobile)}</nav>
      <div class="mt-4">[[btn primary lg "Take the free Pulse Check" {{{{PULSE_URL}}}} arrow-up-right]]</div>
    </div></div>
  </div>
</header>
"""


def social_icons():
    out = []
    for label, icon, url in CONFIG["SOCIAL"]:
        attrs = f'href="{html.escape(url)}" target="_blank" rel="noopener"' if url else 'href="#" data-todo="social-url"'
        out.append(
            f'<a {attrs} class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white '
            f'text-navy-800 transition hover:-translate-y-0.5 hover:border-gold-300 hover:text-gold-700" '
            f'aria-label="SPARKXHR on {label}"><i data-lucide="{icon}" class="h-[18px] w-[18px]"></i></a>'
        )
    return '<div class="flex flex-wrap gap-2.5">' + "".join(out) + "</div>"


def email_rows():
    e = CONFIG["EMAIL"]
    if not e:
        return ""
    e = html.escape(e)
    return (f'<a href="mailto:{e}" class="flex items-center gap-3 text-sm font-medium text-navy-900 hover:text-gold-700">'
            f'<i data-lucide="mail" class="h-4 w-4 text-gold-600"></i>{e}</a>')


def calendar_block():
    url = CONFIG["CALENDAR_URL"]
    if url:
        return (f'<iframe src="{html.escape(url)}" title="Book a 30-minute call with Fides Tanay" '
                f'class="h-[680px] w-full rounded-2xl border-0 bg-white" loading="lazy"></iframe>')
    return """<div class="flex h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-gold-300 bg-gold-50/50 p-8 text-center">
  <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gold-700 shadow-sm ring-1 ring-gold-100"><i data-lucide="calendar-days" class="h-6 w-6"></i></span>
  <p class="mt-5 text-base font-semibold text-navy-900">Live booking calendar</p>
  <p class="mt-2 max-w-[320px] text-sm leading-6 text-slate-500">Fides's Google Calendar or Calendly booking page appears here once it is connected. Until then, send a message and we will propose times.</p>
</div>"""


def form_attrs():
    url = CONFIG["FORM_ACTION"]
    return f'action="{html.escape(url)}" method="POST"' if url else 'data-preview'


def footer():
    email = CONFIG["EMAIL"]
    email_li = (f'<li><a href="mailto:{html.escape(email)}" class="transition hover:text-gold-700">{html.escape(email)}</a></li>'
                if email else "")
    return f"""<footer class="relative bg-white">
  <div class="frame"><div class="frame-inner border-t border-slate-200/80">
    <div class="grid gap-12 px-6 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-12 lg:py-16 xl:px-16">
      <div class="max-w-sm">
        <a href="index.html" class="flex items-center gap-3.5" aria-label="SPARKXHR home">{LOGO}</a>
        <p class="mt-5 text-sm leading-6 text-slate-500">The people engine for growth. A Group CHRO's judgment in tools and sprints, priced for the business you are actually running.</p>
        <div class="mt-6">{{{{SOCIAL_ICONS}}}}</div>
      </div>
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-navy-900">SPARK</p>
        <ul class="mt-5 space-y-3 text-sm text-slate-500">
          <li><a href="{{{{PULSE_URL}}}}" class="transition hover:text-gold-700">Free Pulse Check</a></li>
          <li><a href="spark.html" class="transition hover:text-gold-700">The five pillars</a></li>
          <li><a href="spark.html#toolkits" class="transition hover:text-gold-700">Toolkits</a></li>
          <li><a href="pricing.html" class="transition hover:text-gold-700">Investment tiers</a></li>
        </ul>
      </div>
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-navy-900">Company</p>
        <ul class="mt-5 space-y-3 text-sm text-slate-500">
          <li><a href="about.html" class="transition hover:text-gold-700">About Fides</a></li>
          <li><a href="who-we-work-with.html" class="transition hover:text-gold-700">Who we work with</a></li>
          <li><a href="contact.html" class="transition hover:text-gold-700">Contact</a></li>
          <li><a href="contact.html#privacy" class="transition hover:text-gold-700">Privacy notice</a></li>
        </ul>
      </div>
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.14em] text-navy-900">Talk to us</p>
        <ul class="mt-5 space-y-3 text-sm text-slate-500">
          <li><a href="contact.html#book" class="transition hover:text-gold-700">Book a 30-minute call</a></li>
          {email_li}
          <li>Metro Manila, Philippines</li>
        </ul>
      </div>
    </div>
    <div class="flex flex-col gap-3 border-t border-slate-200/80 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 xl:px-16">
      <p>&copy; <span data-year>2026</span> Faith &amp; Possibilities HR Consulting. SPARKXHR is a Faith &amp; Possibilities platform.</p>
      <p>Personal data is handled under the Data Privacy Act of 2012 (RA 10173).</p>
    </div>
  </div></div>
</footer>
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
<script src="assets/site.js"></script>
</body>
</html>
"""


# --------------------------------------------------------------------------
# Macros
# --------------------------------------------------------------------------
def m_btn(variant, size, label, href, icon):
    full = " w-full sm:w-auto" if size == "lg" else ""
    ext = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
    return (f'<a href="{href}" class="btn btn-{variant} btn-{size}{full}"{ext}>'
            f'<span class="btn-sheen"></span><span class="btn-glow"></span>'
            f'<span class="btn-label">{label}</span>'
            f'<span class="btn-tile"><i data-lucide="{icon}"></i></span></a>')


def m_kicker(icon, label, dark=False):
    if dark:
        return (f'<div class="mb-6 inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.08em] text-gold-300" data-reveal>'
                f'<span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">'
                f'<i data-lucide="{icon}" class="h-[18px] w-[18px]"></i></span>{label}</div>')
    return (f'<div class="mb-6 inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.08em] text-gold-700" data-reveal>'
            f'<span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold-50 ring-1 ring-gold-100">'
            f'<i data-lucide="{icon}" class="h-[18px] w-[18px]"></i></span>{label}</div>')


ARROW = ('<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 '
         'transition duration-300 group-hover:bg-navy-800 group-hover:text-white group-hover:shadow-[0_12px_26px_rgba(27,37,89,0.22)]">'
         '<i data-lucide="arrow-right" class="h-4 w-4"></i></span>')
ARROW_DARK = ('<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 '
              'transition duration-300 group-hover:bg-gold-400 group-hover:text-navy-900">'
              '<i data-lucide="arrow-right" class="h-4 w-4"></i></span>')


def expand_macros(text):
    def repl(m):
        args = shlex.split(m.group(1))
        name, rest = args[0], args[1:]
        if name == "btn":
            return m_btn(*rest)
        if name == "kicker":
            return m_kicker(*rest)
        if name == "kicker-dark":
            return m_kicker(*rest, dark=True)
        if name == "arrow":
            return ARROW
        if name == "arrow-dark":
            return ARROW_DARK
        raise ValueError(f"Unknown macro: {m.group(0)}")
    return re.sub(r"\[\[(.+?)\]\]", repl, text)


def expand_tokens(text, tokens):
    def repl(m):
        key = m.group(1)
        if key not in tokens:
            raise KeyError(f"Unknown token {{{{{key}}}}}")
        return tokens[key]
    # Run twice so tokens inside partials (e.g. the CTA) are resolved too.
    for _ in range(2):
        text = re.sub(r"\{\{([A-Z_]+)\}\}", repl, text)
    return text


def build():
    tokens = {
        "PULSE_URL": html.escape(CONFIG["PULSE_URL"]),
        "CTA": (SRC / "partials" / "cta.html").read_text(encoding="utf-8"),
        "SOCIAL_ICONS": social_icons(),
        "EMAIL_ROWS": email_rows(),
        "CALENDAR_BLOCK": calendar_block(),
        "FORM_ATTRS": form_attrs(),
    }
    for filename, key, title, desc in PAGES:
        src_file = SRC / "pages" / filename
        if not src_file.exists():
            print(f"skip  {filename} (no source yet)")
            continue
        body = src_file.read_text(encoding="utf-8")
        page = head(title, desc) + header(key) + '<main id="main" class="relative overflow-hidden">\n' + body + "\n</main>\n" + footer()
        page = expand_macros(expand_tokens(page, tokens))
        (ROOT / filename).write_text(page, encoding="utf-8")
        print(f"built {filename}")

    todo = []
    if CONFIG["PULSE_URL"] == "pulse-check.html":
        todo.append("PULSE_URL points at the Pulse Check demo; switch to the live Diagnostic Tool at launch")
    for k in ("CALENDAR_URL", "FORM_ACTION", "EMAIL"):
        if not CONFIG[k]:
            todo.append(f"{k} is empty")
    missing = [label for label, _, url in CONFIG["SOCIAL"] if not url]
    if missing:
        todo.append("social URLs missing: " + ", ".join(missing))
    for t in todo:
        print("TODO:", t)


if __name__ == "__main__":
    build()
