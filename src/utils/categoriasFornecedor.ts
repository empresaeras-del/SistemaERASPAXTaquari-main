import { CategoriaFornecedorRegistro } from '../types/categoriaFornecedor';
import { CATEGORIAS_FORNECEDOR_PADRAO } from '../config/categoriasFornecedorPadrao.config';
import { codigoDeNome } from './codigoDeNome';

/**
 * Lógica pura das categorias de fornecedor: código derivado do nome, ordenação, quais nomes o
 * seletor oferece e o que é preciso normalizar antes de gravar.
 *
 * Decide **o quê**; o modal de gerência e o formulário de fornecedor decidem só **como**. É a
 * mesma divisão de `centrosCusto.ts`, e existe pelo mesmo motivo: é a parte que dá para testar
 * sem rede e sem navegador.
 */

/** Fallback do código quando o nome não sobra nenhuma letra ou número (só símbolos). */
export const CODIGO_CATEGORIA_FALLBACK = 'CATEGORIA';

export const MENSAGEM_CATEGORIA_SEM_NOME = 'Informe o nome da categoria.';
export const MENSAGEM_CATEGORIA_DUPLICADA = 'Já existe uma categoria com esse nome nesta empresa.';

/**
 * `'Urnas e Caixões'` → `'URNAS-E-CAIXOES'`.
 *
 * **A mesma regra roda em SQL** no backfill (`20260918010937`), e isso não é coincidência: se
 * as duas divergirem, o app cria uma categoria duplicada em vez de reaproveitar a que a
 * migration criou. Há teste travando os 12 códigos da lista modelo.
 */
export const codigoDeCategoria = (nome: string): string =>
  codigoDeNome(nome, CODIGO_CATEGORIA_FALLBACK);

/** Ordena por nome, com as desativadas no fim — a tela lista as utilizáveis primeiro. */
export const ordenarCategorias = (
  categorias: readonly CategoriaFornecedorRegistro[]
): CategoriaFornecedorRegistro[] =>
  [...(categorias || [])].sort((a, b) => {
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
    return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  });

/**
 * Normaliza o nome no **ponto de escrita**: espaços das pontas fora, corridas de espaço no
 * meio viram um só. Sem isso `'Outros '` e `'Outros'` são nomes diferentes para a
 * `unique (tenant_id, nome)` e o operador acabaria com duas linhas que parecem a mesma.
 */
export const nomeDeCategoriaParaGravacao = (nome: string | null | undefined): string =>
  (nome ?? '').replace(/\s+/g, ' ').trim();

/**
 * Procura, na empresa, uma categoria com o mesmo nome — ignorando maiúsculas e acentos, que é
 * como o operador enxerga "igual". A `unique` do banco distingue `'Convênios'` de
 * `'Convenios'`; esta guarda não, de propósito: duas linhas assim são erro de digitação, e a
 * recusa amigável vale mais que a violação de constraint.
 */
export const encontrarCategoriaComMesmoNome = (
  categorias: readonly CategoriaFornecedorRegistro[],
  nome: string,
  excluirId?: string | null
): CategoriaFornecedorRegistro | undefined => {
  const alvo = codigoDeCategoria(nomeDeCategoriaParaGravacao(nome));
  if (!alvo || alvo === CODIGO_CATEGORIA_FALLBACK) return undefined;
  return (categorias || []).find(
    (c) => c && c.id !== excluirId && codigoDeCategoria(c.nome || '') === alvo
  );
};

/**
 * Os **nomes** que o seletor do formulário de fornecedor pode oferecer.
 *
 * Três decisões:
 *
 * - **Empresa sem nenhuma categoria cadastrada cai na lista modelo.** É a mesma escolha do
 *   seletor de centro de custo: `categoria` é obrigatória no formulário, então um select vazio
 *   travaria o cadastro de uma empresa criada depois da migration de backfill.
 * - **A categoria já gravada continua na lista mesmo desativada** (`nomeJaSelecionado`). Sem
 *   isso, abrir para editar um fornecedor cuja categoria foi desativada perderia a seleção e
 *   reescreveria o campo ao salvar — em silêncio. Mesma regra do seletor de conta contábil.
 * - **Só nome, não o registro inteiro**: a coluna gravada é texto, e é por ela que
 *   `CATEGORIA_EMPRESA_CONVENIADA` é reconhecida em todo o resto do sistema.
 */
export const nomesDeCategoriaParaSelecao = (
  categorias: readonly CategoriaFornecedorRegistro[],
  nomeJaSelecionado?: string | null
): string[] => {
  const vivas = (categorias || []).filter((c) => c && !c.deleted_at);

  if (vivas.length === 0) {
    const modelo = [...CATEGORIAS_FORNECEDOR_PADRAO];
    const atual = nomeDeCategoriaParaGravacao(nomeJaSelecionado);
    if (atual && !modelo.includes(atual)) modelo.push(atual);
    return modelo;
  }

  const nomes = ordenarCategorias(vivas.filter((c) => c.ativo)).map((c) => c.nome);
  const atual = nomeDeCategoriaParaGravacao(nomeJaSelecionado);
  if (atual && !nomes.includes(atual)) nomes.push(atual);
  return nomes;
};

/**
 * Opções do **filtro** da listagem: as ativas mais qualquer categoria que algum fornecedor já
 * use, ainda que desativada. Uma categoria desativada com fornecedores dentro precisa
 * continuar filtrável, senão esses fornecedores viram infiltráveis — mesma escolha de
 * `opcoesFiltroEmpresa`.
 */
export const nomesDeCategoriaParaFiltro = (
  categorias: readonly CategoriaFornecedorRegistro[],
  categoriasEmUso: readonly (string | null | undefined)[]
): string[] => {
  const emUso = new Set(
    (categoriasEmUso || []).map((c) => nomeDeCategoriaParaGravacao(c)).filter(Boolean)
  );
  const vivas = (categorias || []).filter((c) => c && !c.deleted_at);
  const base = vivas.length === 0 ? [...CATEGORIAS_FORNECEDOR_PADRAO] : ordenarCategorias(vivas)
    .filter((c) => c.ativo || emUso.has(c.nome))
    .map((c) => c.nome);

  for (const nome of emUso) {
    if (!base.includes(nome)) base.push(nome);
  }
  return base;
};

/** Índice nome → categoria, para o formulário resolver o `categoria_id` do nome escolhido. */
export const indiceDeCategoriasPorNome = (
  categorias: readonly CategoriaFornecedorRegistro[]
): Map<string, CategoriaFornecedorRegistro> => {
  const indice = new Map<string, CategoriaFornecedorRegistro>();
  (categorias || []).forEach((c) => {
    if (c?.nome) indice.set(nomeDeCategoriaParaGravacao(c.nome), c);
  });
  return indice;
};

/**
 * O `categoria_id` a gravar num fornecedor, a partir do nome escolhido no select.
 *
 * Devolve `null` — **nunca `undefined`** — quando a empresa ainda não tem a categoria
 * cadastrada (o caso do fallback da lista modelo). `JSON.stringify` descarta chave
 * `undefined`, e o `update` chegaria ao Postgres sem a coluna, deixando o id antigo no banco
 * depois de o operador ter trocado a categoria na tela. É a mesma armadilha de
 * `vinculoEmpresaParaGravacao` e do `responsavelParaGravacao`.
 */
export const categoriaIdParaGravacao = (
  categorias: readonly CategoriaFornecedorRegistro[],
  nomeEscolhido: string | null | undefined
): string | null => {
  const nome = nomeDeCategoriaParaGravacao(nomeEscolhido);
  if (!nome) return null;
  return indiceDeCategoriasPorNome(categorias).get(nome)?.id ?? null;
};
