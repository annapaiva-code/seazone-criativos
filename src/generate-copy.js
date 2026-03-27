// src/generate-copy.js — Gera briefing-normalizado.json, copy.json e roteiros.json
import 'dotenv/config';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { callGemini } from './gemini.js';
import { buildSystem, promptEstatico, promptNarrado, promptApresentadora } from './prompts.js';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'output', 'data');
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg, nivel = 'info') {
  const cores = { info: chalk.white, ok: chalk.green, warn: chalk.yellow, erro: chalk.red };
  const pref = { info: '  ', ok: '+ ', warn: '! ', erro: 'x ' };
  console.log(cores[nivel](`${pref[nivel]}${msg}`));
}

async function generateCopy() {
  console.log(chalk.blue.bold('\n  SEAZONE — GERACAO DE COPY\n'));

  await fs.ensureDir(DATA_DIR);

  // 1. Carregar briefing original
  const briefing = await fs.readJson(path.join(ROOT, 'briefings', 'novo_campeche_spot2.json'));
  log(`Briefing carregado: ${briefing.produto}`, 'ok');

  // 2. Gerar briefing normalizado
  const briefingNormalizado = {
    _gerado_em: new Date().toISOString(),
    produto: {
      nome: briefing.produto,
      tipo: 'SPOT — Short Stay Optimized Property',
      estagio: 'Lancamento',
    },
    localizacao: {
      endereco: briefing.endereco,
      bairro: 'Novo Campeche',
      cidade: 'Florianopolis',
      estado: 'SC',
      diferenciais: ['Proximo ao aeroporto', 'Bairro em valorizacao', 'Acesso privilegiado'],
    },
    proposta: {
      resumo: 'Investimento imobiliario otimizado para renda passiva via aluguel por temporada',
      modelo: 'Short stay com gestao profissional Seazone',
      diferenciais_gestao: [
        'Anuncio e divulgacao',
        'Atendimento ao hospede',
        'Limpeza profissional',
        'Manutencao preventiva',
      ],
    },
    percentuais: {
      roi_anual: briefing.roi_percentual,
      rendimento_mensal: briefing.rendimento_mensal,
      ticket_medio: briefing.ticket_medio,
      valorizacao_estimada: briefing.valorizacao_estimada || '8%',
    },
    cta: {
      primario: 'Saiba Mais',
      secundario: 'Fale com um Especialista',
    },
    restricoes_legais: {
      disclaimer: briefing.disclaimer,
      palavras_proibidas: ['garantido', 'certeza', 'prometemos', 'assegurado'],
      palavras_obrigatorias: ['projetado', 'estimado', 'previsto'],
      regras: briefing.donts,
    },
    pilares_comunicacao: briefing.pilares,
    publico_alvo: briefing.publico_alvo,
    tom: briefing.tom,
    dos: briefing.dos,
    formatos_obrigatorios: {
      estatico: ['feed_1x1', 'reels_9x16', 'story_9x16'],
      video_narrado: ['feed_1x1', 'reels_9x16'],
      video_apresentadora: ['feed_1x1', 'reels_9x16'],
    },
  };

  await fs.writeJson(path.join(DATA_DIR, 'briefing-normalizado.json'), briefingNormalizado, { spaces: 2 });
  log('briefing-normalizado.json gerado', 'ok');

  // 3. Gerar copy via Gemini ou usar existente
  const copyData = {};
  const roteiroData = {};

  if (DRY_RUN) {
    log('MODO DRY-RUN — usando copy existente dos outputs', 'warn');

    // Tentar carregar copy existente
    for (const jobId of ['E1.1', 'VN1.1', 'VA1.1']) {
      const copyPath = path.join(ROOT, 'output', jobId, 'copy.json');
      if (await fs.pathExists(copyPath)) {
        const existing = await fs.readJson(copyPath);
        copyData[jobId] = existing;
        if (existing.cenas) {
          roteiroData[jobId] = {
            id: existing.id,
            tipo: existing.tipo,
            titulo: existing.titulo,
            duracao: existing.duracao,
            cenas: existing.cenas,
            instrucoes_edicao: existing.instrucoes_edicao,
            instrucoes_direcao: existing.instrucoes_direcao || null,
          };
        }
        log(`${jobId}: copy carregado do cache`, 'ok');
      } else {
        log(`${jobId}: sem copy em cache — rode sem --dry-run para gerar`, 'warn');
      }
    }
  } else {
    if (!process.env.GOOGLE_API_KEY) {
      console.error(chalk.red.bold('GOOGLE_API_KEY nao configurada no .env'));
      process.exit(1);
    }

    const system = buildSystem(briefing);

    // E1.1 — Estatico
    log('Gemini: gerando copy E1.1 (estatico)...');
    try {
      const e1 = await callGemini(process.env.GOOGLE_API_KEY, system, promptEstatico(briefing));
      copyData['E1.1'] = e1;
      await fs.ensureDir(path.join(ROOT, 'output', 'E1.1'));
      await fs.writeJson(path.join(ROOT, 'output', 'E1.1', 'copy.json'), e1, { spaces: 2 });
      log(`E1.1: "${(e1.headline || '').slice(0, 60)}"`, 'ok');
    } catch (e) {
      log(`E1.1 falhou: ${e.message}`, 'erro');
    }

    // VN1.1 — Video Narrado
    log('Gemini: gerando copy VN1.1 (video narrado)...');
    try {
      const vn1 = await callGemini(process.env.GOOGLE_API_KEY, system, promptNarrado(briefing));
      copyData['VN1.1'] = vn1;
      roteiroData['VN1.1'] = {
        id: vn1.id, tipo: vn1.tipo, titulo: vn1.titulo, duracao: vn1.duracao,
        cenas: vn1.cenas, instrucoes_edicao: vn1.instrucoes_edicao,
      };
      await fs.ensureDir(path.join(ROOT, 'output', 'VN1.1'));
      await fs.writeJson(path.join(ROOT, 'output', 'VN1.1', 'copy.json'), vn1, { spaces: 2 });
      log(`VN1.1: "${(vn1.titulo || '').slice(0, 60)}"`, 'ok');
    } catch (e) {
      log(`VN1.1 falhou: ${e.message}`, 'erro');
    }

    // VA1.1 — Video Apresentadora
    log('Gemini: gerando copy VA1.1 (video apresentadora)...');
    try {
      const va1 = await callGemini(process.env.GOOGLE_API_KEY, system, promptApresentadora(briefing));
      copyData['VA1.1'] = va1;
      roteiroData['VA1.1'] = {
        id: va1.id, tipo: va1.tipo, titulo: va1.titulo, duracao: va1.duracao,
        cenas: va1.cenas, instrucoes_edicao: va1.instrucoes_edicao,
        instrucoes_direcao: va1.instrucoes_direcao,
      };
      await fs.ensureDir(path.join(ROOT, 'output', 'VA1.1'));
      await fs.writeJson(path.join(ROOT, 'output', 'VA1.1', 'copy.json'), va1, { spaces: 2 });
      log(`VA1.1: "${(va1.titulo || '').slice(0, 60)}"`, 'ok');
    } catch (e) {
      log(`VA1.1 falhou: ${e.message}`, 'erro');
    }
  }

  // 4. Salvar copy.json consolidado
  const copyConsolidado = {
    _gerado_em: new Date().toISOString(),
    _briefing: briefing.produto,
    criativos: copyData,
  };
  await fs.writeJson(path.join(DATA_DIR, 'copy.json'), copyConsolidado, { spaces: 2 });
  log('copy.json consolidado gerado', 'ok');

  // 5. Salvar roteiros.json
  if (Object.keys(roteiroData).length > 0) {
    const roteiros = {
      _gerado_em: new Date().toISOString(),
      _briefing: briefing.produto,
      roteiros: roteiroData,
    };
    await fs.writeJson(path.join(DATA_DIR, 'roteiros.json'), roteiros, { spaces: 2 });
    log('roteiros.json gerado', 'ok');
  }

  // 6. Mapear assets sugeridos por cena nos roteiros
  const assetsMapPath = path.join(DATA_DIR, 'assets-map.json');
  if (await fs.pathExists(assetsMapPath)) {
    const assetsMap = await fs.readJson(assetsMapPath);
    // Enriquecer roteiros com assets sugeridos
    for (const [jobId, roteiro] of Object.entries(roteiroData)) {
      if (!roteiro.cenas) continue;
      for (const cena of roteiro.cenas) {
        const desc = (cena.descricao_visual || '').toLowerCase();
        cena.assets_sugeridos = [];

        if (desc.includes('drone') || desc.includes('aere') || desc.includes('vista')) {
          cena.assets_sugeridos.push(
            ...assetsMap.empreendimento
              .filter(a => a.arquivo.toLowerCase().includes('vista') || a.arquivo.toLowerCase().includes('aere'))
              .map(a => a.caminho)
          );
        }
        if (desc.includes('fachada') || desc.includes('empreendimento')) {
          cena.assets_sugeridos.push(
            ...assetsMap.empreendimento
              .filter(a => a.arquivo.toLowerCase().includes('fachada'))
              .map(a => a.caminho)
          );
        }
        if (desc.includes('rooftop') || desc.includes('entardecer')) {
          cena.assets_sugeridos.push(
            ...assetsMap.empreendimento
              .filter(a => a.arquivo.toLowerCase().includes('rooftop'))
              .map(a => a.caminho)
          );
        }
        if (desc.includes('praia') || desc.includes('caminho')) {
          cena.assets_sugeridos.push(
            ...assetsMap.empreendimento
              .filter(a => a.arquivo.toLowerCase().includes('praia') || a.arquivo.toLowerCase().includes('caminho'))
              .map(a => a.caminho)
          );
        }
        if (desc.includes('monica') || desc.includes('mônica') || desc.includes('apresentadora')) {
          cena.assets_sugeridos.push(
            ...assetsMap.apresentadora.map(a => a.caminho)
          );
        }
      }
    }

    // Re-salvar roteiros com assets
    const roteirosFinal = {
      _gerado_em: new Date().toISOString(),
      _briefing: briefing.produto,
      roteiros: roteiroData,
    };
    await fs.writeJson(path.join(DATA_DIR, 'roteiros.json'), roteirosFinal, { spaces: 2 });
    log('roteiros.json atualizado com assets sugeridos', 'ok');
  }

  console.log(chalk.green.bold('\n  Copy gerado com sucesso\n'));
}

generateCopy().catch(e => {
  console.error(chalk.red.bold(`\nErro: ${e.message}`));
  process.exit(1);
});
