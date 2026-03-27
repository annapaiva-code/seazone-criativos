// src/generate-prompts.js — Gera prompts de imagem e video baseados nos assets reais
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'output', 'data');
const PROMPTS_DIR = path.join(ROOT, 'output', 'prompts');

function log(msg, nivel = 'info') {
  const cores = { info: chalk.white, ok: chalk.green, warn: chalk.yellow, erro: chalk.red };
  const pref = { info: '  ', ok: '+ ', warn: '! ', erro: 'x ' };
  console.log(cores[nivel](`${pref[nivel]}${msg}`));
}

async function generatePrompts() {
  console.log(chalk.blue.bold('\n  SEAZONE — GERACAO DE PROMPTS\n'));

  await fs.ensureDir(PROMPTS_DIR);

  // Carregar dados
  const copyPath = path.join(DATA_DIR, 'copy.json');
  const assetsPath = path.join(DATA_DIR, 'assets-map.json');
  const roteiroPath = path.join(DATA_DIR, 'roteiros.json');

  if (!await fs.pathExists(copyPath)) {
    log('copy.json nao encontrado — rode npm run copy primeiro', 'erro');
    process.exit(1);
  }

  const copy = await fs.readJson(copyPath);
  const assets = await fs.pathExists(assetsPath) ? await fs.readJson(assetsPath) : null;
  const roteiros = await fs.pathExists(roteiroPath) ? await fs.readJson(roteiroPath) : null;

  // ── Prompts Estaticos ──────────────────────────────────────────────────────

  const e1Copy = copy.criativos?.['E1.1'];
  const refAssets = assets?.referencias || [];
  const empreendAssets = assets?.empreendimento || [];

  const estaticosPrompts = {
    _gerado_em: new Date().toISOString(),
    _instrucoes: 'Use estes prompts em ferramentas de geracao de imagem (fal.ai Flux Pro, Midjourney, DALL-E). Os assets de referencia podem ser usados como image_url para img2img.',
    formatos: {
      feed_1x1: {
        aspecto: '1:1',
        resolucao: '1024x1024',
        prompt_en: e1Copy?.prompt_visual_en || null,
        prompt_composicao: e1Copy?.notas_composicao || null,
        overlay_elements: {
          pin_localizacao: e1Copy?.pin_localizacao || 'Novo Campeche, Florianopolis - SC',
          badge: e1Copy?.badge || 'LANCAMENTO',
          headline: e1Copy?.headline || null,
          subheadline: e1Copy?.subheadline || null,
          destaque_financeiro: e1Copy?.destaque_financeiro || null,
          cta: e1Copy?.cta || 'Saiba Mais',
          logo: 'assets/logo.png',
          disclaimer: true,
        },
        assets_referencia: refAssets.filter(a => a.arquivo.toLowerCase().includes('feed')).map(a => a.caminho),
        assets_base: empreendAssets.filter(a =>
          a.arquivo.toLowerCase().includes('fachada') || a.arquivo.toLowerCase().includes('vista')
        ).map(a => a.caminho),
      },
      reels_9x16: {
        aspecto: '9:16',
        resolucao: '576x1024',
        prompt_en: e1Copy?.prompt_visual_en || null,
        prompt_composicao: e1Copy?.notas_composicao || null,
        overlay_elements: {
          pin_localizacao: e1Copy?.pin_localizacao || 'Novo Campeche, Florianopolis - SC',
          badge: e1Copy?.badge || 'LANCAMENTO',
          headline: e1Copy?.headline || null,
          subheadline: e1Copy?.subheadline || null,
          destaque_financeiro: e1Copy?.destaque_financeiro || null,
          cta: e1Copy?.cta || 'Saiba Mais',
          logo: 'assets/logo.png',
          disclaimer: true,
        },
        assets_referencia: refAssets.filter(a => a.arquivo.toLowerCase().includes('reels')).map(a => a.caminho),
        assets_base: empreendAssets.filter(a =>
          a.arquivo.toLowerCase().includes('fachada') || a.arquivo.toLowerCase().includes('vista')
        ).map(a => a.caminho),
      },
      story_9x16: {
        aspecto: '9:16',
        resolucao: '576x1024',
        prompt_en: e1Copy?.prompt_visual_en || null,
        prompt_composicao: e1Copy?.notas_composicao || null,
        overlay_elements: {
          pin_localizacao: e1Copy?.pin_localizacao || 'Novo Campeche, Florianopolis - SC',
          badge: e1Copy?.badge || 'LANCAMENTO',
          headline: e1Copy?.headline || null,
          subheadline: e1Copy?.subheadline || null,
          destaque_financeiro: e1Copy?.destaque_financeiro || null,
          cta: e1Copy?.cta || 'Saiba Mais',
          logo: 'assets/logo.png',
          disclaimer: true,
        },
        assets_referencia: refAssets.filter(a => a.arquivo.toLowerCase().includes('story')).map(a => a.caminho),
        assets_base: empreendAssets.filter(a =>
          a.arquivo.toLowerCase().includes('fachada') || a.arquivo.toLowerCase().includes('rooftop')
        ).map(a => a.caminho),
      },
    },
  };

  await fs.writeJson(path.join(PROMPTS_DIR, 'estaticos.json'), estaticosPrompts, { spaces: 2 });
  log('estaticos.json gerado', 'ok');

  // ── Prompts Video Narrado ──────────────────────────────────────────────────

  const vn1Copy = copy.criativos?.['VN1.1'];
  const vn1Roteiro = roteiros?.roteiros?.['VN1.1'];

  const videoNarradoPrompts = {
    _gerado_em: new Date().toISOString(),
    _instrucoes: 'Use estes prompts para gerar clipes de video (fal.ai Kling, Minimax, Luma). Cada cena deve gerar um clipe separado que sera editado na timeline.',
    prompt_geral_en: vn1Copy?.prompt_visual_en || null,
    formatos: ['feed_1x1', 'reels_9x16'],
    cenas: (vn1Roteiro?.cenas || vn1Copy?.cenas || []).map(cena => ({
      numero: cena.numero,
      tempo: cena.tempo,
      prompt_en: buildScenePrompt(cena, 'narrado'),
      narracao: cena.narracao || null,
      lettering: cena.lettering || null,
      assets_sugeridos: cena.assets_sugeridos || findAssetsForScene(cena, assets),
    })),
    instrucoes_edicao: vn1Copy?.instrucoes_edicao || vn1Roteiro?.instrucoes_edicao || null,
    trilha: 'Instrumental premium, minimalista, sem vocais. Tom inspirador e confiante.',
    assets_video_referencia: assets?.videos_referencia
      ?.filter(a => a.arquivo.toLowerCase().includes('narrad'))
      .map(a => a.caminho) || [],
  };

  await fs.writeJson(path.join(PROMPTS_DIR, 'video-narrado.json'), videoNarradoPrompts, { spaces: 2 });
  log('video-narrado.json gerado', 'ok');

  // ── Prompts Video Apresentadora ────────────────────────────────────────────

  const va1Copy = copy.criativos?.['VA1.1'];
  const va1Roteiro = roteiros?.roteiros?.['VA1.1'];

  const videoApresPrompts = {
    _gerado_em: new Date().toISOString(),
    _instrucoes: 'Video com apresentadora Monica. Cenas com fala_monica usam gravacao real. Cenas com narracao_off usam b-roll gerado ou assets existentes.',
    prompt_geral_en: va1Copy?.prompt_visual_en || null,
    formatos: ['feed_1x1', 'reels_9x16'],
    cenas: (va1Roteiro?.cenas || va1Copy?.cenas || []).map(cena => ({
      numero: cena.numero,
      tempo: cena.tempo,
      tipo_cena: cena.fala_monica ? 'gravacao_apresentadora' : 'broll_gerado',
      prompt_en: buildScenePrompt(cena, 'apresentadora'),
      fala_monica: cena.fala_monica || null,
      narracao_off: cena.narracao_off || null,
      lettering: cena.lettering || null,
      assets_sugeridos: cena.assets_sugeridos || findAssetsForScene(cena, assets),
    })),
    instrucoes_direcao: va1Copy?.instrucoes_direcao || va1Roteiro?.instrucoes_direcao || null,
    instrucoes_edicao: va1Copy?.instrucoes_edicao || va1Roteiro?.instrucoes_edicao || null,
    trilha: 'Moderna e sofisticada, transmite confianca e sucesso. Sem vocais.',
    assets_apresentadora: assets?.apresentadora?.map(a => a.caminho) || [],
    assets_video_referencia: assets?.videos_referencia
      ?.filter(a => a.arquivo.toLowerCase().includes('apresentadora'))
      .map(a => a.caminho) || [],
  };

  await fs.writeJson(path.join(PROMPTS_DIR, 'video-apresentadora.json'), videoApresPrompts, { spaces: 2 });
  log('video-apresentadora.json gerado', 'ok');

  console.log(chalk.green.bold('\n  Prompts gerados com sucesso\n'));
}

function buildScenePrompt(cena, tipo) {
  const desc = cena.descricao_visual || '';
  const base = desc.replace(/[—–]/g, ',').trim();

  if (tipo === 'apresentadora' && cena.fala_monica) {
    return `Professional woman presenter at ${base}. Confident posture, direct eye contact with camera. Cinematic 4K, warm golden hour lighting. No text overlays.`;
  }

  const sceneMap = {
    1: `Cinematic aerial drone shot approaching ${base}. Golden hour, warm tones, 4K quality. No text overlays.`,
    2: `Smooth dolly-in shot of ${base}. Modern architecture detail, clean lines. Premium real estate style. No text overlays.`,
    3: `Dynamic lifestyle montage: ${base}. Vibrant colors, warm lighting, professional quality. No text overlays.`,
    4: `Breathtaking panoramic view: ${base}. Dramatic sunset, cinematic wide angle, aspirational mood. No text overlays.`,
  };

  return sceneMap[cena.numero] || `Cinematic shot: ${base}. 4K, professional quality. No text overlays.`;
}

function findAssetsForScene(cena, assets) {
  if (!assets) return [];
  const desc = (cena.descricao_visual || '').toLowerCase();
  const found = [];

  if (desc.includes('drone') || desc.includes('aere') || desc.includes('vista')) {
    found.push(...(assets.empreendimento || []).filter(a =>
      a.arquivo.toLowerCase().includes('vista') || a.arquivo.toLowerCase().includes('aere')
    ).map(a => a.caminho));
  }
  if (desc.includes('fachada')) {
    found.push(...(assets.empreendimento || []).filter(a =>
      a.arquivo.toLowerCase().includes('fachada')
    ).map(a => a.caminho));
  }
  if (desc.includes('rooftop') || desc.includes('entardecer')) {
    found.push(...(assets.empreendimento || []).filter(a =>
      a.arquivo.toLowerCase().includes('rooftop')
    ).map(a => a.caminho));
  }
  if (desc.includes('monica') || desc.includes('mônica')) {
    found.push(...(assets.apresentadora || []).map(a => a.caminho));
  }
  if (desc.includes('praia')) {
    found.push(...(assets.empreendimento || []).filter(a =>
      a.arquivo.toLowerCase().includes('praia') || a.arquivo.toLowerCase().includes('caminho')
    ).map(a => a.caminho));
  }

  return found;
}

generatePrompts().catch(e => {
  console.error(chalk.red.bold(`\nErro: ${e.message}`));
  process.exit(1);
});
