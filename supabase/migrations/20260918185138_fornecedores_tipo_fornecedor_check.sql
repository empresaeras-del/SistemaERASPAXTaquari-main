-- O "Gerenciar" do campo Tipo de Fornecimento deixava o operador acrescentar um valor novo à
-- lista, e essa lista vivia no `localStorage` do navegador. Ao contrário das categorias — que
-- viraram tabela na migration `20260918010924` —, aqui **não há catálogo a manter**: os três
-- valores têm rótulo cravado no JSX (`produtos`/`servicos`/`ambos`), e um quarto valor nasceria
-- sem rótulo, sem filtro e sem ninguém para exibi-lo. A correção é tirar a ação.
--
-- Esta migration é a outra metade: **esconder o botão é conveniência; a recusa mora no ponto de
-- escrita.** Sem o CHECK, a coluna continuaria aceitando qualquer texto pela fila de sync, por um
-- bundle antigo em cache de service worker ou por qualquer chamador novo.
--
-- Ao contrário do CHECK de `status` (migration `20260918010947`), este não é uma correção de
-- domínio que a tela já oferecia: é o domínio que o TypeScript sempre declarou
-- (`TipoFornecedor = 'produtos' | 'servicos' | 'ambos'`) passando a valer também no banco.
--
-- `NULL` continua passando — a coluna é nullable e um `CHECK` é satisfeito quando a expressão é
-- nula, como nos outros dois desta tabela. Ensaiado em transação revertida antes de aplicar: os
-- três valores passam, `'qualquer coisa'` leva `23514`, `NULL` passa, e as 2 linhas existentes
-- (ambas `servicos`) validam sob a constraint.

alter table public.fornecedores
  drop constraint if exists fornecedores_tipo_fornecedor_check;
alter table public.fornecedores
  add constraint fornecedores_tipo_fornecedor_check
  check (tipo_fornecedor = any (array['produtos'::text, 'servicos'::text, 'ambos'::text]));

comment on column public.fornecedores.tipo_fornecedor is
  'Dominio fechado: produtos | servicos | ambos. Os rotulos vivem em config/tiposFornecimento.config.ts; acrescentar um valor aqui exige acrescentar o rotulo la, senao ele aparece sem nome na tela.';
