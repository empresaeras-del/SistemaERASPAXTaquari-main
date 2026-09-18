const ACENTOS = 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC';

/**
 * `'Comercial / Vendas'` → `'COMERCIAL-VENDAS'`.
 *
 * Código legível derivado de um nome: sem acento, maiúsculas, e qualquer corrida de caractere
 * que não seja letra ou número vira **um** hífen só, sem hífen nas pontas. Nome que não sobra
 * nada (só símbolos) devolve o `fallback`, para nunca gravar código vazio numa coluna `UNIQUE`.
 *
 * Vive aqui, e não dentro de um módulo de domínio, porque duas tabelas já a usam — centros de
 * custo e categorias de fornecedor — e **o `translate()`/`regexp_replace` das migrations gera
 * exatamente o mesmo código de propósito**: se as duas pontas divergirem, o app cria uma linha
 * duplicada em vez de reaproveitar a que a migration criou. Predicado repetido em dois lugares
 * só é corrigido uma vez.
 */
export function codigoDeNome(nome: string, fallback: string): string {
  const semAcento = (nome ?? '')
    .split('')
    .map((ch) => {
      const i = ACENTOS.indexOf(ch);
      return i >= 0 ? SEM_ACENTO[i] : ch;
    })
    .join('');

  const codigo = semAcento
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return codigo || fallback;
}
