-- Higiene: funções de trigger não devem ficar expostas como RPC em /rest/v1/rpc/.
--
-- As três funções abaixo nasceram nas fases 2 a 4 do plano contábil e são **exclusivamente**
-- funções de trigger (`returns trigger`). Ainda assim, o grant padrão do Postgres somado aos
-- grants que o Supabase concede ao schema `public` deixava as três com `EXECUTE` para
-- `PUBLIC`, `anon` e `authenticated` — o que fez as duas `SECURITY DEFINER` aparecerem nos
-- advisors `anon_security_definer_function_executable` e
-- `authenticated_security_definer_function_executable`.
--
-- Não era explorável: o Postgres recusa a chamada direta de qualquer função de trigger com
-- "trigger functions can only be called as triggers", verificado nas duas antes desta
-- migration. Isto é fechar a superfície, não corrigir uma brecha aberta.
--
-- Revogar de `PUBLIC` **e** dos dois papéis: aqui existiam as duas coisas ao mesmo tempo — o
-- grant implícito de PUBLIC e grants explícitos a anon/authenticated —, então revogar de um
-- só deixaria o outro de pé. É a mesma lição do par
-- `20260904123956_revoke_anon_admin_functions` / `20260904124031_revoke_public_admin_functions`,
-- agora nas duas direções.
--
-- O trigger continua disparando: o Postgres não verifica `EXECUTE` para invocar a função de
-- um trigger, só para chamada direta. Verificado como o papel `authenticated`, com JWT de uma
-- empresa real, antes e depois desta migration — em ambos os casos a receita sem conta
-- contábil é recusada por `exige_conta_contabil`.
--
-- **Deliberadamente fora de escopo**: as outras funções que os mesmos advisors apontam
-- (`has_tenant_access`, `current_tenant_id`, `current_user_nivel`, `is_super_admin`...).
-- Elas são chamadas de dentro das expressões das policies de RLS, e essas expressões são
-- avaliadas com as permissões de quem consulta — revogar o `EXECUTE` delas derruba o acesso
-- a todas as tabelas. Comprovado em transação revertida: sem `EXECUTE` em
-- `has_tenant_access`, um `SELECT` em `receitas` como `authenticated` falha com
-- "permission denied for function has_tenant_access". Para essas, o alerta do advisor é
-- esperado nesta arquitetura, não uma pendência.

revoke execute on function public.exige_conta_contabil() from public, anon, authenticated;
revoke execute on function public.valida_conta_lancavel() from public, anon, authenticated;
revoke execute on function public.define_natureza_movimentacao_caixa() from public, anon, authenticated;

comment on function public.exige_conta_contabil() is
  'Fase 3: exige conta_contabil_id em lancamento criado a partir de 2026-09-09. Isenta o legado (por criado_em), suprimento/sangria e empresa sem conta analitica da natureza. Funcao de trigger: EXECUTE revogado de PUBLIC/anon/authenticated, o que nao afeta o disparo do trigger.';
comment on function public.valida_conta_lancavel() is
  'Fase 2: recusa lancamento em conta sintetica ou excluida. De proposito nao checa `ativo` (ver CLAUDE.md). Funcao de trigger: EXECUTE revogado de PUBLIC/anon/authenticated.';
comment on function public.define_natureza_movimentacao_caixa() is
  'Mantem movimentacoes_caixa.natureza_contabil coerente com tipo, para a FK composta nao depender de o cliente mandar o valor certo. Funcao de trigger: EXECUTE revogado de PUBLIC/anon/authenticated.';
