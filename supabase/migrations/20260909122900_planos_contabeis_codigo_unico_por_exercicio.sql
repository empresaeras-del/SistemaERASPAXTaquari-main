-- Correção da migration anterior (`planos_contabeis_por_exercicio`), que ficou incompleta.
--
-- Aquela migration soltou a unicidade do *plano ativo* para (tenant, exercício), mas deixou
-- de pé `planos_contabeis_codigo_uk unique (tenant_id, codigo)`. Com ela, duplicar o plano
-- "PADRAO" de 2026 para 2027 falharia na hora do insert — o código repetiria dentro da mesma
-- empresa. Ou seja: a feature que a migration anterior anunciava não funcionava de ponta a
-- ponta. Arquivo separado de propósito (ver CLAUDE.md, "uma migration aplicada, um arquivo"):
-- editar o arquivo anterior faria ele mentir sobre o que aplicou, e apagaria a lição.
--
-- O código passa a identificar o plano **dentro do exercício**, que é o mesmo raciocínio do
-- índice de plano ativo: o que é único é o par (empresa, exercício).

alter table public.planos_contabeis
  drop constraint if exists planos_contabeis_codigo_uk;

alter table public.planos_contabeis
  add constraint planos_contabeis_codigo_exercicio_uk
  unique (tenant_id, exercicio, codigo);

comment on constraint planos_contabeis_codigo_exercicio_uk on public.planos_contabeis is
  'O codigo identifica o plano dentro do exercicio. Sem o exercicio na chave, duplicar o plano do ano anterior colidiria com ele mesmo.';
