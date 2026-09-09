-- O advisor unindexed_foreign_keys apontou contas_contabeis_pai_fk sem indice de cobertura.
-- A FK e composta — (tenant_id, plano_id, conta_pai_id) — e um indice so em (conta_pai_id)
-- nao serve: o indice de cobertura precisa ter as colunas da FK como prefixo, na ordem.
--
-- A outra FK (contas_contabeis_plano_fk, sobre (tenant_id, plano_id)) ja estava coberta de
-- graca pela unique contas_contabeis_plano_id_uk (tenant_id, plano_id, id), que tem esse par
-- como prefixo — por isso o advisor nao reclamou dela.
--
-- O indice antigo por (conta_pai_id) sozinho e descartado junto: o app carrega as contas do
-- plano inteiras e monta a arvore em memoria, entao nunca busca filha sem saber o plano.

drop index if exists public.idx_contas_contabeis_pai;

create index if not exists idx_contas_contabeis_pai_fk
  on public.contas_contabeis (tenant_id, plano_id, conta_pai_id);

comment on index public.idx_contas_contabeis_pai_fk is
  'Cobertura da FK composta contas_contabeis_pai_fk. As colunas seguem a ordem da FK: sem isso, apagar ou atualizar uma conta faz seq scan para checar as filhas.';
