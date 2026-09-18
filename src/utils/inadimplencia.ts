import type { Associado } from '../services/associadosService';
import {
  IndiceDeAssociados,
  ParcelaParaMapa,
  ReceitaParaMapa,
  indiceDeAssociados,
  resolverAssociadoDaParcela,
} from './mapaCalorReceber';
import { parcelaEmAberto } from './statusParcela';

/**
 * Quem acumulou parcelas vencidas a ponto de merecer uma decisão do operador.
 *
 * Este módulo **decide quem**, e nada mais: não grava status, não cria notificação, não
 * cobra ninguém. É a mesma divisão da cobrança automática de atendimento e requisição
 * (`utils/cobrancaAutomatica.ts`): montar a proposta não pode escrever nada, senão a
 * recusa fica mais cara que a confirmação.
 *
 * Por que a divisão importa aqui: até 18/09/2026 esta regra vivia dentro de
 * `useBackgroundChecks`, que rodava no carregamento da aplicação **para todo operador** e
 * gravava `status: 'inadimplente'` direto no cadastro do associado — sem confirmação, sem
 * notificação e sem caminho de volta. Ninguém decidia; o sistema decidia, e quem descobria
 * era o operador ao abrir o cadastro. Marcar um cliente como inadimplente é decisão de
 * cobrança, não reparo de dado — a mesma lição que o backfill da Ata de Ocorrências já
 * registra sobre preencher um campo que decide o que o registro significa.
 */

/**
 * Parcelas vencidas a partir das quais o associado entra no aviso.
 *
 * Três é o valor que a rotina antiga usava (`overdueMap[cpf] > 2`), preservado para o aviso
 * não mudar de sensibilidade junto com o resto. **É constante do código, não configuração
 * da empresa** — duas empresas com políticas de cobrança diferentes recebem a mesma régua,
 * e isso é limitação conhecida: tornar o limiar configurável precisa de coluna nova e de
 * tela, e ficou para uma passada própria. Enquanto for constante, ela é parâmetro da função
 * (não literal no corpo), que é o que torna essa passada barata depois.
 */
export const LIMITE_PARCELAS_VENCIDAS = 3;

/** Assunto fixo do aviso. A contagem vive na mensagem — ver `montarAvisoInadimplencia`. */
export const TITULO_AVISO_INADIMPLENCIA = 'Associados com parcelas vencidas';

/** Um associado que cruzou o limite, com o que sustenta a afirmação. */
export interface CandidatoInadimplencia {
  associado: Associado;
  /** Quantas parcelas em aberto já venceram. */
  parcelasVencidas: number;
  /** Quanto essas parcelas somam. */
  valorVencido: number;
  /** A mais antiga delas, em `YYYY-MM-DD` — é ela que diz há quanto tempo isso dura. */
  vencimentoMaisAntigo: string;
}

export interface OpcoesInadimplencia {
  associados: readonly Associado[];
  parcelas: readonly ParcelaParaMapa[];
  /** As receitas, para achar o dono da parcela por `associado_id`. Ver a nota abaixo. */
  receitas?: readonly ReceitaParaMapa[];
  /** Hoje em `YYYY-MM-DD`. Injetável para o teste não depender de quando a suíte roda. */
  hoje: string;
  limite?: number;
}

/**
 * Considera vencida a parcela cuja data é **anterior** a hoje.
 *
 * Compara o texto, nunca `new Date()`. Para `YYYY-MM-DD` a ordem lexicográfica é a
 * cronológica, e comparar texto evita de saída a armadilha que o CLAUDE.md já documenta em
 * `anoDaData()`: `new Date('2026-01-01')` é meia-noite **UTC**, que em UTC-3 é 31/12/2025.
 * A rotina antiga contornava isso concatenando `'T12:00:00'` na data — o meio-dia era a
 * margem que a fazia funcionar. Comparar texto dispensa a margem.
 *
 * A parcela que vence **hoje** não está vencida: o associado ainda tem o dia para pagar.
 */
const jaVenceu = (dataVencimento: string | undefined, hoje: string): boolean => {
  const data = (dataVencimento || '').trim().slice(0, 10);
  if (data.length !== 10) return false; // data quebrada não acusa ninguém
  return data < hoje;
};

/**
 * Os associados ativos com `limite` ou mais parcelas vencidas em aberto.
 *
 * Três decisões valem como regra:
 *
 * - **O dono da parcela sai de `resolverAssociadoDaParcela`**, que tenta `associado_id` da
 *   receita, depois CPF, depois nome — nessa ordem de confiança. A rotina antiga casava
 *   **só por CPF**, montando um mapa `cpf → contagem`. Funcionava por sorte: conferi em
 *   produção que `associados.cpf` e `parcelas_receber.devedor_cpf_cnpj` estão gravados no
 *   mesmo formato (`017.989.211-89`), então batiam. Bastava um operador digitar sem
 *   pontuação num dos dois lados para a contagem zerar em silêncio — e o associado deixar
 *   de ser visto, que é o erro mais quieto dos dois.
 * - **"Em aberto" tem três nomes**, e `parcelaEmAberto` cobre os três. A rotina antiga
 *   olhava `'pendente'` e `'vencido'` e **deixava `'atrasado'` de fora** — justamente o
 *   status que significa atraso. É a terceira vez que este projeto registra esse mesmo
 *   descuido; por isso a checagem mora em `utils/statusParcela.ts` e não aqui.
 * - **Só associado `ativo` entra.** Quem já está `inadimplente` não precisa ser apontado de
 *   novo, e quem está `inativo` ou `encerrado` não é candidato a cobrança. É o mesmo
 *   recorte da rotina antiga.
 */
export const associadosComParcelasVencidas = ({
  associados,
  parcelas,
  receitas,
  hoje,
  limite = LIMITE_PARCELAS_VENCIDAS,
}: OpcoesInadimplencia): CandidatoInadimplencia[] => {
  const indice: IndiceDeAssociados = indiceDeAssociados(associados);

  const receitasPorId = new Map<string, ReceitaParaMapa>();
  for (const receita of receitas || []) {
    if (receita?.id) receitasPorId.set(receita.id, receita);
  }

  const acumulado = new Map<
    string,
    { associado: Associado; parcelasVencidas: number; valorVencido: number; vencimentoMaisAntigo: string }
  >();

  for (const parcela of parcelas || []) {
    if (!parcela) continue;
    if (!parcelaEmAberto(parcela.status)) continue;
    if (!jaVenceu(parcela.data_vencimento, hoje)) continue;

    const associado = resolverAssociadoDaParcela(parcela, indice, receitasPorId);
    if (!associado?.id) continue;
    if (associado.status !== 'ativo') continue;

    const vencimento = (parcela.data_vencimento || '').trim().slice(0, 10);
    const atual = acumulado.get(associado.id);
    if (atual) {
      atual.parcelasVencidas += 1;
      atual.valorVencido += Number(parcela.valor) || 0;
      if (vencimento < atual.vencimentoMaisAntigo) atual.vencimentoMaisAntigo = vencimento;
    } else {
      acumulado.set(associado.id, {
        associado,
        parcelasVencidas: 1,
        valorVencido: Number(parcela.valor) || 0,
        vencimentoMaisAntigo: vencimento,
      });
    }
  }

  return Array.from(acumulado.values())
    .filter((c) => c.parcelasVencidas >= limite)
    // Mais parcelas primeiro; empate decidido pelo valor, que é o que separa doze parcelas
    // de R$ 10 de três de R$ 400.
    .sort((a, b) => b.parcelasVencidas - a.parcelasVencidas || b.valorVencido - a.valorVencido);
};

const formatarBRL = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

/** Quantos nomes cabem na mensagem antes de ela virar uma lista que ninguém lê. */
const NOMES_NA_MENSAGEM = 3;

/**
 * O aviso a dar ao administrador, ou `null` quando não há o que avisar.
 *
 * **O título é constante e a contagem vive na mensagem** — a mesma escolha do aviso de
 * cadastros pela metade, e pelo mesmo motivo: com o número no título, cada mudança na
 * lista produziria um assunto novo e `avisoJaEnviado` perderia o rastro do aviso anterior,
 * voltando a avisar do zero a cada carregamento. Foi assim que um usuário acumulou 24
 * notificações de boas-vindas, 22 já apagadas.
 *
 * A mensagem cita no máximo `NOMES_NA_MENSAGEM` nomes e resume o resto. Ela precisa caber
 * num toque no ombro: a lista inteira está na tela de Associados, que é a superfície
 * durável.
 */
export const montarAvisoInadimplencia = (
  candidatos: readonly CandidatoInadimplencia[],
): { titulo: string; mensagem: string } | null => {
  if (!candidatos || candidatos.length === 0) return null;

  const total = candidatos.length;
  const valorTotal = candidatos.reduce((soma, c) => soma + c.valorVencido, 0);
  const citados = candidatos.slice(0, NOMES_NA_MENSAGEM).map((c) => c.associado.nome).join(', ');
  const restantes = total - Math.min(total, NOMES_NA_MENSAGEM);

  const quem =
    restantes > 0
      ? `${citados} e mais ${restantes} ${restantes === 1 ? 'associado' : 'associados'}`
      : citados;

  const abertura =
    total === 1
      ? '1 associado ativo acumulou'
      : `${total} associados ativos acumularam`;

  return {
    titulo: TITULO_AVISO_INADIMPLENCIA,
    mensagem:
      `${abertura} ${LIMITE_PARCELAS_VENCIDAS} ou mais parcelas vencidas, ` +
      `somando ${formatarBRL(valorTotal)}: ${quem}. ` +
      'Confira em Associados e decida se o cadastro passa a inadimplente.',
  };
};
