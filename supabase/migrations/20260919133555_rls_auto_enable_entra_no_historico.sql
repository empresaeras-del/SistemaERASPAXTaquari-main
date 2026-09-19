-- `public.rls_auto_enable()` e o event trigger `ensure_rls` existem em producao desde
-- algum ponto de agosto/2026, mas NENHUMA migration os criava: a unica que os citava era
-- `20260910010924_revoke_execute_handle_new_user_e_rls_auto_enable`, que apenas REVOGA
-- EXECUTE deles. Foram criados a mao, fora do historico.
--
-- Descoberto em 19/09/2026 ao reconstruir o schema do zero num projeto de homologacao:
-- o replay das 70 migrations parou em `20260910010924` com
--   ERROR: 42883: function public.rls_auto_enable() does not exist
-- ou seja, `supabase db push` contra um banco vazio nao chegava ao fim, e o ambiente
-- resultante nascia SEM a rede de seguranca que habilita RLS em toda tabela nova.
--
-- Esta migration e no-op contra producao (o corpo e copia byte a byte do que ja esta la,
-- e CREATE OR REPLACE preserva ACL e dono) e existe para que o repositorio volte a
-- descrever o banco por inteiro. Conferido antes e depois de aplicar: mesmo
-- pg_get_functiondef (md5 6998ea6b...), mesma ACL {postgres=X/postgres,service_role=X/postgres},
-- 1 event trigger `ensure_rls`, 0 tabelas de `public` sem RLS.
--
-- ATENCAO a ordem: num rebuild do zero esta migration roda DEPOIS de `20260910010924`,
-- entao aquele arquivo ainda falha. Ver a secao "O que o repositorio ainda nao reconstroi
-- sozinho" no CLAUDE.md.

create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

comment on function public.rls_auto_enable() is
  'Event trigger (ensure_rls, ddl_command_end): habilita RLS automaticamente em toda tabela nova do schema public. Funcao de event trigger — NAO deve ter EXECUTE para PUBLIC/anon/authenticated; o gatilho dispara sem depender desse grant.';

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
  end if;
end $$;

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
