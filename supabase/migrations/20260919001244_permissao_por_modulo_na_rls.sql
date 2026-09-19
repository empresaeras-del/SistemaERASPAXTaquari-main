-- Torna `users.modulos_permitidos` uma permissão de verdade, e não só uma preferência de tela.
--
-- Até 18/09/2026 as policies perguntavam só "o registro é da sua empresa?". Provado em
-- produção, com o JWT real de um gerente que tem apenas os módulos de Associados: ele lia 24
-- parcelas a receber, 2 receitas, 3 movimentações de caixa e 14 linhas de auditoria, e o
-- UPDATE nas 24 parcelas foi ACEITO. A chave anônima está no bundle, então isso é alcançável
-- por qualquer usuário autenticado via /rest/v1, sem passar pela tela que esconde o botão.
--
-- O corte aplicado aqui NÃO é um mapa completo tabela→módulo, e isso é deliberado: os módulos
-- são agrupamentos de navegação, não fronteiras de dados. Seis dos catorze arquivos que criam
-- receita/parcela vivem fora das telas de financeiro (gerar mensalidade, receber parcela,
-- reativar associado, atendimento e contrato com cobrança, guia com co-participação). Amarrar
-- `receitas` ao módulo `financeiro` tiraria do gerente KAUA justamente as operações centrais do
-- módulo que ele tem. Associados e financeiro seguem um domínio só, porque de fato são.
--
-- O que muda: a ESCRITA passa a exigir o módulo nas tabelas em que o módulo é mesmo uma
-- fronteira; a LEITURA continua por empresa, então nenhuma tela perde dado que já mostrava.

create or replace function public.tem_modulo(modulo text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select u.nivel = 'super_admin'
        or u.modulos_permitidos @> array['*']
        or u.modulos_permitidos @> array[modulo]
    from public.users u
    where u.id = auth.uid() and u.deleted_at is null
  ), false)
$$;

comment on function public.tem_modulo(text) is
  'O usuário logado tem este módulo em users.modulos_permitidos? super_admin e o curinga ''*'' '
  'passam sempre. Usada nas policies de ESCRITA das tabelas cujo módulo é uma fronteira de '
  'dados real. Recebe o módulo como literal constante (não uma coluna), então a chamada é '
  'hoistável e vai dentro de (select ...) nas policies — ver a seção de auth_rls_initplan no '
  'CLAUDE.md. Sem linha em public.users, ou sem login, devolve false.';

-- Diferente das quatro auxiliares de RLS, esta não precisa ser chamável pelo anônimo: todas as
-- policies que a usam são `TO authenticated`, então o anon nunca chega a avaliá-la. Revogar de
-- PUBLIC **e** de anon mantém o advisor anon_security_definer_function_executable em 4, que é a
-- contagem que o CLAUDE.md fixa como esperada.
revoke execute on function public.tem_modulo(text) from public;
revoke execute on function public.tem_modulo(text) from anon;
grant  execute on function public.tem_modulo(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Escrita por módulo. SELECT continua por empresa.
--
-- Duas policies por tabela, e a semântica depende de elas serem permissivas (OR):
--   * <t>_select_policy  (cmd SELECT) — empresa
--   * <t>_write_policy   (cmd ALL)    — empresa E módulo
-- Em SELECT as duas são avaliadas e o OR devolve "empresa"; em INSERT/UPDATE/DELETE só a
-- segunda se aplica, então o módulo é exigido.
--
-- É DROP + CREATE, não ALTER POLICY — o CLAUDE.md prefere ALTER justamente para não deixar cair
-- o `TO authenticated`, mas ALTER não muda o `cmd`, e aqui a mudança É o cmd. Por isso todo
-- CREATE abaixo declara o papel explicitamente.
-- ---------------------------------------------------------------------------------------------
do $$
declare m record;
begin
  for m in
    select * from (values
      ('planos_pax',            'planos',           '(tenant_id IS NULL) OR has_tenant_access(tenant_id)'),
      ('planos_pax_faixas',     'planos',           '(tenant_id IS NULL) OR has_tenant_access(tenant_id)'),
      ('planos_pax_coberturas', 'planos',           '(tenant_id IS NULL) OR has_tenant_access(tenant_id)'),
      ('credenciados',          'credenciados',     'has_tenant_access(tenant_id)'),
      ('procedimentos',         'credenciados',     '(tenant_id IS NULL) OR has_tenant_access(tenant_id)'),
      ('remessas_faturamento',  'credenciados',     'has_tenant_access(tenant_id)'),
      ('itens_funerarios',      'itens_funerarios', '(tenant_id IS NULL) OR has_tenant_access(tenant_id)'),
      ('fornecedores',          'administracao',    'has_tenant_access(tenant_id)'),
      ('categorias_fornecedor', 'administracao',    'has_tenant_access(tenant_id)'),
      ('documentos_padroes',    'configuracoes',    '(tenant_id IS NULL) OR has_tenant_access(tenant_id)'),
      ('planos_contabeis',      'financeiro',       'has_tenant_access(tenant_id)'),
      ('contas_contabeis',      'financeiro',       'has_tenant_access(tenant_id)'),
      ('centros_custo',         'financeiro',       'has_tenant_access(tenant_id)')
    ) as t(tabela, modulo, pred)
  loop
    execute format('drop policy if exists %I on public.%I', m.tabela || '_tenant_policy', m.tabela);
    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      m.tabela || '_select_policy', m.tabela, m.pred);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((%s) and (select public.tem_modulo(%L))) with check ((%s) and (select public.tem_modulo(%L)))',
      m.tabela || '_write_policy', m.tabela, m.pred, m.modulo, m.pred, m.modulo);
  end loop;
end $$;

-- As duas de vínculo do credenciado têm predicado por EXISTS, não por coluna própria.
drop policy if exists credenciados_planos_tenant_policy on public.credenciados_planos;
create policy credenciados_planos_select_policy on public.credenciados_planos
  for select to authenticated
  using (is_super_admin() or exists (
    select 1 from public.credenciados c
    where c.id = credenciados_planos.credenciado_id and has_tenant_access(c.tenant_id)));
create policy credenciados_planos_write_policy on public.credenciados_planos
  for all to authenticated
  using ((is_super_admin() or exists (
    select 1 from public.credenciados c
    where c.id = credenciados_planos.credenciado_id and has_tenant_access(c.tenant_id)))
    and (select public.tem_modulo('credenciados')))
  with check ((is_super_admin() or exists (
    select 1 from public.credenciados c
    where c.id = credenciados_planos.credenciado_id and has_tenant_access(c.tenant_id)))
    and (select public.tem_modulo('credenciados')));

drop policy if exists credenciados_procedimentos_tenant_policy on public.credenciados_procedimentos;
create policy credenciados_procedimentos_select_policy on public.credenciados_procedimentos
  for select to authenticated
  using (is_super_admin() or exists (
    select 1 from public.credenciados c
    where c.id = credenciados_procedimentos.credenciado_id and has_tenant_access(c.tenant_id)));
create policy credenciados_procedimentos_write_policy on public.credenciados_procedimentos
  for all to authenticated
  using ((is_super_admin() or exists (
    select 1 from public.credenciados c
    where c.id = credenciados_procedimentos.credenciado_id and has_tenant_access(c.tenant_id)))
    and (select public.tem_modulo('credenciados')))
  with check ((is_super_admin() or exists (
    select 1 from public.credenciados c
    where c.id = credenciados_procedimentos.credenciado_id and has_tenant_access(c.tenant_id)))
    and (select public.tem_modulo('credenciados')));

-- ---------------------------------------------------------------------------------------------
-- Auditoria: leitura por NÍVEL, e a trilha vira append-only.
--
-- A regra pedida em 15/09 e anunciada pela própria tela é "super_admin vê tudo; admin vê a
-- própria empresa" — nenhum funcionário ou gerente tem o módulo `auditoria`, então restringir
-- a leitura a admin+ não tira nada que alguém alcance hoje pela interface.
--
-- Sem policy de UPDATE nem de DELETE: com RLS ligada, o que nenhuma policy permite é negado.
-- Conferido no `src/` antes de fechar — só existem um SELECT (auditoriaService) e um INSERT
-- (lib/supabase); nada reescreve nem apaga linha de auditoria. É o que o CLAUDE.md já afirma ao
-- deixar as duas linhas falsas de 16/09 onde estão: reescrever trilha é decisão de produto.
-- O INSERT continua liberado a qualquer autenticado, porque `registrarAuditoria` é chamado de
-- praticamente todo service.
-- ---------------------------------------------------------------------------------------------
drop policy if exists auditoria_tenant_policy on public.auditoria;

create policy auditoria_select_policy on public.auditoria
  for select to authenticated
  using (has_tenant_access(tenant_id)
         and (select public.current_user_nivel()) in ('admin', 'super_admin'));

create policy auditoria_insert_policy on public.auditoria
  for insert to authenticated
  with check (has_tenant_access(tenant_id));
