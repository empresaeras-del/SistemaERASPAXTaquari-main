/**
 * O pedaço do PostgREST que estas telas usam — filtro, ordenação, embed e upsert.
 *
 * A decisão que faz este arquivo valer alguma coisa: **operador que ele não conhece LANÇA**,
 * em vez de ignorar o filtro e devolver a tabela inteira (ou vazia). Um dublê que responde
 * `[]` para o que não entendeu deixa o teste verde sem ter exercido nada — é a mesma armadilha
 * do guarda que não acha o que deveria checar, que o CLAUDE.md já registra. Quando esta suíte
 * alcançar uma tela nova e ela usar `cs.` ou `fts.`, o erro diz qual operador falta.
 */
export type Linha = Record<string, any>;
export type Banco = Map<string, Linha[]>;

export class FiltroDesconhecido extends Error {}

const comparar = (a: any, b: any): number => {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1; // nulo por último, como `NULLS LAST`
  if (b === null || b === undefined) return -1;
  return a < b ? -1 : 1;
};

/** `"texto"` / `texto` / `null` / `true` → o valor que se compara com a coluna. */
const valorDoFiltro = (bruto: string): any => {
  const v = decodeURIComponent(bruto);
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  return v;
};

const comoTexto = (v: any) => (v === null || v === undefined ? '' : String(v));

const casaOperador = (linha: Linha, coluna: string, expressao: string): boolean => {
  const ponto = expressao.indexOf('.');
  if (ponto < 0) throw new FiltroDesconhecido(`Filtro sem operador: ${coluna}=${expressao}`);

  let op = expressao.slice(0, ponto);
  let resto = expressao.slice(ponto + 1);
  let negado = false;
  if (op === 'not') {
    negado = true;
    const p2 = resto.indexOf('.');
    op = resto.slice(0, p2);
    resto = resto.slice(p2 + 1);
  }

  const atual = linha[coluna];
  const alvo = valorDoFiltro(resto);
  let resultado: boolean;

  switch (op) {
    case 'eq':
      resultado = comoTexto(atual) === comoTexto(alvo);
      break;
    case 'neq':
      resultado = comoTexto(atual) !== comoTexto(alvo);
      break;
    case 'is':
      resultado = alvo === null ? atual === null || atual === undefined : atual === alvo;
      break;
    case 'gt':
      resultado = comparar(atual, alvo) > 0;
      break;
    case 'gte':
      resultado = comparar(atual, alvo) >= 0;
      break;
    case 'lt':
      resultado = atual !== null && atual !== undefined && comparar(atual, alvo) < 0;
      break;
    case 'lte':
      resultado = atual !== null && atual !== undefined && comparar(atual, alvo) <= 0;
      break;
    case 'like':
    case 'ilike': {
      const padrao = comoTexto(alvo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*');
      resultado = new RegExp(`^${padrao}$`, op === 'ilike' ? 'i' : '').test(comoTexto(atual));
      break;
    }
    case 'in': {
      const lista = comoTexto(alvo)
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((x) => x.replace(/^"|"$/g, ''));
      resultado = lista.includes(comoTexto(atual));
      break;
    }
    default:
      throw new FiltroDesconhecido(`Operador PostgREST não implementado no dublê: "${op}"`);
  }

  return negado ? !resultado : resultado;
};

/** `or=(tenant_id.eq.x,empresa_id.eq.x)` — só o nível raso, que é o que as telas usam. */
const casaOr = (linha: Linha, expressao: string): boolean => {
  const corpo = expressao.replace(/^\(|\)$/g, '');
  const partes: string[] = [];
  let profundidade = 0;
  let atual = '';
  for (const c of corpo) {
    if (c === '(') profundidade++;
    if (c === ')') profundidade--;
    if (c === ',' && profundidade === 0) {
      partes.push(atual);
      atual = '';
    } else atual += c;
  }
  if (atual) partes.push(atual);

  return partes.some((parte) => {
    const ponto = parte.indexOf('.');
    return casaOperador(linha, parte.slice(0, ponto), parte.slice(ponto + 1));
  });
};

const RESERVADOS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

export const filtrar = (linhas: Linha[], params: URLSearchParams): Linha[] => {
  let saida = linhas;
  for (const [chave, valor] of params.entries()) {
    if (RESERVADOS.has(chave)) continue;
    if (chave === 'or') {
      saida = saida.filter((l) => casaOr(l, valor));
      continue;
    }
    if (chave === 'and') throw new FiltroDesconhecido('`and=` não implementado no dublê');
    saida = saida.filter((l) => casaOperador(l, chave, valor));
  }
  return saida;
};

export const ordenar = (linhas: Linha[], params: URLSearchParams): Linha[] => {
  const pedidos = params.getAll('order');
  if (pedidos.length === 0) return linhas;

  const criterios = pedidos
    .flatMap((p) => p.split(','))
    .map((p) => {
      const [coluna, ...opcoes] = p.split('.');
      return { coluna, desc: opcoes.includes('desc') };
    });

  return [...linhas].sort((a, b) => {
    for (const { coluna, desc } of criterios) {
      const c = comparar(a[coluna], b[coluna]);
      if (c !== 0) return desc ? -c : c;
    }
    return 0;
  });
};

/**
 * `select=*,dependentes(*)` — o embed que `getAssociados` usa. O dublê resolve o vínculo por
 * `<tabela_pai_singular>_id`, que é a convenção deste schema inteiro.
 */
export const aplicarSelect = (linhas: Linha[], select: string | null, banco: Banco, tabela: string): Linha[] => {
  if (!select || !select.includes('(')) return linhas;

  const embeds = [...select.matchAll(/(\w+)\s*\(([^()]*)\)/g)].map((m) => m[1]);
  if (embeds.length === 0) return linhas;

  const chaveEstrangeira = `${tabela.replace(/s$/, '')}_id`;
  return linhas.map((linha) => {
    const copia = { ...linha };
    for (const filha of embeds) {
      copia[filha] = (banco.get(filha) ?? []).filter((f) => f[chaveEstrangeira] === linha.id);
    }
    return copia;
  });
};
