/* SPARKXHR Toolkit front end: clients, templates, streaming drafts, versions, export. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STORE_KEY = 'sparkxhr.toolkit.v1';

  // Markdown rendering with raw HTML disabled.
  window.marked.use({ gfm: true, breaks: true, renderer: { html(token) { return esc(token.text); } } });

  let cfg = null;
  let state = load();
  let pillarId = 'select';
  let templateId = null;
  let generating = false;
  let current = { markdown: '', done: false };

  // ---------- storage ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }
  const uid = () => Math.random().toString(36).slice(2, 10);
  const client = () => state.clients.find((c) => c.id === state.activeClientId) || state.clients[0];
  const templates = () => cfg.manifest.pillars.flatMap((p) => p.templates.map((t) => ({ ...t, pillar: p.id })));
  const tpl = () => templates().find((t) => t.id === templateId);

  // ---------- helpers ----------
  const toastEl = $('#toast'); let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); }
  function setStatus(html, busy) { $('#status').innerHTML = (busy ? '<span class="dot"></span>' : '') + `<span>${html}</span>`; }
  function notice(text, kind) { const n = $('#notice'); if (!text) { n.hidden = true; return; } n.hidden = false; n.className = 'notice' + (kind ? ' ' + kind : ''); n.textContent = text; }
  function tools(enabled) { $$('.tool').forEach((b) => { b.disabled = !enabled; }); }

  // ---------- rendering ----------
  function renderPillars() {
    $('#pillarNav').innerHTML = cfg.manifest.pillars.map((p) =>
      `<button type="button" class="nav${p.id === pillarId ? ' active' : ''}" data-pillar="${p.id}"><span class="l">${esc(p.letter)}</span><span>${esc(p.name)}<small>${p.templates.length} templates</small></span></button>`).join('');
    $$('[data-pillar]').forEach((b) => b.addEventListener('click', () => selectPillar(b.dataset.pillar)));
    const p = cfg.manifest.pillars.find((x) => x.id === pillarId);
    $('#pillarKicker').textContent = `${p.name} pillar`;
    $('#pillarTagline').textContent = p.tagline;
  }

  function renderTemplates() {
    const p = cfg.manifest.pillars.find((x) => x.id === pillarId);
    $('#tplRow').innerHTML = p.templates.map((t) =>
      `<button type="button" role="tab" class="tpl" aria-selected="${t.id === templateId}" data-tpl="${t.id}"><b>${esc(t.name)}</b><span>${esc(t.description)}</span></button>`).join('');
    $$('[data-tpl]').forEach((b) => b.addEventListener('click', () => selectTemplate(b.dataset.tpl)));
  }

  function fieldHtml(f, value, prefix) {
    const id = `${prefix}-${f.id}`;
    const label = `<label class="f" for="${id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>`;
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    if (f.type === 'textarea') return `${label}<textarea class="in" id="${id}" name="${f.id}"${ph}>${esc(value)}</textarea>`;
    if (f.type === 'select') return `${label}<select class="in" id="${id}" name="${f.id}">${f.options.map((o) => `<option${o === value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    return `${label}<input class="in" id="${id}" name="${f.id}" value="${esc(value)}"${ph}>`;
  }

  function inputsFor(tId) {
    const c = client();
    c.inputs = c.inputs || {};
    return c.inputs[tId] || {};
  }

  function renderForm() {
    const t = tpl();
    const values = inputsFor(t.id);
    $('#formTitle').textContent = `Inputs · ${t.name}`;
    $('#form').innerHTML = t.fields.map((f) => fieldHtml(f, values[f.id] ?? (f.type === 'select' ? f.options[0] : ''), 'in')).join('');
    $('#form').querySelectorAll('.in').forEach((el) => el.addEventListener('input', captureInputs));
    $('#formErr').hidden = true;
  }

  function captureInputs() {
    const c = client();
    c.inputs = c.inputs || {};
    const data = {};
    new FormData($('#form')).forEach((v, k) => { data[k] = v; });
    c.inputs[templateId] = data;
    save();
  }

  function renderClients() {
    $('#clientSel').innerHTML = state.clients.map((c) => `<option value="${c.id}"${c.id === state.activeClientId ? ' selected' : ''}>${esc(c.profile.name || 'Unnamed client')}</option>`).join('');
    const p = client().profile;
    $('#clientLine').textContent = [p.name, p.industry, p.employees && `${p.employees} employees`, p.stage && `${p.stage} stage`, p.location].filter(Boolean).join(' · ');
  }

  function renderVersions() {
    const list = (client().drafts || []).filter((d) => d.templateId === templateId);
    const sel = $('#versions');
    sel.hidden = !list.length;
    sel.innerHTML = '<option value="">Saved versions</option>' + list.map((d) => `<option value="${d.id}">${esc(new Date(d.savedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }))}</option>`).join('');
  }

  function renderDoc(markdown, streaming) {
    const doc = $('#doc');
    doc.classList.remove('empty');
    doc.innerHTML = window.marked.parse(markdown) + (streaming ? '<span class="caret"></span>' : '');
    markReviewNotes(doc);
  }

  function markReviewNotes(doc) {
    const heads = Array.from(doc.querySelectorAll('h2'));
    const last = heads.find((h) => /review notes/i.test(h.textContent));
    if (last && last.nextElementSibling && last.nextElementSibling.tagName === 'UL') last.nextElementSibling.classList.add('review-notes');
  }

  function resetDoc() {
    const doc = $('#doc');
    doc.className = 'doc empty';
    doc.removeAttribute('contenteditable');
    doc.innerHTML = '<div class="empty-state"><p class="big">Your SPARK toolkit, drafted in minutes</p><p>The draft appears here as it is written. When it finishes you can edit it directly, save a version, and export it to Word or PDF.</p></div>';
    current = { markdown: '', done: false };
    tools(false);
    notice('');
    setStatus('Choose a template, check the inputs, and draft.');
  }

  // ---------- selection ----------
  function selectPillar(id) {
    if (generating) return;
    pillarId = id;
    templateId = cfg.manifest.pillars.find((p) => p.id === id).templates[0].id;
    renderPillars(); renderTemplates(); renderForm(); renderVersions(); resetDoc();
  }
  function selectTemplate(id) {
    if (generating) return;
    templateId = id;
    renderTemplates(); renderForm(); renderVersions(); resetDoc();
  }

  // ---------- generation ----------
  async function generate() {
    if (generating) return;
    captureInputs();
    const t = tpl();
    const inputs = inputsFor(t.id);
    const missing = t.fields.filter((f) => f.required && !String(inputs[f.id] || '').trim()).map((f) => f.label);
    if (!String(client().profile.name || '').trim()) missing.unshift('Company name (edit the client profile)');
    if (missing.length) { $('#formErr').textContent = `Please fill in: ${missing.join(', ')}.`; $('#formErr').hidden = false; return; }
    $('#formErr').hidden = true;

    generating = true;
    $('#genBtn').disabled = true;
    tools(false);
    notice(cfg.mode === 'preview' ? 'Preview mode: this plays the sample draft for Bayanihan Foods, not a draft from your inputs. Add an Anthropic API key on the server to draft live.' : '');
    const doc = $('#doc');
    doc.removeAttribute('contenteditable'); doc.classList.remove('editable');
    current = { markdown: '', done: false };
    renderDoc('', true);
    setStatus(`Reading ${esc(client().profile.shortName || client().profile.name)}'s profile…`, true);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: t.id, profile: client().profile, inputs }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let raf = 0;
      const paint = () => { raf = 0; renderDoc(current.markdown, true); };
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
          const ev = /^event: (.+)$/m.exec(chunk)?.[1];
          const data = JSON.parse(/^data: (.*)$/m.exec(chunk)?.[1] || '{}');
          if (ev === 'status') {
            const label = { preview: 'Preview mode: playing the sample draft…', thinking: 'Applying the SPARK framework…', writing: `Drafting the ${esc(t.name)} in the SPARK voice…` }[data.phase];
            if (label) setStatus(label, true);
          } else if (ev === 'text') {
            current.markdown += data.text;
            if (!raf) raf = requestAnimationFrame(paint);
          } else if (ev === 'reset') {
            current.markdown = '';
            setStatus('Switching to a backup model and restarting the draft…', true);
          } else if (ev === 'error') {
            throw new Error(data.message);
          } else if (ev === 'done') {
            finished = true;
            current.done = true;
            current.meta = data;
          }
        }
      }
      if (!current.done) throw new Error('The connection closed before the draft finished. Try again.');
      if (raf) cancelAnimationFrame(raf);
      renderDoc(current.markdown, false);
      doc.setAttribute('contenteditable', 'true'); doc.classList.add('editable');
      tools(true);
      const cache = current.meta?.usage?.cacheRead ? ' · cached prompt reused' : '';
      setStatus(`Draft ready for review. Click into the document to edit${cache}.`);
    } catch (err) {
      if (!current.markdown) resetDoc();
      notice(err.message || 'Drafting failed.', 'error');
      setStatus('The draft did not finish.');
    } finally {
      generating = false;
      $('#genBtn').disabled = false;
    }
  }

  // ---------- export ----------
  function runsFrom(node, style = {}) {
    const runs = [];
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { if (n.textContent) runs.push({ text: n.textContent, bold: !!style.bold, italic: !!style.italic }); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BR') { runs.push({ text: '', break: true }); return; }
      if (tag === 'UL' || tag === 'OL') return;
      const next = { bold: style.bold || tag === 'STRONG' || tag === 'B', italic: style.italic || tag === 'EM' || tag === 'I' };
      runs.push(...runsFrom(n, next));
    });
    return runs;
  }
  function listItems(list, level) {
    const items = [];
    Array.from(list.children).forEach((li) => {
      if (li.tagName !== 'LI') return;
      items.push({ level, runs: runsFrom(li) });
      li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => items.push(...listItems(sub, level + 1)));
    });
    return items;
  }
  function blocksFromDoc() {
    const blocks = [];
    Array.from($('#doc').children).forEach((el) => {
      const tag = el.tagName;
      if (/^H[1-6]$/.test(tag)) blocks.push({ type: 'heading', level: Math.min(Number(tag[1]), 3), runs: runsFrom(el) });
      else if (tag === 'UL' || tag === 'OL') blocks.push({ type: 'list', ordered: tag === 'OL', items: listItems(el, 0) });
      else if (tag === 'TABLE') {
        const head = Array.from(el.querySelectorAll('thead th, thead td')).map((c) => runsFrom(c));
        const rows = Array.from(el.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.children).map((c) => runsFrom(c)));
        blocks.push({ type: 'table', header: head, rows });
      } else if (tag === 'HR') blocks.push({ type: 'hr' });
      else if (tag !== 'SPAN' && el.textContent.trim()) blocks.push({ type: 'paragraph', runs: runsFrom(el) });
    });
    return blocks;
  }
  function docTitle() {
    const h1 = $('#doc h1');
    return (h1 ? h1.textContent : tpl().name).trim();
  }
  async function exportDocx() {
    const title = docTitle();
    const who = client().profile.shortName || client().profile.name;
    const filename = (title.toLowerCase().includes(tpl().name.toLowerCase()) ? `${who} - ${title}` : `${who} - ${tpl().name} - ${title}`).slice(0, 110);
    const res = await fetch('/api/export/docx', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks: blocksFromDoc(), title, filename }),
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast(b.error || 'Export failed'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename.replace(/[^\w .,()-]+/g, '')}.docx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Word document downloaded');
  }

  function saveVersion() {
    const c = client();
    c.drafts = c.drafts || [];
    c.drafts.unshift({ id: uid(), templateId, savedAt: Date.now(), html: $('#doc').innerHTML, mode: cfg.mode });
    c.drafts = c.drafts.slice(0, 60);
    save(); renderVersions();
    toast('Version saved for this client');
  }

  function openVersion(id) {
    const d = (client().drafts || []).find((x) => x.id === id);
    if (!d) return;
    const doc = $('#doc');
    doc.className = 'doc editable'; doc.innerHTML = d.html; doc.setAttribute('contenteditable', 'true');
    tools(true); notice('');
    setStatus(`Opened the version saved ${esc(new Date(d.savedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }))}.`);
  }

  // ---------- clients ----------
  function openClientDialog(isNew) {
    const profile = isNew ? {} : client().profile;
    $('#clientDlgTitle').textContent = isNew ? 'New client' : 'Client profile';
    $('#clientFields').innerHTML = cfg.manifest.profileFields.map((f) => fieldHtml(f, profile[f.id] ?? (f.type === 'select' ? f.options[0] : ''), 'cp')).join('');
    const dlg = $('#clientDlg');
    dlg.dataset.isNew = isNew ? '1' : '';
    dlg.showModal();
  }
  $('#clientDlg').addEventListener('close', () => {
    const dlg = $('#clientDlg');
    if (dlg.returnValue !== 'save') return;
    const data = {};
    $('#clientFields').querySelectorAll('.in').forEach((el) => { data[el.name] = el.value.trim(); });
    if (!data.name) { toast('A company name is required'); return; }
    if (dlg.dataset.isNew) {
      const c = { id: uid(), profile: data, inputs: {}, drafts: [] };
      state.clients.push(c); state.activeClientId = c.id;
    } else client().profile = data;
    save(); renderClients(); renderForm(); renderVersions(); resetDoc();
    toast('Client profile saved');
  });

  // ---------- events ----------
  $('#genBtn').addEventListener('click', generate);
  $('#fillSample').addEventListener('click', () => {
    const c = client(); c.inputs = c.inputs || {};
    c.inputs[templateId] = { ...(tpl().sample || {}) };
    save(); renderForm(); toast('Sample inputs filled');
  });
  $('#clientSel').addEventListener('change', (e) => { state.activeClientId = e.target.value; save(); renderClients(); renderForm(); renderVersions(); resetDoc(); });
  $('#editClient').addEventListener('click', () => openClientDialog(false));
  $('#newClient').addEventListener('click', () => openClientDialog(true));
  $('#versions').addEventListener('change', (e) => { if (e.target.value) openVersion(e.target.value); e.target.value = ''; });
  $$('.tool').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.act;
    if (act === 'copy') { try { await navigator.clipboard.writeText($('#doc').innerText); toast('Copied to the clipboard'); } catch { toast('Copy is not available in this browser'); } }
    if (act === 'docx') exportDocx();
    if (act === 'pdf') window.print();
    if (act === 'save') saveVersion();
  }));

  // ---------- boot ----------
  fetch('/api/config').then((r) => r.json()).then((config) => {
    cfg = config;
    const m = $('#mode');
    m.textContent = cfg.mode === 'live' ? `Live AI · ${cfg.model}` : 'Preview mode';
    m.className = `mode ${cfg.mode}`;
    if (!state || !Array.isArray(state.clients) || !state.clients.length) {
      const inputs = {};
      templates().forEach((t) => { inputs[t.id] = { ...(t.sample || {}) }; });
      const c = { id: uid(), profile: { ...cfg.manifest.sampleProfile }, inputs, drafts: [] };
      state = { clients: [c], activeClientId: c.id };
      save();
    }
    templateId = cfg.manifest.pillars[0].templates[0].id;
    renderClients(); renderPillars(); renderTemplates(); renderForm(); renderVersions();
  }).catch(() => { $('#mode').textContent = 'Server offline'; setStatus('Could not reach the toolkit server. Start it with npm start.'); });
})();
