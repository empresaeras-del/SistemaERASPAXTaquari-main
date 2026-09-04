-- Fixa search_path nas funções apontadas pelo Supabase security advisor (function_search_path_mutable).
-- Sem isso, funções SECURITY DEFINER ficam vulneráveis a search_path hijacking: um objeto malicioso
-- em outro schema poderia ser resolvido no lugar do pretendido quando a função roda com privilégios do dono.
-- Achado crítico do Diagnóstico ERAS PAX de 04/09/2026 — Fase 0.
ALTER FUNCTION public.update_itens_funerarios_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_planos_pax_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_associados_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_receitas_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_despesas_atualizado_em() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_tenants_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_profile() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_dashboard_resumo(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.registrar_audit(text, text, jsonb) SET search_path = public, pg_temp;
