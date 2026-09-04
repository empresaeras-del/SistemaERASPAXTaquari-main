import type { MargensConfig } from '../components/documentos/DocumentoMargensModal';

export type TipoDocumento = 'contrato_adesao' | 'termo_rescisao' | 'termo_credenciamento' | 'aditivo' | 'outro';

export type OrientacaoPapel = 'retrato' | 'paisagem';
export type TamanhoPapel = 'a4' | 'carta' | 'oficio';

/** Posição/tamanho da assinatura da empresa, escolhidos livremente pelo usuário no editor (coordenadas em % da página, para funcionar em qualquer zoom/tela). */
export interface AssinaturaConfig {
  x: number; // % da largura da página, a partir da esquerda
  y: number; // % da altura da página, a partir do topo
  largura: number; // % da largura da página
  altura: number; // % da altura da página
  pagina: number; // índice da página (0 = primeira), para documentos com quebra de página
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
