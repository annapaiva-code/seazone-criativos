// src/audit.js — Valida arquivos e paths do projeto
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'assets');
const BRIEFINGS_DIR = path.join(ROOT, 'briefings');
const OUTPUT_DIR = path.join(ROOT, 'output');

function log(msg, nivel = 'info') {
  const cores = { info: chalk.white, ok: chalk.green, warn: chalk.yellow, erro: chalk.red };
  const pref = { info: '  ', ok: '+ ', warn: '! ', erro: 'x ' };
  console.log(cores[nivel](`${pref[nivel]}${msg}`));
}

// Categoriza assets por tipo
function categorizar(arquivo) {
  const lower = arquivo.toLowerCase();
  if (lower.includes('logo')) return 'branding';
  if (lower.includes('casinha')) return 'branding';
  if (lower.startsWith('est')) return 'referencias';
  if (lower.includes('monica') || lower.includes('mônica')) return 'apresentadora';
  if (lower.includes('feed-narrados') || lower.includes('reels-novo')) return 'videos_referencia';
  return 'empreendimento';
}

async function audit() {
  console.log(chalk.blue.bold('\n  SEAZONE — AUDITORIA DE ASSETS\n'));

  let erros = 0;
  let avisos = 0;

  // 1. Verificar diretórios
  for (const [nome, dir] of [['assets', ASSETS_DIR], ['briefings', BRIEFINGS_DIR], ['output', OUTPUT_DIR]]) {
    if (await fs.pathExists(dir)) {
      log(`Diretorio ${nome}/ encontrado`, 'ok');
    } else {
      log(`Diretorio ${nome}/ NAO encontrado`, 'erro');
      erros++;
    }
  }

  // 2. Listar e categorizar assets
  const arquivos = await fs.readdir(ASSETS_DIR);
  const categorias = { branding: [], referencias: [], empreendimento: [], apresentadora: [], videos_referencia: [] };

  for (const arq of arquivos) {
    const cat = categorizar(arq);
    categorias[cat].push(arq);
  }

  console.log(chalk.cyan('\n  Assets encontrados:\n'));
  for (const [cat, lista] of Object.entries(categorias)) {
    if (lista.length === 0) continue;
    console.log(chalk.white.bold(`  ${cat.toUpperCase()} (${lista.length}):`));
    lista.forEach(a => log(a, 'ok'));
    console.log();
  }

  // 3. Verificar briefing
  const briefingPath = path.join(BRIEFINGS_DIR, 'novo_campeche_spot2.json');
  if (await fs.pathExists(briefingPath)) {
    const b = await fs.readJson(briefingPath);
    log(`Briefing: ${b.produto}`, 'ok');
    const campos = ['produto', 'endereco', 'roi_percentual', 'rendimento_mensal', 'ticket_medio', 'pilares', 'dos', 'donts', 'publico_alvo', 'tom', 'disclaimer'];
    for (const c of campos) {
      if (!b[c]) {
        log(`Campo ausente no briefing: ${c}`, 'warn');
        avisos++;
      }
    }
  } else {
    log('Briefing nao encontrado', 'erro');
    erros++;
  }

  // 4. Verificar branding na raiz
  for (const arq of ['logo seazone.png', 'Casinha-3.png']) {
    const p = path.join(ROOT, arq);
    if (await fs.pathExists(p)) {
      log(`Raiz: ${arq}`, 'ok');
    } else {
      log(`Raiz: ${arq} nao encontrado`, 'warn');
      avisos++;
    }
  }

  // 5. Verificar outputs existentes
  console.log(chalk.cyan('\n  Outputs existentes:\n'));
  for (const jobId of ['E1.1', 'VN1.1', 'VA1.1']) {
    const jobDir = path.join(OUTPUT_DIR, jobId);
    if (await fs.pathExists(jobDir)) {
      const files = await fs.readdir(jobDir);
      log(`${jobId}/: ${files.join(', ')}`, 'ok');
    } else {
      log(`${jobId}/: nao encontrado`, 'warn');
      avisos++;
    }
  }

  // 6. Gerar assets-map.json
  const assetsMap = {
    _gerado_em: new Date().toISOString(),
    _diretorio: 'assets/',
    branding: categorias.branding.map(f => ({ arquivo: f, caminho: `assets/${f}` })),
    referencias: categorias.referencias.map(f => ({ arquivo: f, caminho: `assets/${f}` })),
    empreendimento: categorias.empreendimento.map(f => ({ arquivo: f, caminho: `assets/${f}` })),
    apresentadora: categorias.apresentadora.map(f => ({ arquivo: f, caminho: `assets/${f}` })),
    videos_referencia: categorias.videos_referencia.map(f => ({ arquivo: f, caminho: `assets/${f}` })),
    branding_raiz: [
      { arquivo: 'logo seazone.png', caminho: 'logo seazone.png' },
      { arquivo: 'Casinha-3.png', caminho: 'Casinha-3.png' },
    ],
  };

  await fs.ensureDir(path.join(OUTPUT_DIR, 'data'));
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'assets-map.json'), assetsMap, { spaces: 2 });
  log('assets-map.json gerado', 'ok');

  // Resumo
  console.log(chalk.blue.bold('\n  RESUMO'));
  console.log(chalk.white(`  Total de assets: ${arquivos.length}`));
  console.log(chalk.white(`  Categorias: ${Object.entries(categorias).filter(([,v]) => v.length > 0).map(([k,v]) => `${k}(${v.length})`).join(', ')}`));
  if (erros > 0) console.log(chalk.red(`  Erros: ${erros}`));
  if (avisos > 0) console.log(chalk.yellow(`  Avisos: ${avisos}`));
  if (erros === 0) console.log(chalk.green.bold('\n  Auditoria OK — pronto para gerar criativos\n'));
  else console.log(chalk.red.bold('\n  Corrija os erros antes de continuar\n'));

  return erros === 0;
}

audit().catch(e => {
  console.error(chalk.red.bold(`\nErro: ${e.message}`));
  process.exit(1);
});
