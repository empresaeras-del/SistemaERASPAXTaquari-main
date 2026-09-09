-- Fase 4, parte 3: semeia os centros de custo de cada empresa e liga as despesas existentes.
--
-- Duas fontes, nesta ordem:
--   1. os textos que **de fato** aparecem em `despesas.centro_custo` — é o que a empresa já
--      usou, e o que precisa continuar resolvendo depois que a coluna virar id;
--   2. a lista modelo que o frontend oferecia em `defaultCentrosCusto`, para a empresa não
--      abrir a tela num select vazio.
--
-- O código é derivado do nome (maiúsculas, sem acento, espaço vira hífen) em vez de numérico:
-- centro de custo não tem hierarquia como o plano de contas, então um código legível vale
-- mais que uma sequência. `on conflict do nothing` deixa a migration idempotente e respeita
-- a empresa que já tiver criado o centro à mão.

-- ── 1. Centros que as despesas já usam ──────────────────────────────────────────────────
insert into public.centros_custo (tenant_id, codigo, nome)
select distinct
       d.tenant_id,
       upper(translate(btrim(d.centro_custo), ' áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ/',
                                              '-aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC-')),
       btrim(d.centro_custo)
  from public.despesas d
 where d.centro_custo is not null and btrim(d.centro_custo) <> ''
on conflict (tenant_id, nome) do nothing;

-- ── 2. Lista modelo, para cada empresa que já tem plano de contas montado ───────────────
-- Só para essas: uma empresa que ainda não usa o módulo financeiro não precisa da lista.
insert into public.centros_custo (tenant_id, codigo, nome)
select p.tenant_id, m.codigo, m.nome
  from (select distinct tenant_id from public.planos_contabeis where deleted_at is null) p
 cross join (values
   ('REDE-ASSISTENCIAL', 'Rede Assistencial'),
   ('FUNERARIA',         'Funerária'),
   ('CEMITERIO',         'Cemitério'),
   ('ADMINISTRATIVO',    'Administrativo'),
   ('FINANCEIRO',        'Financeiro'),
   ('COMERCIAL-VENDAS',  'Comercial / Vendas')
 ) as m(codigo, nome)
on conflict (tenant_id, nome) do nothing;

-- ── 3. Liga as despesas existentes ao centro correspondente ─────────────────────────────
update public.despesas d
   set centro_custo_id = c.id
  from public.centros_custo c
 where d.centro_custo_id is null
   and c.tenant_id = d.tenant_id
   and c.nome = btrim(d.centro_custo);
