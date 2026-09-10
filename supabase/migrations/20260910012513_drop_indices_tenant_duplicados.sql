-- Remove 9 índices idênticos duplicados sobre `tenant_id`.
--
-- ORIGEM DO PROBLEMA, e é a parte que vale guardar: os 9 índices curtos
-- (`idx_<tabela>_tenant`) vêm do schema original de 17/08. Os 9 longos
-- (`idx_<tabela>_tenant_id`) vêm das migrations de correção de RLS de 31/08, 03/09 e
-- 05/09, que acrescentaram "um índice de cobertura para o predicado da policy" sem saber
-- que já existia um igual com outro nome.
--
-- `CREATE INDEX IF NOT EXISTS` NÃO PROTEGE CONTRA ISSO: o `IF NOT EXISTS` casa pelo
-- **nome** do índice, nunca pela definição. Um índice byte a byte idêntico, com outro nome,
-- é criado sem aviso. Ao adicionar índice numa tabela que já existe, procure por definição
-- (`pg_indexes` / `pg_get_indexdef`), não por nome.
--
-- QUAL FICA: o curto, do schema original — e as três razões apontam para o mesmo lado:
--   1. é o original, de 17/08;
--   2. é o que o planner de fato escolheu nos 9 pares (mais `idx_scan` em todos, e em
--      `despesas`, `fornecedores`, `parcelas_pagar` e `receitas` o longo está em ZERO);
--   3. é a convenção majoritária entre as tabelas que não duplicaram (7 usam o curto,
--      5 o longo) e a usada pelo módulo contábil deste mês.
--
-- SEGURANÇA DA OPERAÇÃO, conferida antes: os 18 índices são `btree (tenant_id)` simples,
-- nenhum é `UNIQUE` nem `PRIMARY`, todos `indisvalid`, e nenhum tem constraint dependente
-- (`pg_constraint.conindid` = 0 para todos). Nenhum é referenciado por nome no frontend.
-- Dropar o duplicado não muda plano de consulta nenhum: o par sobrevivente tem exatamente
-- a mesma definição.
--
-- `DROP INDEX` simples, sem `CONCURRENTLY`: as tabelas são pequenas (a maior tem centenas
-- de linhas) e o `CONCURRENTLY` não pode rodar dentro de bloco de transação, que é como
-- esta migration é aplicada. O lock é de microssegundos.
--
-- Num ambiente recriado do zero, as migrations rodam em ordem: o schema base cria o curto,
-- as correções de RLS criam o longo, e esta aqui — a última — remove o longo. Estado final
-- idêntico ao de produção. Por isso nenhum arquivo antigo foi editado (ver "uma migration
-- aplicada, um arquivo" no CLAUDE.md).

drop index if exists public.idx_auditoria_tenant_id;
drop index if exists public.idx_contas_bancarias_tenant_id;
drop index if exists public.idx_despesas_tenant_id;
drop index if exists public.idx_fornecedores_tenant_id;
drop index if exists public.idx_notificacoes_tenant_id;
drop index if exists public.idx_parcelas_pagar_tenant_id;
drop index if exists public.idx_parcelas_receber_tenant_id;
drop index if exists public.idx_receitas_tenant_id;
drop index if exists public.idx_requisicoes_tenant_id;
