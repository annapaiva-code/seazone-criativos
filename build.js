// build.js — Prepara output/ para deploy (copia assets estáticos)
import fs from 'fs-extra';
import path from 'path';

const ROOT = process.cwd();

async function build() {
  console.log('Preparando output/ para deploy...\n');

  // Copiar logo
  const logoSrc = path.join(ROOT, 'logo seazone.png');
  const logoDest = path.join(ROOT, 'output', 'logo-seazone.png');
  if (await fs.pathExists(logoSrc)) {
    await fs.copy(logoSrc, logoDest);
    console.log('+ logo-seazone.png');
  }

  // Copiar imagens de assets/ para output/assets/
  const assetsDir = path.join(ROOT, 'assets');
  const outputAssets = path.join(ROOT, 'output', 'assets');
  await fs.ensureDir(outputAssets);

  if (await fs.pathExists(assetsDir)) {
    const imgExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const files = await fs.readdir(assetsDir);
    for (const file of files) {
      if (imgExts.includes(path.extname(file).toLowerCase())) {
        await fs.copy(path.join(assetsDir, file), path.join(outputAssets, file));
        console.log(`+ assets/${file}`);
      }
    }
  } else {
    console.log('assets/ não encontrado — pulando cópia de imagens.');
  }

  console.log('\nBuild concluído. output/ pronto para deploy.');
}

build().catch(e => {
  console.error('Erro:', e.message);
  process.exit(1);
});
