export type TipoDocumento = 'contrato_adesao' | 'termo_rescisao' | 'termo_credenciamento' | 'aditivo' | 'outro';

export interface DocumentoPadrao {
  id: string;
  nome: string;
  descricao?: string;
  tipo: TipoDocumento;
  conteudo: string; // The HTML or markdown template with variables like {{associado_nome}}, {{empresa_nome}}, etc.
  arquivo_url?: string; // Optional URL for uploaded PDF/Docx templates
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  empresa_id: string;
}

export type DocumentoPadraoInsert = Omit<DocumentoPadrao, 'id' | 'criado_em' | 'atualizado_em'> & { id?: string };
export type DocumentoPadraoUpdate = Partial<DocumentoPadraoInsert>;
