/**
 * Conversões de coordenadas da assinatura de posição livre dos Documentos Padrões.
 *
 * O visualizador desenha o documento numa folha contínua (uma `div` só que
 * cresce com o conteúdo) e o usuário arrasta a assinatura sobre ela em pixels.
 * A impressão, por outro lado, é paginada. Estas funções fazem a ponte entre os
 * dois mundos numa unidade que vale nos dois: **milímetros a partir do canto
 * superior esquerdo da área útil de uma página**, mais o índice da página.
 *
 * Todas as funções aqui são puras — é o que permite testá-las sem navegador.
 */
import type {
  AssinaturaConfig,
  AssinaturaConfigV1,
  AssinaturaConfigV2,
  MargensConfig,
  OrientacaoPapel,
} from '../types/documentos';
import { isAssinaturaConfigV2 } from '../types/documentos';

/** Margem usada quando o documento não tem margens próprias gravadas, em mm. */
export const MARGEM_PAGINA_MM = 15;

/** Margens de fallback: documentos antigos não têm `margens` gravado. */
export const MARGENS_PADRAO: MargensConfig = {
  top: MARGEM_PAGINA_MM,
  bottom: MARGEM_PAGINA_MM,
  left: MARGEM_PAGINA_MM,
  right: MARGEM_PAGINA_MM,
};

/** Normaliza margens possivelmente ausentes ou parciais vindas do banco. */
export function margensOu(margens?: MargensConfig | null): MargensConfig {
  if (!margens) return MARGENS_PADRAO;
  return {
    top: Number.isFinite(margens.top) ? margens.top : MARGENS_PADRAO.top,
    bottom: Number.isFinite(margens.bottom) ? margens.bottom : MARGENS_PADRAO.bottom,
    left: Number.isFinite(margens.left) ? margens.left : MARGENS_PADRAO.left,
    right: Number.isFinite(margens.right) ? margens.right : MARGENS_PADRAO.right,
  };
}

/** Dimensões do papel A4 em mm. */
export const A4_MM = { largura: 210, altura: 297 };

type Orientacao = OrientacaoPapel | 'portrait' | 'landscape';

const ehPaisagem = (orientacao: Orientacao) =>
  orientacao === 'paisagem' || orientacao === 'landscape';

/** Largura total do papel, em mm. */
export function larguraPapelMm(orientacao: Orientacao): number {
  return ehPaisagem(orientacao) ? A4_MM.altura : A4_MM.largura;
}

/** Altura total do papel, em mm. */
export function alturaPapelMm(orientacao: Orientacao): number {
  return ehPaisagem(orientacao) ? A4_MM.largura : A4_MM.altura;
}

/** Largura da área útil (papel menos as margens laterais do documento), em mm. */
export function larguraUtilMm(orientacao: Orientacao, margens?: MargensConfig | null): number {
  const m = margensOu(margens);
  return larguraPapelMm(orientacao) - m.left - m.right;
}

/**
 * Altura da área útil de UMA página, em mm — é também o passo vertical entre
 * páginas no fluxo impresso, já que o conteúdo de cada página ocupa exatamente
 * essa altura antes de quebrar.
 */
export function alturaUtilMm(orientacao: Orientacao, margens?: MargensConfig | null): number {
  const m = margensOu(margens);
  return alturaPapelMm(orientacao) - m.top - m.bottom;
}

/**
 * Quantos pixels de layout equivalem a 1mm, medidos a partir da largura
 * renderizada da folha. Usa `clientWidth` (espaço de layout) e não
 * `getBoundingClientRect()` (espaço visual) porque o zoom do visualizador é um
 * `transform: scale()` num ancestral — o arrastar também trabalha em
 * coordenadas de layout, então as duas medidas precisam vir da mesma base.
 */
export function pxPorMm(larguraFolhaPx: number, orientacao: Orientacao): number {
  if (!larguraFolhaPx || larguraFolhaPx <= 0) return 0;
  return larguraFolhaPx / larguraPapelMm(orientacao);
}

/**
 * Converte um deslocamento vertical contínuo (mm desde o topo da área útil da
 * primeira página) no par página + deslocamento dentro dela.
 */
export function decomporEmPagina(
  deslocamentoMm: number,
  orientacao: Orientacao,
  margens?: MargensConfig | null,
): { pagina: number; yMm: number } {
  const passo = alturaUtilMm(orientacao, margens);
  const seguro = Math.max(0, deslocamentoMm);
  const pagina = Math.floor(seguro / passo);
  return { pagina, yMm: seguro - pagina * passo };
}

/** Operação inversa de `decomporEmPagina`. */
export function deslocamentoContinuoMm(
  config: AssinaturaConfigV2,
  orientacao: Orientacao,
  margens?: MargensConfig | null,
): number {
  return config.pagina * alturaUtilMm(orientacao, margens) + config.yMm;
}

/**
 * Monta a configuração a partir de um arrastar/redimensionar, cujas coordenadas
 * chegam em pixels relativos ao canto superior esquerdo da área útil.
 */
export function configDeArrasto(
  xPx: number,
  yPx: number,
  larguraPx: number,
  alturaPx: number,
  escalaPxPorMm: number,
  orientacao: Orientacao,
  margens?: MargensConfig | null,
): AssinaturaConfigV2 | null {
  if (!escalaPxPorMm || escalaPxPorMm <= 0) return null;
  const { pagina, yMm } = decomporEmPagina(yPx / escalaPxPorMm, orientacao, margens);
  return {
    versao: 2,
    pagina,
    xMm: Math.max(0, xPx / escalaPxPorMm),
    yMm,
    larguraMm: Math.max(1, larguraPx / escalaPxPorMm),
    alturaMm: Math.max(1, alturaPx / escalaPxPorMm),
  };
}

/**
 * Converte um registro no formato legado (% da folha contínua inteira) para o
 * formato atual, usando as medidas reais da folha no momento da leitura — é a
 * única forma de recuperar a intenção original, já que a porcentagem antiga só
 * faz sentido contra a altura que a folha tinha na tela.
 *
 * `alturaUtilFolhaPx` é a altura da área útil da folha (sem os paddings), pois
 * é dela que o deslocamento vertical precisa ser medido.
 */
export function converterLegado(
  legado: AssinaturaConfigV1,
  medidas: { larguraFolhaPx: number; alturaFolhaPx: number; paddingTopPx: number; paddingEsquerdaPx: number },
  orientacao: Orientacao,
  margens?: MargensConfig | null,
): AssinaturaConfigV2 | null {
  const escala = pxPorMm(medidas.larguraFolhaPx, orientacao);
  if (!escala) return null;

  // As % antigas eram da folha inteira, medidas a partir da borda dela — o
  // formato novo mede a partir do início da área útil, daí descontar o padding.
  const xPx = (legado.x / 100) * medidas.larguraFolhaPx - medidas.paddingEsquerdaPx;
  const yPx = (legado.y / 100) * medidas.alturaFolhaPx - medidas.paddingTopPx;
  const larguraPx = (legado.largura / 100) * medidas.larguraFolhaPx;
  const alturaPx = (legado.altura / 100) * medidas.alturaFolhaPx;

  return configDeArrasto(xPx, yPx, larguraPx, alturaPx, escala, orientacao, margens);
}

/** Normaliza qualquer formato guardado para o atual. Devolve `null` se não der para converter. */
export function normalizarConfig(
  config: AssinaturaConfig | null | undefined,
  medidas: { larguraFolhaPx: number; alturaFolhaPx: number; paddingTopPx: number; paddingEsquerdaPx: number },
  orientacao: Orientacao,
  margens?: MargensConfig | null,
): AssinaturaConfigV2 | null {
  if (!config) return null;
  if (isAssinaturaConfigV2(config)) return config;
  return converterLegado(config, medidas, orientacao, margens);
}

/**
 * Estilo de posicionamento da assinatura, em mm — o mesmo objeto serve para a
 * folha do visualizador e para a janela de impressão, que é justamente o ponto:
 * as duas passam a desenhar a assinatura a partir dos mesmos números.
 */
export function estiloAssinaturaMm(
  config: AssinaturaConfigV2,
  orientacao: Orientacao,
  margens?: MargensConfig | null,
): { left: string; top: string; width: string; height: string } {
  return {
    left: `${config.xMm.toFixed(2)}mm`,
    top: `${deslocamentoContinuoMm(config, orientacao, margens).toFixed(2)}mm`,
    width: `${config.larguraMm.toFixed(2)}mm`,
    height: `${config.alturaMm.toFixed(2)}mm`,
  };
}

/** Posição/tamanho em pixels de layout, para alimentar o componente de arrastar. */
export function configEmPx(
  config: AssinaturaConfigV2,
  escalaPxPorMm: number,
  orientacao: Orientacao,
  margens?: MargensConfig | null,
): { x: number; y: number; largura: number; altura: number } {
  return {
    x: config.xMm * escalaPxPorMm,
    y: deslocamentoContinuoMm(config, orientacao, margens) * escalaPxPorMm,
    largura: config.larguraMm * escalaPxPorMm,
    altura: config.alturaMm * escalaPxPorMm,
  };
}

/**
 * Posição inicial sugerida ao ativar o posicionamento livre: rodapé da última
 * página que o documento ocupa — onde uma assinatura de contrato costuma ir.
 */
export function configPadrao(
  alturaUtilFolhaMm: number,
  orientacao: Orientacao,
  margens?: MargensConfig | null,
): AssinaturaConfigV2 {
  const passo = alturaUtilMm(orientacao, margens);
  const totalPaginas = Math.max(1, Math.ceil(alturaUtilFolhaMm / passo));
  const larguraMm = 70;
  const alturaMm = 32;
  return {
    versao: 2,
    pagina: totalPaginas - 1,
    xMm: Math.max(0, (larguraUtilMm(orientacao, margens) - larguraMm) / 2),
    yMm: Math.max(0, passo - alturaMm - 12),
    larguraMm,
    alturaMm,
  };
}

/** Quantas páginas a folha do visualizador ocupa, para desenhar as guias de página. */
export function totalPaginasDaFolha(
  alturaUtilFolhaMm: number,
  orientacao: Orientacao,
  margens?: MargensConfig | null,
): number {
  return Math.max(1, Math.ceil(alturaUtilFolhaMm / alturaUtilMm(orientacao, margens)));
}
