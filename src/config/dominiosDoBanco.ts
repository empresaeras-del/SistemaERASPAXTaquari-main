/**
 * Retrato dos domínios de texto que o Postgres impõe por `CHECK`.
 *
 * Existe porque este projeto já teve **quatro** defeitos da mesma classe, todos com a mesma
 * forma — a tela oferece um valor que o banco recusa, e ninguém sabe até alguém tentar:
 *
 * | Descoberto | O defeito |
 * | --- | --- |
 * | 11/09/2026 | `requisicoes.status` não conhecia `'emitida'`, o status com que o app cria toda guia |
 * | 18/09/2026 | `fornecedores.status` não conhecia `'bloqueado'`, que o formulário oferece desde sempre |
 * | 18/09/2026 | `fornecedores.tipo_fornecedor` não tinha `CHECK` nenhum — o domínio existia só no TypeScript |
 * | 19/09/2026 | `contratos.status` recusa `'inadimplente'`, que `saveAssociado` copia do associado |
 *
 * Os três primeiros foram achados um a um, por acaso. `dominiosDoBanco.test.ts` compara este
 * retrato com as unions do TypeScript e falha quando as duas metades discordam — é o guarda que
 * faz a regra valer para o código que ainda não foi escrito.
 *
 * **Como regerar.** Este arquivo é escrito à mão a partir do banco, e por isso pode envelhecer.
 * Rode o SQL abaixo contra a produção e cole o resultado em `DOMINIOS_DO_BANCO`; a saída já vem
 * no formato exato das linhas:
 *
 * ```sql
 * select string_agg(linha, E'\n' order by chave)
 * from (
 *   select
 *     c.conrelid::regclass::text || '.' ||
 *       (regexp_match(pg_get_constraintdef(c.oid), '\(\(?(\w+) = ANY'))[1] as chave,
 *     '  ''' || c.conrelid::regclass::text || '.' ||
 *       (regexp_match(pg_get_constraintdef(c.oid), '\(\(?(\w+) = ANY'))[1] || ''': [' ||
 *       (select string_agg('''' || v || '''', ', ' order by ord)
 *          from regexp_split_to_table(
 *            (regexp_match(pg_get_constraintdef(c.oid), 'ARRAY\[(.*)\]'))[1], ',\s*'
 *          ) with ordinality as t(raw, ord),
 *          lateral (select btrim(split_part(raw, '::', 1), '''')) as x(v))
 *     || '],' as linha
 *   from pg_constraint c
 *   join pg_namespace n on n.oid = c.connamespace
 *   where n.nspname = 'public' and c.contype = 'c'
 *     and pg_get_constraintdef(c.oid) like '%= ANY (ARRAY[%'
 * ) s;
 * ```
 *
 * **Ao criar ou alterar um `CHECK` de domínio, atualize este arquivo na mesma tarefa** — é a
 * mesma regra do campo novo sem migration, na direção contrária.
 *
 * Gerado de `qigytjkgehwxalhmwpdd` em 19/09/2026.
 */
export const DOMINIOS_DO_BANCO: Readonly<Record<string, readonly string[]>> = {
  'associados.status': ['ativo', 'inativo', 'inadimplente', 'encerrado'],
  'associados.tipo_pessoa': ['PF', 'PJ'],
  'atendimentos.tipo_cliente': ['associado', 'externo'],
  'contas_bancarias.status': ['ativo', 'inativo'],
  'contas_bancarias.tipo': ['corrente', 'poupanca', 'pagamento'],
  'contas_contabeis.natureza': ['receita', 'despesa'],
  'contas_contabeis.tipo': ['sintetica', 'analitica'],
  'contratos.status': ['ativo', 'inativo', 'encerrado', 'cancelado'],
  'credenciados.status': ['ativo', 'bloqueado', 'descredenciado'],
  'despesas.status': ['ativo', 'rascunho', 'cancelado', 'quitado'],
  'despesas.tipo_credor': ['fornecedor', 'fornecedor_pf', 'fornecedor_pj', 'funcionario', 'outro'],
  'fornecedores.status': ['ativo', 'inativo', 'bloqueado'],
  'fornecedores.tipo_fornecedor': ['produtos', 'servicos', 'ambos'],
  'fornecedores.tipo_pessoa': ['PF', 'PJ'],
  'lotes_caixa.status': ['aberto', 'fechado', 'auditado'],
  'movimentacoes_caixa.origem': ['contas_receber', 'contas_pagar', 'suprimento', 'sangria', 'avulso'],
  'movimentacoes_caixa.tipo': ['entrada', 'saida'],
  'parcelas_pagar.status': ['pendente', 'pago', 'atrasado', 'cancelado', 'negociado', 'recebido'],
  'parcelas_receber.status': ['pendente', 'pago', 'atrasado', 'cancelado', 'negociado', 'vencido', 'recebido'],
  'planos_pax_coberturas.tipo_cobertura': ['coberto', 'excluido'],
  'planos_pax.regra_calculo': ['fixo', 'por_vida', 'faixa_etaria'],
  'planos_pax.tipo_plano': ['individual', 'coletivo'],
  'receitas.status': ['ativo', 'rascunho', 'cancelado', 'quitado'],
  'receitas.tipo_devedor': ['associado', 'cliente_pf', 'cliente_pj'],
  'remessas_faturamento.status': ['em_aberto', 'processando', 'fechada', 'paga', 'cancelada'],
  'remessas_faturamento.tipo_prestador': ['credenciado', 'rede_externa'],
  'requisicoes.status': ['emitida', 'autorizada', 'realizada', 'cancelada', 'pendente', 'negada'],
  'tenants.status': ['ativo', 'inativo'],
  'users.nivel': ['super_admin', 'admin', 'gerente', 'funcionario'],
  'users.status': ['ativo', 'inativo'],
};

/** Uma union do TypeScript que é gravada numa coluna com `CHECK`. */
export interface UniaoPersistida {
  /** Caminho do arquivo, a partir de `src/`. */
  arquivo: string;
  /** A chave em `DOMINIOS_DO_BANCO`. */
  dominio: string;
  /**
   * Valores que o banco aceita e o TypeScript **não** declara, com o motivo.
   *
   * Sem o motivo escrito, a exceção vira um jeito de calar o teste — que é exatamente o que ele
   * existe para impedir.
   */
  soNoBanco?: Readonly<Record<string, string>>;
}

/**
 * O mapa entre as duas metades.
 *
 * Só entram as unions que de fato viajam para uma coluna com `CHECK`. As demais
 * (`OrientacaoPapel`, `TamanhoPapel`, `FaixaDeCalor`, `ForcaSenha`, `DashboardPeriod`,
 * `TipoAcaoAuditoria`...) são de tela ou de relatório e não têm domínio no banco para comparar.
 *
 * `TipoDocumento` fica de fora por um motivo diferente e que vale registrar: ela é persistida em
 * `documentos_padroes.tipo`, mas **essa coluna não tem `CHECK`**. É a mesma situação que
 * `fornecedores.tipo_fornecedor` tinha antes de 18/09 — domínio que existe só no TypeScript. Não
 * entrou nesta rodada porque criar o `CHECK` exige conferir o que as 7 linhas em produção têm
 * gravado, e isso é tarefa própria.
 */
export const UNIOES_PERSISTIDAS: Readonly<Record<string, UniaoPersistida>> = {
  NivelAcesso: { arquivo: 'types.ts', dominio: 'users.nivel' },
  CredenciadoStatus: { arquivo: 'types/credenciados.ts', dominio: 'credenciados.status' },
  NaturezaContabil: { arquivo: 'types/planoContabil.ts', dominio: 'contas_contabeis.natureza' },
  TipoConta: { arquivo: 'types/planoContabil.ts', dominio: 'contas_contabeis.tipo' },
  RegraCalculo: { arquivo: 'types/planosPax.ts', dominio: 'planos_pax.regra_calculo' },
  TipoPlano: { arquivo: 'types/planosPax.ts', dominio: 'planos_pax.tipo_plano' },
  StatusContrato: { arquivo: 'types/contrato.ts', dominio: 'contratos.status' },
  StatusFornecedor: { arquivo: 'types/fornecedores.ts', dominio: 'fornecedores.status' },
  TipoFornecedor: { arquivo: 'types/fornecedores.ts', dominio: 'fornecedores.tipo_fornecedor' },
  TipoPessoa: { arquivo: 'types/fornecedores.ts', dominio: 'fornecedores.tipo_pessoa' },
  StatusLoteCaixa: { arquivo: 'types/caixas.ts', dominio: 'lotes_caixa.status' },
  TipoMovimentacaoCaixa: { arquivo: 'types/caixas.ts', dominio: 'movimentacoes_caixa.tipo' },
  OrigemMovimentacaoCaixa: { arquivo: 'types/caixas.ts', dominio: 'movimentacoes_caixa.origem' },
  StatusRemessa: { arquivo: 'types/faturamento.ts', dominio: 'remessas_faturamento.status' },
  TipoPrestadorFaturamento: {
    arquivo: 'types/faturamento.ts',
    dominio: 'remessas_faturamento.tipo_prestador',
  },
  StatusRequisicao: {
    arquivo: 'types/requisicoes.ts',
    dominio: 'requisicoes.status',
    soNoBanco: {
      pendente:
        'Legado. Até 11/09/2026 `criarRequisicao` reinseria a guia com este status quando o ' +
        'primeiro insert falhava — o remendo saiu, mas as linhas antigas ficaram. Tirar do ' +
        'CHECK quebraria o UPDATE delas.',
      negada:
        'Legado, pelo mesmo motivo de `pendente`. Backfill é decisão de produto sobre dado ' +
        'existente, não limpeza de código.',
    },
  },
};
