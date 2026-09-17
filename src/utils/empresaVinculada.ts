import { Associado } from '../services/associadosService';
import { Fornecedor } from '../types/fornecedores';

/**
 * O associado Pessoa Jurídica é vinculado a uma empresa conveniada, que é uma linha de
 * `fornecedores`. Este módulo é puro: decide **o quê** (quem é PJ, qual empresa vale, que nome
 * imprimir, quais opções oferecer), e cada tela/renderizador decide só **como**.
 *
 * Existe para não repetir o predicado nos quatro lugares que precisam dele — cadastro, listagem,
 * filtro e relatório. Predicado repetido em dois lugares só é corrigido uma vez.
 */

/**
 * Categoria de `fornecedores` que representa uma empresa conveniada de associado.
 *
 * Era um literal dentro do JSX do formulário. O problema de deixá-lo lá: se alguém renomear a
 * categoria no cadastro de fornecedores, o seletor esvazia **em silêncio** e o operador fica sem
 * conseguir salvar um PJ sem nada na tela explicando por quê.
 */
export const CATEGORIA_EMPRESA_CONVENIADA = 'Convenios Associados';

/**
 * Valor do filtro que significa "qualquer associado Pessoa Jurídica", sem escolher a empresa.
 * Filtrar por empresa sem poder listar todos os PJ responde metade da pergunta.
 */
export const FILTRO_SOMENTE_PJ = '__pj__';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Um cadastro é PJ só quando o tipo diz isso explicitamente; o default do schema é `'PF'`. */
export const ehPessoaJuridica = (tipoPessoa?: string | null): boolean => tipoPessoa === 'PJ';

/**
 * Normaliza o vínculo no **ponto de escrita**, e é aqui que moram três regras que já custaram caro
 * neste schema:
 *
 * - `''` vira `null`. A coluna é `uuid`, e string vazia é `22P02` — foi um `''` num `uuid` que
 *   manteve `atendimentos` com zero linhas por meses.
 * - Cadastro que não é PJ grava `null`, nunca o id que ficou na tela. Trocar de PJ para PF sem
 *   isso deixaria um vínculo órfão, invisível no formulário e visível no filtro.
 * - `null`, nunca `undefined`: `JSON.stringify` descarta chave `undefined`, então o `upsert`
 *   chegaria ao Postgres sem a coluna e o valor antigo continuaria lá. O operador desvincularia a
 *   empresa na tela, salvaria, e o vínculo velho seguiria no banco sem nenhum erro.
 */
export const vinculoEmpresaParaGravacao = (
  tipoPessoa?: string | null,
  fornecedorId?: string | null
): string | null => {
  if (!ehPessoaJuridica(tipoPessoa)) return null;
  const id = (fornecedorId || '').trim();
  if (!id || !UUID_REGEX.test(id)) return null;
  return id;
};

/** Nome pelo qual a empresa é reconhecida: razão social, e o fantasia como segunda opção. */
export const nomeDaEmpresa = (fornecedor?: Pick<Fornecedor, 'razao_social' | 'nome_fantasia'> | null): string =>
  (fornecedor?.razao_social || fornecedor?.nome_fantasia || '').trim();

/**
 * Índice id → fornecedor, montado uma vez por render em vez de cada linha procurar na lista
 * inteira. Mesmo desenho de `indiceDeAssociados` no relatório de Contas a Receber.
 */
export const indiceDeEmpresas = (fornecedores: Fornecedor[]): Map<string, Fornecedor> => {
  const indice = new Map<string, Fornecedor>();
  (fornecedores || []).forEach((f) => {
    if (f?.id) indice.set(f.id, f);
  });
  return indice;
};

/**
 * Nome da empresa vinculada a um associado, ou `''` quando ele é PF, não tem vínculo, ou a empresa
 * não está na lista carregada.
 *
 * Resolve por **id**, e não por um nome guardado no próprio associado: numa listagem operacional a
 * empresa renomeada deve aparecer com o nome de hoje. (É o oposto do `categoria` dos lançamentos,
 * que é snapshot de propósito — lá o documento precisa dizer o que valia na época.)
 */
export const nomeDaEmpresaDoAssociado = (
  associado: Pick<Associado, 'tipo_pessoa' | 'fornecedor_id'> | null | undefined,
  indice: Map<string, Fornecedor>
): string => {
  if (!associado || !ehPessoaJuridica(associado.tipo_pessoa)) return '';
  const id = associado.fornecedor_id;
  if (!id) return '';
  return nomeDaEmpresa(indice.get(id));
};

/**
 * Opções do seletor do **cadastro**: as empresas conveniadas ativas, mais a que já está gravada
 * naquele associado mesmo que tenha sido desativada depois.
 *
 * Sem essa exceção, abrir para editar um associado cuja conveniada foi desativada perderia a
 * seleção na tela e reescreveria o vínculo como vazio ao salvar — em silêncio. É a mesma escolha
 * do seletor de conta contábil e do seletor de cadastro já selecionado.
 */
export const opcoesEmpresaConveniada = (
  fornecedores: Fornecedor[],
  idJaSelecionado?: string | null
): Fornecedor[] => {
  const elegiveis = (fornecedores || []).filter(
    (f) => f?.categoria === CATEGORIA_EMPRESA_CONVENIADA && f?.status === 'ativo'
  );
  if (idJaSelecionado && !elegiveis.some((f) => f.id === idJaSelecionado)) {
    const gravada = (fornecedores || []).find((f) => f?.id === idJaSelecionado);
    if (gravada) elegiveis.push(gravada);
  }
  return elegiveis.sort((a, b) => nomeDaEmpresa(a).localeCompare(nomeDaEmpresa(b)));
};

/**
 * Opções do **filtro**: as conveniadas ativas mais qualquer uma que algum associado já aponte,
 * ainda que desativada. Uma empresa desativada com associados vinculados precisa continuar
 * filtrável, senão esses associados viram infiltráveis.
 */
export const opcoesFiltroEmpresa = (
  fornecedores: Fornecedor[],
  associados: Associado[]
): Fornecedor[] => {
  const emUso = new Set(
    (associados || [])
      .filter((a) => ehPessoaJuridica(a?.tipo_pessoa) && a?.fornecedor_id)
      .map((a) => a.fornecedor_id as string)
  );
  return (fornecedores || [])
    .filter(
      (f) =>
        f?.id &&
        ((f.categoria === CATEGORIA_EMPRESA_CONVENIADA && f.status === 'ativo') || emUso.has(f.id))
    )
    .sort((a, b) => nomeDaEmpresa(a).localeCompare(nomeDaEmpresa(b)));
};

/**
 * Predicado do filtro por empresa. Vazio não filtra nada; `FILTRO_SOMENTE_PJ` casa qualquer PJ,
 * inclusive o que ainda não tem empresa escolhida — ele existe e precisa ser encontrável.
 */
export const associadoCasaFiltroEmpresa = (
  associado: Pick<Associado, 'tipo_pessoa' | 'fornecedor_id'> | null | undefined,
  filtro?: string | null
): boolean => {
  if (!filtro) return true;
  if (!associado) return false;
  if (filtro === FILTRO_SOMENTE_PJ) return ehPessoaJuridica(associado.tipo_pessoa);
  return ehPessoaJuridica(associado.tipo_pessoa) && associado.fornecedor_id === filtro;
};
