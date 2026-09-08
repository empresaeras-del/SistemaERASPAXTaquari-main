-- CNPJ/CPF passa a ser opcional no cadastro de credenciados.
--
-- A coluna nasceu `NOT NULL` na primeira migration da tabela
-- (20260804120000_credenciados.sql) e ficou assim mesmo depois da
-- reescrita de schema de 17/08 — o arquivo daquela rodada declarava a coluna
-- sem `NOT NULL`, mas como a tabela já existia, o `CREATE TABLE` daquele
-- arquivo era inerte para ela; a restrição real, em produção, nunca mudou.
-- Confirmado consultando a coluna ao vivo antes desta migration.
--
-- O pedido de negócio: alguns prestadores (pessoa física sem CPF cadastrado
-- no sistema de origem, ou credenciamento em andamento) não têm o documento
-- no momento do cadastro. Antes disso, o formulário obrigava um valor —
-- então quem não tinha o documento em mãos não conseguia salvar o cadastro
-- de jeito nenhum, mesmo que todos os outros dados já estivessem prontos.
--
-- A tabela mantém `UNIQUE (cnpj_cpf)`, propositalmente: dois credenciados
-- com o mesmo documento continuam sendo rejeitados. Isso funciona sem
-- ressalva nenhuma com a coluna opcional — o Postgres trata cada `NULL` como
-- distinto dos demais para fins de unicidade, então vários credenciados sem
-- documento coexistem normalmente. O que muda no frontend, em decorrência
-- direta desta migration: salvar `null` (não `''`) quando o campo fica em
-- branco — uma string vazia colidiria com a próxima string vazia pela mesma
-- UNIQUE, e o segundo cadastro sem documento falharia com uma mensagem que
-- pareceria dizer que já existe um credenciado igual, quando não existe.
ALTER TABLE public.credenciados ALTER COLUMN cnpj_cpf DROP NOT NULL;

COMMENT ON COLUMN public.credenciados.cnpj_cpf IS
  'Documento do credenciado (CPF ou CNPJ). Opcional desde 08/09/2026 — '
  'salve NULL quando ausente, nunca string vazia: a coluna tem UNIQUE, e '
  'duas strings vazias colidiriam entre si (NULLs não colidem).';
