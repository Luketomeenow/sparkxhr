# SPARKXHR website

Six-page marketing site for SPARKXHR, built on the Fluxa layout in the navy and gold brand palette.

| Page | File |
|---|---|
| Home | `index.html` |
| SPARK Pillars and Toolkits | `spark.html` |
| Who We Work With | `who-we-work-with.html` |
| Investment Tiers | `pricing.html` |
| About Fides | `about.html` |
| Contact, booking, privacy notice | `contact.html` |

## Editing

Do not edit the `.html` files in this folder directly; they are generated.

- Page content lives in `src/pages/`.
- The shared call-to-action band lives in `src/partials/cta.html`.
- Header, footer, navigation, and site settings live in `build.py`.
- Custom styles are in `assets/site.css`; behaviour is in `assets/site.js`.

Rebuild after any change:

```
python3 build.py
```

The build prints a `TODO` line for every setting that still needs a value.

## Settings to fill before launch (`CONFIG` in build.py)

- `PULSE_URL`: currently the local Pulse Check demo. Point it at the live Diagnostic Tool.
- `CALENDAR_URL`: Google Calendar appointment page or Calendly link for the booking embed.
- `FORM_ACTION`: form endpoint for the contact form. While empty, the form runs in preview mode.
- `EMAIL`: public contact email. Hidden while empty.
- `SOCIAL`: URLs for the official LinkedIn, Facebook, Instagram, and YouTube channels.

## Before going live

- Replace the Tailwind CDN script with a compiled stylesheet. The CDN is for development and prints a console warning in production.
- Add Fides's photo in place of the FT monogram on the home and About pages.
- Confirm the research sources for the three statistics on the home page.
