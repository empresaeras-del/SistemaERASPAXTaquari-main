-- pgTAP: isolamento real de dados entre duas empresas (tenants), exercitando
-- as políticas de RLS de ponta a ponta (não só a função has_tenant_access()).
--
-- Diferente do teste 002 (que só olha o texto das políticas), este teste
-- insere linhas de duas empresas diferentes e verifica, com um SELECT de
-- verdade sob o papel "authenticated", que um usuário de uma empresa nunca
-- enxerga os dados da outra. É esse tipo de teste que pega uma política
-- insuficiente que não é literalmente "true" (ex.: uma política de SELECT
-- que checa só "deleted_at IS NULL", sem checar o tenant).
BEGIN;
SELECT plan(15);

-- ---------------------------------------------------------------------------
-- Massa de dados: duas empresas (tenant-a / tenant-b) + um super_admin
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_app_meta_data) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'user-a@test.local', '{"tenant_id":"tenant-a","nivel":"funcionario"}'),
  ('b0000000-0000-0000-0000-00000000000b', 'user-b@test.local', '{"tenant_id":"tenant-b","nivel":"funcionario"}'),
  ('c0000000-0000-0000-0000-00000000000c', 'user-super@test.local', '{"tenant_id":"tenant-a","nivel":"super_admin"}');

INSERT INTO associados (id, tenant_id, nome) VALUES
  ('11111111-0000-0000-0000-000000000001', 'tenant-a', 'Associado da Empresa A'),
  ('22222222-0000-0000-0000-000000000002', 'tenant-b', 'Associado da Empresa B');

INSERT INTO dependentes (associado_id, tenant_id, nome, parentesco) VALUES
  ('11111111-0000-0000-0000-000000000001', 'tenant-a', 'Dependente da Empresa A', 'filho'),
  ('22222222-0000-0000-0000-000000000002', 'tenant-b', 'Dependente da Empresa B', 'filho');

INSERT INTO contratos (tenant_id, associado_id, numero_contrato, data_inicio, valor_mensalidade) VALUES
  ('tenant-a', '11111111-0000-0000-0000-000000000001', 'CT-TESTE-A-001', CURRENT_DATE, 100),
  ('tenant-b', '22222222-0000-0000-0000-000000000002', 'CT-TESTE-B-001', CURRENT_DATE, 100);

INSERT INTO contas_bancarias (id, tenant_id, nome, banco) VALUES
  ('11111111-0000-0000-0000-00000000000b', 'tenant-a', 'Conta da Empresa A', 'Banco A'),
  ('22222222-0000-0000-0000-00000000000b', 'tenant-b', 'Conta da Empresa B', 'Banco B');

INSERT INTO receitas (id, tenant_id, tipo_devedor, descricao, categoria, valor_total) VALUES
  ('11111111-0000-0000-0000-00000000000d', 'tenant-a', 'cliente_pf', 'Mensalidade Empresa A', 'Mensalidade', 100),
  ('22222222-0000-0000-0000-00000000000d', 'tenant-b', 'cliente_pf', 'Mensalidade Empresa B', 'Mensalidade', 100);

INSERT INTO credenciados (id, razao_social, cnpj_cpf, ramo_atividade, tenant_id) VALUES
  ('33333333-0000-0000-0000-000000000003', 'Credenciado da Empresa A', '11.111.111/0001-11', 'Funeraria', 'tenant-a'),
  ('44444444-0000-0000-0000-000000000004', 'Credenciado da Empresa B', '22.222.222/0001-22', 'Funeraria', 'tenant-b');

INSERT INTO planos_pax (id, codigo, nome, tipo_plano, valor_mensalidade) VALUES
  ('55555555-0000-0000-0000-000000000005', 'PLANO-TESTE-X', 'Plano de Teste X', 'individual', 50);

-- requisicoes referencia associado_id/paciente_id/credenciado_id, então
-- precisa ser inserida depois de associados e credenciados.
INSERT INTO requisicoes (
  id, tenant_id, codigo_requisicao,
  associado_id, associado_nome,
  paciente_id, paciente_nome, paciente_tipo,
  credenciado_id, credenciado_nome
) VALUES
  (
    '11111111-0000-0000-0000-00000000000c', 'tenant-a', 'REQ-TESTE-A-001',
    '11111111-0000-0000-0000-000000000001', 'Associado A',
    '11111111-0000-0000-0000-000000000001', 'Paciente A', 'titular',
    '33333333-0000-0000-0000-000000000003', 'Credenciado A'
  ),
  (
    '22222222-0000-0000-0000-00000000000c', 'tenant-b', 'REQ-TESTE-B-001',
    '22222222-0000-0000-0000-000000000002', 'Associado B',
    '22222222-0000-0000-0000-000000000002', 'Paciente B', 'titular',
    '44444444-0000-0000-0000-000000000004', 'Credenciado B'
  );

-- credenciados_planos NÃO tem política própria por tenant_id: ela herda o
-- tenant do credenciado pai via JOIN (ver has_tenant_access(c.tenant_id) em
-- 20260831190000_fix_tenant_rls_and_credenciados.sql).
INSERT INTO credenciados_planos (credenciado_id, plano_pax_id) VALUES
  ('33333333-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000005'),
  ('44444444-0000-0000-0000-000000000004', '55555555-0000-0000-0000-000000000005');

-- ---------------------------------------------------------------------------
-- Usuário da Empresa A: só pode ver os dados da própria empresa
-- ---------------------------------------------------------------------------
SELECT test_login_as('a0000000-0000-0000-0000-00000000000a');

SELECT ok(
  EXISTS(SELECT 1 FROM associados WHERE id = '11111111-0000-0000-0000-000000000001'),
  'associados: usuário da Empresa A vê o associado da própria empresa'
);
SELECT ok(
  NOT EXISTS(SELECT 1 FROM associados WHERE id = '22222222-0000-0000-0000-000000000002'),
  'associados: usuário da Empresa A NÃO vê o associado da Empresa B'
);

SELECT ok(
  EXISTS(SELECT 1 FROM dependentes WHERE associado_id = '11111111-0000-0000-0000-000000000001'),
  'dependentes: usuário da Empresa A vê o dependente da própria empresa'
);
SELECT ok(
  NOT EXISTS(SELECT 1 FROM dependentes WHERE associado_id = '22222222-0000-0000-0000-000000000002'),
  'dependentes: usuário da Empresa A NÃO vê o dependente da Empresa B'
);

SELECT ok(
  EXISTS(SELECT 1 FROM contratos WHERE numero_contrato = 'CT-TESTE-A-001'),
  'contratos: usuário da Empresa A vê o contrato da própria empresa'
);
SELECT ok(
  NOT EXISTS(SELECT 1 FROM contratos WHERE numero_contrato = 'CT-TESTE-B-001'),
  'contratos: usuário da Empresa A NÃO vê o contrato da Empresa B'
);

SELECT ok(
  EXISTS(SELECT 1 FROM contas_bancarias WHERE id = '11111111-0000-0000-0000-00000000000b'),
  'contas_bancarias: usuário da Empresa A vê a conta da própria empresa'
);
SELECT ok(
  NOT EXISTS(SELECT 1 FROM contas_bancarias WHERE id = '22222222-0000-0000-0000-00000000000b'),
  'contas_bancarias: usuário da Empresa A NÃO vê a conta bancária da Empresa B'
);

SELECT ok(
  EXISTS(SELECT 1 FROM requisicoes WHERE id = '11111111-0000-0000-0000-00000000000c'),
  'requisicoes: usuário da Empresa A vê a requisição da própria empresa'
);
SELECT ok(
  NOT EXISTS(SELECT 1 FROM requisicoes WHERE id = '22222222-0000-0000-0000-00000000000c'),
  'requisicoes: usuário da Empresa A NÃO vê a requisição da Empresa B'
);

SELECT ok(
  EXISTS(SELECT 1 FROM receitas WHERE id = '11111111-0000-0000-0000-00000000000d'),
  'receitas: usuário da Empresa A vê a receita da própria empresa'
);
SELECT ok(
  NOT EXISTS(SELECT 1 FROM receitas WHERE id = '22222222-0000-0000-0000-00000000000d'),
  'receitas: usuário da Empresa A NÃO vê a receita da Empresa B'
);

SELECT ok(
  EXISTS(SELECT 1 FROM credenciados_planos WHERE credenciado_id = '33333333-0000-0000-0000-000000000003'),
  'credenciados_planos: usuário da Empresa A vê o vínculo do credenciado da própria empresa'
);
SELECT ok(
  NOT EXISTS(SELECT 1 FROM credenciados_planos WHERE credenciado_id = '44444444-0000-0000-0000-000000000004'),
  'credenciados_planos: usuário da Empresa A NÃO vê o vínculo do credenciado da Empresa B (tenant herdado via JOIN)'
);

-- ---------------------------------------------------------------------------
-- super_admin enxerga os dados de todas as empresas
-- ---------------------------------------------------------------------------
SELECT test_logout();
SELECT test_login_as('c0000000-0000-0000-0000-00000000000c');

SELECT is(
  (SELECT count(*)::int FROM associados WHERE id IN (
    '11111111-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002'
  )),
  2,
  'associados: super_admin vê os associados de ambas as empresas'
);

SELECT test_logout();
SELECT * FROM finish();
ROLLBACK;
