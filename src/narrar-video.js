// src/narrar-video.js — Pipeline completo: Gemini gera texto → fal.ai TTS → trilha Lyria2 → ffmpeg merge
import 'dotenv/config';
import { fal } from '@fal-ai/client';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import { callGemini } from './gemini.js';

// ── Config ───────────────────────────────────────────────────────────────────
fal.config({ credentials: process.env.FAL_KEY });

const DRY_RUN = process.argv.includes('--dry-run');
const APENAS_VN = process.argv.includes('--vn');
const APENAS_VA = process.argv.includes('--va');
const SEM_TRILHA = process.argv.includes('--sem-trilha');
const FORMATO = process.argv.includes('--reels') ? 'reels_9x16' : 'feed_1x1';
const VOZ = process.argv.find(a => a.startsWith('--voz='))?.split('=')[1] || 'Calm_Woman';

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

// Volume da trilha relativo à narração (0.0 a 1.0)
const TRILHA_VOLUME = 0.15;

function log(msg, nivel = 'info') {
  const cores = { info: chalk.white, ok: chalk.green, warn: chalk.yellow, erro: chalk.red };
  const pref = { info: '  ', ok: '+ ', warn: '! ', erro: 'x ' };
  console.log(cores[nivel](`${pref[nivel]}${msg}`));
}

// ── 1. Gemini gera textos de narração ────────────────────────────────────────
async function gerarTextosNarracao(briefing) {
  const system = `Você é roteirista de vídeos publicitários imobiliários da Seazone.
Gere textos de NARRAÇÃO para vídeo, otimizados para serem FALADOS em voz alta.

REGRAS:
- Frases curtas e naturais, como se estivesse conversando com um investidor
- Cada narração DEVE caber no tempo da cena (considere ~3 palavras por segundo)
- Tom: autoridade serena, confiante, sem ser agressivo
- Dados financeiros devem ser falados de forma clara (ex: "dezesseis vírgula quatro por cento")
- NUNCA usar: garantido, certeza, prometemos. SEMPRE: projetado, estimado, previsto
- Responda APENAS em JSON válido, sem markdown`;

  const prompt = `Gere narração para dois vídeos do empreendimento ${briefing.produto}.

DADOS:
- Local: ${briefing.endereco}
- ROI: ${briefing.roi_percentual} ao ano
- Rendimento mensal: ${briefing.rendimento_mensal}
- Valorização estimada: ${briefing.valorizacao_estimada}
- Modelo: short stay com gestão Seazone
- Tom: ${briefing.tom}

VÍDEO VN1.1 (Narrado, 30-40s):
- Cena 1 (0-7s, ~20 palavras): Contextualizar localização — Novo Campeche, Florianópolis
- Cena 2 (8-15s, ~20 palavras): Fachada e arquitetura projetada para short stay
- Cena 3 (16-23s, ~20 palavras): ROI e rendimento mensal — pausar nos números
- Cena 4 (24-35s, ~25 palavras): CTA — convidar a conhecer, falar com especialista

VÍDEO VA1.1 (Apresentadora, 30-40s):
- Cena 1 (0-7s, ~15 palavras): Narração OFF sobre Florianópolis como destino de investimento
  (Cenas 2-4 são falas gravadas da Monica, não gerar)

Retorne este JSON:
{
  "VN1.1": {
    "cena_1": "texto narração cena 1",
    "cena_2": "texto narração cena 2",
    "cena_3": "texto narração cena 3",
    "cena_4": "texto narração cena 4"
  },
  "VA1.1": {
    "cena_1": "texto narração off cena 1"
  }
}`;

  return await callGemini(process.env.GOOGLE_API_KEY, system, prompt);
}

// ── 2. fal.ai TTS ───────────────────────────────────────────────────────────
async function gerarAudio(texto, vozId) {
  if (!texto?.trim()) return null;

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
        if (logs.length) log(`      ${logs[logs.length - 1].message}`);
      }
    },
  });

  const audioUrl = result.data?.audio?.url;
  const duracao = result.data?.duration_ms;
  if (!audioUrl) return null;
  return { url: audioUrl, duracao_ms: duracao };
}

async function downloadFile(url, destino) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.ensureDir(path.dirname(destino));
  await fs.writeFile(destino, buffer);
  return buffer.length;
}

// ── 3. Gerar trilha sonora via Lyria2 ────────────────────────────────────────
async function gerarTrilha(jobId, outputDir) {
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
          if (logs.length) log(`      ${logs[logs.length - 1].message}`);
        }
      },
    });

    const audioUrl = result.data?.audio?.url;
    if (!audioUrl) {
      log(`  Lyria2 não retornou URL de áudio`, 'warn');
      return null;
    }

    const size = await downloadFile(audioUrl, trilhaPath);
    log(`  Trilha salva: ${trilhaPath} (${(size / 1024).toFixed(0)}KB)`, 'ok');
    return trilhaPath;
  } catch (e) {
    log(`  Trilha erro: ${e.message}`, 'erro');
    return null;
  }
}

// ── 4. ffmpeg merge ──────────────────────────────────────────────────────────
function mergeAudioVideo(videoPath, audioPath, outputPath) {
  // Merge: vídeo + narração, truncar no mais curto
  const cmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -shortest "${outputPath}"`;
  execSync(cmd, { encoding: 'utf-8', shell: true, stdio: 'pipe' });
}

// Concatenar todos os clips narrados em um vídeo final
function concatenarClips(clips, outputPath) {
  const listPath = outputPath.replace(/\.[^.]+$/, '_list.txt');
  const listContent = clips.map(c => `file '${path.resolve(c).replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(listPath, listContent);
  const cmd = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`;
  execSync(cmd, { encoding: 'utf-8', shell: true, stdio: 'pipe' });
  fs.removeSync(listPath);
}

// Adicionar trilha ao vídeo final concatenado (loop da trilha para cobrir duração total, fade out nos últimos 3s)
function adicionarTrilhaFinal(videoPath, trilhaPath, outputPath) {
  const cmd = `ffmpeg -y -i "${videoPath}" -stream_loop -1 -i "${trilhaPath}" -filter_complex "[1:a]volume=${TRILHA_VOLUME},afade=t=out:st=0:d=3[trilha];[0:a][trilha]amix=inputs=2:duration=first:dropout_transition=3[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k "${outputPath}"`;
  execSync(cmd, { encoding: 'utf-8', shell: true, stdio: 'pipe' });
}

// ── Pipeline por vídeo ──────────────────────────────────────────────────────
async function processarVideo(jobId, textos, formato, vozId) {
  const outputDir = `output/${jobId}`;
  if (!await fs.pathExists(outputDir)) {
    log(`${outputDir} não existe`, 'erro');
    return 0;
  }

  // Descobrir total de cenas a partir do copy.json (inclui cenas sem narração TTS)
  const copyPath = path.join(outputDir, 'copy.json');
  let totalCenas = Object.keys(textos).length;
  if (await fs.pathExists(copyPath)) {
    const copy = await fs.readJson(copyPath);
    totalCenas = (copy.cenas || []).length || totalCenas;
  }

  const cenaKeys = Object.keys(textos).sort();
  log(`\n━━ ${jobId} — ${totalCenas} cenas (${cenaKeys.length} com narração) | ${formato} | Voz: ${vozId} ━━`, 'ok');

  // Gerar trilha sonora (uma vez por vídeo, reutilizada em todas as cenas)
  let trilhaPath = null;
  if (!SEM_TRILHA && !DRY_RUN) {
    trilhaPath = await gerarTrilha(jobId, outputDir);
  } else if (SEM_TRILHA) {
    log(`  Trilha desativada (--sem-trilha)`, 'warn');
  }

  // Processar cenas com narração TTS
  let count = 0;
  const cenasNarradas = new Set();

  for (const key of cenaKeys) {
    const num = key.replace('cena_', '');
    const texto = textos[key];
    const videoPath = path.join(outputDir, `cena_${num}_${formato}.mp4`);
    const audioPath = path.join(outputDir, `narracao_cena_${num}.mp3`);
    const outputPath = path.join(outputDir, `cena_${num}_${formato}_narrado.mp4`);

    log(`  Cena ${num}:`, 'info');
    log(`    "${texto.slice(0, 80)}${texto.length > 80 ? '...' : ''}"`);

    if (!await fs.pathExists(videoPath)) {
      log(`    vídeo não encontrado: ${videoPath}`, 'warn');
      continue;
    }

    if (DRY_RUN) {
      log(`    [dry-run] pulando`, 'warn');
      continue;
    }

    // TTS
    try {
      log(`    TTS...`);
      const audio = await gerarAudio(texto, vozId);
      if (!audio) { log(`    TTS falhou`, 'erro'); continue; }
      const size = await downloadFile(audio.url, audioPath);
      const durSec = audio.duracao_ms ? (audio.duracao_ms / 1000).toFixed(1) : '?';
      log(`    áudio: ${(size / 1024).toFixed(0)}KB, ${durSec}s`, 'ok');
    } catch (e) {
      log(`    TTS erro: ${e.message}`, 'erro');
      continue;
    }

    // Merge vídeo + narração (sem trilha ainda — trilha entra no final)
    try {
      log(`    Merge vídeo + narração...`);
      mergeAudioVideo(videoPath, audioPath, outputPath);
      const stat = await fs.stat(outputPath);
      log(`    salvo: ${outputPath} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`, 'ok');
      cenasNarradas.add(parseInt(num));
      count++;
    } catch (e) {
      log(`    Merge erro: ${e.message}`, 'erro');
    }
  }

  // Montar lista de todos os clips para concatenar (narrados + sem narração)
  const todosClips = [];
  for (let i = 1; i <= totalCenas; i++) {
    const narradoPath = path.join(outputDir, `cena_${i}_${formato}_narrado.mp4`);
    const rawPath = path.join(outputDir, `cena_${i}_${formato}.mp4`);
    if (cenasNarradas.has(i) && await fs.pathExists(narradoPath)) {
      todosClips.push(narradoPath);
    } else if (await fs.pathExists(rawPath)) {
      log(`  Cena ${i}: sem narração, usando clip original`, 'info');
      todosClips.push(rawPath);
    }
  }

  // Concatenar clips em vídeo final
  if (todosClips.length > 1) {
    try {
      const concatPath = path.join(outputDir, `${formato}_narrado_concat.mp4`);
      const finalPath = path.join(outputDir, `${formato}_narrado_final.mp4`);
      log(`  Concatenando ${todosClips.length} clips...`);
      concatenarClips(todosClips, concatPath);

      // Aplicar trilha sonora de fundo ao vídeo final concatenado
      if (trilhaPath) {
        try {
          log(`  Adicionando trilha sonora ao vídeo final...`);
          adicionarTrilhaFinal(concatPath, trilhaPath, finalPath);
          await fs.remove(concatPath);
          const stat = await fs.stat(finalPath);
          log(`  FINAL (com trilha): ${finalPath} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`, 'ok');
        } catch (e) {
          log(`  Trilha merge erro: ${e.message} — usando versão sem trilha`, 'warn');
          await fs.move(concatPath, finalPath, { overwrite: true });
        }
      } else {
        await fs.move(concatPath, finalPath, { overwrite: true });
        const stat = await fs.stat(finalPath);
        log(`  FINAL: ${finalPath} (${(stat.size / 1024 / 1024).toFixed(1)}MB)`, 'ok');
      }
    } catch (e) {
      log(`  Concat erro: ${e.message}`, 'erro');
    }
  }

  return count;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(chalk.cyan.bold('\n══════════════════════════════════════'));
  console.log(chalk.cyan.bold('  Pipeline: Gemini → TTS → Trilha → Vídeo'));
  console.log(chalk.cyan.bold(`  Formato: ${FORMATO} | Voz: ${VOZ}`));
  console.log(chalk.cyan.bold(`  Trilha: ${SEM_TRILHA ? 'desativada' : 'Lyria2 (fal.ai)'}`));
  if (DRY_RUN) console.log(chalk.yellow.bold('  MODO DRY-RUN'));
  console.log(chalk.cyan.bold('══════════════════════════════════════\n'));

  if (!process.env.FAL_KEY) { log('FAL_KEY não configurada', 'erro'); process.exit(1); }
  if (!process.env.GOOGLE_API_KEY) { log('GOOGLE_API_KEY não configurada', 'erro'); process.exit(1); }

  const inicio = Date.now();

  // Carregar briefing
  const briefing = await fs.readJson('briefings/novo_campeche_spot2.json');
  log(`Briefing: ${briefing.produto}`, 'ok');

  // Gemini gera textos
  log('Gemini → textos de narração...', 'info');
  const textos = await gerarTextosNarracao(briefing);
  log('Textos gerados:', 'ok');

  if (textos['VN1.1']) {
    for (const [k, v] of Object.entries(textos['VN1.1'])) {
      log(`  VN1.1 ${k}: "${v.slice(0, 70)}..."`, 'info');
    }
  }
  if (textos['VA1.1']) {
    for (const [k, v] of Object.entries(textos['VA1.1'])) {
      log(`  VA1.1 ${k}: "${v.slice(0, 70)}..."`, 'info');
    }
  }

  // Salvar textos gerados
  await fs.writeJson('output/narracao_textos.json', textos, { spaces: 2 });
  log('Textos salvos em output/narracao_textos.json', 'ok');

  let total = 0;

  // VN1.1
  if (!APENAS_VA && textos['VN1.1']) {
    total += await processarVideo('VN1.1', textos['VN1.1'], FORMATO, VOZ);
  }

  // VA1.1
  if (!APENAS_VN && textos['VA1.1']) {
    total += await processarVideo('VA1.1', textos['VA1.1'], FORMATO, VOZ);
  }

  const tempo = Math.round((Date.now() - inicio) / 1000);

  console.log(chalk.green.bold('\n══════════════════════════════════════'));
  console.log(chalk.green.bold('  PIPELINE CONCLUÍDO'));
  console.log(chalk.green.bold('══════════════════════════════════════'));
  log(`${total} clips narrados em ${tempo}s`, 'ok');
  log(`Vídeos finais em output/*/\${formato}_narrado_final.mp4`);
}

main().catch(e => {
  console.error(chalk.red.bold(`\nErro: ${e.message}`));
  process.exit(1);
});
