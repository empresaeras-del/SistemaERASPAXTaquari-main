import { Associado, Dependente } from '../services/associadosService';
import { idadeEmAnos } from './resumoAssociado';
import { construirEntradaHistoricoContrato } from './associadoHelpers';
// A projeção de parcelas já existia aqui, usada pelo wizard de mensalidades avulso —
// reexportada para que o assistente de reativação não escreva uma terceira cópia da
// mesma regra de vencimento (`NovoContratoWizard` tinha a segunda, agora removida).
export { gerarProjecaoParcelas } from './mensalidadesAssociadoHelpers';
export type { ParcelaProjetada } from './mensalidadesAssociadoHelpers';

/**
 * Reativar um associado é fazer um contrato novo, não desfazer a inativação.
 *
 * A inativação (`inativarAssociadoEmCascata`) não é reversível por simetria: ela cancelou
 * as parcelas em aberto e pôs o contrato em `inativo`, e nada disso deve voltar. As
 * parcelas canceladas são de um período em que o associado não estava coberto — ressuscitá-las
 * cobraria mensalidade de quem não teve direito a nada — e o contrato antigo é o documento
 * que valeu até a inativação, com o valor e o plano daquela época.
 *
 * Por isso o que este módulo monta é uma **adesão nova aproveitando o cadastro**: os dados
 * pessoais e os dependentes já existem e não se redigitam, mas o plano é escolhido de novo,
 * o contrato ganha número e data próprios, as mensalidades nascem do zero e o contrato
 * anterior fica guardado em `historico_contratos`.
 *
 * Tudo aqui é puro: decide **o quê**, e quem grava é `services/reativacaoService.ts`.
 */

/** Status de associado/dependente que a reativação tira de circulação. */
const STATUS_ATIVO = 'ativo';

export interface DependenteReativavel {
  id: string;
  nome: string;
  parentesco: string;
  dataNascimento?: string;
  /** `null` quando não há data de nascimento — a tela omite em vez de mostrar "0 anos". */
  idade: number | null;
  /**
   * `true` quando o dependente já estava ativo antes desta tela.
   *
   * Não é uma escolha do operador: é informação. Um dependente cadastrado **depois** da
   * inativação (ou que nunca foi inativado junto) chega aqui ativo, e desmarcá-lo seria
   * inativar alguém a pretexto de reativar o titular.
   */
  jaAtivo: boolean;
  /**
   * `true` para quem foi acrescentado nesta tela e ainda não existe no banco.
   *
   * É o que separa o que pode ser **removido** do que só pode ser **desmarcado**: um
   * dependente já cadastrado pode ter atendimento apontando para a linha dele (a lição de
   * `handleInativarDependente`), então some do contrato mas nunca do cadastro. O que acabou
   * de ser digitado não tem nada apontando para ele e sai inteiro se foi engano.
   */
  novo: boolean;
}

/**
 * Os dependentes que a reativação pode trazer de volta, na ordem do cadastro.
 *
 * **Todos entram na lista, ativos e inativos**, porque a etapa também é a conferência de
 * quem fica coberto pelo contrato novo — e é essa lista que determina o número de vidas e,
 * com ele, o valor da mensalidade.
 *
 * `idsJaCadastrados` são os ids que vieram do banco. Quem não estiver nessa lista foi
 * acrescentado na própria tela e é marcado como `novo` — sem ela, não há como distinguir um
 * dependente recém-digitado de um que já existia e estava ativo, e os dois têm regras
 * diferentes de remoção. Omitir o parâmetro trata todos como já cadastrados, que é o estado
 * de quem só está conferindo.
 */
export const dependentesParaReativacao = (
  associado: Pick<Associado, 'dependentes'> | null | undefined,
  hoje: Date = new Date(),
  idsJaCadastrados?: readonly string[],
): DependenteReativavel[] => {
  const conhecidos = idsJaCadastrados ? new Set(idsJaCadastrados) : null;
  return (associado?.dependentes || []).map((d) => ({
    id: d.id,
    nome: (d.nome || '').trim(),
    parentesco: (d.parentesco || '').trim(),
    dataNascimento: d.data_nascimento,
    idade: idadeEmAnos(d.data_nascimento, hoje),
    jaAtivo: (d.status || STATUS_ATIVO).trim().toLowerCase() !== 'inativo',
    novo: conhecidos ? !conhecidos.has(d.id) : false,
  }));
};

/**
 * Quem vem marcado ao abrir a etapa: **todos**.
 *
 * A inativação foi em cascata, então desmarcar um a um seria o trabalho comum. O caso de
 * desmarcar existe e é sério — dependente falecido, que é o motivo típico da inativação —,
 * mas é a exceção, e uma lista vazia por padrão faria o operador reativar o titular sozinho
 * por distração, deixando a família descoberta sem nenhum aviso.
 */
export const dependentesMarcadosPorPadrao = (
  dependentes: DependenteReativavel[],
): string[] => dependentes.map((d) => d.id);

export interface VidasDaReativacao {
  nVidas: number;
  idadesDependentes: number[];
}

/**
 * Vidas e idades que alimentam o cálculo do plano, contando **só quem foi marcado**.
 *
 * É o que liga a etapa de dependentes ao valor da mensalidade: desmarcar alguém tem de
 * baratear o contrato na mesma hora, senão a escolha vira enfeite e o operador paga por uma
 * vida que não vai ser coberta. O `?? 0` para dependente sem data de nascimento é o mesmo
 * fallback de `calcularNVidasEIdades`, de propósito — as duas contas precisam casar a mesma
 * faixa para o mesmo dependente.
 */
export const vidasDaReativacao = (
  dependentes: DependenteReativavel[],
  idsSelecionados: readonly string[],
): VidasDaReativacao => {
  const marcados = new Set(idsSelecionados);
  const selecionados = dependentes.filter((d) => marcados.has(d.id));
  return {
    nVidas: 1 + selecionados.length,
    idadesDependentes: selecionados.map((d) => d.idade ?? 0),
  };
};

/**
 * Aplica a escolha da etapa aos dependentes do cadastro.
 *
 * Quem foi marcado volta a `ativo`; quem não foi **fica `inativo`**, e isso vale inclusive
 * para quem chegou ativo — é a única forma de a lista da tela corresponder ao que será
 * gravado. Nenhum dependente é removido: o falecido continua no cadastro porque o
 * atendimento funerário dele aponta para essa linha (a lição de `handleInativarDependente`,
 * que apagava o dependente e levava junto o registro do velório).
 */
export const aplicarSelecaoDeDependentes = (
  dependentes: Dependente[] | undefined,
  idsSelecionados: readonly string[],
): Dependente[] => {
  const marcados = new Set(idsSelecionados);
  return (dependentes || []).map((d) => ({
    ...d,
    status: marcados.has(d.id) ? ('ativo' as const) : ('inativo' as const),
  }));
};

/**
 * Acrescenta um dependente ao cadastro em edição, sem tocar nos que já estavam.
 *
 * A etapa de dependentes não é só conferência: a família muda enquanto o cadastro está
 * inativo — nasce neto, casa filho —, e mandar o operador concluir a reativação para só
 * então abrir o cadastro e incluir teria duas consequências ruins, nenhuma visível na hora:
 * o contrato nasceria com uma vida a menos do que a família tem, e as mensalidades já
 * geradas cobrariam o valor errado até alguém refazer tudo.
 *
 * Quem chega aqui **substitui** o de mesmo id, o que faz a mesma função servir para a
 * edição de um recém-incluído — sem isso, corrigir um nome digitado errado criaria uma
 * segunda linha para a mesma pessoa.
 */
export const acrescentarDependente = <T extends { dependentes?: Dependente[] }>(
  cadastro: T,
  dependente: Dependente,
): T => {
  const atuais = cadastro.dependentes || [];
  const jaExiste = atuais.some((d) => d.id === dependente.id);
  return {
    ...cadastro,
    dependentes: jaExiste
      ? atuais.map((d) => (d.id === dependente.id ? { ...d, ...dependente } : d))
      : [...atuais, dependente],
  };
};

/**
 * `true` quando o dependente pode ser **removido** da lista, não apenas desmarcado.
 *
 * Só vale para quem foi acrescentado nesta tela. Um dependente que já existe no banco pode
 * ter um atendimento funerário apontando para a linha dele; removê-lo daqui faria
 * `saveAssociado` apagá-lo do Postgres — é exatamente o defeito que
 * `handleInativarDependente` tinha, e que sumia com o falecido do cadastro que o próprio
 * atendimento referencia. Para esse, o caminho é desmarcar: ele fica `inativo` e continua lá.
 */
export const podeRemoverDependente = (
  dependente: Pick<DependenteReativavel, 'novo'> | null | undefined,
): boolean => Boolean(dependente?.novo);

/** Tira da lista um dependente acrescentado por engano nesta tela. */
export const removerDependenteNovo = <T extends { dependentes?: Dependente[] }>(
  cadastro: T,
  id: string,
): T => ({
  ...cadastro,
  dependentes: (cadastro.dependentes || []).filter((d) => d.id !== id),
});

/** Número do contrato novo, no mesmo formato que o wizard de contrato já usa. */
export const gerarNumeroContratoReativacao = (
  sufixo: string = Math.random().toString(36).substring(2, 10),
): string => `CTR-${sufixo.toUpperCase()}`;

export interface DadosDoNovoContrato {
  planoId: string;
  planoNome: string;
  valorPlano: number;
  numeroContrato: string;
  dataAdesao: string;
  idsDependentesReativados: readonly string[];
  /** Id da entrada de histórico do contrato anterior (injetável para o teste). */
  idHistorico: string;
}

/**
 * O associado como ele fica depois da reativação.
 *
 * O contrato anterior **é empurrado para `historico_contratos` sempre**, não só quando o
 * plano muda — ao contrário do `NovoContratoWizard`, que só arquiva quando
 * `plano_pax_id !== planoId`. Aqui a adesão anterior terminou de fato, na inativação, e
 * readerir ao mesmo plano continua sendo um contrato novo: sem a entrada, o período em que
 * o associado esteve fora sumiria do cadastro e a data de adesão passaria a mentir sobre
 * desde quando ele é coberto.
 *
 * O contrato anterior **termina no dia em que o novo começa** — `dados.dataAdesao`, não a
 * data de hoje. São a mesma coisa no caso comum, e por isso a diferença passa despercebida:
 * só divergem quando o operador retroage a adesão, e aí duas datas diferentes deixariam um
 * intervalo (ou uma sobreposição) entre o contrato arquivado e o vigente. É também a mesma
 * data que `arquivarContratosVigentes` grava em `contratos.data_fim`, e as duas precisam
 * contar a mesma história.
 */
export const montarAssociadoReativado = (
  associado: Associado,
  dados: DadosDoNovoContrato,
): Associado => {
  const dataFim = dados.dataAdesao;
  const historico = Array.isArray(associado.historico_contratos)
    ? [...associado.historico_contratos]
    : [];

  if (associado.plano_nome || associado.valor_plano || associado.data_adesao) {
    historico.push(
      construirEntradaHistoricoContrato(
        {
          plano_nome: associado.plano_nome,
          valor_plano: associado.valor_plano,
          data_adesao: associado.data_adesao,
        },
        dados.idHistorico,
        dataFim,
      ),
    );
  }

  const dependentes = aplicarSelecaoDeDependentes(
    associado.dependentes,
    dados.idsDependentesReativados,
  );

  return {
    ...associado,
    status: 'ativo',
    dependentes,
    // `n_vidas` é lido pelo wizard de mensalidades avulso (`MensalidadesGeracaoWizard`), que
    // não recalcula nada — deixá-lo com a contagem antiga faria a próxima geração de
    // parcelas cobrar por dependentes que esta reativação acabou de deixar de fora.
    n_vidas: 1 + dependentes.filter((d) => d.status !== 'inativo').length,
    plano_pax_id: dados.planoId,
    plano_nome: dados.planoNome,
    valor_plano: dados.valorPlano,
    numero_contrato: dados.numeroContrato,
    data_adesao: dados.dataAdesao,
    historico_contratos: historico,
  };
};

/** Recusa exibida quando alguém tenta reativar um cadastro que já está em circulação. */
export const MENSAGEM_REATIVACAO_DESNECESSARIA =
  'Este associado já está ativo. A reativação vale apenas para cadastros inativos ou encerrados.';
