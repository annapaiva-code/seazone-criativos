// src/fal.js — Geração via Gemini 2.5 Flash Image + fallbacks
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';

let googleApiKey = null;

export function configurar() {
  googleApiKey = process.env.GOOGLE_API_KEY;
  const providers = [];
  if (googleApiKey) providers.push('gemini-image');
  if (process.env.TOGETHER_API_KEY) providers.push('together');
  return providers;
}

const SIZES = {
  feed_1x1:   { width: 1024, height: 1024 },
  reels_9x16: { width: 576,  height: 1024 },
  story_9x16: { width: 576,  height: 1024 },
};

// ── Gemini 2.5 Flash Image ──────────────────────────────────────────────────
async function imagemGemini(prompt, formato) {
  const s = SIZES[formato];
  const orientacao = s.width === s.height ? 'square 1:1 aspect ratio' :
                     s.width < s.height   ? 'vertical 9:16 portrait aspect ratio' : 'horizontal 16:9 landscape';

  const fullPrompt = `Generate a high-quality image with ${orientacao} (${s.width}x${s.height}px). ${prompt}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Image ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();

  if (data.candidates?.[0]?.finishReason === 'IMAGE_SAFETY') {
    throw new Error('Gemini: bloqueado por filtro de segurança de imagem');
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imgPart) {
    const textPart = parts.find(p => p.text);
    throw new Error(`Gemini: sem imagem na resposta. ${textPart?.text?.slice(0, 100) || ''}`);
  }

  const buffer = Buffer.from(imgPart.inlineData.data, 'base64');
  const ext = imgPart.inlineData.mimeType.includes('png') ? 'png' : 'jpg';
  return { buffer, modelo: 'gemini-2.5-flash-image', ext };
}

// ── Gemini Image com referência (img2img via multimodal) ────────────────────
async function imagemGeminiComRef(prompt, formato, refImagePath) {
  const s = SIZES[formato];
  const orientacao = s.width === s.height ? 'square 1:1 aspect ratio' :
                     s.width < s.height   ? 'vertical 9:16 portrait aspect ratio' : 'horizontal 16:9 landscape';

  // Ler imagem de referência
  const imgBuffer = await fs.readFile(refImagePath);
  const ext = path.extname(refImagePath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  const mimeType = mimeMap[ext] || 'image/jpeg';
  const b64 = imgBuffer.toString('base64');

  const fullPrompt = `Using this reference image as the base scene, generate a new high-quality ${orientacao} (${s.width}x${s.height}px) cinematic version. Enhance the visual quality to cinematic 4K level while keeping the SAME scene, composition and location. ${prompt}. Do NOT add any text, overlays, logos, or watermarks to the image.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: b64 } },
            { text: fullPrompt },
          ],
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini Image+Ref ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();

  if (data.candidates?.[0]?.finishReason === 'IMAGE_SAFETY') {
    throw new Error('Gemini: bloqueado por filtro de segurança');
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imgPart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
  if (!imgPart) {
    const textPart = parts.find(p => p.text);
    throw new Error(`Gemini+Ref: sem imagem. ${textPart?.text?.slice(0, 100) || ''}`);
  }

  const buffer = Buffer.from(imgPart.inlineData.data, 'base64');
  const outExt = imgPart.inlineData.mimeType.includes('png') ? 'png' : 'jpg';
  return { buffer, modelo: 'gemini-2.5-flash-image (ref)', ext: outExt };
}

// ── Gerar imagem (com ou sem referência) ─────────────────────────────────────
export async function gerarImagem(prompt, formato, log, refImagePath) {
  // Tentar com referência primeiro (img2img via multimodal)
  if (refImagePath && await fs.pathExists(refImagePath)) {
    try {
      log(`  Gemini Image + ref (${formato})...`);
      const result = await imagemGeminiComRef(prompt, formato, refImagePath);
      log(`  imagem — ${result.modelo} (${(result.buffer.length / 1024).toFixed(0)}KB)`, 'ok');
      return result;
    } catch (e) {
      log(`  Gemini+ref: ${e.message}`, 'warn');
      log(`  Tentando sem referência...`);
    }
  }

  // Fallback: gerar sem referência
  try {
    log(`  Gemini Image (${formato})...`);
    const result = await imagemGemini(prompt, formato);
    log(`  imagem — ${result.modelo} (${(result.buffer.length / 1024).toFixed(0)}KB)`, 'ok');
    return result;
  } catch (e) {
    log(`  Gemini Image: ${e.message}`, 'warn');
  }

  return null;
}

// ── Gerar vídeo (sem provider gratuito confiável) ────────────────────────────
export async function gerarVideo(prompt, formato, log, imagemBuffer) {
  // Gemini não gera vídeo. Sem fal.ai, vídeo requer API paga.
  log(`  video: sem provider gratuito disponível (use fal.ai ou Runway)`, 'warn');
  return null;
}

// ── Salvar buffer em arquivo ─────────────────────────────────────────────────
export async function salvar(buffer, destino) {
  await fs.ensureDir(path.dirname(destino));
  await fs.writeFile(destino, buffer);
}
