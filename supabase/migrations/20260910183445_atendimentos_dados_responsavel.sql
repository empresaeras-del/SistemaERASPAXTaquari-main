-- Dados do responsável pelo falecido, no próprio atendimento.
--
-- Todas nullable de propósito: a obrigatoriedade vale para atendimento de cliente
-- EXTERNO criado a partir de agora, e um NOT NULL vale para a linha, não para o
-- instante em que ela nasceu — quebraria os atendimentos já existentes no primeiro
-- UPDATE (mesma decisão da fase 3 do plano contábil). A exigência vive no schema Zod,
-- no ponto de escrita.
alter table public.atendimentos
  add column if not exists responsavel_nome text,
  add column if not exists responsavel_cpf text,
  add column if not exists responsavel_rg text,
  add column if not exists responsavel_parentesco text,
  add column if not exists responsavel_endereco text,
  add column if not exists responsavel_contato text,
  add column if not exists responsavel_nacionalidade text,
  add column if not exists responsavel_observacoes text;

comment on column public.atendimentos.responsavel_nome is
  'Nome completo de quem responde pelo falecido. Em atendimento de associado vem preenchido do cadastro do titular; em cliente externo é obrigatório no formulário.';
comment on column public.atendimentos.responsavel_cpf is 'CPF do responsável, formatado 000.000.000-00.';
comment on column public.atendimentos.responsavel_rg is 'RG do responsável.';
comment on column public.atendimentos.responsavel_parentesco is 'Parentesco ou vínculo do responsável com o falecido (ex.: FILHO, CONJUGE, TITULAR DO PLANO).';
comment on column public.atendimentos.responsavel_endereco is 'Endereço completo do responsável, em uma linha. Quando vem do associado é montado a partir do par canônico endereco_*.';
comment on column public.atendimentos.responsavel_contato is 'Telefone/celular ou e-mail de contato do responsável.';
comment on column public.atendimentos.responsavel_nacionalidade is 'Nacionalidade do responsável. Não existe no cadastro de associados, então nunca é preenchida automaticamente.';
comment on column public.atendimentos.responsavel_observacoes is 'Observações livres sobre o responsável. Único campo do bloco que não é obrigatório para cliente externo.';
