# SPARKXHR

SPARKXHR is the AI-enabled HR platform of Faith & Possibilities HR Consulting, built on the five SPARK pillars: Select, Perform, Accelerate, Reward, and Kindle.

| Folder | What it is |
|---|---|
| [`website/`](website/README.md) | Six-page marketing website: Home, SPARK Pillars, Who We Work With, Investment, About Fides, Contact |
| [`toolkit/`](toolkit/README.md) | AI Toolkit Generator for the SELECT and PERFORM pillars (draft) |

## Website

Static HTML built from `website/src/` by a small Python script.

```
cd website
python3 build.py
```

Open `website/index.html`, or deploy the `website/` folder to any static host. Site settings (Pulse Check link, booking calendar, form endpoint, email, social links) are at the top of `website/build.py`.

## Toolkit

Node server and browser app. Claude drafts SPARK documents from Fides's templates.

```
cd toolkit
npm install
npm run preview                           # sample drafts, no API key needed
ANTHROPIC_API_KEY=sk-ant-... npm start    # live AI drafting
```

Then open http://127.0.0.1:5180. See [`toolkit/README.md`](toolkit/README.md) for settings and limits. Never commit an API key.
