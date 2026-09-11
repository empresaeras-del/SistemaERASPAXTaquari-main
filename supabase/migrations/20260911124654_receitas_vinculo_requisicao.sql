-- Vínculo entre a receita de co-participação e a guia que a originou.
--
-- Existe para uma pergunta que a tela precisa responder ANTES de oferecer cobrança ao
-- reeditar uma guia: "esta requisição já gerou receita?". Sem o vínculo, a resposta só
-- existia no texto da descrição, que é frágil.

-- Lado referenciado: a unicidade que viabiliza a FK composta (ver CLAUDE.md,
-- "quando uma tabela nova referencia outra tabela multi-tenant, use FK composta").
alter table public.requisicoes
  add constraint requisicoes_tenant_id_uk unique (tenant_id, id);

alter table public.receitas
  add column if not exists requisicao_id uuid;

comment on column public.receitas.requisicao_id is
  'Guia de requisição que originou esta receita de co-participação. NULL para receita de qualquer outra origem. Usado para avisar o operador, ao reeditar a guia, que ela já tem cobrança.';

-- FK composta carregando o tenant: uma FK simples por id garantiria só que a linha
-- existe, e apontar para guia de outra empresa passaria em silêncio.
--
-- `ON DELETE SET NULL (requisicao_id)` — e não RESTRICT — porque a exclusão de guia
-- neste sistema é hard delete: RESTRICT faria o operador esbarrar num erro de FK que a
-- tela não sabe explicar. A receita é registro financeiro e não pode sumir junto com a
-- guia; perder o vínculo é a consequência certa. A lista de colunas é obrigatória aqui:
-- sem ela o Postgres tentaria anular também `tenant_id`, que é NOT NULL, e a exclusão
-- falharia — exatamente o que se queria evitar.
alter table public.receitas
  add constraint receitas_requisicao_fk
  foreign key (tenant_id, requisicao_id)
  references public.requisicoes (tenant_id, id)
  on delete set null (requisicao_id);

-- Índice de cobertura para a FK e para a consulta "receitas desta guia".
create index if not exists idx_receitas_requisicao
  on public.receitas (tenant_id, requisicao_id);
