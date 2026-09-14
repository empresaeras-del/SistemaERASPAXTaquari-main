-- Cadastros de usuário pela metade: quem tem credencial no Auth mas não tem perfil no app,
-- ou nunca confirmou o e-mail do convite.
--
-- Por que uma função e não uma view: `auth.users` não é legível por `authenticated`, e é lá
-- que moram `email_confirmed_at`, `last_sign_in_at` e o `raw_user_meta_data` com a intenção
-- registrada no cadastro. Sem SECURITY DEFINER o app não tem como saber que um usuário
-- autentica e não existe no sistema — foi exatamente assim que `empresa.eras@gmail.com`
-- ficou 28 dias nesse estado sem ninguém notar.
--
-- `LEFT JOIN` a partir de `auth.users`, e não `FULL OUTER`: `public.users.id` referencia
-- `auth.users(id) ON DELETE CASCADE`, então perfil sem credencial é impossível por
-- construção. A FK já responde essa metade da pergunta.
create or replace function public.listar_cadastros_incompletos()
returns table (
  usuario_id uuid,
  email text,
  nome text,
  tenant_id text,
  nivel text,
  criado_em timestamptz,
  tem_perfil boolean,
  email_confirmado boolean,
  ja_acessou boolean,
  convite_enviado_em timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select
    au.id,
    coalesce(pu.email, au.email)::text,
    -- Sem perfil, o nome/nível/empresa saem do metadata do convite: é o único lugar onde a
    -- intenção de quem cadastrou sobrevive, e é de lá que o reparo deve ler.
    coalesce(pu.nome, au.raw_user_meta_data->>'nome')::text,
    coalesce(pu.tenant_id, au.raw_user_meta_data->>'tenant_id')::text,
    coalesce(pu.nivel, au.raw_user_meta_data->>'nivel')::text,
    au.created_at,
    (pu.id is not null),
    (au.email_confirmed_at is not null),
    (au.last_sign_in_at is not null),
    au.confirmation_sent_at
  from auth.users au
  left join public.users pu on pu.id = au.id and pu.deleted_at is null
  where (pu.id is null or au.email_confirmed_at is null)
    and (
      public.is_super_admin()
      -- Um cadastro órfão cujo metadata não diz a empresa fica com `tenant_id` nulo, e
      -- `NULL = current_tenant_id()` não casa: ele aparece só para o super_admin, que é
      -- quem pode decidir de quem ele é. Nenhum admin o vê por engano.
      or (public.current_user_nivel() = 'admin'
          and coalesce(pu.tenant_id, au.raw_user_meta_data->>'tenant_id') = public.current_tenant_id())
    )
  order by au.created_at;
$fn$;

comment on function public.listar_cadastros_incompletos() is
  'Cadastros de usuário incompletos visíveis para quem chama: sem perfil em public.users, ou com e-mail do convite não confirmado. Escopada por empresa para admin; tudo para super_admin; nada para os demais níveis. SECURITY DEFINER porque lê auth.users.';

-- Função SECURITY DEFINER que lê auth.users não pode ficar chamável sem login. Revogar de
-- `anon` sozinho não basta: o grant implícito de PUBLIC continua valendo por herança — a
-- lição do par revoke_anon/revoke_public.
revoke execute on function public.listar_cadastros_incompletos() from public;
revoke execute on function public.listar_cadastros_incompletos() from anon;
grant execute on function public.listar_cadastros_incompletos() to authenticated;
