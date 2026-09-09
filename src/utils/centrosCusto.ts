/**
 * Lógica pura dos centros de custo — derivação do código e ordenação.
 *
 * Fica fora do service pelo mesmo motivo de `planoContabilTree.ts`: é o que dá para testar
 * sem rede nem navegador. O código de um centro de custo é derivado do nome, e não uma
 * sequência numérica, porque centro de custo não tem hierarquia — "ADMINISTRATIVO" diz o que
 * é num relatório exportado, "03" não diz nada.
 */
import { CentroCusto } from '../types/centroCusto';

const ACENTOS = 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ';
const SEM_ACENTO = 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC';

/**
 * `'Comercial / Vendas'` → `'COMERCIAL-VENDAS'`.
 *
 * Mesma regra do backfill em SQL (`20260909122939`), para o código que o app gera bater com
 * o que a migration gerou: sem acento, maiúsculas, e qualquer corrida de caractere que não
 * seja letra ou número vira um hífen só. Nome que não sobra nada (só símbolos) devolve
 * `'CENTRO'`, para nunca gravar código vazio numa coluna `UNIQUE`.
 */
export function codigoDeCentroCusto(nome: string): string {
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

  return codigo || 'CENTRO';
}

/** Ordena por código, com os desativados no fim — a tela lista os utilizáveis primeiro. */
export function ordenarCentrosCusto(centros: CentroCusto[]): CentroCusto[] {
  return [...centros].sort((a, b) => {
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
    return (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR');
  });
}

/**
 * Centros que o formulário de lançamento pode oferecer: ativos e não excluídos.
 *
 * `selecionadoId` mantém na lista o centro já gravado num lançamento antigo mesmo depois de
 * desativado — pelo mesmo motivo do seletor de conta contábil: abrir o lançamento para editar
 * não pode apagar a classificação dele.
 */
export function centrosSelecionaveis(
  centros: CentroCusto[],
  selecionadoId?: string | null,
): CentroCusto[] {
  return ordenarCentrosCusto(
    centros.filter((c) => !c.deleted_at && (c.ativo || (selecionadoId != null && c.id === selecionadoId))),
  );
}
