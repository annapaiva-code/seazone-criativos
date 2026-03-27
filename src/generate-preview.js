// src/generate-preview.js — Gera visualizar.html a partir dos dados reais
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'output', 'data');
const OUTPUT_DIR = path.join(ROOT, 'output');

function log(msg, nivel = 'info') {
  const cores = { info: chalk.white, ok: chalk.green, warn: chalk.yellow, erro: chalk.red };
  const pref = { info: '  ', ok: '+ ', warn: '! ', erro: 'x ' };
  console.log(cores[nivel](`${pref[nivel]}${msg}`));
}

async function generatePreview() {
  console.log(chalk.blue.bold('\n  SEAZONE — GERACAO DE PREVIEW\n'));

  // Carregar dados
  const copyPath = path.join(DATA_DIR, 'copy.json');
  if (!await fs.pathExists(copyPath)) {
    log('copy.json nao encontrado — rode npm run copy primeiro', 'erro');
    process.exit(1);
  }

  const copy = await fs.readJson(copyPath);
  const assetsMap = await fs.pathExists(path.join(DATA_DIR, 'assets-map.json'))
    ? await fs.readJson(path.join(DATA_DIR, 'assets-map.json'))
    : null;
  const briefing = await fs.pathExists(path.join(DATA_DIR, 'briefing-normalizado.json'))
    ? await fs.readJson(path.join(DATA_DIR, 'briefing-normalizado.json'))
    : null;
  const prompts = {};
  for (const f of ['estaticos.json', 'video-narrado.json', 'video-apresentadora.json']) {
    const p = path.join(OUTPUT_DIR, 'prompts', f);
    if (await fs.pathExists(p)) prompts[f.replace('.json', '')] = await fs.readJson(p);
  }

  const produto = briefing?.produto?.nome || copy._briefing || 'Novo Campeche SPOT II';

  // Montar COPY_DATA para embed no HTML
  const copyData = copy.criativos || {};

  // Verificar quais assets de output existem
  const outputAssets = {};
  for (const jobId of ['E1.1', 'VN1.1', 'VA1.1']) {
    const jobDir = path.join(OUTPUT_DIR, jobId);
    if (await fs.pathExists(jobDir)) {
      outputAssets[jobId] = await fs.readdir(jobDir);
    } else {
      outputAssets[jobId] = [];
    }
  }

  const html = buildHTML(produto, copyData, assetsMap, prompts, outputAssets);
  const dest = path.join(OUTPUT_DIR, 'visualizar.html');
  await fs.writeFile(dest, html, 'utf-8');
  log(`visualizar.html gerado (${(html.length / 1024).toFixed(1)} KB)`, 'ok');
  console.log(chalk.green.bold(`\n  Preview salvo em: output/visualizar.html\n`));
}

function buildHTML(produto, copyData, assetsMap, prompts, outputAssets) {
  const copyJSON = JSON.stringify(copyData, null, 2);
  const assetsJSON = JSON.stringify(assetsMap || {}, null, 2);
  const promptsJSON = JSON.stringify(prompts || {}, null, 2);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Seazone — Maquina de Criativos</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;0,9..40,800;1,9..40,300;1,9..40,400&display=swap" rel="stylesheet">
<style>
  :root {
    --blue: #0055FF;
    --navy: #00143D;
    --coral: #FC6058;
    --blue-soft: #6593FF;
    --bg: #00143D;
    --text: #FFFFFF;
    --border: rgba(255,255,255,0.08);
    --muted: rgba(255,255,255,0.4);
    --surface: rgba(255,255,255,0.04);
    --green: #34d399;
    --yellow: #fbbf24;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--navy);
    color: var(--text);
    line-height: 1.6;
    min-height: 100vh;
  }

  header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.2rem 2.5rem;
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
    background: var(--navy);
    backdrop-filter: blur(12px);
  }
  .header-left { display: flex; flex-direction: column; gap: .15rem; }
  .logo { font-size: 1.6rem; font-weight: 800; letter-spacing: 0.02em; line-height: 1; }
  .logo .o { color: var(--coral); }
  .logo-subtitle { font-size: .65rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.25em; color: var(--muted); }
  .header-badge { font-size: .7rem; font-weight: 700; padding: .4rem 1rem; border-radius: 6px; background: var(--coral); color: #fff; letter-spacing: 0.06em; text-transform: uppercase; }

  .status-bar { display: flex; justify-content: center; gap: 2rem; padding: .8rem 2.5rem; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.15); flex-wrap: wrap; }
  .status-item { display: flex; align-items: center; gap: .4rem; font-size: .8rem; font-weight: 400; color: rgba(255,255,255,0.5); }
  .dot { width: 7px; height: 7px; border-radius: 50%; }
  .dot.ok { background: var(--green); }
  .dot.warn { background: var(--yellow); }
  .dot.err { background: var(--coral); }

  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.1); }
  .tab { padding: .8rem 1.5rem; font-size: .8rem; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; color: var(--muted); transition: all .15s; }
  .tab:hover { color: rgba(255,255,255,0.7); }
  .tab.active { color: #fff; border-bottom-color: var(--coral); }

  .container { max-width: 1280px; margin: 0 auto; padding: 2.5rem 2rem; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }

  .section { margin-bottom: 3.5rem; }
  .section-header { display: flex; align-items: center; gap: .8rem; margin-bottom: 1.5rem; padding-left: 1rem; border-left: 3px solid var(--coral); flex-wrap: wrap; }
  .section-badge { font-size: .7rem; font-weight: 700; padding: .25rem .65rem; border-radius: 5px; background: var(--coral); color: #fff; letter-spacing: 0.04em; }
  .section-title { font-size: 1.2rem; font-weight: 700; }
  .section-meta { margin-left: auto; font-size: .8rem; color: var(--muted); font-weight: 400; }

  .formats-grid { display: grid; gap: 1.5rem; }
  .formats-3 { grid-template-columns: repeat(3, 1fr); }
  .formats-2 { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 960px) { .formats-3, .formats-2 { grid-template-columns: 1fr; } }

  .format-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; transition: border-color .2s; }
  .format-card:hover { border-color: rgba(255,255,255,0.15); }
  .format-label { display: inline-block; margin: .8rem .8rem 0; padding: .2rem .6rem; font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #fff; background: var(--coral); border-radius: 4px; }
  .asset-container { position: relative; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; min-height: 220px; margin: .6rem; border-radius: 10px; overflow: hidden; }
  .asset-container img, .asset-container video { width: 100%; height: auto; display: block; border-radius: 10px; }
  .placeholder { color: rgba(255,255,255,0.25); font-size: .85rem; text-align: center; padding: 3rem 1rem; }
  .placeholder .icon { font-size: 2.5rem; margin-bottom: .6rem; opacity: .4; }
  .placeholder small { display: block; margin-top: .3rem; font-size: .7rem; font-family: 'DM Sans', monospace; color: rgba(255,255,255,0.15); }

  .card-copy { padding: .8rem 1rem 1rem; }
  .card-headline { font-size: .95rem; font-weight: 700; color: #fff; line-height: 1.3; margin-bottom: .2rem; }
  .card-subheadline { font-size: .8rem; font-weight: 400; color: rgba(255,255,255,0.5); margin-bottom: .5rem; }
  .card-titulo { font-size: .95rem; font-weight: 700; color: #fff; margin-bottom: .5rem; }

  .destaque-financeiro { background: rgba(0,85,255,0.15); border: 1px solid rgba(0,85,255,0.3); border-radius: 10px; padding: .8rem 1rem; margin: .8rem 1rem; }
  .destaque-financeiro .roi { font-size: 1.8rem; font-weight: 800; color: var(--blue-soft); line-height: 1; }
  .destaque-financeiro .roi-label { font-size: .75rem; font-weight: 400; color: rgba(255,255,255,0.5); margin-top: .2rem; }

  .cta-btn { display: inline-block; padding: .45rem 1.2rem; background: var(--blue); color: #fff; font-size: .8rem; font-weight: 700; border-radius: 8px; border: none; letter-spacing: 0.02em; margin-top: .4rem; }

  .copy-details { margin-top: 1.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  .copy-details-header { padding: .8rem 1.2rem; font-size: .85rem; font-weight: 700; color: var(--coral); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: .5rem; cursor: pointer; user-select: none; }
  .copy-details-header:hover { background: rgba(255,255,255,0.02); }
  .copy-details-body { padding: 1rem 1.2rem; }

  .copy-field { margin-bottom: .8rem; }
  .copy-field:last-child { margin-bottom: 0; }
  .copy-field label { font-size: .65rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); display: block; margin-bottom: .25rem; font-weight: 500; }
  .copy-field .value { font-size: .85rem; color: rgba(255,255,255,0.85); background: rgba(0,0,0,0.2); padding: .6rem .8rem; border-radius: 8px; border: 1px solid var(--border); white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow-y: auto; line-height: 1.5; }

  .legenda-wrapper { position: relative; }
  .legenda-box { font-size: .85rem; color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.03); padding: .6rem .8rem; padding-right: 3.5rem; border-radius: 8px; border: 1px solid var(--border); white-space: pre-wrap; word-break: break-word; max-height: 220px; overflow-y: auto; line-height: 1.5; }
  .copy-btn { position: absolute; top: .5rem; right: .5rem; padding: .3rem .6rem; font-size: .65rem; font-weight: 700; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.6); border-radius: 5px; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .15s; text-transform: uppercase; letter-spacing: 0.06em; }
  .copy-btn:hover { background: var(--blue); color: #fff; border-color: var(--blue); }
  .copy-btn.copied { background: var(--green); color: #fff; border-color: var(--green); }

  .cenas-grid { display: grid; gap: .5rem; margin-top: .4rem; }
  .cena { background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 8px; padding: .7rem .9rem; font-size: .8rem; }
  .cena-header { display: flex; gap: .5rem; align-items: center; margin-bottom: .3rem; }
  .cena-num { font-weight: 700; color: var(--blue-soft); font-size: .7rem; letter-spacing: 0.04em; }
  .cena-tempo { color: var(--muted); font-size: .65rem; }
  .cena-text { color: rgba(255,255,255,0.8); line-height: 1.5; }
  .cena-text em { color: var(--muted); font-style: normal; font-weight: 500; font-size: .75rem; text-transform: uppercase; letter-spacing: 0.04em; }

  .cena-assets { margin-top: .4rem; display: flex; flex-wrap: wrap; gap: .3rem; }
  .cena-asset-tag { font-size: .6rem; padding: .15rem .4rem; background: rgba(0,85,255,0.15); border: 1px solid rgba(0,85,255,0.2); border-radius: 4px; color: var(--blue-soft); font-weight: 500; }

  .prompt-visual { margin-top: .4rem; padding: .6rem .8rem; background: rgba(0,85,255,0.06); border: 1px dashed rgba(0,85,255,0.2); border-radius: 8px; font-size: .75rem; color: rgba(255,255,255,0.35); font-family: 'DM Sans', monospace; word-break: break-word; line-height: 1.5; }

  .assets-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: .8rem; margin-top: 1rem; }
  .asset-thumb { background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; text-align: center; }
  .asset-thumb img { width: 100%; height: 100px; object-fit: cover; }
  .asset-thumb .name { font-size: .6rem; padding: .3rem; color: var(--muted); word-break: break-all; }
  .asset-thumb .cat { font-size: .55rem; padding: .1rem .3rem; background: var(--coral); color: #fff; border-radius: 3px; display: inline-block; margin: .2rem; }

  footer { text-align: center; padding: 2rem; font-size: .75rem; color: rgba(255,255,255,0.2); border-top: 1px solid var(--border); margin-top: 1rem; }
</style>
</head>
<body>

<header>
  <div class="header-left">
    <img src="../logo seazone.png" alt="Seazone" style="height:32px;width:auto;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
    <div class="logo" style="display:none;">SEAZ<span class="o">O</span>NE</div>
    <div class="logo-subtitle">Maquina de Criativos</div>
  </div>
  <div class="header-badge">${esc(produto)}</div>
</header>

<div class="status-bar" id="statusBar"></div>

<div class="tabs" id="tabs">
  <div class="tab active" data-tab="criativos">Criativos</div>
  <div class="tab" data-tab="assets">Assets</div>
  <div class="tab" data-tab="prompts">Prompts</div>
</div>

<div class="container">
  <div class="tab-content active" id="tab-criativos"></div>
  <div class="tab-content" id="tab-assets"></div>
  <div class="tab-content" id="tab-prompts"></div>
</div>

<footer>
  Seazone Creative Machine &middot; ${esc(produto)} &middot; 2026
</footer>

<script>
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function copyToClipboard(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copiado';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
  });
}

const COPY_DATA = ${copyJSON};
const ASSETS_MAP = ${assetsJSON};
const PROMPTS_DATA = ${promptsJSON};

const JOBS = [
  { id: 'E1.1', tipo: 'Estatico', formatos: ['feed_1x1', 'reels_9x16', 'story_9x16'], ext: 'jpg', mediaType: 'image', gridClass: 'formats-3' },
  { id: 'VN1.1', tipo: 'Video Narrado', formatos: ['feed_1x1', 'reels_9x16'], ext: 'mp4', mediaType: 'video', gridClass: 'formats-2' },
  { id: 'VA1.1', tipo: 'Video Apresentadora', formatos: ['feed_1x1', 'reels_9x16'], ext: 'mp4', mediaType: 'video', gridClass: 'formats-2' },
];

const FORMAT_LABELS = { feed_1x1: 'Feed 1:1', reels_9x16: 'Reels 9:16', story_9x16: 'Story 9:16' };

// ── Tabs ─────────────────────────────────────────────────────────────────────

document.getElementById('tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
});

// ── Render helpers ───────────────────────────────────────────────────────────

function renderAsset(job, formato) {
  const assetPath = job.id + '/' + formato + '.' + job.ext;
  if (job.mediaType === 'image') return '<img src="' + assetPath + '" alt="' + job.id + ' ' + formato + '" onerror="this.parentElement.innerHTML=\\'<div class=placeholder><div class=icon>&#x1f5bc;</div>Asset pendente<small>' + assetPath + '</small></div>\\'">';
  return '<video src="' + assetPath + '" controls preload="metadata" playsinline onerror="this.parentElement.innerHTML=\\'<div class=placeholder><div class=icon>&#x1f3ac;</div>Asset pendente<small>' + assetPath + '</small></div>\\'">';
}

function renderCardCopy(job, copy) {
  if (!copy) return '';
  if (job.id === 'E1.1') return '<div class="card-copy"><div class="card-headline">' + esc(copy.headline) + '</div><div class="card-subheadline">' + esc(copy.subheadline) + '</div><span class="cta-btn">' + esc(copy.cta || 'Saiba Mais') + '</span></div>';
  return '<div class="card-copy"><div class="card-titulo">' + esc(copy.titulo) + '</div><div class="card-subheadline">' + esc(copy.duracao) + '</div></div>';
}

function renderDestaqueFinanceiro(copy) {
  if (!copy || !copy.destaque_financeiro) return '';
  const match = copy.destaque_financeiro.match(/([\\d,]+%)/);
  const roi = match ? match[1] : '';
  const rest = copy.destaque_financeiro.replace(roi, '').trim();
  return '<div class="destaque-financeiro"><div class="roi">' + esc(roi) + '</div><div class="roi-label">' + esc(rest) + '</div></div>';
}

function renderLegenda(legenda, uid) {
  if (!legenda) return '';
  return '<div class="copy-field"><label>Legenda Feed</label><div class="legenda-wrapper"><div class="legenda-box" id="legenda-' + uid + '">' + esc(legenda) + '</div><button class="copy-btn" onclick="copyToClipboard(this, document.getElementById(\\'legenda-' + uid + '\\').textContent)">Copiar</button></div></div>';
}

function renderCenas(cenas, duracao) {
  if (!cenas || !cenas.length) return '';
  let html = '<div class="copy-field"><label>Roteiro — ' + cenas.length + ' cenas (' + esc(duracao) + ')</label><div class="cenas-grid">';
  for (const c of cenas) {
    html += '<div class="cena"><div class="cena-header"><span class="cena-num">CENA ' + c.numero + '</span><span class="cena-tempo">' + esc(c.tempo) + '</span></div><div class="cena-text">';
    html += '<em>Visual:</em> ' + esc(c.descricao_visual) + '<br>';
    if (c.lettering) html += '<em>Lettering:</em> ' + esc(c.lettering) + '<br>';
    if (c.narracao) html += '<em>Narracao:</em> ' + esc(c.narracao) + '<br>';
    if (c.fala_monica) html += '<em>Fala Monica:</em> ' + esc(c.fala_monica) + '<br>';
    if (c.narracao_off) html += '<em>Narracao Off:</em> ' + esc(c.narracao_off) + '<br>';
    html += '</div>';
    if (c.assets_sugeridos && c.assets_sugeridos.length) {
      html += '<div class="cena-assets">';
      for (const a of c.assets_sugeridos) html += '<span class="cena-asset-tag">' + esc(a.split('/').pop()) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

function renderDetailsEstatico(copy, uid) {
  if (!copy) return '<div style="color:var(--coral);font-size:.85rem;">Copy nao encontrado — rode npm run copy</div>';
  let h = '';
  h += '<div class="copy-field"><label>Headline</label><div class="value">' + esc(copy.headline) + '</div></div>';
  h += '<div class="copy-field"><label>Subheadline</label><div class="value">' + esc(copy.subheadline) + '</div></div>';
  h += '<div class="copy-field"><label>Destaque Financeiro</label><div class="value">' + esc(copy.destaque_financeiro) + '</div></div>';
  h += '<div class="copy-field"><label>CTA</label><div class="value">' + esc(copy.cta) + '</div></div>';
  h += renderLegenda(copy.legenda_feed, uid);
  h += '<div class="copy-field"><label>Notas de Composicao</label><div class="value">' + esc(copy.notas_composicao) + '</div></div>';
  h += '<div class="copy-field"><label>Prompt Visual (EN)</label><div class="prompt-visual">' + esc(copy.prompt_visual_en) + '</div></div>';
  return h;
}

function renderDetailsVideo(copy, uid) {
  if (!copy) return '<div style="color:var(--coral);font-size:.85rem;">Copy nao encontrado — rode npm run copy</div>';
  let h = '';
  h += '<div class="copy-field"><label>Titulo</label><div class="value">' + esc(copy.titulo) + '</div></div>';
  h += renderCenas(copy.cenas, copy.duracao);
  if (copy.instrucoes_direcao) h += '<div class="copy-field"><label>Instrucoes de Direcao</label><div class="value">' + esc(copy.instrucoes_direcao) + '</div></div>';
  h += '<div class="copy-field"><label>Instrucoes de Edicao</label><div class="value">' + esc(copy.instrucoes_edicao) + '</div></div>';
  h += renderLegenda(copy.legenda_feed, uid);
  h += '<div class="copy-field"><label>Prompt Visual (EN)</label><div class="prompt-visual">' + esc(copy.prompt_visual_en) + '</div></div>';
  return h;
}

// ── Render criativos ─────────────────────────────────────────────────────────

function renderCreativos() {
  const app = document.getElementById('tab-criativos');
  const statusBar = document.getElementById('statusBar');
  let html = '';
  const statuses = [];

  for (const job of JOBS) {
    const copy = COPY_DATA[job.id] || null;
    const hasCopy = !!copy;
    const status = hasCopy ? 'ok' : 'err';
    const label = hasCopy ? job.id + ': copy OK' : job.id + ': sem copy';
    statuses.push({ id: job.id, status, label });

    const cardsHTML = job.formatos.map(fmt =>
      '<div class="format-card"><div class="format-label">' + (FORMAT_LABELS[fmt] || fmt) + '</div><div class="asset-container">' + renderAsset(job, fmt) + '</div>' + renderCardCopy(job, copy) + '</div>'
    ).join('');

    const destaqueHTML = job.id === 'E1.1' ? renderDestaqueFinanceiro(copy) : '';
    const uid = job.id.replace('.', '_');
    const detailsHTML = job.id === 'E1.1' ? renderDetailsEstatico(copy, uid) : renderDetailsVideo(copy, uid);

    html += '<div class="section"><div class="section-header"><span class="section-badge">' + esc(job.id) + '</span><span class="section-title">' + esc(job.tipo) + '</span><span class="section-meta">' + job.formatos.length + ' formatos &middot; ' + job.ext.toUpperCase() + '</span></div>' + destaqueHTML + '<div class="formats-grid ' + job.gridClass + '">' + cardsHTML + '</div><div class="copy-details"><div class="copy-details-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\\'none\\'?\\'block\\':\\'none\\'">Copy &amp; Roteiro</div><div class="copy-details-body">' + detailsHTML + '</div></div></div>';
  }

  app.innerHTML = html;
  statusBar.innerHTML = statuses.map(s =>
    '<div class="status-item"><div class="dot ' + s.status + '"></div>' + esc(s.label) + '</div>'
  ).join('');
}

// ── Render assets ────────────────────────────────────────────────────────────

function renderAssets() {
  const app = document.getElementById('tab-assets');
  if (!ASSETS_MAP || !ASSETS_MAP.branding) {
    app.innerHTML = '<p style="color:var(--muted)">Assets map nao encontrado — rode npm run audit</p>';
    return;
  }

  let html = '';
  const cats = ['branding', 'referencias', 'empreendimento', 'apresentadora', 'videos_referencia'];
  for (const cat of cats) {
    const items = ASSETS_MAP[cat] || [];
    if (!items.length) continue;
    html += '<div class="section"><div class="section-header"><span class="section-badge">' + cat.toUpperCase() + '</span><span class="section-title">' + items.length + ' arquivos</span></div><div class="assets-gallery">';
    for (const item of items) {
      const ext = item.arquivo.split('.').pop().toLowerCase();
      const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
      const isVid = ['mp4', 'mov', 'avi', 'webm'].includes(ext);
      html += '<div class="asset-thumb">';
      if (isImg) html += '<img src="../' + item.caminho + '" onerror="this.style.display=\\'none\\'">';
      else if (isVid) html += '<div style="height:100px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);font-size:2rem;opacity:.3;">&#x1f3ac;</div>';
      else html += '<div style="height:100px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);font-size:2rem;opacity:.3;">&#x1f4c4;</div>';
      html += '<div class="name">' + esc(item.arquivo) + '</div></div>';
    }
    html += '</div></div>';
  }
  app.innerHTML = html;
}

// ── Render prompts ───────────────────────────────────────────────────────────

function renderPrompts() {
  const app = document.getElementById('tab-prompts');
  if (!PROMPTS_DATA || Object.keys(PROMPTS_DATA).length === 0) {
    app.innerHTML = '<p style="color:var(--muted)">Prompts nao encontrados — rode npm run prompts</p>';
    return;
  }

  let html = '';
  for (const [key, data] of Object.entries(PROMPTS_DATA)) {
    html += '<div class="section"><div class="section-header"><span class="section-badge">' + esc(key.toUpperCase()) + '</span><span class="section-title">Prompts de Geracao</span></div>';
    html += '<div class="copy-details"><div class="copy-details-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\\'none\\'?\\'block\\':\\'none\\'">JSON Completo</div><div class="copy-details-body"><pre style="font-size:.7rem;color:rgba(255,255,255,0.6);white-space:pre-wrap;word-break:break-word;max-height:400px;overflow-y:auto;">' + esc(JSON.stringify(data, null, 2)) + '</pre></div></div></div>';
  }
  app.innerHTML = html;
}

renderCreativos();
renderAssets();
renderPrompts();
</script>
</body>
</html>`;
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

generatePreview().catch(e => {
  console.error(chalk.red.bold(`\nErro: ${e.message}`));
  process.exit(1);
});
