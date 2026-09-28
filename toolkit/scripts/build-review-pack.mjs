// Builds the SELECT and PERFORM review pack: every sample draft in one A4 PDF,
// with a cover, review instructions, and a feedback sheet for Fides.
//   npm run review-pack [-- output.pdf]
// Regenerate after editing samples/*.md (or after replacing them with live AI drafts).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { chromium } from 'playwright';
import { allTemplates, loadManifest } from '../lib/prompt.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'SPARKXHR_Select_and_Perform_Drafts_for_Review.pdf'));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
marked.use({ gfm: true, breaks: true, renderer: { html(token) { return esc(token.text); } } });

const manifest = await loadManifest(ROOT);
const templates = allTemplates(manifest);
const profile = manifest.sampleProfile;
const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const drafts = [];
for (const t of templates) {
  const md = await fs.readFile(path.join(ROOT, 'samples', `${t.id}.md`), 'utf8');
  drafts.push({ t, html: marked.parse(md).replace(/<h2>Review notes<\/h2>\s*<ul>/, '<h2>Review notes</h2><ul class="review-notes">') });
}

const rows = templates.map((t, i) => `<tr><td>${i + 1}</td><td><b>${esc(t.pillarName)}</b></td><td>${esc(t.name)}</td><td>${esc(t.description)}</td></tr>`).join('');
const feedback = templates.map((t) => `
  <div class="fb">
    <h3>${esc(t.pillarName)} · ${esc(t.name)}</h3>
    <table class="fbt">
      <tr><th>Question</th><th style="width:16%">Yes</th><th style="width:16%">No</th></tr>
      <tr><td>Does it sound like you?</td><td></td><td></td></tr>
      <tr><td>Are the sections and their order right?</td><td></td><td></td></tr>
      <tr><td>Is anything missing that every client needs?</td><td></td><td></td></tr>
    </table>
    <p class="lines">Tone corrections and wording you always use:</p>
    <div class="ruled"></div><div class="ruled"></div><div class="ruled"></div>
  </div>`).join('');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm 18mm 20mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1f2937; font-size: 9.8pt; line-height: 1.5; }
  .page { break-after: page; }
  .cover { padding-top: 38mm; }
  .how p, .how li { font-size: 9.6pt; } .how table { font-size: 8.6pt; } .how td { padding: 4px 7px; } .how h2.sec { font-size: 14pt; }
  .kicker { font-size: 8pt; letter-spacing: .26em; text-transform: uppercase; color: #8F6A1E; font-weight: 700; }
  .cover h1 { font-size: 30pt; line-height: 1.1; letter-spacing: -0.03em; color: #141B45; margin: 10px 0 12px; }
  .cover .sub { font-size: 12.5pt; color: #4E5678; max-width: 140mm; }
  .mark { display: inline-grid; grid-template-columns: repeat(3, 9px); gap: 3px; margin-bottom: 18px; }
  .mark i { width: 9px; height: 9px; border-radius: 2px; background: #1B2559; }
  .mark i.x { background: transparent; } .mark i.g { background: #D4A53A; }
  .meta { margin-top: 28mm; border-top: 2px solid #EBD9A8; padding-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; font-size: 9.5pt; }
  .meta b { display: block; color: #141B45; font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; }
  h2.sec { font-size: 16pt; color: #141B45; letter-spacing: -0.02em; margin: 0 0 8px; }
  .how ol { padding-left: 18px; } .how li { margin-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0 14px; font-size: 9.2pt; }
  th { background: #1B2559; color: #fff; text-align: left; padding: 6px 8px; font-weight: 600; font-size: 8.6pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { border: 1px solid #E5E7EB; padding: 6px 8px; vertical-align: top; }
  tr { break-inside: avoid; }
  .box { background: #FBF5E6; border-left: 3px solid #D4A53A; padding: 10px 14px; margin: 12px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-label { font-size: 8pt; letter-spacing: .2em; text-transform: uppercase; color: #8F6A1E; font-weight: 700; margin-bottom: 6px; }
  .doc h1 { font-size: 19pt; line-height: 1.2; color: #1B2559; margin: 0 0 4px; letter-spacing: -0.02em; }
  .doc h1 + p { color: #555; font-size: 9.2pt; margin-top: 0; }
  .doc h2 { font-size: 9.2pt; letter-spacing: .14em; text-transform: uppercase; color: #1B2559; margin: 13px 0 5px; padding-bottom: 4px; border-bottom: 2px solid #EBD9A8; break-after: avoid; }
  .doc h3 { font-size: 10.5pt; color: #1B2559; margin: 12px 0 4px; break-after: avoid; }
  .doc p { margin: 0 0 7px; } .doc ul { margin: 0 0 8px; padding-left: 18px; } .doc li { margin-bottom: 2px; }
  .review-notes { background: #FBF5E6; border-left: 3px solid #D4A53A; padding: 8px 12px 6px 28px !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .fb { break-inside: avoid; margin-bottom: 14px; } .fb h3 { font-size: 11pt; color: #1B2559; margin: 0 0 4px; }
  .fbt td { height: 22px; } .lines { margin: 4px 0 2px; font-size: 9pt; color: #4E5678; }
  .ruled { border-bottom: 1px solid #CFCFCF; height: 20px; }
</style></head><body>
  <section class="page cover">
    <div class="mark"><i></i><i class="x"></i><i></i><i class="x"></i><i class="g"></i><i class="x"></i><i></i><i class="x"></i><i></i></div>
    <div class="kicker">SPARKXHR Toolkit · Drafts for review</div>
    <h1>SELECT and PERFORM<br>template drafts</h1>
    <p class="sub">Six AI-drafted SPARK documents for one sample client, for Fides to check for voice, structure, and anything missing before the toolkit goes to clients.</p>
    <div class="meta">
      <div><b>Prepared for</b>Fides Ventura Tanay, Faith &amp; Possibilities HR Consulting</div>
      <div><b>Prepared by</b>Luke Jason Fernandez</div>
      <div><b>Sample client</b>${esc(profile.name)} (fictional)</div>
      <div><b>Date</b>${esc(date)}</div>
    </div>
  </section>

  <section class="page how">
    <div class="kicker">How to review</div>
    <h2 class="sec">What we need from you</h2>
    <p>The toolkit writes every document from two things: a drafting guide that describes your voice and the SPARK rules, and one template per document. Your corrections on these drafts go straight into that guide and those templates, so every future draft improves, not just this one.</p>
    <ol>
      <li><b>Read each draft as if a client sent it to you.</b> Mark anything that doesn't sound like you, directly on the page.</li>
      <li><b>Check the structure.</b> Are these the right sections, in the right order, at the right length?</li>
      <li><b>Look for gaps.</b> Is there anything you always include that is missing?</li>
      <li><b>Complete the feedback sheet</b> at the back, one block per document.</li>
    </ol>
    <div class="box"><b>About the sample.</b> ${esc(profile.name)} is a fictional client, and every name in these drafts is invented. Text in [square brackets] marks facts the AI was not given and left for the reviewer. The gold "Review notes" box at the end of each draft lists those gaps and the assumptions made.</div>
    <h2 class="sec" style="margin-top:14px">In this pack</h2>
    <table><tr><th style="width:6%">#</th><th style="width:16%">Pillar</th><th style="width:36%">Document</th><th>Purpose</th></tr>${rows}</table>
    <h2 class="sec" style="margin-top:14px">The sample client profile used</h2>
    <table>${manifest.profileFields.map((f) => `<tr><td style="width:30%"><b>${esc(f.label)}</b></td><td>${esc(profile[f.id] || '')}</td></tr>`).join('')}</table>
  </section>

  ${drafts.map(({ t, html }, i) => `<section class="page doc"><div class="doc-label">Draft ${i + 1} of ${drafts.length} · ${esc(t.pillarName)} · ${esc(t.name)}</div>${html}</section>`).join('')}

  <section class="feedback">
    <div class="kicker">Feedback sheet</div>
    <h2 class="sec">Your corrections</h2>
    <p style="margin-bottom:14px">Tick yes or no, then add the phrases you always use or never use. A photo of this page is enough to send back.</p>
    ${feedback}
  </section>
</body></html>`;

const tmp = path.join(ROOT, 'samples', '.review-pack.html');
await fs.writeFile(tmp, html, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + tmp, { waitUntil: 'load' });
await page.pdf({
  path: OUT, format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<div style="font-size:7px;color:#888;width:100%;padding:0 18mm;text-align:right;font-family:Helvetica,Arial">SPARKXHR · Faith &amp; Possibilities HR Consulting · Drafts for review</div>',
  footerTemplate: '<div style="font-size:7px;color:#888;width:100%;padding:0 18mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial"><span>Confidential draft</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
  margin: { top: '18mm', bottom: '18mm', left: '0', right: '0' },
});
await browser.close();
await fs.unlink(tmp);
console.log('wrote', OUT);
