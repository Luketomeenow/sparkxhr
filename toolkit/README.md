# SPARKXHR Toolkit: SELECT and PERFORM (draft)

The AI Toolkit Generator for the SELECT and PERFORM pillars. Fides or her team pick a client, pick a template, check the inputs, and Claude drafts the document in the SPARK voice. The draft streams in, can be edited in place, saved as a version, and exported to Word or PDF.

| Pillar | Templates | Contract milestone |
|---|---|---|
| SELECT | Job Description, Job Ad, Interview Guide, 90-Day New Hire Success Check | Milestone 1 |
| PERFORM | Performance Scorecard, Goal-Setting Sheet | Milestone 2 |

## Run it

```
npm install
npm run preview                               # no API key: plays the sample drafts
ANTHROPIC_API_KEY=sk-ant-... npm start        # live AI drafting
```

Then open http://127.0.0.1:5180.

The badge in the top bar shows **Preview mode** or **Live AI**. Preview mode plays the pre-written sample drafts for the fictional client Bayanihan Foods, whatever the inputs say, so Fides can see the flow before a key is set up.

| Setting | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Turns on live drafting |
| `SPARK_MODE` | auto | Force `live` or `preview` |
| `SPARK_MODEL` | `claude-opus-5` | Claude model used for drafts |
| `SPARK_EFFORT` | `medium` | Thinking effort; `high` for more careful drafts, slower |
| `PORT`, `HOST` | `5180`, `127.0.0.1` | Server address |

## Where Fides's voice lives

- `prompts/voice.md`: the drafting guide. Voice, the SPARK framework, Philippine employment rules, and the rule that the AI never invents facts.
- `templates/select/*.md`, `templates/perform/*.md`: one spec per document, with its sections, order, and length.
- `templates/templates.json`: the input fields for each template, and the sample client.

Edits to these files apply to the next draft without a restart. Fides's review corrections belong here.

## Review pack

`samples/*.md` holds one sample draft per template. To rebuild the review PDF after editing them:

```
npm run review-pack
```

The PDF is written to the client folder as `SPARKXHR_Select_and_Perform_Drafts_for_Review.pdf`.

## How the AI call works

- One request per draft to Claude Opus 5, streamed, through the beta Messages API.
- `fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta: if the model declines, the API retries on Anthropic's recommended backup model and the draft restarts cleanly in the browser.
- The system prompt, the voice guide plus all six templates, is identical on every request, so it is cached. Only the client profile and inputs change.
- Rough cost at current list prices: under US$0.10 per draft, which is well inside the care plan's allowance of 150 documents a month.

## What this draft does not do yet

- **No logins.** The server only listens on this computer. Do not expose it to the internet until team logins are added.
- **Clients and saved versions live in the browser**, per computer. The production build moves them to the cloud database so the team shares them.
- **Client portal release** of approved documents comes with the portal in Milestone 3.
