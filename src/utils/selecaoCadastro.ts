/**
 * Quem pode ser escolhido num registro **novo**.
 *
 * Inativar um associado só significa alguma coisa se ele parar de aparecer nos seletores:
 * enquanto der para escolhê-lo num atendimento, numa guia ou num contrato, a inativação é
 * um rótulo na lista e nada mais. Esta é a segunda metade da regra que
 * `inativarAssociadoEmCascata` começa.
 */

/** Status de associado que tiram o cadastro de circulação. */
const STATUS_FORA_DE_CIRCULACAO = ['inativo', 'encerrado'];

/**
 * `true` quando o cadastro pode entrar num registro novo.
 *
 * **`inadimplente` continua selecionável de propósito.** Quem deve é justamente quem
 * precisa ser atendido e cobrado; barrar aqui seria negar serviço por atraso, que é
 * decisão de negócio que ninguém tomou. Só `inativo` e `encerrado` saem.
 *
 * `idJaSelecionado` é a exceção que mantém a **edição** funcionando: um registro antigo
 * pode apontar para um associado que foi inativado depois, e sumir com ele da lista faria
 * a tela de edição perder a seleção — reescrevendo o registro em silêncio. É a mesma
 * escolha do seletor de conta contábil, que exibe a conta desativada já gravada.
 */
export const associadoSelecionavel = (
  cadastro: { id?: string; status?: string | null } | null | undefined,
  idJaSelecionado?: string | null,
): boolean => {
  if (!cadastro) return false;
  if (idJaSelecionado && cadastro.id === idJaSelecionado) return true;
  return !STATUS_FORA_DE_CIRCULACAO.includes((cadastro.status || '').trim().toLowerCase());
};

/**
 * `true` quando o dependente pode entrar num registro novo.
 *
 * Depende **também do titular**: a cobertura do dependente vem do plano dele, então um
 * dependente ativo de um titular inativo não pode ser atendido. Sem esse segundo teste, a
 * inativação do titular deixaria a família inteira selecionável pela porta dos fundos.
 */
export const dependenteSelecionavel = (
  dependente: { id?: string; status?: string | null } | null | undefined,
  titular: { status?: string | null } | null | undefined,
  idJaSelecionado?: string | null,
): boolean => {
  if (!dependente) return false;
  if (idJaSelecionado && dependente.id === idJaSelecionado) return true;
  if (!associadoSelecionavel(titular ? { status: titular.status } : null)) return false;
  return !STATUS_FORA_DE_CIRCULACAO.includes((dependente.status || '').trim().toLowerCase());
};
