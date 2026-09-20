-- A co-participação por procedimento existia no TypeScript e na tela desde sempre, e NUNCA
-- teve coluna: `credenciados_procedimentos` só tem `valor`. O hook mandava
-- `valor_exclusivo` + `valor_coparticipacao` no upsert, levava `PGRST204` em TODA gravação, e
-- o "fallback" reenviava sem as duas — a co-participação que o operador digitava ficava só no
-- IndexedDB do navegador dele. É a terceira ocorrência do "campo no TypeScript sem a coluna no
-- banco" que o CLAUDE.md documenta, e a primeira que estava disparando em produção.
--
-- Opção escolhida: criar SÓ `valor_coparticipacao`. `valor_exclusivo` fica de fora de
-- propósito — o hook já grava o valor exclusivo em `valor`, e criar as duas reintroduziria
-- exatamente o par de colunas duplicadas que a migration 20260915132838 acabou de eliminar.
alter table public.credenciados_procedimentos
  add column if not exists valor_coparticipacao numeric not null default 0;

comment on column public.credenciados_procedimentos.valor_coparticipacao is
  'Valor de co-participação do associado neste procedimento, neste credenciado. É ele que vira conta a receber quando a guia é emitida (ver receitas.requisicao_id). As 29 linhas anteriores a 20/09/2026 ficaram em 0 porque a coluna não existia e o valor nunca chegou ao servidor — não é "sem co-participação", é "nunca gravado".';

comment on column public.credenciados_procedimentos.valor is
  'Valor exclusivo acordado do procedimento neste credenciado. É a coluna canônica do preço — o app envia `valor_exclusivo` do formulário para cá. Não crie uma coluna `valor_exclusivo` ao lado desta.';
