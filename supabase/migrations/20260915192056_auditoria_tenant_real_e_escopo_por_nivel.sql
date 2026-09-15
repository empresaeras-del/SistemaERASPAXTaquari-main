-- A Ata de Ocorrencias nao era legivel por nenhum admin: as 568 linhas de auditoria
-- nasceram com tenant_id = 'system', um literal que nao e empresa nenhuma. Como a policy
-- e has_tenant_access(tenant_id), o resultado era 0 linhas para admin, gerente e
-- funcionario, e tudo para o super_admin pelo atalho do is_super_admin().
--
-- E o inverso do incidente 'empresa_padrao' que o CLAUDE.md documenta: la o literal
-- inventado VAZAVA para todas as empresas, aqui ele ESCONDE de todas. Mesma causa --
-- carimbar um tenant que ninguem determinou.
--
-- Tres origens do 'system', todas fechadas aqui ou no frontend:
--   a) DEFAULT 'system' da propria coluna (dropado abaixo);
--   b) registrar_audit lia app_metadata.tenant_id, e o app grava em user_metadata --
--      entao a RPC caia no fallback 'system' praticamente sempre (corrigida abaixo);
--   c) lib/supabase.ts inicializava tenantId = 'system' (corrigido no frontend).

-- 1) Backfill pelo AUTOR, so quando o tenant dele e empresa real (existe em tenants).
--    187 linhas: 185 de usuarios da PAX e 2 da outra empresa.
update public.auditoria a
set tenant_id = u.tenant_id
from public.users u
where u.id::text = a.usuario_id
  and a.tenant_id = 'system'
  and exists (select 1 from public.tenants t where t.id::text = u.tenant_id);

-- 2) Backfill pelo tenant que o PROPRIO detalhe declara, quando e empresa real.
--    Pega as que o autor nao resolveu (super_admin agindo sobre dado de uma empresa).
update public.auditoria a
set tenant_id = a.detalhes->>'tenant_id'
where a.tenant_id = 'system'
  and exists (select 1 from public.tenants t where t.id::text = a.detalhes->>'tenant_id');

-- 3) 'system' deixa de ser DEFAULT. Ele continua valendo como marcador explicito de
--    "acao sem empresa determinada", mas passa a exigir que alguem o escreva de
--    proposito: sem default, um insert que esqueca o tenant_id falha na hora (a coluna
--    e NOT NULL) em vez de nascer invisivel para a empresa dona do registro.
alter table public.auditoria alter column tenant_id drop default;

comment on column public.auditoria.tenant_id is
  'Empresa dona da acao auditada. O literal ''system'' e o marcador de "empresa nao '
  'determinada": has_tenant_access() e falso para ele, entao so o super_admin le essas '
  'linhas. NUNCA use ''system'' como fallback de escrita -- resolva a empresa ou recuse '
  'a gravacao (ver utils/tenant.ts e a secao da Ata de Ocorrencias no CLAUDE.md).';

-- 4) A RPC passa a resolver o tenant pela MESMA funcao que as policies usam, em vez de
--    reimplementar a leitura do JWT olhando so um dos dois lugares onde o tenant mora.
--    Predicado repetido em dois lugares so e corrigido uma vez.
create or replace function public.registrar_audit(user_id text, acao text, detalhes jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_tenant_id text;
  v_uid uuid;
begin
  v_uid := auth.uid();
  v_tenant_id := current_tenant_id();

  if v_tenant_id is null or v_tenant_id = '' then
    v_tenant_id := 'system';
  end if;

  insert into auditoria (tenant_id, usuario_id, acao, detalhes)
  values (v_tenant_id, coalesce(v_uid::text, 'system'), acao, coalesce(detalhes, '{}'::jsonb));
end;
$function$;

-- CREATE OR REPLACE preserva a ACL, mas as revogacoes da migration 20260910005709 sao
-- reafirmadas aqui de proposito: esta funcao ESCREVE e e SECURITY DEFINER, entao um
-- EXECUTE para anon a tornaria gravavel por quem nao fez login. Revogar de um lado so
-- nao basta -- e a licao do par revoke_anon/revoke_public.
revoke execute on function public.registrar_audit(text, text, jsonb) from public;
revoke execute on function public.registrar_audit(text, text, jsonb) from anon;
grant execute on function public.registrar_audit(text, text, jsonb) to authenticated;
