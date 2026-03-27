// src/overlay.js — Composita textos sobre as imagens estáticas (E1.1)
import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';

const COPY = {
  pin: 'Novo Campeche, Florianópolis - SC',
  nome: 'NOVO CAMPECHE SPOT II',
  badge: 'LANÇAMENTO',
  headline: 'Retorno projetado de 16,4% ao ano.',
  subheadline: 'Rendimento mensal estimado de R$ 5.500,00.',
  roi: '16,4%',
  roiLabel: 'ao ano',
  roiDescL1: 'de retorno líquido com',
  roiDescL2: 'aluguel por temporada',
  cta: 'Saiba Mais',
  disclaimer: 'Este material tem caráter exclusivamente informativo e não constitui uma promessa de rentabilidade futura ou garantia de retorno financeiro. Os resultados financeiros dependem da performance do empreendimento após sua conclusão. A Seazone não oferece garantia de rendimento fixo ou retorno mínimo.',
};

const CORAL = '#FC6058';
const BLUE = '#0055FF';

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── SVG para Feed 1:1 (1024x1024) ──────────────────────────────────────────
function svgFeed(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0.40" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,8,30,0)" />
      <stop offset="35%" stop-color="rgba(0,8,30,0.6)" />
      <stop offset="65%" stop-color="rgba(0,8,30,0.88)" />
      <stop offset="100%" stop-color="rgba(0,8,30,0.96)" />
    </linearGradient>
    <linearGradient id="topgrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,8,30,0.5)" />
      <stop offset="100%" stop-color="rgba(0,8,30,0)" />
    </linearGradient>
  </defs>

  <!-- subtle top gradient for readability -->
  <rect x="0" y="0" width="${w}" height="130" fill="url(#topgrad)" />

  <!-- gradient overlay bottom half -->
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#grad)" />

  <!-- PIN location top-left -->
  <g transform="translate(36, 36)">
    <rect rx="20" width="330" height="38" fill="rgba(0,0,0,0.5)" />
    <circle cx="20" cy="19" r="5" fill="${CORAL}" />
    <text x="32" y="25" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="600" fill="#fff">
      ${esc(COPY.pin)}
    </text>
  </g>

  <!-- Nome empreendimento -->
  <text x="36" y="102" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="800" fill="#fff" letter-spacing="1.5" opacity="0.95">
    ${esc(COPY.nome)}
  </text>

  <!-- Logo seazone top-right -->
  <g transform="translate(${w - 170}, 36)">
    <rect rx="20" width="134" height="38" fill="rgba(0,0,0,0.5)" />
    <text x="18" y="26" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="800" fill="#fff" letter-spacing="1.5">sea<tspan fill="${CORAL}">z</tspan>one</text>
  </g>

  <!-- BADGE LANÇAMENTO -->
  <g transform="translate(36, ${Math.round(h * 0.44)})">
    <rect rx="5" width="166" height="34" fill="${CORAL}" />
    <text x="18" y="23" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" fill="#fff" letter-spacing="2.5">${esc(COPY.badge)}</text>
  </g>

  <!-- Subheadline -->
  <text x="36" y="${Math.round(h * 0.54)}" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="500" fill="rgba(255,255,255,0.85)">
    ${esc(COPY.subheadline)}
  </text>

  <!-- ROI block: big number left -->
  <text x="36" y="${Math.round(h * 0.74)}" font-family="Arial,Helvetica,sans-serif" font-weight="900" fill="#fff" font-size="100">
    ${esc(COPY.roi)}
  </text>
  <text x="395" y="${Math.round(h * 0.67)}" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="600" fill="rgba(255,255,255,0.7)">
    ${esc(COPY.roiLabel)}
  </text>

  <!-- "de retorno líquido com aluguel por temporada" right side -->
  <text font-family="Arial,Helvetica,sans-serif" font-weight="700">
    <tspan x="530" y="${Math.round(h * 0.68)}" font-size="20" fill="rgba(255,255,255,0.6)">de</tspan>
    <tspan x="530" y="${Math.round(h * 0.68) + 30}" font-size="30" fill="${CORAL}">retorno</tspan>
    <tspan x="530" y="${Math.round(h * 0.68) + 62}" font-size="30" fill="${CORAL}">líquido</tspan>
    <tspan x="530" y="${Math.round(h * 0.68) + 88}" font-size="18" fill="rgba(255,255,255,0.55)">com aluguel por</tspan>
    <tspan x="530" y="${Math.round(h * 0.68) + 108}" font-size="18" fill="rgba(255,255,255,0.55)">temporada</tspan>
  </text>

  <!-- CTA button -->
  <g transform="translate(36, ${Math.round(h * 0.87)})">
    <rect rx="8" width="170" height="44" fill="${BLUE}" />
    <text x="38" y="29" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" fill="#fff">${esc(COPY.cta)}</text>
  </g>

  <!-- Disclaimer -->
  <text x="16" y="${h - 14}" font-family="Arial,Helvetica,sans-serif" font-size="7" fill="rgba(255,255,255,0.28)">
    ${esc(COPY.disclaimer.slice(0, 180))}
  </text>
</svg>`;
}

// ── SVG para Reels/Story 9:16 (576x1024) ───────────────────────────────────
function svgVertical(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <linearGradient id="grad" x1="0" y1="0.32" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,8,30,0)" />
      <stop offset="30%" stop-color="rgba(0,8,30,0.55)" />
      <stop offset="60%" stop-color="rgba(0,8,30,0.88)" />
      <stop offset="100%" stop-color="rgba(0,8,30,0.96)" />
    </linearGradient>
    <linearGradient id="topgrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,8,30,0.5)" />
      <stop offset="100%" stop-color="rgba(0,8,30,0)" />
    </linearGradient>
  </defs>

  <!-- subtle top gradient -->
  <rect x="0" y="0" width="${w}" height="110" fill="url(#topgrad)" />

  <!-- gradient overlay -->
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#grad)" />

  <!-- PIN location top-left -->
  <g transform="translate(24, 30)">
    <rect rx="16" width="286" height="32" fill="rgba(0,0,0,0.5)" />
    <circle cx="17" cy="16" r="4.5" fill="${CORAL}" />
    <text x="28" y="22" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="600" fill="#fff">
      ${esc(COPY.pin)}
    </text>
  </g>

  <!-- Nome empreendimento -->
  <text x="24" y="86" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="800" fill="#fff" letter-spacing="1.2" opacity="0.95">
    ${esc(COPY.nome)}
  </text>

  <!-- Logo seazone top-right -->
  <g transform="translate(${w - 136}, 30)">
    <rect rx="16" width="112" height="32" fill="rgba(0,0,0,0.5)" />
    <text x="14" y="22" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" fill="#fff" letter-spacing="1.5">sea<tspan fill="${CORAL}">z</tspan>one</text>
  </g>

  <!-- BADGE LANÇAMENTO -->
  <g transform="translate(24, ${Math.round(h * 0.40)})">
    <rect rx="5" width="148" height="30" fill="${CORAL}" />
    <text x="14" y="21" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="800" fill="#fff" letter-spacing="2.5">${esc(COPY.badge)}</text>
  </g>

  <!-- Subheadline -->
  <text font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="500" fill="rgba(255,255,255,0.85)">
    <tspan x="24" y="${Math.round(h * 0.49)}">${esc(COPY.subheadline)}</tspan>
  </text>

  <!-- ROI big number -->
  <text x="24" y="${Math.round(h * 0.63)}" font-family="Arial,Helvetica,sans-serif" font-weight="900" fill="#fff" font-size="78">
    ${esc(COPY.roi)}
  </text>
  <text x="340" y="${Math.round(h * 0.575)}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="600" fill="rgba(255,255,255,0.7)">
    ${esc(COPY.roiLabel)}
  </text>

  <!-- ROI description coral -->
  <text font-family="Arial,Helvetica,sans-serif" font-weight="800" fill="${CORAL}">
    <tspan x="24" y="${Math.round(h * 0.70)}" font-size="22">${esc(COPY.roiDescL1)}</tspan>
    <tspan x="24" y="${Math.round(h * 0.70) + 28}" font-size="22">${esc(COPY.roiDescL2)}</tspan>
  </text>

  <!-- CTA button -->
  <g transform="translate(24, ${Math.round(h * 0.80)})">
    <rect rx="8" width="150" height="40" fill="${BLUE}" />
    <text x="32" y="27" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700" fill="#fff">${esc(COPY.cta)}</text>
  </g>

  <!-- Disclaimer -->
  <foreignObject x="12" y="${h - 70}" width="${w - 24}" height="62">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,Helvetica,sans-serif;font-size:6.5px;color:rgba(255,255,255,0.25);line-height:1.4;overflow:hidden;">
      ${esc(COPY.disclaimer)}
    </div>
  </foreignObject>
</svg>`;
}

// ── Processar cada formato ──────────────────────────────────────────────────
const FORMATOS = [
  { nome: 'feed_1x1',   w: 1024, h: 1024, svgFn: svgFeed },
  { nome: 'reels_9x16', w: 576,  h: 1024, svgFn: svgVertical },
  { nome: 'story_9x16', w: 576,  h: 1024, svgFn: svgVertical },
];

async function main() {
  const outDir = 'output/E1.1';
  await fs.ensureDir(outDir);

  for (const fmt of FORMATOS) {
    const src = path.join(outDir, `${fmt.nome}.png`);
    if (!await fs.pathExists(src)) {
      console.log(`  SKIP ${fmt.nome} — imagem base não encontrada`);
      continue;
    }

    const svg = fmt.svgFn(fmt.w, fmt.h);
    const svgBuffer = Buffer.from(svg);

    const dest = path.join(outDir, `${fmt.nome}_final.png`);
    await sharp(src)
      .resize(fmt.w, fmt.h, { fit: 'cover' })
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .png({ quality: 95 })
      .toFile(dest);

    const stat = await fs.stat(dest);
    console.log(`  + ${fmt.nome}_final.png (${(stat.size / 1024).toFixed(0)}KB)`);
  }

  console.log('\n  Overlay concluído!');
}

main().catch(e => { console.error(`Erro: ${e.message}`); process.exit(1); });
