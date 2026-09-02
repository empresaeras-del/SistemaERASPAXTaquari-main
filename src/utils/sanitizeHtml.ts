import DOMPurify from 'dompurify';

/**
 * Sanitiza HTML antes de injetar via `dangerouslySetInnerHTML`.
 *
 * Usado para o HTML de "documentos padrão" (editado no Jodit e salvo em
 * `documentos_padroes.conteudo`): qualquer usuário com acesso ao editor pode
 * gravar esse HTML, e ele é depois renderizado para outros usuários ao
 * visualizar/imprimir o documento — sem sanitização, isso é um vetor de XSS
 * armazenado.
 */
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target'],
  });
};
