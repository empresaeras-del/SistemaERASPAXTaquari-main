import { test, expect, entrar, irPara, contraODuble } from './apoio/sessao';
import { cpfValido } from './apoio/documentos';
import {
  abrirAssociadoParaEditar,
  destravarNavegacao,
  irParaAba,
  irParaSubAba,
} from './apoio/formularioDeAssociado';
import { ASSOCIADO_JOAO, EMPRESA_PAX } from './apoio/dadosDeHomologacao';

/**
 * Linha de base do formulário de associado no caminho de EDIÇÃO.
 *
 * `cadastrar-associado.spec.ts` cobre o cadastro novo — formulário vazio, etapas em sequência,
 * três das oito abas. Este arquivo cobre o que aquele não alcança e o que uma decomposição de
 * `AssociadoFormModal.tsx` mexe: o cabeçalho de identidade que acompanha todas as abas, as cinco
 * sub-abas de Dados Principais com valor gravado dentro, a lista de dependentes, o widget do
 * contrato ativo, e o payload que sai ao salvar uma alteração.
 *
 * **Ele foi escrito contra o arquivo monolítico e passou nele antes de qualquer extração.** Sem
 * essa ordem, uma suíte verde no fim não distingue "nada quebrou" de "o teste não mede nada".
 */

test('o cabeçalho identifica o cadastro em todas as abas', async ({ sessao: { page } }) => {
  await entrar(page);
  await irPara(page, '/associados');

  const modal = await abrirAssociadoParaEditar(page, 'MARIA APARECIDA DA SILVA');

  await expect(modal).toContainText('MARIA APARECIDA DA SILVA');
  await expect(modal).toContainText('000.000.000-01');
  await expect(modal).toContainText('Plano Familiar');
  await expect(modal).toContainText(/\d+ anos/);

  // Três cliques adiante, nada na tela dizia de quem era o cadastro aberto — é o defeito que
  // o cabeçalho existe para fechar, e por isso a asserção o procura DEPOIS de trocar de aba.
  await destravarNavegacao(page, cpfValido());
  await irParaAba(page, 'Dependentes');
  await expect(modal).toContainText('Dependentes do Associado');
  await expect(modal).toContainText('MARIA APARECIDA DA SILVA');
  await expect(modal).toContainText('Plano Familiar');

  await irParaAba(page, 'Contratos');
  await expect(modal).toContainText('Contratos do Associado');
  await expect(modal).toContainText('MARIA APARECIDA DA SILVA');
});

test('as cinco sub-abas de Dados Principais trazem o que está gravado', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/associados');

  await abrirAssociadoParaEditar(page, 'MARIA APARECIDA DA SILVA');

  // Cada sub-aba é conferida por um campo que só existe nela, e a asserção exige que ele
  // esteja VISÍVEL, não só presente: a seção inativa é `hidden`, não desmontada, então um
  // `toHaveValue` sozinho passaria mesmo se o clique na sub-aba não fizesse nada — o teste
  // afirmaria ter navegado sem ter navegado.
  const campoVisivelCom = async (placeholder: string, valor: string) => {
    const campo = page.getByPlaceholder(placeholder);
    await expect(campo).toBeVisible();
    await expect(campo).toHaveValue(valor);
  };

  await campoVisivelCom('Digite o nome completo', 'MARIA APARECIDA DA SILVA');

  await irParaSubAba(page, 'Filiação');
  await expect(page.getByPlaceholder('Nome da mãe')).toBeVisible();
  await expect(page.getByPlaceholder('Digite o nome completo')).toBeHidden();

  await irParaSubAba(page, 'Contato');
  await campoVisivelCom('(00) 00000-0000', '(67) 99999-0001');

  await irParaSubAba(page, 'Endereço');
  await campoVisivelCom('Rua, Avenida, Alameda, Travessa...', 'RUA DAS FLORES');
  await campoVisivelCom('Nome do bairro', 'CENTRO');

  await irParaSubAba(page, 'Informações do Sistema');
  await expect(page.locator('#associado-form').getByText('Data de Adesão')).toBeVisible();
  await expect(page.getByPlaceholder('Nome do bairro')).toBeHidden();
});

test('a aba de dependentes lista os dependentes do titular, com a contagem de vidas', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/associados');

  const modal = await abrirAssociadoParaEditar(page, 'MARIA APARECIDA DA SILVA');
  await destravarNavegacao(page, cpfValido());
  await irParaAba(page, 'Dependentes');

  await expect(modal).toContainText('Dependentes do Associado');
  await expect(modal).toContainText('2 cadastrado(s)');
  // 1 titular + 2 dependentes. O número é o que vira `n_vidas` e entra no valor do plano.
  await expect(modal).toContainText('3 vidas');

  await expect(modal).toContainText('PEDRO DA SILVA');
  await expect(modal).toContainText('CARLOS DA SILVA');
});

test('a aba de contratos mostra o contrato ativo com plano e valor', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/associados');

  const modal = await abrirAssociadoParaEditar(page, 'JOAO BATISTA SOUZA');
  await destravarNavegacao(page, cpfValido());
  await irParaAba(page, 'Contratos');

  await expect(modal).toContainText('Contratos do Associado');
  await expect(modal).toContainText('ATIVO');
  await expect(modal).toContainText('Tipo de Pessoa');

  // `toContainText('Plano Individual')` no modal inteiro NÃO prova nada aqui: o cabeçalho de
  // identidade imprime o mesmo nome em todas as abas, e o teste passava com o widget exibindo
  // "Nenhum Plano Selecionado". As duas asserções abaixo só existem dentro do widget.
  await expect(modal).not.toContainText('Nenhum Plano Selecionado');
  await expect(modal).toContainText('Valor: R$ 60,00');
});

/**
 * O titular aqui é JOÃO, e a escolha é obrigatória, não estética: `handleSave` recusa o
 * cadastro quando **qualquer dependente** tem CPF inválido, e os dois dependentes de MARIA
 * têm CPF sem dígito verificador na semente. Salvá-la exigiria corrigir três documentos para
 * exercitar um campo — e o teste passaria a falar sobre a semente, não sobre o save.
 */
test('salvar uma alteração manda o campo mudado — e nenhuma coluna legada', async ({
  sessao: { page, servidor },
}) => {
  const cpf = cpfValido();

  await entrar(page);
  await irPara(page, '/associados');

  await abrirAssociadoParaEditar(page, 'JOAO BATISTA SOUZA');
  await destravarNavegacao(page, cpf);

  await irParaSubAba(page, 'Contato');
  await page.getByPlaceholder('(00) 00000-0000').fill('(67) 98888-7777');

  await page.getByRole('button', { name: /Salvar Alterações/i }).click();
  await expect(page.locator('.fixed.inset-0')).toHaveCount(0, { timeout: 30_000 });

  test.skip(!contraODuble, 'as asserções de payload só valem contra o dublê');

  const gravado = servidor!.linhas('associados').find((a) => a.id === ASSOCIADO_JOAO);
  expect(gravado, 'o associado sumiu do servidor depois do save').toBeTruthy();

  // 1. O campo editado chegou. Um save que devolve "sucesso" sem o campo é a classe de
  //    defeito que este repositório já teve três vezes (o `fornecedor_id` desestruturado
  //    para fora, o `plano_pax_id` anulado no retry, a senha descartada em silêncio).
  expect(gravado!.telefone).toBe('(67) 98888-7777');
  expect(gravado!.cpf).toBe(cpf);

  // 2. Editar não pode trocar a empresa do cadastro — é a variante que ESCONDE.
  expect(gravado!.tenant_id).toBe(EMPRESA_PAX);
  expect(['default_tenant', 'empresa_padrao', 'all', 'emp-001', 'default', 'system'])
    .not.toContain(gravado!.tenant_id);

  // 3. Editar também não pode perder o que não foi tocado: o plano e o nome continuam lá
  //    depois de um save disparado a partir de outra sub-aba.
  expect(gravado!.plano_nome).toBe('Plano Individual');
  expect(gravado!.nome).toBe('JOAO BATISTA SOUZA');
  expect(gravado!.endereco_logradouro).toBe('AVENIDA BRASIL');

  const LEGADAS = ['logradouro', 'numero', 'bairro', 'cidade', 'cep', 'uf', 'plano_id'];
  for (const escrita of servidor!.escritasEm('associados')) {
    const corpo = Array.isArray(escrita.payload) ? escrita.payload : [escrita.payload];
    for (const linha of corpo) {
      for (const legada of LEGADAS) {
        expect(Object.keys(linha ?? {}), `payload com a coluna legada "${legada}"`)
          .not.toContain(legada);
      }
    }
  }
});
