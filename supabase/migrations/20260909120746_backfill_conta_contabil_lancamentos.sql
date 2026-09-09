-- Fase 3 do plano contábil, parte 2: classifica o legado.
--
-- Ordem de resolução, do sinal mais forte para o mais fraco:
--   1. nome da conta igual à `categoria` (respeita a empresa que renomeou a conta);
--   2. mapa de sinônimos das categorias que o sistema oferecia em `useOptions`;
--   3. conta de sobra da natureza (3.2.02 Outras Receitas / 4.9.01 Despesas Diversas);
--   4. primeira conta analítica da natureza, se a empresa apagou até a conta de sobra.
-- Sem candidata em nenhum dos quatro passos, a linha fica sem conta — é o que acontece com
-- a empresa que ainda não montou plano, e é justamente o caso que o trigger da parte 3 isenta.
--
-- Comparação é feita sem acento e sem caixa; `categoria` é texto livre digitado ao longo de
-- meses, então bater string crua erraria por "Serviço"/"Servico".

-- ── Receitas ────────────────────────────────────────────────────────────────────────────
with contas as (
  select c.id, c.tenant_id, c.codigo, c.natureza,
         translate(lower(btrim(c.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as nome_norm
  from public.contas_contabeis c
  join public.planos_contabeis p on p.id = c.plano_id and p.tenant_id = c.tenant_id
  where c.tipo = 'analitica' and c.ativo and c.deleted_at is null
    and p.ativo and p.deleted_at is null
),
sinonimos (cat_norm, codigo) as (values
  ('mensalidade','3.1.01'), ('mensalidades','3.1.01'), ('mensalidade de plano','3.1.01'),
  ('mensalidades de plano','3.1.01'), ('receita / mensalidade','3.1.01'), ('recebimento','3.1.01'),
  ('taxa de adesao','3.1.02'), ('adesao','3.1.02'),
  ('servico extra','3.1.03'), ('servicos extras','3.1.03'), ('servico adicional','3.1.03'),
  ('servicos adicionais','3.1.03'), ('co-participacao','3.1.03'), ('coparticipacao','3.1.03'),
  ('servico funerario','3.1.04'), ('servicos funerarios','3.1.04'), ('funeral avulso','3.1.04'),
  ('rendimento','3.2.01'), ('rendimentos','3.2.01'),
  ('outro','3.2.02'), ('outros','3.2.02'), ('outras receitas','3.2.02')
),
alvo as (
  select r.id as linha_id, r.tenant_id,
         translate(lower(btrim(r.categoria)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as cat_norm
  from public.receitas r
  where r.conta_contabil_id is null
)
update public.receitas r
   set conta_contabil_id = escolha.conta_id
  from (
    select a.linha_id,
           coalesce(
             (select c.id from contas c
               where c.tenant_id = a.tenant_id and c.natureza = 'receita' and c.nome_norm = a.cat_norm
               order by c.codigo limit 1),
             (select c.id from contas c join sinonimos s on s.codigo = c.codigo
               where c.tenant_id = a.tenant_id and c.natureza = 'receita' and s.cat_norm = a.cat_norm
               order by c.codigo limit 1),
             (select c.id from contas c
               where c.tenant_id = a.tenant_id and c.natureza = 'receita' and c.codigo = '3.2.02' limit 1),
             (select c.id from contas c
               where c.tenant_id = a.tenant_id and c.natureza = 'receita' order by c.codigo limit 1)
           ) as conta_id
    from alvo a
  ) escolha
 where escolha.linha_id = r.id and escolha.conta_id is not null;

-- ── Despesas ────────────────────────────────────────────────────────────────────────────
with contas as (
  select c.id, c.tenant_id, c.codigo, c.natureza,
         translate(lower(btrim(c.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as nome_norm
  from public.contas_contabeis c
  join public.planos_contabeis p on p.id = c.plano_id and p.tenant_id = c.tenant_id
  where c.tipo = 'analitica' and c.ativo and c.deleted_at is null
    and p.ativo and p.deleted_at is null
),
sinonimos (cat_norm, codigo) as (values
  ('repasse','4.1.01'), ('repasse a credenciados','4.1.01'), ('credenciado','4.1.01'),
  ('credenciados','4.1.01'), ('faturamento credenciado','4.1.01'),
  ('fornecedor','4.1.02'), ('fornecedores','4.1.02'), ('material','4.1.02'), ('materiais','4.1.02'),
  ('servico de terceiros','4.1.03'), ('terceiros','4.1.03'),
  ('salario','4.2.01'), ('salarios','4.2.01'), ('folha','4.2.01'), ('folha de pagamento','4.2.01'),
  ('aluguel','4.2.02'),
  ('agua','4.2.03'), ('luz','4.2.03'), ('telefone','4.2.03'), ('energia','4.2.03'),
  ('material de escritorio','4.2.04'),
  ('manutencao','4.2.05'), ('conservacao','4.2.05'),
  ('combustivel','4.2.06'), ('transporte','4.2.06'),
  ('marketing','4.2.07'), ('publicidade','4.2.07'),
  ('imposto','4.3.01'), ('impostos','4.3.01'), ('tributos','4.3.01'), ('taxas','4.3.01'),
  ('tarifa bancaria','4.4.01'), ('tarifas bancarias','4.4.01'), ('tarifas','4.4.01'),
  ('juros','4.4.02'), ('multas','4.4.02'), ('juros e multa','4.4.02'),
  ('despesa / pagamento','4.9.01'), ('pagamento','4.9.01'), ('diversas','4.9.01'),
  ('outra despesa','4.9.01'), ('outro','4.9.01'), ('outros','4.9.01')
),
alvo as (
  select d.id as linha_id, d.tenant_id,
         translate(lower(btrim(d.categoria)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as cat_norm
  from public.despesas d
  where d.conta_contabil_id is null
)
update public.despesas d
   set conta_contabil_id = escolha.conta_id
  from (
    select a.linha_id,
           coalesce(
             (select c.id from contas c
               where c.tenant_id = a.tenant_id and c.natureza = 'despesa' and c.nome_norm = a.cat_norm
               order by c.codigo limit 1),
             (select c.id from contas c join sinonimos s on s.codigo = c.codigo
               where c.tenant_id = a.tenant_id and c.natureza = 'despesa' and s.cat_norm = a.cat_norm
               order by c.codigo limit 1),
             (select c.id from contas c
               where c.tenant_id = a.tenant_id and c.natureza = 'despesa' and c.codigo = '4.9.01' limit 1),
             (select c.id from contas c
               where c.tenant_id = a.tenant_id and c.natureza = 'despesa' order by c.codigo limit 1)
           ) as conta_id
    from alvo a
  ) escolha
 where escolha.linha_id = d.id and escolha.conta_id is not null;

-- ── Movimentações de caixa ──────────────────────────────────────────────────────────────
-- Suprimento e sangria ficam de fora de propósito: são transferência de numerário entre
-- caixa e banco, não receita nem despesa. Classificá-las inflaria o resultado do exercício.
with contas as (
  select c.id, c.tenant_id, c.codigo, c.natureza,
         translate(lower(btrim(c.nome)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as nome_norm
  from public.contas_contabeis c
  join public.planos_contabeis p on p.id = c.plano_id and p.tenant_id = c.tenant_id
  where c.tipo = 'analitica' and c.ativo and c.deleted_at is null
    and p.ativo and p.deleted_at is null
),
sinonimos (cat_norm, natureza, codigo) as (values
  ('mensalidade','receita','3.1.01'), ('mensalidades','receita','3.1.01'),
  ('receita / mensalidade','receita','3.1.01'), ('recebimento','receita','3.1.01'),
  ('taxa de adesao','receita','3.1.02'),
  ('servico extra','receita','3.1.03'), ('servicos extras','receita','3.1.03'),
  ('outro','receita','3.2.02'), ('outros','receita','3.2.02'),
  ('despesa / pagamento','despesa','4.9.01'), ('pagamento','despesa','4.9.01'),
  ('fornecedor','despesa','4.1.02'), ('fornecedores','despesa','4.1.02'),
  ('servico de terceiros','despesa','4.1.03'),
  ('outra despesa','despesa','4.9.01'), ('diversas','despesa','4.9.01')
),
alvo as (
  select m.id as linha_id, m.tenant_id, m.natureza_contabil,
         translate(lower(btrim(m.categoria)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as cat_norm
  from public.movimentacoes_caixa m
  where m.conta_contabil_id is null
    and m.origem not in ('suprimento', 'sangria')
)
update public.movimentacoes_caixa m
   set conta_contabil_id = escolha.conta_id
  from (
    select a.linha_id,
           coalesce(
             (select c.id from contas c
               where c.tenant_id = a.tenant_id and c.natureza = a.natureza_contabil and c.nome_norm = a.cat_norm
               order by c.codigo limit 1),
             (select c.id from contas c join sinonimos s on s.codigo = c.codigo and s.natureza = c.natureza
               where c.tenant_id = a.tenant_id and c.natureza = a.natureza_contabil and s.cat_norm = a.cat_norm
               order by c.codigo limit 1),
             (select c.id from contas c
               where c.tenant_id = a.tenant_id and c.natureza = a.natureza_contabil
                 and c.codigo = case when a.natureza_contabil = 'receita' then '3.2.02' else '4.9.01' end limit 1),
             (select c.id from contas c
               where c.tenant_id = a.tenant_id and c.natureza = a.natureza_contabil order by c.codigo limit 1)
           ) as conta_id
    from alvo a
  ) escolha
 where escolha.linha_id = m.id and escolha.conta_id is not null;
