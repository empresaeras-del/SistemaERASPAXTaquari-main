-- Semeia as categorias de cada empresa e liga os fornecedores existentes.
--
-- Duas fontes, nesta ordem:
--   1. os textos que **de fato** aparecem em `fornecedores.categoria` — é o que a empresa já
--      usou, e o que precisa continuar resolvendo depois que a coluna ganhar id;
--   2. a lista modelo que o frontend oferecia (`defaultCategoriasList`), para nenhuma empresa
--      abrir o formulário num select vazio.
--
-- **O que esta migration NÃO consegue trazer**: uma categoria que alguém criou pelo
-- "Gerenciar" e nunca usou em fornecedor nenhum. Ela existia só no localStorage daquele
-- navegador, fora do alcance do SQL — e, por definição, era invisível para todo o resto da
-- empresa. É perda aceitável justamente porque ninguém além daquele navegador a enxergava.
--
-- O código é derivado do nome pela **mesma regra** de `codigoDeNome()` no frontend (sem
-- acento, maiúsculas, corrida de símbolo vira um hífen só, sem hífen nas pontas). Divergir
-- faria o app criar categoria duplicada em vez de reaproveitar a que esta migration criou —
-- foi a lição de `codigoDeCentroCusto`. `on conflict do nothing` deixa a migration idempotente.

-- ── 1. Categorias que os fornecedores já usam ───────────────────────────────────────────
insert into public.categorias_fornecedor (tenant_id, codigo, nome)
select distinct
       f.tenant_id,
       coalesce(nullif(btrim(regexp_replace(
         upper(translate(btrim(f.categoria),
                         'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                         'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
         '[^A-Z0-9]+', '-', 'g'), '-'), ''), 'CATEGORIA'),
       btrim(f.categoria)
  from public.fornecedores f
 where f.categoria is not null and btrim(f.categoria) <> ''
on conflict (tenant_id, nome) do nothing;

-- ── 2. Lista modelo, para toda empresa ──────────────────────────────────────────────────
-- Toda empresa, e não só as que já têm fornecedor: a lista é o catálogo de partida, e uma
-- empresa sem nenhuma linha aqui cairia no fallback do frontend — que funciona, mas deixaria
-- a empresa sem poder gerenciar a própria lista.
insert into public.categorias_fornecedor (tenant_id, codigo, nome)
select t.tenant_id,
       coalesce(nullif(btrim(regexp_replace(
         upper(translate(m.nome,
                         'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                         'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
         '[^A-Z0-9]+', '-', 'g'), '-'), ''), 'CATEGORIA'),
       m.nome
  from (
        select id::text as tenant_id from public.tenants
        union
        select distinct tenant_id from public.fornecedores
       ) t
 cross join (values
   ('Convenios Associados'),
   ('Urnas e Caixões'),
   ('Floricultura e Coroas'),
   ('Marmoraria e Lápides'),
   ('Translado e Veículos'),
   ('Equipamentos Médicos'),
   ('Tanatopraxia e Insumos'),
   ('Cemitério e Crematório'),
   ('Gráfica e Impressões'),
   ('Manutenção e Conservação'),
   ('Tecnologia e Sistemas'),
   ('Outros')
 ) as m(nome)
on conflict (tenant_id, nome) do nothing;

-- ── 3. Liga os fornecedores existentes à categoria correspondente ───────────────────────
update public.fornecedores f
   set categoria_id = c.id
  from public.categorias_fornecedor c
 where f.categoria_id is null
   and c.tenant_id = f.tenant_id
   and c.nome = btrim(f.categoria);
