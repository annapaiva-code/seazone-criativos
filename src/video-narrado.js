// src/video-narrado.js — Gera vídeo narrado (VN1.1) a partir dos storyboard frames
// Usa fal.ai Kling image-to-video com os frames como first-frame
import 'dotenv/config';
import { fal } from '@fal-ai/client';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

// ── Config ───────────────────────────────────────────────────────────────────
fal.config({ credentials: process.env.FAL_KEY });

const DRY_RUN = process.argv.includes('--dry-run');
const FORMATO = process.argv.includes('--reels') ? 'reels_9x16' : 'feed_1x1';
const ASPECT = FORMATO === 'feed_1x1' ? '1:1' : '9:16';

function log(msg, nivel = 'info') {
  const cores = { info: chalk.white, ok: chalk.green, warn: chalk.yellow, erro: chalk.red };
  const pref = { info: '  ', ok: '+ ', warn: '! ', erro: 'x ' };
  console.log(cores[nivel](`${pref[nivel]}${msg}`));
}

// ── Cenas do vídeo narrado ──────────────────────────────────────────────────
// Prompts cinematográficos para cada cena, baseados nos storyboard frames
const CENAS = [
  {
    num: 1,
    tempo: '0-7s',
    frame: `output/VN1.1/cena_1_${FORMATO}.png`,
    prompt: 'Slow cinematic aerial drone shot pushing forward over a coastal neighborhood. Low-rise white buildings, green field, turquoise sea with gentle waves in background. Camera slowly glides forward revealing more of the neighborhood and ocean. Bright daylight, vivid colors, smooth steady movement.',
    movimento: 'drone push-in lento',
  },
  {
    num: 2,
    tempo: '8-15s',
    frame: `output/VN1.1/cena_2_${FORMATO}.png`,
    prompt: 'Smooth dolly-in shot approaching a modern 4-story building facade. Concrete, slatted wood panels, and glass. Tropical plants sway gently in the breeze. Camera slowly pushes toward the entrance. Warm natural daylight, architectural details in focus. Premium real estate cinematic style.',
    movimento: 'dolly-in fachada',
  },
  {
    num: 3,
    tempo: '16-23s',
    frame: `output/VN1.1/cena_3_${FORMATO}.png`,
    prompt: 'Street-level traveling shot along a tree-lined coastal street. Palm trees sway gently, modern buildings on both sides. Ocean visible in the distance through the street. Camera moves smoothly forward. Bright vivid colors, clear blue sky, warm afternoon light.',
    movimento: 'traveling rua',
  },
  {
    num: 4,
    tempo: '24-35s',
    frame: `output/VN1.1/cena_4_${FORMATO}.png`,
    prompt: 'Cinematic reveal of a luxury rooftop. Camera slowly pans across a wooden deck with infinity pool reflecting the sky. Gourmet area with stone counter visible. Panoramic view of coastal neighborhood and ocean in background. Golden hour warm tones, aspirational premium mood.',
    movimento: 'pan rooftop',
  },
];

// ── Upload imagem para fal storage ──────────────────────────────────────────
async function uploadFrame(framePath) {
  const buffer = await fs.readFile(framePath);
  const blob = new Blob([buffer], { type: 'image/png' });
  const url = await fal.storage.upload(blob);
  return url;
}

// ── Gerar vídeo de uma cena ─────────────────────────────────────────────────
async function gerarCena(cena) {
  log(`\nCena ${cena.num} (${cena.tempo}) — ${cena.movimento}`);
  log(`  frame: ${cena.frame}`);

  if (!await fs.pathExists(cena.frame)) {
    log(`  frame não encontrado: ${cena.frame}`, 'erro');
    return null;
  }

  if (DRY_RUN) {
    log(`  [dry-run] pulando geração`, 'warn');
    return null;
  }

  // Upload frame
  log(`  Enviando frame para fal.ai...`);
  const imageUrl = await uploadFrame(cena.frame);
  log(`  upload OK`, 'ok');

  // Gerar vídeo via Kling 1.5
  log(`  Gerando vídeo (Kling 1.5 Pro, ${ASPECT})...`);
  const result = await fal.subscribe('fal-ai/kling-video/v1.5/pro/image-to-video', {
    input: {
      prompt: cena.prompt,
      image_url: imageUrl,
      duration: '5',
      aspect_ratio: ASPECT,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        const logs = update.logs || [];
        if (logs.length) log(`  ${logs[logs.length - 1].message}`);
      }
    },
  });

  if (result.data?.video?.url) {
    return result.data.video.url;
  }
  log(`  Resposta inesperada: ${JSON.stringify(result.data).slice(0, 200)}`, 'warn');
  return null;
}

// ── Download vídeo ──────────────────────────────────────────────────────────
async function downloadVideo(url, destino) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.ensureDir(path.dirname(destino));
  await fs.writeFile(destino, buffer);
  return buffer.length;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(chalk.cyan.bold('\n══════════════════════════════════════'));
  console.log(chalk.cyan.bold('  VN1.1 — Vídeo Narrado'));
  console.log(chalk.cyan.bold(`  Formato: ${FORMATO} (${ASPECT})`));
  console.log(chalk.cyan.bold('  fal.ai Kling 1.5 Pro img2video'));
  console.log(chalk.cyan.bold('══════════════════════════════════════\n'));

  if (!process.env.FAL_KEY) {
    log('FAL_KEY não configurada no .env', 'erro');
    process.exit(1);
  }

  const inicio = Date.now();
  const clips = [];

  for (const cena of CENAS) {
    try {
      const videoUrl = await gerarCena(cena);
      if (videoUrl) {
        const destino = `output/VN1.1/cena_${cena.num}_${FORMATO}.mp4`;
        const size = await downloadVideo(videoUrl, destino);
        log(`  salvo: ${destino} (${(size / 1024 / 1024).toFixed(1)}MB)`, 'ok');
        clips.push({ cena: cena.num, arquivo: destino, url: videoUrl });
      }
    } catch (e) {
      log(`  Cena ${cena.num} falhou: ${e.message}`, 'erro');
    }
  }

  const tempo = Math.round((Date.now() - inicio) / 1000);

  console.log(chalk.green.bold('\n══════════════════════════════════════'));
  console.log(chalk.green.bold('  GERAÇÃO CONCLUÍDA'));
  console.log(chalk.green.bold('══════════════════════════════════════'));
  log(`${clips.length}/${CENAS.length} clips gerados em ${tempo}s`, 'ok');
  clips.forEach(c => log(`  Cena ${c.cena}: ${c.arquivo}`, 'ok'));

  if (clips.length > 0) {
    log(`\nPróximo passo: editar os clips na timeline com narração e letterings.`);
    log(`Instruções de edição no copy: output/VN1.1/copy.json`);
  }
}

main().catch(e => {
  console.error(chalk.red.bold(`\nErro: ${e.message}`));
  process.exit(1);
});
