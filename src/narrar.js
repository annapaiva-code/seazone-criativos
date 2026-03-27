// src/narrar.js — Gera narração (TTS) + trilha sonora para vídeos VN1.1 e VA1.1
// Usa fal.ai MiniMax Speech 2.8 HD com boost em português
// Trilha sonora via fal.ai Lyria2
import 'dotenv/config';
import { fal } from '@fal-ai/client';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

// ── Config ───────────────────────────────────────────────────────────────────
fal.config({ credentials: process.env.FAL_KEY });

const DRY_RUN = process.argv.includes('--dry-run');
const APENAS_VN = process.argv.includes('--vn');
const APENAS_VA = process.argv.includes('--va');
const SEM_TRILHA = process.argv.includes('--sem-trilha');

// Voz padrão — grave, pausada, confiante (tom de investimento)
const VOZ_NARRADOR = process.argv.find(a => a.startsWith('--voz='))?.split('=')[1] || 'Calm_Woman';

// Prompts de trilha por tipo de vídeo
const TRILHA_PROMPTS = {
  'VN1.1': {
    prompt: 'Instrumental premium background music for a real estate investment advertisement video. Minimalist, inspiring and confident tone. Soft piano with ambient pads, subtle strings, and light percussion. Modern cinematic feel, warm and aspirational. No vocals, no singing.',
    negative_prompt: 'vocals, singing, speech, voice, loud drums, aggressive, distorted, lo-fi, low quality',
  },
  'VA1.1': {
    prompt: 'Modern and sophisticated instrumental background music for a premium real estate presenter video. Conveys confidence and success. Gentle electronic elements with warm piano chords, soft synth pads, and minimal beat. Corporate premium feel. No vocals, no singing.',
    negative_prompt: 'vocals, singing, speech, voice, loud drums, aggressive, distorted, lo-fi, low quality',
  },
};

function log(msg, nivel = 'info') {
  const cores = { info: chalk.white, ok: chalk.green, warn: chalk.yellow, erro: chalk.red };
  const pref = { info: '  ', ok: '+ ', warn: '! ', erro: 'x ' };
  console.log(cores[nivel](`${pref[nivel]}${msg}`));
}

// ── Gerar áudio de uma cena ─────────────────────────────────────────────────
async function gerarNarracao(texto, vozId) {
  if (!texto || !texto.trim()) return null;

  const result = await fal.subscribe('fal-ai/minimax/speech-2.8-hd', {
    input: {
      prompt: texto,
      language_boost: 'Portuguese',
      output_format: 'url',
      voice_setting: {
        voice_id: vozId,
        speed: 0.95,
        emotion: 'neutral',
      },
      audio_setting: {
        format: 'mp3',
        sample_rate: 44100,
        bitrate: 256000,
        channel: 1,
      },
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        const logs = update.logs || [];
        if (logs.length) log(`    ${logs[logs.length - 1].message}`);
      }
    },
  });

  const audioUrl = result.data?.audio?.url;
  const duracao = result.data?.duration_ms;
  if (!audioUrl) {
    log(`    Resposta inesperada: ${JSON.stringify(result.data).slice(0, 200)}`, 'warn');
    return null;
  }

  return { url: audioUrl, duracao_ms: duracao };
}

// ── Download áudio ──────────────────────────────────────────────────────────
async function downloadAudio(url, destino) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.ensureDir(path.dirname(destino));
  await fs.writeFile(destino, buffer);
  return buffer.length;
}

// ── Gerar trilha sonora via Lyria2 ──────────────────────────────────────────
async function gerarTrilha(jobId) {
  const outputDir = `output/${jobId}`;
  const trilhaPath = path.join(outputDir, 'trilha.wav');

  // Reutilizar trilha se já existe
  if (await fs.pathExists(trilhaPath)) {
    log(`  Trilha já existe: ${trilhaPath} (reutilizando)`, 'ok');
    return trilhaPath;
  }

  const config = TRILHA_PROMPTS[jobId];
  if (!config) {
    log(`  Sem prompt de trilha para ${jobId}`, 'warn');
    return null;
  }

  log(`  Gerando trilha sonora (Lyria2)...`);
  try {
    const result = await fal.subscribe('fal-ai/lyria2', {
      input: {
        prompt: config.prompt,
        negative_prompt: config.negative_prompt,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === 'IN_PROGRESS') {
          const logs = update.logs || [];
          if (logs.length) log(`    ${logs[logs.length - 1].message}`);
        }
      },
    });

    const audioUrl = result.data?.audio?.url;
    if (!audioUrl) {
      log(`  Lyria2 não retornou URL de áudio`, 'warn');
      return null;
    }

    const size = await downloadAudio(audioUrl, trilhaPath);
    log(`  Trilha salva: ${trilhaPath} (${(size / 1024).toFixed(0)}KB)`, 'ok');
    return trilhaPath;
  } catch (e) {
    log(`  Trilha erro: ${e.message}`, 'erro');
    return null;
  }
}

// ── Processar um vídeo (VN ou VA) ───────────────────────────────────────────
async function processarVideo(jobId, vozId) {
  const copyPath = `output/${jobId}/copy.json`;
  if (!await fs.pathExists(copyPath)) {
    log(`${copyPath} não encontrado — rode a geração primeiro`, 'erro');
    return [];
  }

  const copy = await fs.readJson(copyPath);
  const cenas = copy.cenas || [];
  log(`\n━━ ${jobId} — ${copy.titulo || copy.tipo} ━━`, 'ok');
  log(`  ${cenas.length} cenas | Voz: ${vozId}`);

  const resultados = [];

  for (const cena of cenas) {
    // Para VA, a fala da Monica é gravação real — só gera narracao_off
    const texto = cena.narracao || cena.narracao_off || null;
    const tipo = cena.narracao ? 'narracao' : cena.narracao_off ? 'narracao_off' : null;

    if (!texto) {
      // Cenas com fala_monica (gravação real) — pular TTS
      if (cena.fala_monica) {
        log(`  Cena ${cena.numero} (${cena.tempo}) — fala Monica (gravação real, pulando TTS)`, 'warn');
      } else {
        log(`  Cena ${cena.numero} (${cena.tempo}) — sem texto de narração`, 'warn');
      }
      continue;
    }

    log(`  Cena ${cena.numero} (${cena.tempo}) — ${tipo}`);
    log(`    "${texto.slice(0, 80)}${texto.length > 80 ? '...' : ''}"`);

    if (DRY_RUN) {
      log(`    [dry-run] pulando geração`, 'warn');
      continue;
    }

    try {
      const audio = await gerarNarracao(texto, vozId);
      if (audio) {
        const destino = `output/${jobId}/narracao_cena_${cena.numero}.mp3`;
        const size = await downloadAudio(audio.url, destino);
        const durSec = audio.duracao_ms ? (audio.duracao_ms / 1000).toFixed(1) : '?';
        log(`    salvo: ${destino} (${(size / 1024).toFixed(0)}KB, ${durSec}s)`, 'ok');
        resultados.push({
          cena: cena.numero,
          tempo: cena.tempo,
          arquivo: destino,
          duracao_ms: audio.duracao_ms,
          tipo,
        });
      }
    } catch (e) {
      log(`    Cena ${cena.numero} falhou: ${e.message}`, 'erro');
    }
  }

  // Gerar trilha sonora
  let trilhaInfo = null;
  if (!SEM_TRILHA && !DRY_RUN) {
    const trilhaPath = await gerarTrilha(jobId);
    if (trilhaPath) {
      trilhaInfo = { arquivo: trilhaPath, prompt: TRILHA_PROMPTS[jobId]?.prompt || null };
    }
  } else if (SEM_TRILHA) {
    log(`  Trilha desativada (--sem-trilha)`, 'warn');
  }

  // Salvar manifesto de áudios gerados
  if (resultados.length > 0 || trilhaInfo) {
    const manifesto = {
      job: jobId,
      voz: vozId,
      gerado_em: new Date().toISOString(),
      audios: resultados,
      trilha: trilhaInfo,
    };
    const manifestoPath = `output/${jobId}/narracao.json`;
    await fs.writeJson(manifestoPath, manifesto, { spaces: 2 });
    log(`  Manifesto: ${manifestoPath}`, 'ok');
  }

  return resultados;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(chalk.cyan.bold('\n══════════════════════════════════════'));
  console.log(chalk.cyan.bold('  Narração — TTS via fal.ai MiniMax'));
  console.log(chalk.cyan.bold(`  Voz: ${VOZ_NARRADOR}`));
  console.log(chalk.cyan.bold(`  Trilha: ${SEM_TRILHA ? 'desativada' : 'Lyria2 (fal.ai)'}`));
  if (DRY_RUN) console.log(chalk.yellow.bold('  MODO DRY-RUN'));
  console.log(chalk.cyan.bold('══════════════════════════════════════\n'));

  if (!process.env.FAL_KEY) {
    log('FAL_KEY não configurada no .env', 'erro');
    process.exit(1);
  }

  const inicio = Date.now();
  let totalAudios = 0;

  // VN1.1 — Vídeo Narrado
  if (!APENAS_VA) {
    const vn = await processarVideo('VN1.1', VOZ_NARRADOR);
    totalAudios += vn.length;
  }

  // VA1.1 — Vídeo Apresentadora (só narracao_off, fala Monica é real)
  if (!APENAS_VN) {
    const va = await processarVideo('VA1.1', VOZ_NARRADOR);
    totalAudios += va.length;
  }

  const tempo = Math.round((Date.now() - inicio) / 1000);

  console.log(chalk.green.bold('\n══════════════════════════════════════'));
  console.log(chalk.green.bold('  NARRAÇÃO CONCLUÍDA'));
  console.log(chalk.green.bold('══════════════════════════════════════'));
  log(`${totalAudios} áudios gerados em ${tempo}s`, 'ok');

  if (totalAudios > 0) {
    log(`\nÁudios em output/VN1.1/narracao_cena_X.mp3 e output/VA1.1/narracao_cena_X.mp3`);
    log(`Manifesto de cada vídeo em output/*/narracao.json`);
  }
}

main().catch(e => {
  console.error(chalk.red.bold(`\nErro: ${e.message}`));
  process.exit(1);
});
