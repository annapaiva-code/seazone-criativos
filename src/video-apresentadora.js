// src/video-apresentadora.js — Gera vídeo apresentadora (VA1.1) a partir dos storyboard frames
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

// ── Cenas do vídeo apresentadora ────────────────────────────────────────────
const CENAS = [
  {
    num: 1,
    tempo: '0-7s',
    frame: `output/VA1.1/cena_1_${FORMATO}.png`,
    prompt: 'Slow cinematic aerial drone shot pushing forward over a coastal neighborhood in Florianópolis. Low-rise white buildings, turquoise sea with gentle waves, beach visible. Camera slowly glides forward. Bright daylight, vivid colors, smooth steady movement. Premium real estate style.',
    movimento: 'drone aéreo push-in',
  },
  {
    num: 2,
    tempo: '8-15s',
    frame: `output/VA1.1/cena_2_${FORMATO}.png`,
    prompt: 'Professional woman walking on a wooden beach boardwalk. She wears a blue striped dress, smiling confidently. Ocean and island visible in background. Gentle breeze moves her dress and hair slightly. Warm sunny day, natural lighting. Camera follows her movement smoothly.',
    movimento: 'Monica passarela praia',
  },
  {
    num: 3,
    tempo: '16-23s',
    frame: `output/VA1.1/cena_3_${FORMATO}.png`,
    prompt: 'Smooth dolly-in shot approaching a modern 4-story building facade. Concrete, slatted wood panels, and glass elements. Tropical vegetation sways gently. Camera slowly pushes toward the building. Warm daylight, architectural details in focus. Premium real estate cinematic style.',
    movimento: 'dolly-in fachada SPOT II',
  },
  {
    num: 4,
    tempo: '24-35s',
    frame: `output/VA1.1/cena_4_${FORMATO}.png`,
    prompt: 'Cinematic reveal of a luxury rooftop deck. Camera slowly pans across wooden deck with infinity pool reflecting the sky. Gourmet area with stone counter. Neon sign visible. Panoramic view of coastal neighborhood. Golden hour warm tones, aspirational premium mood.',
    movimento: 'pan rooftop SPOT II',
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
  console.log(chalk.cyan.bold('  VA1.1 — Vídeo Apresentadora'));
  console.log(chalk.cyan.bold(`  Formato: ${FORMATO} (${ASPECT})`));
  console.log(chalk.cyan.bold('  fal.ai Kling 1.5 Pro img2video'));
  if (DRY_RUN) console.log(chalk.yellow.bold('  MODO DRY-RUN'));
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
        const destino = `output/VA1.1/cena_${cena.num}_${FORMATO}.mp4`;
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
    log(`\nPróximo passo: npm run narrar:video -- --va`);
  }
}

main().catch(e => {
  console.error(chalk.red.bold(`\nErro: ${e.message}`));
  process.exit(1);
});
