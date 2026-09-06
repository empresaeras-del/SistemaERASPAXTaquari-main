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
  OrientacaoPapel,
} from '../types/documentos';
import { isAssinaturaConfigV2 } from '../types/documentos';

/** Margem da página usada pelo CSS de impressão (`@page { margin }`), em mm. */
export const MARGEM_PAGINA_MM = 15;

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

/** Largura da área útil (papel menos as duas margens), em mm. */
export function larguraUtilMm(orientacao: Orientacao): number {
  return larguraPapelMm(orientacao) - MARGEM_PAGINA_MM * 2;
}

/**
 * Altura da área útil de UMA página, em mm — é também o passo vertical entre
 * páginas no fluxo impresso, já que o conteúdo de cada página ocupa exatamente
 * essa altura antes de quebrar.
 */
export function alturaUtilMm(orientacao: Orientacao): number {
  return alturaPapelMm(orientacao) - MARGEM_PAGINA_MM * 2;
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
): { pagina: number; yMm: number } {
  const passo = alturaUtilMm(orientacao);
  const seguro = Math.max(0, deslocamentoMm);
  const pagina = Math.floor(seguro / passo);
  return { pagina, yMm: seguro - pagina * passo };
}

/** Operação inversa de `decomporEmPagina`. */
export function deslocamentoContinuoMm(
  config: AssinaturaConfigV2,
  orientacao: Orientacao,
): number {
  return config.pagina * alturaUtilMm(orientacao) + config.yMm;
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
): AssinaturaConfigV2 | null {
  if (!escalaPxPorMm || escalaPxPorMm <= 0) return null;
  const { pagina, yMm } = decomporEmPagina(yPx / escalaPxPorMm, orientacao);
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
): AssinaturaConfigV2 | null {
  const escala = pxPorMm(medidas.larguraFolhaPx, orientacao);
  if (!escala) return null;

  // As % antigas eram da folha inteira, medidas a partir da borda dela — o
  // formato novo mede a partir do início da área útil, daí descontar o padding.
  const xPx = (legado.x / 100) * medidas.larguraFolhaPx - medidas.paddingEsquerdaPx;
  const yPx = (legado.y / 100) * medidas.alturaFolhaPx - medidas.paddingTopPx;
  const larguraPx = (legado.largura / 100) * medidas.larguraFolhaPx;
  const alturaPx = (legado.altura / 100) * medidas.alturaFolhaPx;

  return configDeArrasto(xPx, yPx, larguraPx, alturaPx, escala, orientacao);
}

/** Normaliza qualquer formato guardado para o atual. Devolve `null` se não der para converter. */
export function normalizarConfig(
  config: AssinaturaConfig | null | undefined,
  medidas: { larguraFolhaPx: number; alturaFolhaPx: number; paddingTopPx: number; paddingEsquerdaPx: number },
  orientacao: Orientacao,
): AssinaturaConfigV2 | null {
  if (!config) return null;
  if (isAssinaturaConfigV2(config)) return config;
  return converterLegado(config, medidas, orientacao);
}

/**
 * Estilo de posicionamento da assinatura, em mm — o mesmo objeto serve para a
 * folha do visualizador e para a janela de impressão, que é justamente o ponto:
 * as duas passam a desenhar a assinatura a partir dos mesmos números.
 */
export function estiloAssinaturaMm(
  config: AssinaturaConfigV2,
  orientacao: Orientacao,
): { left: string; top: string; width: string; height: string } {
  return {
    left: `${config.xMm.toFixed(2)}mm`,
    top: `${deslocamentoContinuoMm(config, orientacao).toFixed(2)}mm`,
    width: `${config.larguraMm.toFixed(2)}mm`,
    height: `${config.alturaMm.toFixed(2)}mm`,
  };
}

/** Posição/tamanho em pixels de layout, para alimentar o componente de arrastar. */
export function configEmPx(
  config: AssinaturaConfigV2,
  escalaPxPorMm: number,
  orientacao: Orientacao,
): { x: number; y: number; largura: number; altura: number } {
  return {
    x: config.xMm * escalaPxPorMm,
    y: deslocamentoContinuoMm(config, orientacao) * escalaPxPorMm,
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
): AssinaturaConfigV2 {
  const passo = alturaUtilMm(orientacao);
  const totalPaginas = Math.max(1, Math.ceil(alturaUtilFolhaMm / passo));
  const larguraMm = 70;
  const alturaMm = 32;
  return {
    versao: 2,
    pagina: totalPaginas - 1,
    xMm: Math.max(0, (larguraUtilMm(orientacao) - larguraMm) / 2),
    yMm: Math.max(0, passo - alturaMm - 12),
    larguraMm,
    alturaMm,
  };
}

/** Quantas páginas a folha do visualizador ocupa, para desenhar as guias de página. */
export function totalPaginasDaFolha(alturaUtilFolhaMm: number, orientacao: Orientacao): number {
  return Math.max(1, Math.ceil(alturaUtilFolhaMm / alturaUtilMm(orientacao)));
}
