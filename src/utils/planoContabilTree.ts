/**
 * Lógica pura da árvore de contas contábeis — montagem, ordenação e validação.
 *
 * Fica aqui, fora do componente e fora do service, porque é o que dá para testar sem
 * navegador nem rede (mesma divisão de `tableGridModel.ts` e `assinaturaPosicao.ts`).
 * O banco garante o que consegue garantir (unicidade, tenant, plano, ciclo de 1 nível —
 * ver as constraints da migration); estas funções são a camada que impede o formulário
 * de sequer oferecer uma operação inválida.
 */
import { ContaContabil, ContaContabilNode, NaturezaContabil, TipoConta } from '../types/planoContabil';

/** `'3.1.01'` → 3. Código vazio ou só separadores conta como nível 1. */
export function nivelDoCodigo(codigo: string): number {
  const partes = (codigo ?? '').split('.').filter((p) => p.trim() !== '');
  return Math.max(1, partes.length);
}

/** `'3.1.01'` → `'3.1'`; `'3'` → `null` (raiz). */
export function codigoDoPai(codigo: string): string | null {
  const partes = (codigo ?? '').split('.').filter((p) => p.trim() !== '');
  if (partes.length <= 1) return null;
  return partes.slice(0, -1).join('.');
}

/**
 * Ordena por código de forma "natural": cada segmento numérico compara como número, para
 * `3.1.10` vir depois de `3.1.9` (a ordenação alfabética faria o contrário). Segmento não
 * numérico compara como texto, então um plano com códigos alfanuméricos não quebra.
 */
export function compararCodigos(a: string, b: string): number {
  const pa = (a ?? '').split('.');
  const pb = (b ?? '').split('.');
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const sa = pa[i];
    const sb = pb[i];
    if (sa === undefined) return -1;
    if (sb === undefined) return 1;

    const na = Number(sa);
    const nb = Number(sb);
    const ambosNumericos = sa.trim() !== '' && sb.trim() !== '' && !isNaN(na) && !isNaN(nb);

    if (ambosNumericos) {
      if (na !== nb) return na - nb;
    } else {
      const cmp = sa.localeCompare(sb, 'pt-BR');
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

/**
 * Monta a floresta a partir da lista achatada. Contas cujo pai não está na lista (pai
 * excluído, filtro por natureza, dado inconsistente) sobem para a raiz em vez de sumirem
 * da tela — perder uma conta em silêncio seria pior que mostrá-la fora do lugar.
 */
export function montarArvore(contas: ContaContabil[]): ContaContabilNode[] {
  const porId = new Map<string, ContaContabilNode>();
  for (const c of contas) {
    porId.set(c.id, { ...c, filhas: [] });
  }

  const raizes: ContaContabilNode[] = [];
  for (const node of porId.values()) {
    const pai = node.conta_pai_id ? porId.get(node.conta_pai_id) : undefined;
    if (pai && pai.id !== node.id) {
      pai.filhas.push(node);
    } else {
      raizes.push(node);
    }
  }

  const ordenar = (lista: ContaContabilNode[]) => {
    lista.sort((a, b) => compararCodigos(a.codigo, b.codigo));
    for (const item of lista) ordenar(item.filhas);
  };
  ordenar(raizes);

  return raizes;
}

/** Achata a árvore de volta em lista, na ordem em que a tela renderiza. */
export function achatarArvore(nodes: ContaContabilNode[]): ContaContabilNode[] {
  const saida: ContaContabilNode[] = [];
  const visitar = (lista: ContaContabilNode[]) => {
    for (const node of lista) {
      saida.push(node);
      visitar(node.filhas);
    }
  };
  visitar(nodes);
  return saida;
}

/** Contas que podem receber lançamento: analíticas, ativas e não excluídas. */
export function contasLancaveis(contas: ContaContabil[], natureza?: NaturezaContabil): ContaContabil[] {
  return contas
    .filter((c) => c.tipo === 'analitica' && c.ativo && !c.deleted_at)
    .filter((c) => (natureza ? c.natureza === natureza : true))
    .sort((a, b) => compararCodigos(a.codigo, b.codigo));
}

/** Ids de todas as descendentes de uma conta (não inclui a própria). */
export function descendentesDe(contas: ContaContabil[], contaId: string): string[] {
  const filhasPorPai = new Map<string, string[]>();
  for (const c of contas) {
    if (!c.conta_pai_id) continue;
    const atual = filhasPorPai.get(c.conta_pai_id) || [];
    atual.push(c.id);
    filhasPorPai.set(c.conta_pai_id, atual);
  }

  const saida: string[] = [];
  const visitados = new Set<string>([contaId]);
  const fila = [...(filhasPorPai.get(contaId) || [])];

  while (fila.length > 0) {
    const id = fila.shift() as string;
    if (visitados.has(id)) continue; // corta ciclo, se algum dia existir
    visitados.add(id);
    saida.push(id);
    fila.push(...(filhasPorPai.get(id) || []));
  }
  return saida;
}

/**
 * Contas que podem ser pai de `contaId`: sintéticas, ativas, da mesma natureza, e que não
 * sejam a própria conta nem qualquer descendente dela — é o que impede montar um ciclo
 * pela tela (o banco só barra o ciclo de 1 nível; ver R6 do planejamento).
 * Passe `contaId = null` ao criar uma conta nova.
 */
export function paisPossiveis(
  contas: ContaContabil[],
  natureza: NaturezaContabil,
  contaId: string | null,
): ContaContabil[] {
  const proibidos = new Set<string>(contaId ? [contaId, ...descendentesDe(contas, contaId)] : []);
  return contas
    .filter((c) => c.tipo === 'sintetica' && c.ativo && !c.deleted_at)
    .filter((c) => c.natureza === natureza)
    .filter((c) => !proibidos.has(c.id))
    .sort((a, b) => compararCodigos(a.codigo, b.codigo));
}

export interface ErroValidacaoConta {
  campo: 'codigo' | 'nome' | 'natureza' | 'tipo' | 'conta_pai_id';
  mensagem: string;
}

export interface DadosContaParaValidar {
  id?: string | null;
  codigo: string;
  nome: string;
  natureza: NaturezaContabil;
  tipo: TipoConta;
  conta_pai_id?: string | null;
}

/**
 * Valida uma conta contra as demais do mesmo plano. Devolve lista vazia quando está tudo
 * certo. As mensagens são as que aparecem na tela — por isso em português e específicas.
 */
export function validarConta(dados: DadosContaParaValidar, contas: ContaContabil[]): ErroValidacaoConta[] {
  const erros: ErroValidacaoConta[] = [];
  const codigo = (dados.codigo ?? '').trim();
  const nome = (dados.nome ?? '').trim();

  if (!codigo) {
    erros.push({ campo: 'codigo', mensagem: 'Informe o código da conta (ex.: 3.1.01).' });
  } else if (!/^[A-Za-z0-9]+(\.[A-Za-z0-9]+)*$/.test(codigo)) {
    erros.push({ campo: 'codigo', mensagem: 'Código deve ser formado por segmentos separados por ponto, sem espaços (ex.: 3.1.01).' });
  } else if (contas.some((c) => c.codigo === codigo && c.id !== dados.id)) {
    erros.push({ campo: 'codigo', mensagem: `Já existe uma conta com o código ${codigo} neste plano.` });
  }

  if (!nome) {
    erros.push({ campo: 'nome', mensagem: 'Informe o nome da conta.' });
  }

  const pai = dados.conta_pai_id ? contas.find((c) => c.id === dados.conta_pai_id) : null;

  if (dados.conta_pai_id && !pai) {
    erros.push({ campo: 'conta_pai_id', mensagem: 'A conta pai selecionada não existe mais.' });
  }

  if (pai) {
    if (pai.id === dados.id) {
      erros.push({ campo: 'conta_pai_id', mensagem: 'Uma conta não pode ser pai de si mesma.' });
    } else if (dados.id && descendentesDe(contas, dados.id).includes(pai.id)) {
      erros.push({ campo: 'conta_pai_id', mensagem: 'A conta pai escolhida está abaixo desta conta na árvore — isso criaria um ciclo.' });
    }
    if (pai.tipo !== 'sintetica') {
      erros.push({ campo: 'conta_pai_id', mensagem: 'Só uma conta sintética (grupo) pode ter contas abaixo dela.' });
    }
    if (pai.natureza !== dados.natureza) {
      erros.push({ campo: 'natureza', mensagem: 'A conta deve ter a mesma natureza da conta pai (receita ou despesa).' });
    }
  }

  return erros;
}

/**
 * Sugere o próximo código livre dentro de um pai: `3.1` com filhas `3.1.01` e `3.1.02`
 * devolve `3.1.03`, mantendo o zero à esquerda do padrão usado pelas irmãs. Sem pai,
 * sugere o próximo código de raiz.
 */
export function proximoCodigo(contas: ContaContabil[], paiCodigo: string | null): string {
  const prefixo = paiCodigo ? `${paiCodigo}.` : '';
  const irmas = contas.filter((c) => codigoDoPai(c.codigo) === paiCodigo);

  let maior = 0;
  let largura = paiCodigo ? 2 : 1;

  for (const irma of irmas) {
    const ultimo = irma.codigo.split('.').pop() as string;
    const n = Number(ultimo);
    if (!isNaN(n)) {
      if (n > maior) maior = n;
      if (ultimo.length > largura) largura = ultimo.length;
    }
  }

  return `${prefixo}${String(maior + 1).padStart(largura, '0')}`;
}
