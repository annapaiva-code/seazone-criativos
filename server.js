// server.js — Servidor web com formulário para link do Lovable
import 'dotenv/config';
import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// CORS — permite file:// e localhost chamarem a API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/output', express.static(path.join(__dirname, 'output')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// ── Estado da geração ────────────────────────────────────────────────────────
let geracaoAtual = { status: 'idle', progresso: [], erro: null, resultado: null };

// ── Scraping do Lovable ──────────────────────────────────────────────────────
async function extrairDadosLovable(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SeazoneBot/1.0)' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`Erro ao acessar ${url}: ${res.status}`);
  const html = await res.text();

  // Extrair meta tags (funcionam mesmo em SPAs)
  const meta = (name) => {
    const re = new RegExp(`<meta[^>]*(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
    const re2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, 'i');
    return (html.match(re)?.[1] || html.match(re2)?.[1] || '').trim();
  };

  const title = meta('og:title') || meta('twitter:title') || (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim();
  const description = meta('og:description') || meta('twitter:description') || meta('description');
  const image = meta('og:image') || meta('twitter:image');

  // Extrair textos visíveis (heurística para dados financeiros)
  const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Procurar dados financeiros no texto
  const roiMatch = textContent.match(/(\d{1,2}[,.]?\d*)\s*%\s*(?:ao\s+ano|a\.a\.|ROI)/i)
    || textContent.match(/ROI[^0-9]*(\d{1,2}[,.]?\d*)\s*%/i);
  const rendMatch = textContent.match(/R\$\s*([\d.,]+)\s*(?:por\s+m[eê]s|mensal|\/m[eê]s)/i)
    || textContent.match(/rendimento[^R$]*R\$\s*([\d.,]+)/i);
  const ticketMatch = textContent.match(/(?:a\s+partir|desde|ticket|cota)[^R$]*R\$\s*([\d.,]+)/i);
  const valorizMatch = textContent.match(/valoriza[çc][aã]o[^0-9]*(\d{1,3})\s*%/i);

  return {
    url,
    titulo: title,
    descricao: description,
    imagem_og: image,
    roi: roiMatch?.[1] ? `${roiMatch[1]}%` : null,
    rendimento_mensal: rendMatch?.[1] ? `R$ ${rendMatch[1]}` : null,
    ticket: ticketMatch?.[1] ? `R$ ${ticketMatch[1]}` : null,
    valorizacao: valorizMatch?.[1] ? `${valorizMatch[1]}%` : null,
    texto_bruto: textContent.slice(0, 3000),
    html_tamanho: html.length,
  };
}

// ── Form HTML ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const briefings = fs.readdirSync(path.join(__dirname, 'briefings'))
    .filter(f => f.endsWith('.json'));

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Seazone — Máquina de Criativos</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  :root { --blue: #0055FF; --navy: #00143D; --coral: #FC6058; --green: #34d399; --muted: rgba(255,255,255,0.4); --border: rgba(255,255,255,0.08); --surface: rgba(255,255,255,0.04); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; background: var(--navy); color: #fff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
  header { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 1.2rem 2.5rem; border-bottom: 1px solid var(--border); }
  .logo { font-size: 1.6rem; font-weight: 800; } .logo .o { color: var(--coral); }
  .logo-sub { font-size: .65rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.25em; color: var(--muted); }
  main { width: 100%; max-width: 720px; padding: 2.5rem 1.5rem; }
  h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: .5rem; }
  .desc { color: var(--muted); font-size: .85rem; margin-bottom: 2rem; line-height: 1.6; }
  .form-group { margin-bottom: 1.5rem; }
  label { display: block; font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: .4rem; }
  input, select, textarea { width: 100%; padding: .7rem 1rem; font-size: .9rem; font-family: 'DM Sans', sans-serif; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: #fff; outline: none; transition: border-color .2s; }
  input:focus, select:focus, textarea:focus { border-color: var(--blue); }
  input::placeholder { color: rgba(255,255,255,0.2); }
  select { cursor: pointer; }
  select option { background: var(--navy); }
  .btn { display: inline-flex; align-items: center; gap: .5rem; padding: .8rem 2rem; font-size: .9rem; font-weight: 700; font-family: 'DM Sans', sans-serif; border: none; border-radius: 10px; cursor: pointer; transition: all .2s; }
  .btn-primary { background: var(--coral); color: #fff; }
  .btn-primary:hover { background: #e0504a; transform: translateY(-1px); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
  .btn-secondary { background: var(--surface); color: #fff; border: 1px solid var(--border); }
  .btn-secondary:hover { border-color: rgba(255,255,255,0.2); }
  .btns { display: flex; gap: 1rem; margin-top: 2rem; }
  .preview-box { margin-top: 1.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; display: none; }
  .preview-box.show { display: block; }
  .preview-title { font-size: .75rem; font-weight: 700; color: var(--coral); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: .8rem; }
  .preview-row { display: flex; gap: .5rem; margin-bottom: .5rem; font-size: .8rem; }
  .preview-label { color: var(--muted); min-width: 120px; }
  .preview-value { color: rgba(255,255,255,0.85); word-break: break-word; }
  .preview-value.ok { color: var(--green); }
  .preview-value.miss { color: var(--coral); }
  .status-box { margin-top: 2rem; background: rgba(0,0,0,0.2); border: 1px solid var(--border); border-radius: 12px; padding: 1.2rem; display: none; }
  .status-box.show { display: block; }
  .status-title { font-size: .85rem; font-weight: 700; margin-bottom: .8rem; }
  .status-log { font-size: .75rem; color: rgba(255,255,255,0.6); max-height: 300px; overflow-y: auto; line-height: 1.8; font-family: monospace; }
  .status-log .ok { color: var(--green); } .status-log .erro { color: var(--coral); } .status-log .warn { color: #fbbf24; }
  .result-link { display: inline-block; margin-top: 1rem; padding: .6rem 1.5rem; background: var(--blue); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: .85rem; }
  .divider { height: 1px; background: var(--border); margin: 2rem 0; }
  .briefings-list { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
  .briefing-chip { font-size: .7rem; padding: .3rem .8rem; background: rgba(0,85,255,0.15); border: 1px solid rgba(0,85,255,0.2); border-radius: 6px; color: rgba(255,255,255,0.6); }
</style>
</head>
<body>

<header>
  <div>
    <div class="logo">SEAZ<span class="o">O</span>NE</div>
    <div class="logo-sub">Máquina de Criativos</div>
  </div>
</header>

<main>
  <h2>Gerar Criativos</h2>
  <p class="desc">Cole o link do Lovable do empreendimento. O sistema extrai os dados da página e gera automaticamente os criativos (estáticos + storyboard de vídeo).</p>

  <form id="formLovable" onsubmit="return false;">
    <div class="form-group">
      <label>Link do Lovable</label>
      <input type="url" id="urlInput" placeholder="https://seu-projeto.lovable.app" required>
    </div>

    <div class="btns">
      <button type="button" class="btn btn-secondary" onclick="extrairDados()">Extrair Dados</button>
    </div>
  </form>

  <div class="preview-box" id="previewBox">
    <div class="preview-title">Dados extraídos do Lovable</div>
    <div id="previewContent"></div>
    <div class="form-group" style="margin-top:1rem;">
      <label>Briefing base (opcional — complementa dados extraídos)</label>
      <select id="briefingSelect">
        <option value="">Nenhum — usar apenas dados do Lovable</option>
        ${briefings.map(f => `<option value="${f}">${f.replace('.json','')}</option>`).join('')}
      </select>
    </div>
    <div class="btns">
      <button class="btn btn-primary" onclick="gerarCriativos()">Gerar Criativos</button>
    </div>
  </div>

  <div class="status-box" id="statusBox">
    <div class="status-title">Gerando criativos...</div>
    <div class="status-log" id="statusLog"></div>
    <div id="resultLink"></div>
  </div>

  <div class="divider"></div>
  <div>
    <label>Briefings disponíveis</label>
    <div class="briefings-list">
      ${briefings.map(f => `<span class="briefing-chip">${f.replace('.json','')}</span>`).join('')}
    </div>
  </div>
</main>

<script>
let dadosExtraidos = null;

async function extrairDados() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return alert('Cole um link do Lovable');

  const preview = document.getElementById('previewBox');
  const content = document.getElementById('previewContent');
  content.innerHTML = '<div style="color:var(--muted);font-size:.8rem;">Extraindo dados...</div>';
  preview.classList.add('show');

  try {
    const res = await fetch('/api/extrair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao extrair');

    dadosExtraidos = data;
    const campos = [
      ['Título', data.titulo],
      ['Descrição', data.descricao],
      ['ROI', data.roi],
      ['Rendimento mensal', data.rendimento_mensal],
      ['Ticket / Cota', data.ticket],
      ['Valorização', data.valorizacao],
      ['Imagem OG', data.imagem_og ? '<img src="'+data.imagem_og+'" style="max-width:200px;border-radius:6px;margin-top:.3rem;">' : null],
      ['Tamanho HTML', (data.html_tamanho/1024).toFixed(0) + 'KB'],
    ];

    content.innerHTML = campos.map(([label, val]) =>
      '<div class="preview-row"><span class="preview-label">' + label + '</span><span class="preview-value ' + (val ? 'ok' : 'miss') + '">' + (val || 'não encontrado') + '</span></div>'
    ).join('');
  } catch (e) {
    content.innerHTML = '<div style="color:var(--coral);font-size:.85rem;">Erro: ' + e.message + '</div>';
  }
}

async function gerarCriativos() {
  const url = document.getElementById('urlInput').value.trim();
  const briefing = document.getElementById('briefingSelect').value;
  if (!url) return alert('Cole um link');

  const statusBox = document.getElementById('statusBox');
  const statusLog = document.getElementById('statusLog');
  const resultLink = document.getElementById('resultLink');
  statusBox.classList.add('show');
  statusLog.innerHTML = '<span class="ok">Iniciando geração...</span>\\n';
  resultLink.innerHTML = '';

  try {
    const res = await fetch('/api/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, briefing, dadosExtraidos }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split('\\n').filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'log') {
            const cls = msg.nivel === 'ok' ? 'ok' : msg.nivel === 'erro' ? 'erro' : msg.nivel === 'warn' ? 'warn' : '';
            statusLog.innerHTML += '<span class="' + cls + '">' + msg.msg + '</span>\\n';
            statusLog.scrollTop = statusLog.scrollHeight;
          } else if (msg.type === 'done') {
            statusLog.innerHTML += '<span class="ok">\\n=== CONCLUÍDO === ' + msg.total + ' assets gerados</span>\\n';
            resultLink.innerHTML = '<a class="result-link" href="/output/visualizar.html" target="_blank">Ver Criativos →</a>';
          } else if (msg.type === 'error') {
            statusLog.innerHTML += '<span class="erro">ERRO: ' + msg.msg + '</span>\\n';
          }
        } catch {}
      }
    }
  } catch (e) {
    statusLog.innerHTML += '<span class="erro">Erro: ' + e.message + '</span>\\n';
  }
}
</script>
</body>
</html>`);
});

// ── API: Extrair dados do Lovable ────────────────────────────────────────────
app.post('/api/extrair', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL obrigatória' });
    const dados = await extrairDadosLovable(url);
    res.json(dados);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: Gerar criativos (streaming de progresso) ────────────────────────────
app.post('/api/gerar', async (req, res) => {
  const { url, briefing: briefingFile, dadosExtraidos } = req.body;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  const send = (type, data) => {
    res.write(JSON.stringify({ type, ...data }) + '\n');
  };
  const log = (msg, nivel = 'info') => {
    send('log', { msg, nivel });
    console.log(`  [${nivel}] ${msg}`);
  };

  try {
    // 1. Carregar ou construir briefing
    let briefing;
    if (briefingFile) {
      log(`Carregando briefing: ${briefingFile}`);
      briefing = await fs.readJson(path.join(__dirname, 'briefings', briefingFile));
    } else {
      log('Usando dados extraídos do Lovable como briefing');
      briefing = buildBriefingFromLovable(dadosExtraidos || {});
    }

    // Enriquecer com dados do Lovable se disponíveis
    if (dadosExtraidos) {
      if (dadosExtraidos.roi && !briefing.roi_percentual) briefing.roi_percentual = dadosExtraidos.roi;
      if (dadosExtraidos.rendimento_mensal && !briefing.rendimento_mensal) briefing.rendimento_mensal = dadosExtraidos.rendimento_mensal;
      if (dadosExtraidos.valorizacao && !briefing.valorizacao_estimada) briefing.valorizacao_estimada = dadosExtraidos.valorizacao;
      if (dadosExtraidos.ticket && !briefing.ticket_medio) briefing.ticket_medio = dadosExtraidos.ticket;
      briefing._lovable_url = url;
    }

    log(`Briefing: ${briefing.produto}`, 'ok');
    log(`ROI: ${briefing.roi_percentual} | Rendimento: ${briefing.rendimento_mensal}`);

    // 2. Importar e rodar pipeline
    const { configurar, gerarImagem, salvar } = await import('./src/fal.js');
    const { callGemini } = await import('./src/gemini.js');
    const { buildSystem, promptEstatico, promptNarrado, promptApresentadora } = await import('./src/prompts.js');

    if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY não configurada');
    configurar();

    // Verificar assets
    const assetsDir = path.join(__dirname, 'assets');
    const assetsDisponiveis = await fs.readdir(assetsDir);
    const imageAssets = assetsDisponiveis.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    log(`${imageAssets.length} assets de imagem encontrados`, 'ok');

    // Mapear assets disponíveis
    const findAsset = (keywords) => {
      for (const kw of keywords) {
        const found = imageAssets.find(f => f.toLowerCase().includes(kw.toLowerCase()));
        if (found) return path.join('assets', found);
      }
      return imageAssets[0] ? path.join('assets', imageAssets[0]) : null;
    };

    const assetFachada  = findAsset(['fachada', 'facade', 'prédio', 'building']);
    const assetRooftop  = findAsset(['rooftop', 'piscina', 'pool', 'terraço']);
    const assetAereo    = findAsset(['aérea', 'aerea', 'aerial', 'drone', 'estático', 'estatico', 'feed']);
    const assetMonica   = findAsset(['mônica', 'monica', 'apresentadora', 'presenter']);

    log(`Fachada: ${assetFachada || 'N/A'}`);
    log(`Rooftop: ${assetRooftop || 'N/A'}`);
    log(`Aéreo: ${assetAereo || 'N/A'}`);
    log(`Apresentadora: ${assetMonica || 'N/A'}`);

    await fs.ensureDir('output');
    let totalAssets = 0;

    // ── E1.1 Estático ───────────────────────────────────────────────────────
    log('\n━━ E1.1 — Estático ━━', 'ok');
    try {
      log('Gemini → copy...');
      const copyE = await callGemini(process.env.GOOGLE_API_KEY, buildSystem(briefing), promptEstatico(briefing));
      await fs.ensureDir('output/E1.1');
      await fs.writeJson('output/E1.1/copy.json', copyE, { spaces: 2 });
      log(`Headline: "${(copyE.headline || '').slice(0, 60)}"`, 'ok');

      const formatos = [
        { fmt: 'feed_1x1', ref: assetFachada || assetAereo },
        { fmt: 'reels_9x16', ref: assetRooftop || assetFachada },
        { fmt: 'story_9x16', ref: assetAereo || assetFachada },
      ];
      for (const { fmt, ref } of formatos) {
        log(`Gerando ${fmt}...`);
        const img = await gerarImagem(copyE.prompt_visual_en, fmt, log, ref);
        if (img?.buffer) {
          const dest = `output/E1.1/${fmt}.${img.ext || 'png'}`;
          await salvar(img.buffer, dest);
          log(`Salvo: ${dest}`, 'ok');
          totalAssets++;
        }
      }
    } catch (e) {
      log(`E1.1 falhou: ${e.message}`, 'erro');
    }

    // ── VN1.1 Vídeo Narrado ─────────────────────────────────────────────────
    log('\n━━ VN1.1 — Vídeo Narrado ━━', 'ok');
    try {
      log('Gemini → roteiro...');
      const copyVN = await callGemini(process.env.GOOGLE_API_KEY, buildSystem(briefing), promptNarrado(briefing));
      await fs.ensureDir('output/VN1.1');
      await fs.writeJson('output/VN1.1/copy.json', copyVN, { spaces: 2 });
      log(`Título: "${(copyVN.titulo || '').slice(0, 60)}"`, 'ok');

      const cenasRef = [
        { num: 1, ref: assetAereo, prompt: 'Cinematic aerial drone shot of coastal neighborhood, low-rise buildings, turquoise sea, blue sky, vivid colors, 4K quality' },
        { num: 2, ref: assetFachada, prompt: 'Modern 4-story building facade, concrete and wood panels, glass windows, tropical vegetation, premium real estate style' },
        { num: 3, ref: assetFachada, prompt: 'Street-level view of modern coastal building with palm trees, ocean in background, bright vivid colors, warm afternoon light' },
        { num: 4, ref: assetRooftop, prompt: 'Luxury rooftop with infinity pool, wooden deck, gourmet area, panoramic coastal view, golden hour, premium mood' },
      ];

      for (const fmt of ['feed_1x1', 'reels_9x16']) {
        for (const cena of cenasRef) {
          const label = `cena_${cena.num}_${fmt}`;
          log(`Gerando ${label}...`);
          const img = await gerarImagem(cena.prompt, fmt, log, cena.ref);
          if (img?.buffer) {
            const dest = `output/VN1.1/${label}.${img.ext || 'png'}`;
            await salvar(img.buffer, dest);
            log(`Salvo: ${dest}`, 'ok');
            totalAssets++;
          }
        }
      }
    } catch (e) {
      log(`VN1.1 falhou: ${e.message}`, 'erro');
    }

    // ── VA1.1 Vídeo Apresentadora ───────────────────────────────────────────
    log('\n━━ VA1.1 — Vídeo Apresentadora ━━', 'ok');
    try {
      log('Gemini → roteiro...');
      const copyVA = await callGemini(process.env.GOOGLE_API_KEY, buildSystem(briefing), promptApresentadora(briefing));
      await fs.ensureDir('output/VA1.1');
      await fs.writeJson('output/VA1.1/copy.json', copyVA, { spaces: 2 });
      log(`Título: "${(copyVA.titulo || '').slice(0, 60)}"`, 'ok');

      const cenasRef = [
        { num: 1, ref: assetAereo, prompt: 'Cinematic aerial drone shot of vibrant coastal neighborhood, turquoise ocean, clear blue sky, bright vivid colors' },
        { num: 2, ref: assetMonica, prompt: 'Professional woman in blue dress on beach boardwalk, confident posture, tropical vegetation, sunny day, natural warm lighting' },
        { num: 3, ref: assetFachada, prompt: 'Modern building with concrete and wood facade, glass windows, tropical plants, premium real estate style, warm daylight' },
        { num: 4, ref: assetRooftop, prompt: 'Luxury rooftop infinity pool, wooden deck, gourmet area, panoramic coastal view, golden hour, aspirational mood' },
      ];

      for (const fmt of ['feed_1x1', 'reels_9x16']) {
        for (const cena of cenasRef) {
          const label = `cena_${cena.num}_${fmt}`;
          log(`Gerando ${label}...`);
          const img = await gerarImagem(cena.prompt, fmt, log, cena.ref);
          if (img?.buffer) {
            const dest = `output/VA1.1/${label}.${img.ext || 'png'}`;
            await salvar(img.buffer, dest);
            log(`Salvo: ${dest}`, 'ok');
            totalAssets++;
          }
        }
      }
    } catch (e) {
      log(`VA1.1 falhou: ${e.message}`, 'erro');
    }

    send('done', { total: totalAssets });
  } catch (e) {
    send('error', { msg: e.message });
  }

  res.end();
});

// ── Construir briefing a partir de dados do Lovable ──────────────────────────
function buildBriefingFromLovable(dados) {
  return {
    produto: dados.titulo || 'Empreendimento',
    endereco: '',
    roi_percentual: dados.roi || 'N/A',
    rendimento_mensal: dados.rendimento_mensal || 'N/A',
    rendimento_anual: '',
    ticket_medio: dados.ticket || 'N/A',
    valorizacao_estimada: dados.valorizacao || 'N/A',
    quantidade_cotas: '',
    pilares: ['ROI', 'Localização', 'Rendimento mensal', 'Fachada'],
    dos: [
      'Colocar SEMPRE um pin de localização do empreendimento',
      'Transições suaves entre cenas',
    ],
    donts: [
      'Não usar as palavras: garantido, certeza, prometemos',
      'Não usar efeitos que escureçam a imagem',
      'Não colocar molduras no vídeo',
    ],
    publico_alvo: { prioridade_1: 'Investidores', prioridade_2: 'Público geral' },
    tom: 'Autoridade — como dono do empreendimento',
    disclaimer: 'Este material tem caráter exclusivamente informativo e não constitui uma promessa de rentabilidade futura ou garantia de retorno financeiro.',
    _lovable_url: dados.url,
  };
}

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Seazone — Máquina de Criativos`);
  console.log(`  http://localhost:${PORT}\n`);
});
