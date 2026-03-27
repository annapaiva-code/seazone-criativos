// src/prompts.js — Prompts baseados 100% nos assets reais disponíveis

export function buildSystem(b) {
  const pubAlvo = typeof b.publico_alvo === 'string'
    ? b.publico_alvo
    : `${b.publico_alvo.prioridade_1}. Secundário: ${b.publico_alvo.prioridade_2}`;

  return `Você é um copywriter premium da Seazone, especializado em criativos de performance para o empreendimento ${b.produto}.

DADOS DO EMPREENDIMENTO:
- Endereço: ${b.endereco}
- ROI projetado: ${b.roi_percentual} ao ano
- Rendimento mensal estimado: ${b.rendimento_mensal}
- Rendimento anual: ${b.rendimento_anual || 'R$ 66.424,18'}
- Ticket médio: ${b.ticket_medio}
- Menor cota: ${b.menor_cota || 'R$ 335.291,87'}
- Valorização estimada: ${b.valorizacao_estimada}
- Cotas: ${b.quantidade_cotas || '49 cotas + 3 lojas'}
- Tom: ${b.tom}
- Público-alvo: ${pubAlvo}

PANORAMA COMPETITIVO:
- Preço médio concorrentes: ${b.panorama_competitivo?.preco_medio_concorrentes || 'R$ 584.166,08'}
- Concorrentes diretos: ${b.panorama_competitivo?.concorrentes_diretos || 8}

PILARES OBRIGATÓRIOS (usar em todo criativo): ${b.pilares.join(', ')}

DOs:
${b.dos.map(d => `- ${d}`).join('\n')}

DON'Ts:
${b.donts.map(d => `- ${d}`).join('\n')}

REGRAS LEGAIS:
- NUNCA usar: garantido, certeza, prometemos, assegurado
- SEMPRE usar: projetado, estimado, previsto
- Disclaimer obrigatório ao final de toda legenda

DISCLAIMER: "${b.disclaimer}"

ESTILO DE COPY:
- Frases curtas e diretas. Máximo 15 palavras por frase na headline.
- Tom de autoridade — como dono do empreendimento falando para investidores de igual para igual.
- Dados financeiros sempre em destaque — são o gancho principal.
- Evitar adjetivos vazios (incrível, maravilhoso, fantástico). Preferir dados concretos.
- Legendas: abertura com gancho forte (pergunta ou dado impactante), desenvolvimento em 2-3 parágrafos curtos, hashtags e disclaimer no final.

REGRAS VISUAIS (para prompts de imagem/vídeo):
- Colocar SEMPRE pin de localização "Novo Campeche SPOT II" nas composições
- Não escurecer imagens, manter cores vivas e claras
- Não usar molduras ou bordas
- Não borrar laterais
- Transições suaves entre takes

Responda SEMPRE em JSON válido sem markdown, sem texto fora do objeto JSON.`;
}

// ── ASSETS REAIS DISPONÍVEIS (somente os que existem na pasta assets/) ───────
// Verificados em: 2026-03-26
export const ASSETS_REAIS = {
  'Estático- Feed.jpg': {
    caminho: 'assets/Estático- Feed.jpg',
    descricao: 'criativo de referência estático feed com vista aérea do bairro Novo Campeche, mostrando localização do empreendimento, praia e mar turquesa ao fundo',
  },
  'fachada.png': {
    caminho: 'assets/fachada.png',
    descricao: 'render 3D da fachada do Novo Campeche SPOT II — prédio moderno de 4 andares com fachada em concreto, madeira ripada e vidro, letreiro "seazone" no rooftop, "NOVO CAMPECHE SPOT II" na fachada, vegetação tropical, bicicletas na entrada',
  },
  'rooftop.png': {
    caminho: 'assets/rooftop.png',
    descricao: 'render 3D do rooftop do SPOT II — deck de madeira, piscina de borda infinita com LED, área gourmet com bancada, letreiro "Novo Campeche II SPOT" em neon, vista para o bairro, céu azul',
  },
  'Mônica 2.jpeg': {
    caminho: 'assets/Mônica 2.jpeg',
    descricao: 'Monica na passarela de praia, postura frontal, vestido azul listrado, vegetação verde, dia claro',
  },
};

// ── Estático ─────────────────────────────────────────────────────────────────
export function promptEstatico(b) {
  return `
Gere o criativo estático E1.1.
Estrutura: foco em localização privilegiada + retorno financeiro projetado.

HEADLINE: máximo 12 palavras. Deve conter o ROI ou o rendimento mensal. Direta, sem floreios.
SUBHEADLINE: máximo 10 palavras. Complementa a headline com o outro dado financeiro.
LEGENDA: 3 parágrafos curtos + hashtags + disclaimer. Abertura com gancho financeiro.

ASSETS REAIS que serão usados como base (img2img):
- Feed 1:1 → ${ASSETS_REAIS['fachada.png'].descricao}
- Reels 9:16 → ${ASSETS_REAIS['rooftop.png'].descricao}
- Story 9:16 → ${ASSETS_REAIS['Estático- Feed.jpg'].descricao}

IMPORTANTE:
- O prompt visual deve descrever a MESMA CENA das fotos reais com qualidade cinematográfica aprimorada
- NÃO inventar prédios altos ou cenas que não existem no bairro real
- NÃO pedir textos, overlays, setas, linhas tracejadas na imagem gerada
- Os overlays de texto (pin, badge, headline, ROI, logo, disclaimer) serão adicionados em pós-produção

Retorne este JSON exato:
{
  "id": "E1.1",
  "tipo": "estatico",
  "pin_localizacao": "Novo Campeche SPOT II",
  "badge": "LANÇAMENTO",
  "headline": "headline principal curta e impactante",
  "subheadline": "complemento direto em até 10 palavras",
  "destaque_financeiro": "${b.roi_percentual} ao ano de retorno líquido com aluguel por temporada",
  "cta": "Saiba Mais",
  "legenda_feed": "legenda completa para Instagram com gancho forte, dados financeiros, hashtags e disclaimer",
  "prompt_visual_en": "prompt em inglês descrevendo a cena real do bairro Novo Campeche vista de drone — SEM textos ou overlays gráficos",
  "notas_composicao": "pin de localização no topo esquerdo, badge LANÇAMENTO no centro esquerdo, headline e bloco financeiro coral na metade inferior, logo Seazone canto superior direito, disclaimer no rodapé"
}`;
}

// ── Vídeo Narrado ────────────────────────────────────────────────────────────
export function promptNarrado(b) {
  return `
Gere o roteiro do vídeo narrado VN1.1.
Estrutura: Localização → Fachada → ROI → CTA (rooftop).
Duração: 30-40 segundos. Cada narração deve caber no tempo da cena (máx 3 frases por cena).

ASSETS REAIS que serão usados como first frame de cada cena (img2video):
- Cena 1 (drone, 0-7s): ${ASSETS_REAIS['Estático- Feed.jpg'].descricao}
- Cena 2 (fachada, 8-15s): ${ASSETS_REAIS['fachada.png'].descricao}
- Cena 3 (lifestyle, 16-23s): ${ASSETS_REAIS['fachada.png'].descricao} (mesmo asset, prompt diferente para street-level)
- Cena 4 (rooftop, 24-35s): ${ASSETS_REAIS['rooftop.png'].descricao}

REGRAS DE NARRAÇÃO:
- Tom de voz: grave, pausado, confiante. Como documentary de investimentos.
- Cena 1: contextualizar localização com dado de mercado. Máx 2 frases.
- Cena 2: fachada e arquitetura com foco em short stay. Máx 2 frases.
- Cena 3: ROI e rendimento — pausar nos números. Máx 2 frases.
- Cena 4: CTA direto e objetivo. Máx 1-2 frases.

Para a descricao_visual de cada cena, descrever EXATAMENTE o que o asset real mostra + o movimento cinematográfico desejado:
- NÃO pedir textos, gráficos ou overlays no vídeo

Retorne este JSON exato:
{
  "id": "VN1.1",
  "tipo": "video_narrado",
  "duracao": "30-40s",
  "titulo": "título descritivo",
  "cenas": [
    {"numero": 1, "tempo": "0-7s", "descricao_visual": "descrição do asset real + movimento", "lettering": "(pin) Novo Campeche, Florianópolis - SC", "narracao": "narração curta"},
    {"numero": 2, "tempo": "8-15s", "descricao_visual": "descrição do asset real + movimento", "lettering": "", "narracao": "narração sobre fachada"},
    {"numero": 3, "tempo": "16-23s", "descricao_visual": "descrição do asset real + movimento", "lettering": "ROI Projetado: ${b.roi_percentual} a.a.", "narracao": "narração com ROI e rendimento"},
    {"numero": 4, "tempo": "24-35s", "descricao_visual": "descrição do asset real + movimento", "lettering": "Saiba Mais", "narracao": "CTA direto"}
  ],
  "instrucoes_edicao": "instruções detalhadas para o editor",
  "legenda_feed": "legenda completa com gancho, dados, hashtags e disclaimer",
  "prompt_visual_en": "prompt geral em inglês para vídeo — SEM textos ou overlays"
}`;
}

// ── Vídeo Apresentadora ──────────────────────────────────────────────────────
export function promptApresentadora(b) {
  return `
Gere o roteiro do vídeo com apresentadora VA1.1.
Estrutura 1: Vista aérea da praia → Entrada da Monica na praia → Fachada → Rooftop + CTA
Duração: 30-40 segundos. Cada fala deve caber no tempo (máx 3 frases por cena).

ASSET REAL DA MONICA (único disponível):
- ${ASSETS_REAIS['Mônica 2.jpeg'].descricao}

ASSETS REAIS DO EMPREENDIMENTO:
- Cena 1: ${ASSETS_REAIS['Estático- Feed.jpg'].descricao}
- Cena 3: ${ASSETS_REAIS['fachada.png'].descricao}
- Cena 4: ${ASSETS_REAIS['rooftop.png'].descricao}

TOM DA MÔNICA: autoridade de investidora — como dona do empreendimento.
Mais credibilidade, menos atriz. Dicção clara, pausa estratégica nos dados financeiros.

Falas de referência (ADAPTAR):
[FALA-01] "Estou no Novo Campeche, um dos bairros que mais faturam com Airbnb em Florianópolis."
[FALA-02] "Projeção de retorno: 16,4% ao ano. Renda passiva estimada: mais de 5.500 reais por mês."
[FALA-03] "A fachada foi desenhada para performance em short stay."
[FALA-04] "Este é o Novo Campeche SPOT II. Clique em Saiba Mais."

Para a descricao_visual, descrever EXATAMENTE o que os assets reais mostram:
- NÃO pedir textos, gráficos ou overlays no vídeo

Retorne este JSON exato:
{
  "id": "VA1.1",
  "tipo": "video_apresentadora",
  "duracao": "30-40s",
  "titulo": "título descritivo",
  "cenas": [
    {"numero": 1, "tempo": "0-7s", "descricao_visual": "drone sobre bairro litorâneo real", "fala_monica": null, "narracao_off": "narração off curta", "lettering": "(pin) Novo Campeche, Florianópolis - SC"},
    {"numero": 2, "tempo": "8-15s", "descricao_visual": "Monica na passarela da praia", "fala_monica": "fala baseada em FALA-01", "narracao_off": null, "lettering": ""},
    {"numero": 3, "tempo": "16-23s", "descricao_visual": "fachada do SPOT II", "fala_monica": "fala baseada em FALA-03", "narracao_off": null, "lettering": ""},
    {"numero": 4, "tempo": "24-35s", "descricao_visual": "rooftop com piscina e vista", "fala_monica": "fala combinando FALA-02 + FALA-04", "narracao_off": null, "lettering": "Saiba Mais"}
  ],
  "instrucoes_direcao": "instruções de direção para a Mônica",
  "instrucoes_edicao": "instruções para editor",
  "legenda_feed": "legenda completa com gancho, dados, hashtags e disclaimer",
  "prompt_visual_en": "prompt geral em inglês — SEM textos ou overlays"
}`;
}
