-- Completa as colunas de óbito que já existem na interface TypeScript Atendimento mas nunca
-- chegaram ao schema real — sem elas, as variáveis de documento do óbito (declaração, médico,
-- tanatopraxia etc.) nunca eram preenchidas na prática. Achado alto do Diagnóstico ERAS PAX (Fase 1).
ALTER TABLE public.atendimentos
  ADD COLUMN IF NOT EXISTS sexo_falecido text,
  ADD COLUMN IF NOT EXISTS cor_falecido text,
  ADD COLUMN IF NOT EXISTS etnia text,
  ADD COLUMN IF NOT EXISTS local_obito text,
  ADD COLUMN IF NOT EXISTS hora_obito text,
  ADD COLUMN IF NOT EXISTS declaracao_obito text,
  ADD COLUMN IF NOT EXISTS numero_do text,
  ADD COLUMN IF NOT EXISTS medico_responsavel text,
  ADD COLUMN IF NOT EXISTS crm_medico text,
  ADD COLUMN IF NOT EXISTS rqe_medico text,
  ADD COLUMN IF NOT EXISTS inicio_tanato text,
  ADD COLUMN IF NOT EXISTS termino_tanato text;

COMMENT ON COLUMN public.atendimentos.sexo_falecido IS 'Sexo do falecido registrado no atendimento';
COMMENT ON COLUMN public.atendimentos.cor_falecido IS 'Cor/raça do falecido';
COMMENT ON COLUMN public.atendimentos.etnia IS 'Etnia do falecido (alias/complemento de cor_falecido)';
COMMENT ON COLUMN public.atendimentos.local_obito IS 'Local onde ocorreu o óbito';
COMMENT ON COLUMN public.atendimentos.hora_obito IS 'Horário do falecimento';
COMMENT ON COLUMN public.atendimentos.declaracao_obito IS 'Número da declaração/certidão de óbito';
COMMENT ON COLUMN public.atendimentos.numero_do IS 'Número da DO (alias de declaracao_obito em alguns modelos de documento)';
COMMENT ON COLUMN public.atendimentos.medico_responsavel IS 'Nome do médico que atestou o óbito';
COMMENT ON COLUMN public.atendimentos.crm_medico IS 'CRM do médico responsável';
COMMENT ON COLUMN public.atendimentos.rqe_medico IS 'RQE do médico responsável';
COMMENT ON COLUMN public.atendimentos.inicio_tanato IS 'Horário de início da tanatopraxia';
COMMENT ON COLUMN public.atendimentos.termino_tanato IS 'Horário de término da tanatopraxia';
