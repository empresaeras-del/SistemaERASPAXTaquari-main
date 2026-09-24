import type { Banco } from './postgrest';

/**
 * Os mesmos ids fixos de `supabase/seed-homologacao.sql`, e de propósito: os specs apontam para
 * um registro conhecido, e apontam para O MESMO registro nos dois alvos (dublê e homologação).
 * Se este arquivo divergir do seed, o mesmo spec passa num alvo e falha no outro — então ele é
 * cópia deliberada, com o `.sql` como fonte.
 */
export const EMPRESA_PAX = '11111111-1111-4111-8111-111111111111';
export const EMPRESA_FUNERARIA = '22222222-2222-4222-8222-222222222222';

export const USUARIOS = {
  admin: { email: 'admin.pax@homologacao.local', senha: 'homologacao123' },
  superAdmin: { email: 'super@homologacao.local', senha: 'homologacao123' },
  gerente: { email: 'gerente.pax@homologacao.local', senha: 'homologacao123' },
  funcionario: { email: 'func.pax@homologacao.local', senha: 'homologacao123' },
} as const;

export const PLANO_INDIVIDUAL = 'bbbbbbbb-0000-4000-8000-000000000001';
export const PLANO_FAMILIAR = 'bbbbbbbb-0000-4000-8000-000000000002';
export const CONTA_BANCARIA = 'cccccccc-0000-4000-8000-000000000001';
export const CREDENCIADO = 'eeeeeeee-0000-4000-8000-000000000001';
export const PROCEDIMENTO = 'ffffffff-0000-4000-8000-000000000001';
export const ASSOCIADO_MARIA = 'a5500000-0000-4000-8000-000000000001';
export const ASSOCIADO_JOAO = 'a5500000-0000-4000-8000-000000000002';
export const RECEITA_MARIA = '4ece1700-0000-4000-8000-000000000001';
export const RECEITA_JOAO = '4ece1700-0000-4000-8000-000000000002';

export const FORNECEDOR_CONVENIO = 'dddddddd-0000-4000-8000-000000000001';
export const FORNECEDOR_URNAS = 'dddddddd-0000-4000-8000-000000000002';
export const DESPESA_URNAS = 'de50e5a0-0000-4000-8000-000000000001';
export const DESPESA_CONVENIO = 'de50e5a0-0000-4000-8000-000000000002';

const hoje = new Date();

/**
 * `base + n meses`, com o mesmo grampo de fim de mês que o Postgres aplica ao
 * `interval '1 month'` do seed: 31/01 + 1 mês é 28/02, não 03/03.
 *
 * O `setMonth` cru do JavaScript transborda, e é ele que estava aqui. Nos dias 1..28 as duas
 * formas dão o mesmo resultado — então isto não muda nenhuma data semeada hoje —, mas a
 * fonte declarada deste arquivo é o `.sql`, e é o Postgres que decide o que "mais um mês"
 * significa.
 */
const somarMeses = (base: Date, n: number) => {
  const d = new Date(base);
  const diaPedido = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const ultimoDiaDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(diaPedido, ultimoDiaDoMes));
  return d;
};

const somarDias = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

const comoData = (d: Date) => d.toISOString().slice(0, 10);
const emMeses = (n: number) => comoData(somarMeses(hoje, n));

/** As 12 parcelas do João: as três primeiras liquidadas, as demais em aberto. */
const parcelasDoJoao = () =>
  Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const liquidada = n <= 3;
    return {
      id: `9a4ce1a0-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
      tenant_id: EMPRESA_PAX,
      receita_id: RECEITA_JOAO,
      numero_parcela: n,
      total_parcelas: 12,
      valor: 60,
      data_vencimento: emMeses(n - 3),
      status: liquidada ? 'recebido' : 'pendente',
      tipo_devedor: 'associado',
      devedor_nome: 'JOAO BATISTA SOUZA',
      devedor_cpf_cnpj: '000.000.000-02',
      descricao: `Mensalidade Plano Individual ${n}/12`,
      forma_pagamento: 'pix',
      data_pagamento: liquidada ? emMeses(n - 3) : null,
      valor_recebido: liquidada ? 60 : null,
      forma_pagamento_efetivo: liquidada ? 'pix' : null,
    };
  });

/**
 * As 12 parcelas da Maria, derivadas como o `.sql` deriva as dela: cobrança iniciada há 180
 * dias, uma parcela por mês, liquidada quando venceu antes de `hoje - 30`.
 *
 * **Este bloco faltava no dublê.** A receita `4ece1700-…0001` está no
 * `supabase/seed-homologacao.sql` desde que ele existe, e nunca foi copiada para cá — os dois
 * alvos discordavam sobre o que a tela de Contas a Receber lista, e nenhum spec acusou porque
 * nenhum olhava para as parcelas da Maria. O cabeçalho deste arquivo diz que ele é cópia
 * deliberada do `.sql`; era cópia incompleta.
 *
 * O que ela acrescenta, e o João não tem: um **segundo devedor** (sem o qual buscar por nome e
 * ordenar por devedor não distinguem "filtrou" de "não filtrou") e uma parcela **vencida e em
 * aberto** — as do João vencem todas no futuro, então o filtro "Vencido" e o indicador do mesmo
 * nome não tinham uma única linha para achar.
 */
const parcelasDaMaria = () => {
  const inicioCobranca = somarDias(hoje, -180);
  const corteDeLiquidacao = somarDias(hoje, -30);

  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const vencimento = somarMeses(inicioCobranca, n - 1);
    const liquidada = vencimento < corteDeLiquidacao;
    return {
      id: `9a4ce1a1-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
      tenant_id: EMPRESA_PAX,
      receita_id: RECEITA_MARIA,
      numero_parcela: n,
      total_parcelas: 12,
      valor: 100,
      data_vencimento: comoData(vencimento),
      status: liquidada ? 'recebido' : 'pendente',
      tipo_devedor: 'associado',
      devedor_nome: 'MARIA APARECIDA DA SILVA',
      devedor_cpf_cnpj: '000.000.000-01',
      descricao: `Mensalidade Plano Familiar ${n}/12`,
      // A parcela herda a forma padrão da receita, como o app faz ao gerá-las. É por ela
      // que o filtro "Forma de Recebimento" tem dois lados: a Maria é boleto, o João é pix.
      forma_pagamento: 'boleto',
      data_pagamento: liquidada ? comoData(vencimento) : null,
      valor_recebido: liquidada ? 100 : null,
      forma_pagamento_efetivo: liquidada ? 'pix' : null,
    };
  });
};

/**
 * As contas a pagar: duas despesas, uma por fornecedor, derivadas como as receitas.
 *
 * **Também faltava no dublê**, e por dois motivos diferentes: os dois `fornecedores` existem no
 * `.sql` desde sempre e nunca foram copiados para cá (a mesma cópia incompleta da receita da
 * Maria); e `despesas`/`parcelas_pagar` não existiam em alvo nenhum — a tela de Contas a Pagar
 * nunca teve uma linha para mostrar em teste.
 *
 * O desenho espelha o do lado das receitas, pelo mesmo motivo: **dois credores** (sem o segundo,
 * buscar por nome e ordenar por credor não distinguem "filtrou" de "não filtrou"), **formas de
 * pagamento diferentes** (boleto e pix, para o filtro ter dois lados) e **uma parcela vencida em
 * aberto**, que é a única linha que o filtro "Vencidas" e o indicador do mesmo nome podem achar.
 */
const parcelasDeUmaDespesa = (
  despesaId: string,
  prefixoId: string,
  credor: { nome: string; documento: string },
  opcoes: {
    qtd: number;
    valor: number;
    descricao: string;
    formaPagamento: string;
    diasAteAPrimeira: number;
  },
) => {
  const primeiroVencimento = somarDias(hoje, opcoes.diasAteAPrimeira);
  const corteDeLiquidacao = somarDias(hoje, -30);

  return Array.from({ length: opcoes.qtd }, (_, i) => {
    const n = i + 1;
    const vencimento = somarMeses(primeiroVencimento, n - 1);
    const liquidada = vencimento < corteDeLiquidacao;
    return {
      id: `${prefixoId}${String(n).padStart(2, '0')}`,
      tenant_id: EMPRESA_PAX,
      despesa_id: despesaId,
      numero_parcela: n,
      total_parcelas: opcoes.qtd,
      valor: opcoes.valor,
      data_vencimento: comoData(vencimento),
      status: liquidada ? 'pago' : 'pendente',
      tipo_credor: 'fornecedor',
      credor_nome: credor.nome,
      credor_cpf_cnpj: credor.documento,
      descricao: `${opcoes.descricao} ${n}/${opcoes.qtd}`,
      forma_pagamento: opcoes.formaPagamento,
      data_pagamento: liquidada ? comoData(vencimento) : null,
      valor_pago: liquidada ? opcoes.valor : null,
      forma_pagamento_efetivo: liquidada ? opcoes.formaPagamento : null,
    };
  });
};

/**
 * 6 parcelas do fornecedor de urnas, a primeira vencida há 90 dias: 2 pagas, 1 **vencida em
 * aberto** (a parcela 3, que cai a ~30 dias atrás) e 3 a vencer.
 */
const parcelasDasUrnas = () =>
  parcelasDeUmaDespesa(DESPESA_URNAS, '9a4ce5a0-0000-4000-8000-0000000000', {
    nome: 'URNAS EXEMPLO LTDA',
    documento: '44.444.444/0001-44',
  }, {
    qtd: 6,
    valor: 500,
    descricao: 'Compra de urnas',
    formaPagamento: 'boleto',
    diasAteAPrimeira: -90,
  });

/** 4 parcelas do convênio, todas futuras — nenhuma paga, nenhuma vencida. */
const parcelasDoConvenio = () =>
  parcelasDeUmaDespesa(DESPESA_CONVENIO, '9a4ce5a1-0000-4000-8000-0000000000', {
    nome: 'CONVENIO EXEMPLO LTDA',
    documento: '33.333.333/0001-33',
  }, {
    qtd: 4,
    valor: 250,
    descricao: 'Repasse de convenio',
    formaPagamento: 'pix',
    diasAteAPrimeira: 15,
  });

/** Ids fixos da Ata de Ocorrências, espelhando o bloco final de `seed-homologacao.sql`. */
export const LOG_CRIAR_ASSOCIADO = 'ad100000-0000-4000-8000-000000000001';
export const LOG_EDITAR_ASSOCIADO = 'ad100000-0000-4000-8000-000000000002';
export const LOG_EXCLUIR_FORNECEDOR = 'ad100000-0000-4000-8000-000000000003';
export const LOG_DE_OUTRA_EMPRESA = 'ad100000-0000-4000-8000-000000000004';
export const LOG_SEM_EMPRESA = 'ad100000-0000-4000-8000-000000000005';
export const MODELO_CONTRATO = 'd0c00000-0000-4000-8000-000000000001';

const horasAtras = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

/**
 * As cinco linhas cobrem o que a tela precisa distinguir: dois autores na mesma empresa (a
 * contagem de operadores), um diff com `dados_anteriores`/`dados_novos`, uma linha de **outra**
 * empresa (que o admin da PAX não pode ver) e uma com `tenant_id = 'system'`, que só o
 * super_admin alcança.
 */
const logsDeAuditoria = () => [
  {
    id: LOG_CRIAR_ASSOCIADO, tenant_id: EMPRESA_PAX,
    usuario_id: 'aaaaaaaa-0000-4000-8000-000000000002', acao: 'Criar Associado',
    detalhes: { id: ASSOCIADO_JOAO, usuario: 'ADMIN PAX', dados_novos: { nome: 'JOAO BATISTA SOUZA', cpf: '000.000.000-02', status: 'ativo' } },
    created_at: horasAtras(2),
  },
  {
    id: LOG_EDITAR_ASSOCIADO, tenant_id: EMPRESA_PAX,
    usuario_id: 'aaaaaaaa-0000-4000-8000-000000000003', acao: 'Editar Associado',
    detalhes: { id: ASSOCIADO_MARIA, usuario: 'GERENTE PAX', dados_anteriores: { telefone: '(67) 99999-0000', status: 'ativo' }, dados_novos: { telefone: '(67) 99999-0001', status: 'ativo' } },
    created_at: horasAtras(24),
  },
  {
    id: LOG_EXCLUIR_FORNECEDOR, tenant_id: EMPRESA_PAX,
    usuario_id: 'aaaaaaaa-0000-4000-8000-000000000002', acao: 'Excluir Fornecedor e Despesas Vinculadas',
    detalhes: { id: 'f0000000-0000-4000-8000-000000000009', usuario: 'ADMIN PAX' },
    created_at: horasAtras(24 * 3),
  },
  {
    id: LOG_DE_OUTRA_EMPRESA, tenant_id: EMPRESA_FUNERARIA,
    usuario_id: 'aaaaaaaa-0000-4000-8000-000000000005', acao: 'Criar Plano PAX',
    detalhes: { id: 'bbbbbbbb-0000-4000-8000-000000000009', usuario: 'ADMIN FUNERARIA', dados_novos: { nome: 'Plano da Outra Empresa' } },
    created_at: horasAtras(24 * 5),
  },
  {
    id: LOG_SEM_EMPRESA, tenant_id: 'system',
    usuario_id: 'aaaaaaaa-0000-4000-8000-000000000001', acao: 'Reabertura Lote Caixa',
    detalhes: { codigo: 'LOTE-HML-0001', usuario: 'SUPER ADMIN HOMOLOGACAO', justificativa: 'Conferencia de homologacao' },
    created_at: horasAtras(24 * 10),
  },
];

/**
 * Um modelo de documento com variáveis de DOIS módulos — empresa e associado.
 *
 * Um modelo sem `{{...}}` não exercita nada do visualizador: ele existe para resolver
 * variável. E um com variáveis de um módulo só não distingue "resolveu" de "resolveu o
 * módulo que eu testei", que é a diferença entre o catálogo e o resolver ficarem em
 * sincronia ou não — a divergência que o CLAUDE.md registra como muda.
 */
const modelosDeDocumento = () => [
  {
    id: MODELO_CONTRATO,
    tenant_id: EMPRESA_PAX,
    empresa_id: EMPRESA_PAX,
    nome: 'Contrato de Adesao PAX',
    descricao: 'Modelo de homologacao',
    tipo: 'contrato_adesao',
    conteudo:
      '<p>A empresa {{empresa_nome}}, inscrita no CNPJ {{empresa_cnpj}}, celebra contrato com '
      + '{{associado_nome}}, portador do CPF {{associado_cpf}}, aderente ao {{plano_nome}}.</p>'
      + '<p>Valor mensal: {{valor_mensalidade}}.</p>',
    orientacao: 'retrato',
    tamanho_papel: 'a4',
    padrao: true,
    ativo: true,
    criado_em: new Date('2026-09-01T12:00:00Z').toISOString(),
    atualizado_em: new Date('2026-09-01T12:00:00Z').toISOString(),
    deleted_at: null,
  },
];

export const montarBancoDeHomologacao = (): Banco => {
  const banco: Banco = new Map();

  banco.set('__auth_users', [
    { id: 'aaaaaaaa-0000-4000-8000-000000000002', email: USUARIOS.admin.email, password: USUARIOS.admin.senha, nome: 'ADMIN PAX', nivel: 'admin', tenant_id: EMPRESA_PAX },
    { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: USUARIOS.superAdmin.email, password: USUARIOS.superAdmin.senha, nome: 'SUPER ADMIN HOMOLOGACAO', nivel: 'super_admin', tenant_id: 'default' },
    { id: 'aaaaaaaa-0000-4000-8000-000000000003', email: USUARIOS.gerente.email, password: USUARIOS.gerente.senha, nome: 'GERENTE PAX', nivel: 'gerente', tenant_id: EMPRESA_PAX },
    { id: 'aaaaaaaa-0000-4000-8000-000000000004', email: USUARIOS.funcionario.email, password: USUARIOS.funcionario.senha, nome: 'FUNCIONARIO PAX', nivel: 'funcionario', tenant_id: EMPRESA_PAX },
  ]);

  banco.set('users', [
    { id: 'aaaaaaaa-0000-4000-8000-000000000002', nome: 'ADMIN PAX', email: USUARIOS.admin.email, nivel: 'admin', tenant_id: EMPRESA_PAX, modulos_permitidos: ['*'], status: 'ativo' },
    { id: 'aaaaaaaa-0000-4000-8000-000000000001', nome: 'SUPER ADMIN HOMOLOGACAO', email: USUARIOS.superAdmin.email, nivel: 'super_admin', tenant_id: 'default', modulos_permitidos: ['*'], status: 'ativo' },
    // Os ids de SUBMÓDULO são o que libera a ROTA: `hasModuleAccess` exige o submódulo
    // explícito, e o módulo pai sozinho não concede nada. Com só `['associados','atendimentos']`
    // — como esta linha esteve até 23/09/2026, copiando o `.sql` — o gerente batia em "Acesso
    // Restrito ao Módulo" em /associados. O id do pai fica porque é ele que `tem_modulo()` lê
    // nas policies de escrita.
    { id: 'aaaaaaaa-0000-4000-8000-000000000003', nome: 'GERENTE PAX', email: USUARIOS.gerente.email, nivel: 'gerente', tenant_id: EMPRESA_PAX, modulos_permitidos: ['associados', 'atendimentos', 'associados_lista', 'associados_atendimentos', 'associados_contratos', 'associados_requisicoes'], status: 'ativo' },
    // O funcionário é o nível mais baixo do sistema — é com ele que se prova "vale para
    // todos", e não com o gerente. Ele estava só no `.sql` e com o mesmo defeito de
    // submódulo do gerente; entrou aqui junto com a correção, nos dois arquivos.
    { id: 'aaaaaaaa-0000-4000-8000-000000000004', nome: 'FUNCIONARIO PAX', email: USUARIOS.funcionario.email, nivel: 'funcionario', tenant_id: EMPRESA_PAX, modulos_permitidos: ['associados', 'financeiro', 'associados_lista', 'associados_atendimentos', 'associados_contratos', 'associados_requisicoes', 'financeiro_receber', 'financeiro_pagar'], status: 'ativo' },
  ]);

  banco.set('tenants', [
    { id: EMPRESA_PAX, razao_social: 'PAX HOMOLOGACAO LTDA', nome_fantasia: 'PAX Homologacao', cnpj: '11.111.111/0001-11', email: 'contato@pax.exemplo', telefone: '(67) 3333-0001', status: 'ativo' },
    { id: EMPRESA_FUNERARIA, razao_social: 'FUNERARIA TESTE LTDA', nome_fantasia: 'Funeraria Teste', cnpj: '22.222.222/0001-22', email: 'contato@fun.exemplo', telefone: '(67) 3333-0002', status: 'ativo' },
  ]);

  banco.set('planos_pax', [
    { id: PLANO_INDIVIDUAL, tenant_id: EMPRESA_PAX, codigo: 'PAX-IND', nome: 'Plano Individual', tipo_plano: 'individual', valor_mensalidade: 60, taxa_adesao: 50, regra_calculo: 'fixo', ativo: true },
    { id: PLANO_FAMILIAR, tenant_id: EMPRESA_PAX, codigo: 'PAX-FAM', nome: 'Plano Familiar', tipo_plano: 'individual', valor_mensalidade: 100, taxa_adesao: 80, regra_calculo: 'por_vida', ativo: true },
  ]);
  banco.set('planos_pax_faixas', []);
  banco.set('planos_pax_coberturas', []);

  banco.set('contas_bancarias', [
    { id: CONTA_BANCARIA, tenant_id: EMPRESA_PAX, nome: 'Conta Principal', banco: 'Sicoob', agencia: '3021', conta: '12345-6', tipo: 'corrente', status: 'ativo' },
  ]);

  banco.set('credenciados', [
    { id: CREDENCIADO, tenant_id: EMPRESA_PAX, empresa_id: EMPRESA_PAX, razao_social: 'CLINICA EXEMPLO LTDA', nome_fantasia: 'Clinica Exemplo', cnpj_cpf: '55.555.555/0001-55', ramo_atividade: 'Clinica medica', especialidade: 'Cardiologia', cidade: 'Coxim', uf: 'MS', status: 'ativo', deleted_at: null },
  ]);
  banco.set('procedimentos', [
    { id: PROCEDIMENTO, tenant_id: EMPRESA_PAX, empresa_id: EMPRESA_PAX, codigo_tuss: '10101012', descricao: 'Consulta em consultorio', valor_padrao: 120, coparticipacao: 20, ativo: true, deleted_at: null },
  ]);
  banco.set('credenciados_procedimentos', [
    { id: 'c9000000-0000-4000-8000-000000000001', credenciado_id: CREDENCIADO, procedimento_id: PROCEDIMENTO, valor: 120, valor_coparticipacao: 20, tenant_id: EMPRESA_PAX },
  ]);
  banco.set('credenciados_planos', []);

  banco.set('associados', [
    { id: ASSOCIADO_MARIA, tenant_id: EMPRESA_PAX, empresa_id: EMPRESA_PAX, nome: 'MARIA APARECIDA DA SILVA', cpf: '000.000.000-01', rg: '1234567', data_nascimento: '1975-03-12', sexo: 'F', telefone: '(67) 99999-0001', email: 'maria@exemplo.local', endereco_logradouro: 'RUA DAS FLORES', endereco_numero: '100', endereco_bairro: 'CENTRO', endereco_cidade: 'COXIM', endereco_cep: '79400-000', endereco_estado: 'MS', tipo_pessoa: 'PF', plano_pax_id: PLANO_FAMILIAR, plano_nome: 'Plano Familiar', numero_contrato: 'CTR-HML00001', n_vidas: 3, valor_plano: 100, status: 'ativo', deleted_at: null },
    { id: ASSOCIADO_JOAO, tenant_id: EMPRESA_PAX, empresa_id: EMPRESA_PAX, nome: 'JOAO BATISTA SOUZA', cpf: '000.000.000-02', rg: '7654321', data_nascimento: '1968-11-30', sexo: 'M', telefone: '(67) 99999-0002', email: 'joao@exemplo.local', endereco_logradouro: 'AVENIDA BRASIL', endereco_numero: '250', endereco_bairro: 'JARDIM SAO JOAO', endereco_cidade: 'COXIM', endereco_cep: '79400-100', endereco_estado: 'MS', tipo_pessoa: 'PF', plano_pax_id: PLANO_INDIVIDUAL, plano_nome: 'Plano Individual', numero_contrato: 'CTR-HML00002', n_vidas: 1, valor_plano: 60, status: 'ativo', deleted_at: null },
  ]);

  banco.set('dependentes', [
    { id: 'de900000-0000-4000-8000-000000000001', associado_id: ASSOCIADO_MARIA, tenant_id: EMPRESA_PAX, nome: 'PEDRO DA SILVA', cpf: '000.000.000-11', data_nascimento: '2005-08-09', parentesco: 'FILHO', status: 'ativo' },
    { id: 'de900000-0000-4000-8000-000000000002', associado_id: ASSOCIADO_MARIA, tenant_id: EMPRESA_PAX, nome: 'CARLOS DA SILVA', cpf: '000.000.000-12', data_nascimento: '1970-02-14', parentesco: 'CONJUGE', status: 'ativo' },
  ]);

  banco.set('contratos', [
    { id: 'c0000000-0000-4000-8000-000000000002', tenant_id: EMPRESA_PAX, associado_id: ASSOCIADO_JOAO, plano_pax_id: PLANO_INDIVIDUAL, numero_contrato: 'CTR-HML00002', valor_mensalidade: 60, taxa_adesao: 50, status: 'ativo', deleted_at: null },
  ]);

  banco.set('receitas', [
    { id: RECEITA_MARIA, tenant_id: EMPRESA_PAX, tipo_devedor: 'associado', associado_id: ASSOCIADO_MARIA, associado_nome: 'MARIA APARECIDA DA SILVA', associado_cpf: '000.000.000-01', associado_plano: 'Plano Familiar', descricao: 'Mensalidade Plano Familiar', categoria: 'Mensalidade', valor_total: 1200, qtd_parcelas: 12, forma_pagamento_padrao: 'boleto', conta_bancaria_id: CONTA_BANCARIA, status: 'ativo', observacoes: 'Semeada para homologacao', criado_em: new Date().toISOString() },
    { id: RECEITA_JOAO, tenant_id: EMPRESA_PAX, tipo_devedor: 'associado', associado_id: ASSOCIADO_JOAO, associado_nome: 'JOAO BATISTA SOUZA', associado_cpf: '000.000.000-02', associado_plano: 'Plano Individual', descricao: 'Mensalidade Plano Individual', categoria: 'Mensalidade', valor_total: 720, qtd_parcelas: 12, forma_pagamento_padrao: 'pix', conta_bancaria_id: CONTA_BANCARIA, status: 'ativo', criado_em: new Date().toISOString() },
  ]);
  banco.set('parcelas_receber', [...parcelasDaMaria(), ...parcelasDoJoao()]);

  banco.set('despesas', [
    { id: DESPESA_URNAS, tenant_id: EMPRESA_PAX, tipo_credor: 'fornecedor', fornecedor_id: FORNECEDOR_URNAS, fornecedor_nome: 'URNAS EXEMPLO LTDA', fornecedor_cnpj_cpf: '44.444.444/0001-44', credor_nome: 'URNAS EXEMPLO LTDA', credor_cpf_cnpj: '44.444.444/0001-44', descricao: 'Compra de urnas', categoria: 'Materiais', centro_custo: 'OPERACIONAL', valor_total: 3000, qtd_parcelas: 6, forma_pagamento_padrao: 'boleto', conta_bancaria_id: CONTA_BANCARIA, status: 'ativo', observacoes: 'Semeada para homologacao', criado_em: new Date().toISOString() },
    { id: DESPESA_CONVENIO, tenant_id: EMPRESA_PAX, tipo_credor: 'fornecedor', fornecedor_id: FORNECEDOR_CONVENIO, fornecedor_nome: 'CONVENIO EXEMPLO LTDA', fornecedor_cnpj_cpf: '33.333.333/0001-33', credor_nome: 'CONVENIO EXEMPLO LTDA', credor_cpf_cnpj: '33.333.333/0001-33', descricao: 'Repasse de convenio', categoria: 'Servicos', centro_custo: 'ADMINISTRATIVO', valor_total: 1000, qtd_parcelas: 4, forma_pagamento_padrao: 'pix', conta_bancaria_id: CONTA_BANCARIA, status: 'ativo', criado_em: new Date().toISOString() },
  ]);
  banco.set('parcelas_pagar', [...parcelasDasUrnas(), ...parcelasDoConvenio()]);
  banco.set('lotes_caixa', []);
  banco.set('movimentacoes_caixa', []);
  banco.set('requisicoes', []);
  banco.set('atendimentos', []);
  banco.set('auditoria', logsDeAuditoria());
  banco.set('notificacoes', []);
  // Os dois fornecedores do `.sql` — cópia que faltava aqui, como a receita da Maria faltava.
  banco.set('fornecedores', [
    { id: FORNECEDOR_CONVENIO, tenant_id: EMPRESA_PAX, empresa_id: EMPRESA_PAX, tipo_pessoa: 'PJ', razao_social: 'CONVENIO EXEMPLO LTDA', nome_fantasia: 'Convenio Exemplo', cnpj_cpf: '33.333.333/0001-33', categoria: 'Convenios Associados', tipo_fornecedor: 'servicos', status: 'ativo', deleted_at: null },
    { id: FORNECEDOR_URNAS, tenant_id: EMPRESA_PAX, empresa_id: EMPRESA_PAX, tipo_pessoa: 'PJ', razao_social: 'URNAS EXEMPLO LTDA', nome_fantasia: 'Urnas Exemplo', cnpj_cpf: '44.444.444/0001-44', categoria: 'Urnas e Caixões', tipo_fornecedor: 'produtos', status: 'ativo', deleted_at: null },
  ]);
  banco.set('categorias_fornecedor', []);
  banco.set('itens_funerarios', []);
  banco.set('documentos_padroes', modelosDeDocumento());
  banco.set('planos_contabeis', []);
  banco.set('contas_contabeis', []);
  banco.set('centros_custo', []);

  return banco;
};
