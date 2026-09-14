/**
 * O que o cabeçalho do formulário de edição mostra sobre o associado, em qualquer aba.
 *
 * O formulário tem oito abas e o cabeçalho só dizia "Editar Associado": três cliques
 * adiante, na aba de Mensalidades ou Requisições, nada na tela lembrava **de quem** era
 * aquele cadastro. Este módulo decide *o quê* aparece; o componente decide só *como*.
 */

/**
 * Idade em anos completos.
 *
 * **Desconta o aniversário que ainda não chegou**, e é por isso que existe em vez de um
 * `getFullYear() - getFullYear()` a mais. Aquela subtração devolve 36 para quem nasceu em
 * 31/12/1990 no dia 01/01/2026, quando a pessoa tem 35.
 *
 * É a única fonte de idade do projeto: `associadoHelpers.ts` (`calcularNVidasEIdades`),
 * `NovoContratoWizard.tsx` e o card de dependente do formulário passaram a chamá-la. Nos
 * dois primeiros a idade entra no cálculo do valor do plano, e por isso a unificação só
 * foi feita depois de medir o efeito em produção — ver a seção do CLAUDE.md.
 *
 * A data é lida do texto `YYYY-MM-DD`, nunca por `new Date(texto)`: em UTC-3 essa
 * conversão devolve o dia anterior (a armadilha que este projeto já documenta em
 * `anoDaData()`), e no aniversário a idade sairia um ano menor.
 */
export function idadeEmAnos(
  dataNascimento?: string | null,
  hoje: Date = new Date(),
): number | null {
  const texto = (dataNascimento || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;

  const [ano, mes, dia] = texto.split('-').map(Number);
  if (!ano || !mes || !dia) return null;

  let idade = hoje.getFullYear() - ano;
  const mesAtual = hoje.getMonth() + 1;
  const diaAtual = hoje.getDate();
  if (mesAtual < mes || (mesAtual === mes && diaAtual < dia)) idade -= 1;

  // Data futura (erro de digitação) não vira idade negativa no cabeçalho.
  return idade < 0 ? null : idade;
}

/** Formata CPF/CNPJ para leitura, devolvendo o original quando não reconhece o formato. */
export function formatarDocumento(valor?: string | null): string {
  const digitos = (valor || '').replace(/\D/g, '');
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return (valor || '').trim();
}

export interface ResumoAssociado {
  nome: string;
  /** `null` quando não há data de nascimento — a linha some em vez de mostrar "— anos". */
  idade: number | null;
  /** Já formatado; `''` quando não há documento. */
  documento: string;
  plano: string;
  status: string;
  inativo: boolean;
}

/**
 * Monta o resumo exibido no cabeçalho.
 *
 * Campo ausente vira string vazia e **o componente omite a linha** — um cabeçalho com
 * "CPF: —" e "Plano: —" ocupa o mesmo espaço sem informar nada, e num cadastro novo
 * (ainda em branco) seria a maior parte do que aparece.
 */
export function montarResumoAssociado(
  associado: {
    nome?: string | null;
    cpf?: string | null;
    data_nascimento?: string | null;
    plano_nome?: string | null;
    status?: string | null;
  } | null | undefined,
  hoje: Date = new Date(),
): ResumoAssociado {
  const status = (associado?.status || '').trim().toLowerCase();
  return {
    nome: (associado?.nome || '').trim(),
    idade: idadeEmAnos(associado?.data_nascimento, hoje),
    documento: formatarDocumento(associado?.cpf),
    plano: (associado?.plano_nome || '').trim(),
    status,
    inativo: status === 'inativo' || status === 'encerrado',
  };
}
