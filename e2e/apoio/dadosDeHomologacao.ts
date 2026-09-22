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
} as const;

export const PLANO_INDIVIDUAL = 'bbbbbbbb-0000-4000-8000-000000000001';
export const PLANO_FAMILIAR = 'bbbbbbbb-0000-4000-8000-000000000002';
export const CONTA_BANCARIA = 'cccccccc-0000-4000-8000-000000000001';
export const CREDENCIADO = 'eeeeeeee-0000-4000-8000-000000000001';
export const PROCEDIMENTO = 'ffffffff-0000-4000-8000-000000000001';
export const ASSOCIADO_MARIA = 'a5500000-0000-4000-8000-000000000001';
export const ASSOCIADO_JOAO = 'a5500000-0000-4000-8000-000000000002';
export const RECEITA_JOAO = '4ece1700-0000-4000-8000-000000000002';

const hoje = new Date();
const emMeses = (n: number) => {
  const d = new Date(hoje);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

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
      data_pagamento: liquidada ? emMeses(n - 3) : null,
      valor_recebido: liquidada ? 60 : null,
      forma_pagamento_efetivo: liquidada ? 'pix' : null,
    };
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
  ]);

  banco.set('users', [
    { id: 'aaaaaaaa-0000-4000-8000-000000000002', nome: 'ADMIN PAX', email: USUARIOS.admin.email, nivel: 'admin', tenant_id: EMPRESA_PAX, modulos_permitidos: ['*'], status: 'ativo' },
    { id: 'aaaaaaaa-0000-4000-8000-000000000001', nome: 'SUPER ADMIN HOMOLOGACAO', email: USUARIOS.superAdmin.email, nivel: 'super_admin', tenant_id: 'default', modulos_permitidos: ['*'], status: 'ativo' },
    { id: 'aaaaaaaa-0000-4000-8000-000000000003', nome: 'GERENTE PAX', email: USUARIOS.gerente.email, nivel: 'gerente', tenant_id: EMPRESA_PAX, modulos_permitidos: ['associados', 'atendimentos'], status: 'ativo' },
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
    { id: RECEITA_JOAO, tenant_id: EMPRESA_PAX, tipo_devedor: 'associado', associado_id: ASSOCIADO_JOAO, associado_nome: 'JOAO BATISTA SOUZA', associado_cpf: '000.000.000-02', associado_plano: 'Plano Individual', descricao: 'Mensalidade Plano Individual', categoria: 'Mensalidade', valor_total: 720, qtd_parcelas: 12, forma_pagamento_padrao: 'pix', conta_bancaria_id: CONTA_BANCARIA, status: 'ativo', criado_em: new Date().toISOString() },
  ]);
  banco.set('parcelas_receber', parcelasDoJoao());

  banco.set('despesas', []);
  banco.set('parcelas_pagar', []);
  banco.set('lotes_caixa', []);
  banco.set('movimentacoes_caixa', []);
  banco.set('requisicoes', []);
  banco.set('atendimentos', []);
  banco.set('auditoria', logsDeAuditoria());
  banco.set('notificacoes', []);
  banco.set('fornecedores', []);
  banco.set('categorias_fornecedor', []);
  banco.set('itens_funerarios', []);
  banco.set('documentos_padroes', modelosDeDocumento());
  banco.set('planos_contabeis', []);
  banco.set('contas_contabeis', []);
  banco.set('centros_custo', []);

  return banco;
};
