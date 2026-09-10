-- registrar_audit: fecha a gravação de auditoria para quem não fez login.
--
-- A função é SECURITY DEFINER (grava passando por cima da RLS de `auditoria`) e recebe
-- quem/o quê/detalhes por parâmetro. Com EXECUTE para `anon`, ela ficava publicada em
-- /rest/v1/rpc/registrar_audit e um chamador NÃO AUTENTICADO conseguia inserir linha no
-- log — verificado em transação revertida em 09/09/2026: `set local role anon` +
-- registrar_audit(...) levou a tabela de 484 para 485 linhas.
--
-- O efeito não é vazamento nem destruição: é a auditoria deixar de valer como prova do que
-- o sistema fez, que é a única coisa que um log de auditoria faz.
--
-- Revoga de PUBLIC **e** de anon: a ACL tinha os dois (`=X/postgres` implícito de PUBLIC
-- mais o grant explícito de `20260817130000_rpc_functions.sql`), então revogar de um lado
-- só deixaria o outro de pé — a lição do par revoke_anon/revoke_public do CLAUDE.md,
-- valendo nas duas direções.
--
-- `authenticated` mantém o EXECUTE: é de lá que o app chama (src/lib/supabase.ts, como
-- fallback quando o insert direto em `auditoria` falha). Conferido que nenhum fluxo
-- pré-login usa a função — LoginPage não registra auditoria, e o único uso em contexto de
-- autenticação (logoff por inatividade) só dispara com usuário carregado.

revoke execute on function public.registrar_audit(text, text, jsonb) from public;
revoke execute on function public.registrar_audit(text, text, jsonb) from anon;

comment on function public.registrar_audit(text, text, jsonb) is
  'Grava entrada no log de auditoria. SECURITY DEFINER: escreve passando por cima da RLS de auditoria, e por isso NÃO deve ter EXECUTE para PUBLIC/anon — um chamador sem login conseguiria forjar linha de log. Chamada pelo app como authenticated (fallback de registrarAuditoria em src/lib/supabase.ts).';
