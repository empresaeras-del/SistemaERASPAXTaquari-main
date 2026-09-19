-- Semente de dados SINTETICOS para o projeto de homologacao.
--
-- NAO rode isto contra producao. O arquivo existe para que homologacao possa ser
-- recriada do zero: `supabase db push` reconstroi o schema, este arquivo enche as
-- tabelas com o minimo necessario para exercitar as telas com um usuario logado.
--
-- Nenhum dado aqui veio de producao. Nomes, CPFs e documentos sao inventados;
-- os CPFs NAO passam na validacao de digito verificador de proposito, para que
-- ninguem os confunda com pessoa real.
--
-- Senha de todos os usuarios: homologacao123
--
-- Ids sao fixos (deterministicos) para o arquivo ser idempotente e para que um
-- teste de fluxo possa apontar para um registro conhecido.

begin;

-- ---------------------------------------------------------------- empresas
insert into public.tenants (id, razao_social, nome_fantasia, cnpj, email, telefone, status) values
  ('11111111-1111-4111-8111-111111111111', 'PAX HOMOLOGACAO LTDA',      'PAX Homologacao', '11.111.111/0001-11', 'contato@pax.exemplo',  '(67) 3333-0001', 'ativo'),
  ('22222222-2222-4222-8222-222222222222', 'FUNERARIA TESTE LTDA',      'Funeraria Teste', '22.222.222/0001-22', 'contato@fun.exemplo',  '(67) 3333-0002', 'ativo')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- credenciais
-- `handle_new_user` cria a linha em public.users a partir do raw_user_meta_data.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('homologacao123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('nome', u.nome, 'nivel', u.nivel, 'tenant_id', u.tenant_id),
  now(), now()
from (values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'super@homologacao.local',      'SUPER ADMIN HOMOLOGACAO', 'super_admin',  'default'),
  ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'admin.pax@homologacao.local',  'ADMIN PAX',               'admin',        '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'gerente.pax@homologacao.local','GERENTE PAX',             'gerente',      '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000004'::uuid, 'func.pax@homologacao.local',   'FUNCIONARIO PAX',         'funcionario',  '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-000000000005'::uuid, 'admin.fun@homologacao.local',  'ADMIN FUNERARIA',         'admin',        '22222222-2222-4222-8222-222222222222')
) as u(id, email, nome, nivel, tenant_id)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select au.id::text, au.id,
       jsonb_build_object('sub', au.id::text, 'email', au.email, 'email_verified', true, 'phone_verified', false),
       'email', now(), now(), now()
from auth.users au
where au.email like '%@homologacao.local'
on conflict (provider, provider_id) do nothing;

-- O gerente tem SO o modulo de associados: é o caso que a RLS por modulo
-- (migration 20260919001244) precisa distinguir, e o que quase quebrou em producao.
update public.users set modulos_permitidos = array['associados','atendimentos']
 where id = 'aaaaaaaa-0000-4000-8000-000000000003';
update public.users set modulos_permitidos = array['associados','financeiro']
 where id = 'aaaaaaaa-0000-4000-8000-000000000004';

-- ---------------------------------------------------------------- planos PAX
insert into public.planos_pax (id, tenant_id, codigo, nome, tipo_plano, valor_mensalidade, taxa_adesao, regra_calculo, ativo) values
  ('bbbbbbbb-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'PAX-IND',  'Plano Individual',      'individual', 60.00,  50.00, 'fixo',     true),
  ('bbbbbbbb-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'PAX-FAM',  'Plano Familiar',        'individual', 100.00, 80.00, 'por_vida', true),
  ('bbbbbbbb-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'FUN-BAS',  'Plano Basico Funeraria','individual', 45.00,   0.00, 'fixo',     true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- conta bancaria
insert into public.contas_bancarias (id, tenant_id, nome, banco, agencia, conta, tipo, status) values
  ('cccccccc-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Conta Principal', 'Sicoob', '3021', '12345-6', 'corrente', 'ativo')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- fornecedores
insert into public.fornecedores (id, tenant_id, tipo_pessoa, razao_social, nome_fantasia, cnpj_cpf, categoria, tipo_fornecedor, status) values
  ('dddddddd-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'PJ', 'CONVENIO EXEMPLO LTDA', 'Convenio Exemplo', '33.333.333/0001-33', 'Convenios Associados', 'servicos', 'ativo'),
  ('dddddddd-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'PJ', 'URNAS EXEMPLO LTDA',   'Urnas Exemplo',    '44.444.444/0001-44', 'Urnas e Caixões',      'produtos', 'ativo')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- credenciado + procedimento
insert into public.credenciados (id, tenant_id, razao_social, nome_fantasia, cnpj_cpf, ramo_atividade, especialidade, cidade, uf, status) values
  ('eeeeeeee-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'CLINICA EXEMPLO LTDA', 'Clinica Exemplo', '55.555.555/0001-55', 'Clinica medica', 'Cardiologia', 'Coxim', 'MS', 'ativo')
on conflict (id) do nothing;

insert into public.procedimentos (id, tenant_id, empresa_id, codigo_tuss, descricao, valor_padrao, coparticipacao, ativo) values
  ('ffffffff-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', '10101012', 'Consulta em consultorio', 120.00, 20.00, true)
on conflict (id) do nothing;

-- A coluna e `valor`, nao `valor_acordado`: o CREATE TABLE IF NOT EXISTS posterior,
-- que trazia valor_acordado/valor_repasse, ja era inerte quando rodou.
insert into public.credenciados_procedimentos (credenciado_id, procedimento_id, valor, tenant_id)
values ('eeeeeeee-0000-4000-8000-000000000001', 'ffffffff-0000-4000-8000-000000000001', 120.00, '11111111-1111-4111-8111-111111111111')
on conflict (credenciado_id, procedimento_id) do nothing;

-- ---------------------------------------------------------------- associados
insert into public.associados (
  id, tenant_id, nome, cpf, rg, data_nascimento, sexo, telefone, email,
  endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_cep, endereco_estado,
  tipo_pessoa, plano_pax_id, plano_nome, numero_contrato, n_vidas, valor_plano, data_adesao, status
) values
  ('a5500000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'MARIA APARECIDA DA SILVA', '000.000.000-01', '1234567', '1975-03-12', 'F', '(67) 99999-0001', 'maria@exemplo.local',
   'RUA DAS FLORES', '100', 'CENTRO', 'COXIM', '79400-000', 'MS', 'PF', 'bbbbbbbb-0000-4000-8000-000000000002', 'Plano Familiar', 'CTR-HML00001', 3, 100.00, current_date - 180, 'ativo'),
  ('a5500000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'JOAO BATISTA SOUZA',       '000.000.000-02', '7654321', '1968-11-30', 'M', '(67) 99999-0002', 'joao@exemplo.local',
   'AVENIDA BRASIL', '250', 'JARDIM SAO JOAO', 'COXIM', '79400-100', 'MS', 'PF', 'bbbbbbbb-0000-4000-8000-000000000001', 'Plano Individual', 'CTR-HML00002', 1, 60.00, current_date - 90, 'ativo'),
  ('a5500000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'EMPRESA CONVENIADA - TITULAR PJ', '000.000.000-03', null, '1980-06-01', 'M', '(67) 99999-0003', 'pj@exemplo.local',
   'RUA COMERCIAL', '77', 'CENTRO', 'COXIM', '79400-000', 'MS', 'PJ', 'bbbbbbbb-0000-4000-8000-000000000001', 'Plano Individual', 'CTR-HML00003', 1, 60.00, current_date - 30, 'ativo'),
  ('a5500000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'ANA PAULA MENDES',         '000.000.000-04', null, '1990-01-20', 'F', '(67) 98888-0001', 'ana@exemplo.local',
   'RUA SETE', '12', 'VILA NOVA', 'RIO VERDE', '79400-200', 'MS', 'PF', 'bbbbbbbb-0000-4000-8000-000000000003', 'Plano Basico Funeraria', 'CTR-HML00004', 1, 45.00, current_date - 15, 'ativo')
on conflict (id) do nothing;

update public.associados set fornecedor_id = 'dddddddd-0000-4000-8000-000000000001'
 where id = 'a5500000-0000-4000-8000-000000000003';

insert into public.dependentes (id, associado_id, tenant_id, nome, cpf, data_nascimento, parentesco, status) values
  ('de900000-0000-4000-8000-000000000001', 'a5500000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'PEDRO DA SILVA',   '000.000.000-11', '2005-08-09', 'FILHO',  'ativo'),
  ('de900000-0000-4000-8000-000000000002', 'a5500000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'CARLOS DA SILVA',  '000.000.000-12', '1970-02-14', 'CONJUGE','ativo')
on conflict (id) do nothing;

insert into public.contratos (id, tenant_id, associado_id, plano_pax_id, numero_contrato, data_inicio, valor_mensalidade, taxa_adesao, status) values
  ('c0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a5500000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'CTR-HML00001', current_date - 180, 100.00, 80.00, 'ativo'),
  ('c0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'a5500000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'CTR-HML00002', current_date - 90,  60.00,  50.00, 'ativo'),
  ('c0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'a5500000-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', 'CTR-HML00003', current_date - 30,  60.00,   0.00, 'ativo'),
  ('c0000000-0000-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 'a5500000-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000003', 'CTR-HML00004', current_date - 15,  45.00,   0.00, 'ativo')
on conflict (id) do nothing;

-- ------------------------------------------------- categorias de fornecedor
-- O backfill da migration 20260918010937 rodou antes de existir qualquer tenant
-- neste banco, entao a lista modelo precisa ser semeada aqui.
insert into public.categorias_fornecedor (tenant_id, codigo, nome)
select t.id::text,
       coalesce(nullif(btrim(regexp_replace(
         upper(translate(m.nome,
                         'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                         'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
         '[^A-Z0-9]+', '-', 'g'), '-'), ''), 'CATEGORIA'),
       m.nome
  from public.tenants t
 cross join (values
   ('Convenios Associados'), ('Urnas e Caixões'), ('Floricultura e Coroas'),
   ('Marmoraria e Lápides'), ('Translado e Veículos'), ('Equipamentos Médicos'),
   ('Tanatopraxia e Insumos'), ('Cemitério e Crematório'), ('Gráfica e Impressões'),
   ('Manutenção e Conservação'), ('Tecnologia e Sistemas'), ('Outros')
 ) as m(nome)
on conflict (tenant_id, nome) do nothing;

update public.fornecedores f set categoria_id = c.id
  from public.categorias_fornecedor c
 where f.categoria_id is null and c.tenant_id = f.tenant_id and c.nome = f.categoria;

-- ---------------------------------------------------------------- mensalidades
-- Sem plano de contas montado, a isencao do trigger `exige_conta_contabil` vale e
-- o lancamento nasce sem conta contabil — que e o estado de uma empresa nova, e
-- justamente o caminho que se quer poder exercitar na tela.
insert into public.receitas (
  id, tenant_id, tipo_devedor, associado_id, associado_nome, associado_cpf, associado_plano,
  descricao, categoria, data_emissao, data_inicio_cobranca, valor_total, qtd_parcelas,
  forma_pagamento_padrao, conta_bancaria_id, status, criado_em
) values
  ('4ece1700-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'associado',
   'a5500000-0000-4000-8000-000000000001', 'MARIA APARECIDA DA SILVA', '000.000.000-01', 'Plano Familiar',
   'Mensalidade Plano Familiar', 'Mensalidade', current_date - 180, current_date - 180, 1200.00, 12,
   'pix', 'cccccccc-0000-4000-8000-000000000001', 'ativo', now()),
  ('4ece1700-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'associado',
   'a5500000-0000-4000-8000-000000000002', 'JOAO BATISTA SOUZA', '000.000.000-02', 'Plano Individual',
   'Mensalidade Plano Individual', 'Mensalidade', current_date - 90, current_date - 90, 720.00, 12,
   'pix', 'cccccccc-0000-4000-8000-000000000001', 'ativo', now())
on conflict (id) do nothing;

-- 12 parcelas por receita; as vencidas antes de hoje ficam pagas, o resto pendente.
insert into public.parcelas_receber (
  tenant_id, receita_id, numero_parcela, valor, data_vencimento, status,
  tipo_devedor, devedor_nome, devedor_cpf_cnpj, descricao, total_parcelas,
  data_pagamento, valor_recebido, valor_pago, recebido_em, forma_pagamento_efetivo
)
select r.tenant_id, r.id, n,
       round(r.valor_total / r.qtd_parcelas, 2),
       (r.data_inicio_cobranca + ((n - 1) * interval '1 month'))::date,
       case when (r.data_inicio_cobranca + ((n - 1) * interval '1 month'))::date < current_date - 30
            then 'recebido' else 'pendente' end,
       'associado', r.associado_nome, r.associado_cpf, r.descricao || ' ' || n || '/' || r.qtd_parcelas, r.qtd_parcelas,
       case when (r.data_inicio_cobranca + ((n - 1) * interval '1 month'))::date < current_date - 30
            then (r.data_inicio_cobranca + ((n - 1) * interval '1 month'))::date end,
       case when (r.data_inicio_cobranca + ((n - 1) * interval '1 month'))::date < current_date - 30
            then round(r.valor_total / r.qtd_parcelas, 2) end,
       case when (r.data_inicio_cobranca + ((n - 1) * interval '1 month'))::date < current_date - 30
            then round(r.valor_total / r.qtd_parcelas, 2) end,
       case when (r.data_inicio_cobranca + ((n - 1) * interval '1 month'))::date < current_date - 30
            then now() end,
       case when (r.data_inicio_cobranca + ((n - 1) * interval '1 month'))::date < current_date - 30
            then 'pix' end
  from public.receitas r
 cross join generate_series(1, 12) as n
 where r.id in ('4ece1700-0000-4000-8000-000000000001','4ece1700-0000-4000-8000-000000000002')
   and not exists (select 1 from public.parcelas_receber p where p.receita_id = r.id and p.numero_parcela = n);

commit;
