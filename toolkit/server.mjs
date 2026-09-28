// SPARKXHR Toolkit server: serves the toolkit UI, streams AI drafts, exports Word.
//
//   npm start          live mode when ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is set
//   npm run preview    preview mode: plays the sample drafts, no API calls
//
// Environment:
//   SPARK_MODE     live | preview (default: live if credentials are set, else preview)
//   SPARK_MODEL    Claude model id (default claude-opus-5)
//   SPARK_EFFORT   low | medium | high (default medium, tuned for interactive drafting)
//   PORT / HOST    default 5180 on 127.0.0.1 (local only; there is no login yet)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { allTemplates, buildSystemPrompt, buildUserMessage, loadManifest, missingRequired } from './lib/prompt.mjs';
import { buildDocx, validBlocks } from './lib/docx.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5180);
const HOST = process.env.HOST || '127.0.0.1';
const MODEL = process.env.SPARK_MODEL || 'claude-opus-5';
const EFFORT = process.env.SPARK_EFFORT || 'medium';
const hasCredentials = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const MODE = process.env.SPARK_MODE === 'preview' ? 'preview'
  : process.env.SPARK_MODE === 'live' || hasCredentials ? 'live' : 'preview';
const anthropic = MODE === 'live' ? new Anthropic() : null;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
const STATIC = {
  '/vendor/marked.umd.js': path.join(ROOT, 'node_modules', 'marked', 'lib', 'marked.umd.js'),
};

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req, limit = 2_000_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

async function serveStatic(req, res, urlPath) {
  const file = STATIC[urlPath] ?? path.join(ROOT, 'public', urlPath === '/' ? 'index.html' : urlPath);
  const publicDir = path.join(ROOT, 'public');
  if (!STATIC[urlPath] && !path.resolve(file).startsWith(publicDir + path.sep)) return json(res, 404, { error: 'Not found' });
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    json(res, 404, { error: 'Not found' });
  }
}

function sse(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  return (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function streamPreview(res, template, send) {
  let md;
  try { md = await fs.readFile(path.join(ROOT, 'samples', `${template.id}.md`), 'utf8'); }
  catch { send('error', { message: `No sample draft exists yet for ${template.name}.` }); return res.end(); }
  send('status', { phase: 'preview' });
  await sleep(500);
  const pieces = md.match(/\S+\s*/g) || [];
  for (let i = 0; i < pieces.length && !res.writableEnded; i += 4) {
    send('text', { text: pieces.slice(i, i + 4).join('') });
    await sleep(14);
  }
  send('done', { mode: 'preview' });
  res.end();
}

async function streamLive(res, manifest, template, profile, inputs, send) {
  const system = await buildSystemPrompt(ROOT, manifest);
  const user = buildUserMessage(manifest, template, profile, inputs);
  send('status', { phase: 'thinking' });

  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT },
    cache_control: { type: 'ephemeral' },
    system,
    messages: [{ role: 'user', content: user }],
  });
  res.on('close', () => { if (!res.writableEnded) stream.abort(); });

  try {
    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const kind = event.content_block.type;
        if (kind === 'thinking') send('status', { phase: 'thinking' });
        else if (kind === 'text') send('status', { phase: 'writing' });
        else if (kind === 'fallback') send('reset', { from: event.content_block.from?.model, to: event.content_block.to?.model });
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        send('text', { text: event.delta.text });
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      send('error', { message: 'The model declined to draft this document. Adjust the inputs and try again.' });
    } else {
      send('done', {
        mode: 'live', model: final.model, stopReason: final.stop_reason,
        usage: {
          input: final.usage?.input_tokens, output: final.usage?.output_tokens,
          cacheRead: final.usage?.cache_read_input_tokens, cacheWrite: final.usage?.cache_creation_input_tokens,
        },
      });
    }
  } catch (err) {
    if (res.writableEnded) return;
    let message = 'Drafting failed. Try again in a moment.';
    if (err instanceof Anthropic.AuthenticationError) message = 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.';
    else if (err instanceof Anthropic.PermissionDeniedError) message = 'This API key cannot use the configured model.';
    else if (err instanceof Anthropic.RateLimitError) message = 'Rate limit reached. Wait a minute and try again.';
    else if (err instanceof Anthropic.BadRequestError) message = `The API rejected the request: ${err.message}`;
    else if (err instanceof Anthropic.APIConnectionError) message = 'Could not reach the Anthropic API. Check the internet connection.';
    else if (err instanceof Anthropic.APIError) message = `Anthropic API error ${err.status}.`;
    console.error('[generate]', err?.constructor?.name, err?.message);
    send('error', { message });
  }
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/config') {
      const manifest = await loadManifest(ROOT);
      return json(res, 200, { mode: MODE, model: MODE === 'live' ? MODEL : null, manifest });
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      const body = await readJson(req, 200_000);
      const manifest = await loadManifest(ROOT);
      const template = allTemplates(manifest).find((t) => t.id === body.templateId);
      if (!template) return json(res, 400, { error: 'Unknown template.' });
      const missing = missingRequired(manifest, template, body.profile, body.inputs);
      if (missing.length) return json(res, 400, { error: `Please fill in: ${missing.join(', ')}.` });
      const send = sse(res);
      return MODE === 'live'
        ? streamLive(res, manifest, template, body.profile, body.inputs, send)
        : streamPreview(res, template, send);
    }

    if (req.method === 'POST' && url.pathname === '/api/export/docx') {
      const body = await readJson(req);
      if (!validBlocks(body.blocks)) return json(res, 400, { error: 'Document could not be read for export.' });
      const buffer = await buildDocx(body.blocks, { title: String(body.title || 'SPARKXHR draft').slice(0, 200) });
      const name = String(body.filename || 'SPARKXHR draft').replace(/[^\w .,()-]+/g, '').slice(0, 120) || 'SPARKXHR draft';
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${name}.docx"`,
      });
      return res.end(buffer);
    }

    if (req.method === 'GET') return serveStatic(req, res, url.pathname);
    json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) json(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`SPARKXHR Toolkit running at http://${HOST}:${PORT}`);
  console.log(MODE === 'live' ? `Mode: live AI drafting with ${MODEL} (effort ${EFFORT})` : 'Mode: preview (sample drafts, no API calls). Set ANTHROPIC_API_KEY for live drafting.');
});
