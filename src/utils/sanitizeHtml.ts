import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML editável pelo usuário (conteúdo de Documentos Padrões) antes de qualquer
 * `dangerouslySetInnerHTML`. Sem isso, um usuário com permissão de editar modelos poderia
 * injetar `<script>`/handlers de evento que executam quando outro usuário do mesmo tenant
 * (com nível de acesso diferente) visualiza ou imprime o documento — XSS armazenado.
 * A configuração padrão do DOMPurify preserva formatação, tabelas e imagens (inclusive
 * `data:` URIs de upload), que é exatamente o que o editor de documentos produz.
 */
export function sanitizeDocumentoHtml(html: string): string {
  return DOMPurify.sanitize(html);
}
