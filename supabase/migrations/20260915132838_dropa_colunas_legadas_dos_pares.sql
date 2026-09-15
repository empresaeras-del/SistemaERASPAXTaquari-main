-- Passo 4 do plano de deprecacao dos pares duplicados (ver CLAUDE.md).
-- Dropa as 10 colunas LEGADAS; as 10 canonicas ficam.
--
-- Precondicoes verificadas em producao antes desta migration:
--   1. Nenhuma linha guarda dado so do lado legado (0 em cada um dos 10 pares).
--      Onde ha divergencia, o canonico e o mais novo -- em documentos_padroes o
--      atualizado_em canonico e >= updated_at legado nas 6 linhas.
--   2. Nenhum nome legado viaja ao servidor: os 424 hits de grep no src/ sao
--      nome canonico de OUTRA tabela (bairro/cidade/cep em credenciados etc.),
--      created_at de planos_pax/contratos, numero_parcela, e plano_id como FK
--      legitima de planos_pax_faixas/coberturas, credenciados_planos e
--      contas_contabeis. O que resta e fallback de leitura em objeto ja
--      carregado, que degrada para undefined sem erro.
--   3. Banco: 0 views, 0 indices, 0 constraints, 0 policies e 0 funcoes
--      referenciam as 10. O unico trigger das duas tabelas mexe em
--      associados.updated_at, que NAO esta nesta lista.
--   4. Logs (24h, 8.248 requisicoes, 303 em /associados e 49 em
--      /documentos_padroes): zero pedidos citando coluna legada.
--   5. A fila de sync ja desestrutura os 7 nomes legados de associados para
--      fora do payload (lib/syncService.ts) -- e o que impede um registro
--      antigo na fila de mandar coluna inexistente depois deste drop.

alter table public.associados
  drop column logradouro,
  drop column numero,
  drop column bairro,
  drop column cidade,
  drop column cep,
  drop column uf,
  drop column plano_id;

alter table public.documentos_padroes
  drop column conteudo_html,
  drop column created_at,
  drop column updated_at;

-- As legadas created_at/updated_at eram NOT NULL e as canonicas nao. Dropar sem
-- isto removeria em silencio a garantia de que todo documento tem data -- a
-- coluna canonica herda a constraint que a legada sustentava.
alter table public.documentos_padroes
  alter column criado_em set not null,
  alter column atualizado_em set not null;

comment on column public.associados.endereco_logradouro is
  'Canonico. O par legado (logradouro/numero/bairro/cidade/cep/uf) foi dropado em 15/09/2026.';
comment on column public.documentos_padroes.conteudo is
  'Canonico. O par legado (conteudo_html/created_at/updated_at) foi dropado em 15/09/2026.';
