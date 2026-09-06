import type { MargensConfig } from '../components/documentos/DocumentoMargensModal';

// Reexportado para que `utils/` possa tipar margens sem depender de `components/`.
export type { MargensConfig };

export type TipoDocumento = 'contrato_adesao' | 'termo_rescisao' | 'termo_credenciamento' | 'aditivo' | 'outro';

export type OrientacaoPapel = 'retrato' | 'paisagem';
export type TamanhoPapel = 'a4' | 'carta' | 'oficio';

/**
 * Formato **legado** da posição da assinatura: porcentagens da folha contínua
 * inteira do visualizador (que cresce com o documento), e não de uma página.
 *
 * Isso quebrava na impressão: lá o mesmo `%` era remedido contra a caixa de uma
 * única página, então uma assinatura colocada aos 13% de uma folha de 7 páginas
 * (~236mm, fim da página 1) reaparecia aos 13% de 267mm (~36mm) com 1/7 do
 * tamanho. Mantido apenas para ler registros antigos e convertê-los para o
 * formato atual — nada grava mais neste formato.
 */
export interface AssinaturaConfigV1 {
  versao?: 1;
  x: number; // % da largura da folha, a partir da esquerda
  y: number; // % da altura da FOLHA INTEIRA, a partir do topo
  largura: number; // % da largura da folha
  altura: number; // % da altura da folha inteira
  pagina: number; // sempre gravado como 0; nunca era lido
}

/**
 * Formato atual da posição da assinatura: milímetros a partir do canto superior
 * esquerdo da **área útil de uma página**, mais o índice da página.
 *
 * Milímetro é a unidade natural do papel: o mesmo valor vale no visualizador e
 * na impressão sem depender de contra qual caixa a porcentagem seria resolvida.
 */
export interface AssinaturaConfigV2 {
  versao: 2;
  pagina: number; // índice da página (0 = primeira)
  xMm: number; // mm a partir da margem esquerda da área útil
  yMm: number; // mm a partir do topo da área útil DA PÁGINA `pagina`
  larguraMm: number;
  alturaMm: number;
}

export type AssinaturaConfig = AssinaturaConfigV1 | AssinaturaConfigV2;

/** Discrimina os dois formatos de `assinatura_config` guardados no JSONB. */
export function isAssinaturaConfigV2(cfg: AssinaturaConfig): cfg is AssinaturaConfigV2 {
  return (cfg as AssinaturaConfigV2).versao === 2;
}

/** Uma variável personalizada criada pelo usuário no editor (além do catálogo padrão por módulo). */
export interface VariavelPersonalizada {
  chave: string; // nome interno, usado como {{chave}}
  label: string;
  descricao?: string;
}

export interface DocumentoPadrao {
  id: string;
  nome: string;
  descricao?: string;
  tipo: TipoDocumento;
  conteudo: string; // HTML com variáveis, ex.: {{associado_nome}}, {{empresa_nome}}
  arquivo_url?: string; // Upload opcional de PDF/Docx pronto
  cabecalho_html?: string;
  rodape_html?: string;
  margens?: MargensConfig;
  orientacao?: OrientacaoPapel;
  tamanho_papel?: TamanhoPapel;
  padrao?: boolean; // marca este modelo como padrão para o seu `tipo`
  variaveis_disponiveis?: VariavelPersonalizada[];
  assinatura_config?: AssinaturaConfig | null; // posição livre da assinatura da empresa; null/ausente = rodapé fixo (comportamento legado)
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  empresa_id: string;
}

export type DocumentoPadraoInsert = Omit<DocumentoPadrao, 'id' | 'criado_em' | 'atualizado_em'> & { id?: string };
export type DocumentoPadraoUpdate = Partial<DocumentoPadraoInsert>;
