// teste.js — Pipeline 100% assets reais + Gemini Image (gratuito)
import 'dotenv/config';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { callGemini } from './src/gemini.js';
import { configurar, gerarImagem, salvar } from './src/fal.js';
import { buildSystem, promptEstatico, promptNarrado, promptApresentadora } from './src/prompts.js';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Logger ────────────────────────────────────────────────────────────────────
function log(msg, nivel = 'info') {
  const cores = { info: chalk.white, ok: chalk.green, warn: chalk.yellow, erro: chalk.red };
  const pref  = { info: '  ', ok: '+ ', warn: '! ', erro: 'x ' };
  console.log(cores[nivel](`${pref[nivel]}${msg}`));
}

// ══════════════════════════════════════════════════════════════════════════════
// ASSETS REAIS — somente arquivos que existem em assets/
// ══════════════════════════════════════════════════════════════════════════════

// Estático: cada formato usa um asset real como referência para img2img
const ASSETS_ESTATICO = {
  feed_1x1:   'assets/fachada.png',
  reels_9x16: 'assets/rooftop.png',
  story_9x16: 'assets/Estático- Feed.jpg',
};

// Vídeo Narrado: cada cena usa um asset real como referência
const CENAS_NARRADO = [
  {
    num: 1,
    asset: 'assets/Estático- Feed.jpg',
    prompt_en: 'Cinematic aerial drone shot slowly approaching a coastal neighborhood in Florianópolis, Brazil. Low-rise white residential buildings, vibrant green grassy field, turquoise sea with gentle waves in background, well-maintained tree-lined streets, bright clean blue sky. 4K cinematic quality, vivid saturated colors, golden hour warm light.',
  },
  {
    num: 2,
    asset: 'assets/fachada.png',
    prompt_en: 'Smooth cinematic view of a modern 4-story building facade. Contemporary architecture with exposed concrete, slatted wood panels, and large glass windows. Tropical vegetation at the entrance, bicycles parked outside. Warm natural daylight, premium real estate style.',
  },
  {
    num: 3,
    asset: 'assets/fachada.png',
    prompt_en: 'Street-level view of a modern coastal building with palm trees. Low-rise residential neighborhood, turquoise ocean visible in the far background. Bright vivid colors, clear blue sky. Cinematic 4K quality, warm afternoon light.',
  },
  {
    num: 4,
    asset: 'assets/rooftop.png',
    prompt_en: 'Luxury rooftop deck view. Wooden deck surface, infinity pool with LED lighting, gourmet area with stone counter. Panoramic view of coastal neighborhood and blue sky. Warm golden hour tones, aspirational premium mood.',
  },
];

// Vídeo Apresentadora: cada cena usa um asset real como referência
const CENAS_APRESENTADORA = [
  {
    num: 1,
    asset: 'assets/Estático- Feed.jpg',
    prompt_en: 'Cinematic aerial drone shot approaching a vibrant coastal neighborhood in Florianópolis. Low-rise white buildings, green fields, turquoise ocean with waves, clear blue sky. Bright vivid colors, 4K quality.',
  },
  {
    num: 2,
    asset: 'assets/Mônica 2.jpeg',
    prompt_en: 'Professional woman in blue striped dress on wooden beach boardwalk, confident posture. Green tropical vegetation around, bright sunny day. Natural warm lighting, cinematic quality.',
  },
  {
    num: 3,
    asset: 'assets/fachada.png',
    prompt_en: 'Modern 4-story building with concrete and slatted wood facade. Glass windows reflecting light, tropical plants at entrance. Premium real estate cinematic style. Warm natural daylight, clean architectural lines.',
  },
  {
    num: 4,
    asset: 'assets/rooftop.png',
    prompt_en: 'Luxury rooftop with infinity pool, wooden deck, and gourmet area with counter. Panoramic view of coastal neighborhood. Blue sky, warm golden hour light. Aspirational premium mood, cinematic wide angle.',
  },
];

// ── Processar estático (img2img com Gemini) ──────────────────────────────────
async function processarEstatico({ id, promptFn, formatos, assetsMap }) {
  console.log(chalk.cyan(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
  console.log(chalk.cyan(`  ${id} — Estático (img2img via Gemini)`));
  console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));

  const resultado = { id, tipo: 'estático', copy: null, assets: {}, erro: null };

  // 1. Gemini — copy
  if (!DRY_RUN) {
    try {
      log('Gemini 2.5 Flash — gerando copy...');
      resultado.copy = await callGemini(
        process.env.GOOGLE_API_KEY,
        buildSystem(briefing),
        promptFn(briefing)
      );
      await fs.ensureDir(`output/${id}`);
      await fs.writeJson(`output/${id}/copy.json`, resultado.copy, { spaces: 2 });
      log(`copy: "${(resultado.copy.headline || '').slice(0, 70)}"`, 'ok');
    } catch (e) {
      log(`Gemini falhou: ${e.message}`, 'erro');
      resultado.erro = e.message;
      return resultado;
    }
  } else {
    log('[dry-run] pulando Gemini', 'warn');
    resultado.copy = { prompt_visual_en: 'Aerial drone shot of coastal neighborhood' };
  }

  // 2. Gerar imagem por formato usando asset real como referência
  const prompt = resultado.copy.prompt_visual_en;
  for (const fmt of formatos) {
    const ref = assetsMap[fmt];
    log(`\nFormato: ${fmt}`);
    log(`  ref: ${ref}`);
    if (DRY_RUN) { log(`[dry-run] pulando (${fmt})`, 'warn'); continue; }

    const result = await gerarImagem(prompt, fmt, log, ref);
    if (result?.buffer) {
      const destino = path.join('output', id, `${fmt}.${result.ext || 'png'}`);
      await salvar(result.buffer, destino);
      resultado.assets[fmt] = { caminho: destino, modelo: result.modelo, ref };
      log(`salvo: ${destino}`, 'ok');
    } else {
      log(`falhou: ${fmt}`, 'erro');
    }
  }

  return resultado;
}

// ── Processar vídeo: gera storyboard (imagem) por cena ──────────────────────
async function processarVideo({ id, tipo, promptFn, formatos, cenas }) {
  console.log(chalk.cyan(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
  console.log(chalk.cyan(`  ${id} — ${tipo} (storyboard via Gemini)`));
  console.log(chalk.cyan(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));

  const resultado = { id, tipo, copy: null, assets: {}, erro: null };

  // 1. Gemini — roteiro
  if (!DRY_RUN) {
    try {
      log('Gemini 2.5 Flash — gerando roteiro...');
      resultado.copy = await callGemini(
        process.env.GOOGLE_API_KEY,
        buildSystem(briefing),
        promptFn(briefing)
      );
      await fs.ensureDir(`output/${id}`);
      await fs.writeJson(`output/${id}/copy.json`, resultado.copy, { spaces: 2 });
      log(`roteiro: "${(resultado.copy.titulo || '').slice(0, 70)}"`, 'ok');
      log(`${resultado.copy.cenas?.length || 0} cenas`, 'ok');
    } catch (e) {
      log(`Gemini falhou: ${e.message}`, 'erro');
      resultado.erro = e.message;
      return resultado;
    }
  } else {
    log('[dry-run] pulando Gemini', 'warn');
    resultado.copy = { titulo: 'dry-run', cenas: [] };
  }

  // 2. Gerar storyboard frame (imagem) por cena × formato
  for (const fmt of formatos) {
    for (const cena of cenas) {
      const label = `cena_${cena.num}_${fmt}`;
      log(`\n${label} (ref: ${path.basename(cena.asset)})`);

      if (DRY_RUN) { log(`[dry-run] pulando (${label})`, 'warn'); continue; }

      // Gerar imagem usando asset real como referência
      const result = await gerarImagem(cena.prompt_en, fmt, log, cena.asset);
      if (result?.buffer) {
        const destino = path.join('output', id, `${label}.${result.ext || 'png'}`);
        await salvar(result.buffer, destino);
        resultado.assets[label] = { caminho: destino, modelo: result.modelo, ref: cena.asset, cena: cena.num };
        log(`frame salvo: ${destino}`, 'ok');
      } else {
        log(`falhou: ${label}`, 'erro');
      }
    }
  }

  return resultado;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const briefing = JSON.parse(
  await fs.readFile('briefings/novo_campeche_spot2.json', 'utf-8')
);

async function main() {
  console.log(chalk.blue.bold('\n══════════════════════════════════════'));
  console.log(chalk.blue.bold('  SEAZONE — MAQUINA DE CRIATIVOS'));
  console.log(chalk.blue.bold('  Gemini Image + assets reais'));
  console.log(chalk.blue.bold('══════════════════════════════════════\n'));

  let providers = [];
  if (!DRY_RUN) {
    if (!process.env.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY não configurada');
    providers = configurar();
    log(`Provedores: ${providers.join(', ')}`, 'ok');
  } else {
    log('MODO DRY-RUN', 'warn');
  }

  log(`Briefing: ${briefing.produto}`);
  log(`ROI: ${briefing.roi_percentual} | Rendimento: ${briefing.rendimento_mensal}`);

  // Verificar assets
  log('\nVerificando assets reais...');
  const todosAssets = new Set([
    ...Object.values(ASSETS_ESTATICO),
    ...CENAS_NARRADO.map(c => c.asset),
    ...CENAS_APRESENTADORA.map(c => c.asset),
  ]);
  let ok = true;
  for (const a of todosAssets) {
    if (await fs.pathExists(a)) {
      const s = await fs.stat(a);
      log(`${a} (${(s.size / 1024 / 1024).toFixed(1)}MB)`, 'ok');
    } else {
      log(`FALTANDO: ${a}`, 'erro');
      ok = false;
    }
  }
  if (!ok) { log('\nAssets faltando!', 'erro'); process.exit(1); }
  log(`${todosAssets.size} assets OK\n`, 'ok');

  await fs.ensureDir('output');
  const inicio = Date.now();

  // ── Job 1: Estático (img2img com Gemini Image) ────────────────────────────
  const r1 = await processarEstatico({
    id: 'E1.1',
    promptFn: promptEstatico,
    formatos: ['feed_1x1', 'reels_9x16', 'story_9x16'],
    assetsMap: ASSETS_ESTATICO,
  });

  // ── Job 2: Vídeo Narrado (storyboard por cena) ────────────────────────────
  const r2 = await processarVideo({
    id: 'VN1.1',
    tipo: 'vídeo narrado',
    promptFn: promptNarrado,
    formatos: ['feed_1x1', 'reels_9x16'],
    cenas: CENAS_NARRADO,
  });

  // ── Job 3: Vídeo Apresentadora (storyboard por cena) ──────────────────────
  const r3 = await processarVideo({
    id: 'VA1.1',
    tipo: 'vídeo apresentadora',
    promptFn: promptApresentadora,
    formatos: ['feed_1x1', 'reels_9x16'],
    cenas: CENAS_APRESENTADORA,
  });

  // ── Relatório ──────────────────────────────────────────────────────────────
  const tempo = Math.round((Date.now() - inicio) / 1000);
  const resultados = [r1, r2, r3];

  const relatorio = {
    data: new Date().toLocaleString('pt-BR'),
    produto: briefing.produto,
    modo: 'Gemini Image + assets reais (img2img multimodal)',
    provedores: providers,
    tempo_segundos: tempo,
    assets_base: [...todosAssets],
    jobs: resultados.map(r => ({
      id: r.id,
      tipo: r.tipo,
      copy_gerado: !!r.copy,
      titulo: r.copy?.headline || r.copy?.titulo || null,
      assets_gerados: Object.keys(r.assets),
      modelos: [...new Set(Object.values(r.assets).map(a => a.modelo))],
      refs: [...new Set(Object.values(r.assets).map(a => a.ref).filter(Boolean))],
      erro: r.erro,
    })),
  };

  await fs.writeJson('output/relatorio_teste.json', relatorio, { spaces: 2 });

  const md = `# Seazone — Máquina de Criativos
**Produto:** ${briefing.produto}
**Data:** ${relatorio.data}
**Tempo:** ${tempo}s
**Provedores:** ${providers.join(', ')}
**Modo:** Gemini Image — img2img multimodal com assets reais

## Assets reais usados como referência
${[...todosAssets].map(a => `- \`${a}\``).join('\n')}

## Resultados

${resultados.map(r => `### ${r.id} — ${r.tipo}
- Copy: ${r.copy ? '+ OK' : 'x falhou'}
${r.copy?.headline ? `- Headline: "${r.copy.headline}"` : ''}
${r.copy?.titulo ? `- Título: "${r.copy.titulo}"` : ''}
- Assets gerados: ${Object.keys(r.assets).length}
- Modelos: ${[...new Set(Object.values(r.assets).map(a => a.modelo))].join(', ') || '—'}
- Refs: ${[...new Set(Object.values(r.assets).map(a => a.ref).filter(Boolean))].join(', ') || '—'}
${r.erro ? `- Erro: ${r.erro}` : ''}`).join('\n\n')}
`;

  await fs.writeFile('output/relatorio_teste.md', md);

  // ── Resumo final ───────────────────────────────────────────────────────────
  console.log(chalk.green.bold('\n══════════════════════════════════════'));
  console.log(chalk.green.bold('  GERACAO CONCLUIDA'));
  console.log(chalk.green.bold('══════════════════════════════════════'));

  resultados.forEach(r => {
    const n = Object.keys(r.assets).length;
    const status = r.copy && n > 0 ? chalk.green('+') : (r.copy ? chalk.yellow('~') : chalk.red('x'));
    console.log(`  ${status} ${chalk.white(r.id)} — ${n} assets gerados`);
    if (r.copy?.headline) console.log(chalk.gray(`    "${r.copy.headline}"`));
    if (r.copy?.titulo)   console.log(chalk.gray(`    "${r.copy.titulo}"`));
  });

  const total = resultados.reduce((s, r) => s + Object.keys(r.assets).length, 0);
  console.log(chalk.white(`\n  Tempo: ${tempo}s | Total: ${total} assets`));
  console.log(chalk.white(`  Output: output/`));
  console.log(chalk.white(`  Relatório: output/relatorio_teste.md\n`));

  if (total > 0) {
    console.log(chalk.gray('  Nota: vídeos não gerados (requer fal.ai ou Runway).'));
    console.log(chalk.gray('  Os storyboard frames podem ser usados como first-frame'));
    console.log(chalk.gray('  em ferramentas de img2video.\n'));
  }
}

main().catch(e => {
  console.error(chalk.red.bold(`\nErro: ${e.message}`));
  process.exit(1);
});
