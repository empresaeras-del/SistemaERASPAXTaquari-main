import { StatusContrato } from '../types/contrato';

/**
 * O status do contrato a partir do status do associado.
 *
 * Existe porque `saveAssociado` **copiava** um no outro:
 *
 * ```ts
 * status: associadoToSave.status || 'ativo',   // dentro do payload de `contratos`
 * ```
 *
 * E os dois domínios não são o mesmo. `associados.status` aceita `'inadimplente'`;
 * `contratos_status_check` não. Conferido em produção, em transação revertida: inserir contrato
 * com `status = 'inadimplente'` devolve
 * `23514 new row for relation "contratos" violates check constraint "contratos_status_check"`.
 *
 * Bastava o operador marcar um associado como inadimplente — opção que o formulário oferece — e
 * salvar o cadastro. Em produção ainda não disparou (0 associados inadimplentes hoje), mas estava
 * armado, como o job de inadimplência estava. E até a PR #77 a recusa morria num `console.warn`
 * no `catch` do contrato: o associado era salvo, o contrato ficava com o status velho, e a tela
 * dizia sucesso.
 *
 * **A tradução, e por que ela não é `inadimplente` → `inativo`:** quem deve continua coberto. O
 * contrato de um inadimplente está vigente — o que existe é uma dívida, não o fim da adesão. É a
 * mesma decisão que `associadoSelecionavel` já registra ao manter o inadimplente escolhível num
 * atendimento: barrar ali seria negar serviço por atraso, e ninguém tomou essa decisão.
 */
export const statusDoContratoParaAssociado = (
  statusDoAssociado?: string | null,
): StatusContrato => {
  switch ((statusDoAssociado || '').trim().toLowerCase()) {
    case 'inativo':
      return 'inativo';
    case 'encerrado':
      return 'encerrado';
    // `ativo`, `inadimplente` e qualquer coisa que não se reconheça caem aqui. O padrão é o
    // contrato vigente: um status de associado que este mapa não conhece não deve, sozinho,
    // encerrar a adesão de alguém.
    default:
      return 'ativo';
  }
};
