-- Vincula o associado Pessoa Juridica a empresa conveniada, que e uma linha de `fornecedores`.
--
-- A coluna ja existia no TypeScript e no formulario desde antes desta migration, mas nao no
-- banco: `saveAssociado` e a fila de sync desestruturavam `fornecedor_id` para FORA do payload,
-- entao o operador escolhia a empresa, salvava, a tela dizia sucesso e o vinculo nunca existia.

-- Lado referenciado: a FK composta precisa de uma unicidade que inclua o tenant.
-- `fornecedores` so tinha PRIMARY KEY (id); a definicao abaixo e diferente, nao e indice duplicado.
alter table public.fornecedores
  add constraint fornecedores_tenant_id_uk unique (tenant_id, id);

alter table public.associados
  add column if not exists fornecedor_id uuid;

comment on column public.associados.fornecedor_id is
  'Empresa conveniada a qual o associado Pessoa Juridica esta vinculado. Aponta para uma linha de '
  '`fornecedores` (na pratica, da categoria "Convenios Associados"). Nulo para tipo_pessoa = ''PF''. '
  'A obrigatoriedade para PJ e do formulario, nao da coluna: a regra e sobre o preenchimento, nao '
  'sobre a linha, e um NOT NULL/CHECK quebraria o cadastro PF no primeiro UPDATE.';

-- FK COMPOSTA com tenant_id: uma FK simples por `id` garantiria so que a linha existe, e apontar
-- para empresa conveniada de OUTRA empresa passaria no banco em silencio. Verificado em transacao
-- revertida antes desta migration: com a chave composta essa tentativa leva 23503.
-- ON DELETE RESTRICT porque excluir a conveniada nao pode desfazer o vinculo dos associados dela.
alter table public.associados
  add constraint associados_fornecedor_fk
  foreign key (tenant_id, fornecedor_id) references public.fornecedores (tenant_id, id)
  on update cascade on delete restrict;

-- Cobertura para a FK (o advisor cobra FK composta sem indice). Parcial porque a esmagadora
-- maioria dos associados e PF e nunca tera valor aqui. Conferido em pg_indexes por DEFINICAO:
-- nenhum indice existente de `associados` cobre (tenant_id, fornecedor_id).
create index if not exists idx_associados_tenant_fornecedor
  on public.associados (tenant_id, fornecedor_id)
  where fornecedor_id is not null;
