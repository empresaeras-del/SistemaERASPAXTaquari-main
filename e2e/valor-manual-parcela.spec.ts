import { test, expect, entrar, irPara, contraODuble } from './apoio/sessao';
import { cpfValido, marcaDaRodada } from './apoio/documentos';
import {
  abrirAssociadoParaEditar,
  abrirNovoAssociado,
  avancarEtapa,
  destravarNavegacao,
  irParaAba,
  preencherDadosBasicos,
} from './apoio/formularioDeAssociado';
import { USUARIOS } from './apoio/dadosDeHomologacao';

/**
 * O campo "Valor Parcela (R$)" da geração de mensalidades deixou de ser só do admin.
 *
 * Ele aparece em dois caminhos, que são o mesmo campo em telas diferentes:
 *
 *  - **edição do associado** → aba Mensalidades → "Gerar Mensalidades"
 *    (`MensalidadesGeracaoWizard`);
 *  - **cadastro novo / contrato** → `NovoContratoWizard`, etapa "Prévia das Mensalidades".
 *
 * Os dois gatilhos estavam atrás de `isAdminOrSuperAdmin`, tanto na renderização do campo
 * quanto no predicado que faz o valor digitado substituir o cálculo do plano. Este arquivo
 * exercita os dois com um **gerente** — o nível que a semente traz abaixo de admin —, porque
 * um teste feito com admin passaria antes e depois da mudança e não mediria nada.
 */

/**
 * Da lista de associados até a prévia das parcelas, no caminho de EDIÇÃO.
 *
 * O associado da semente já tem 12 parcelas, então `handleAbrirGeracao` pergunta antes de
 * abrir o assistente — e a pergunta é parte do caminho do operador, não um detalhe a
 * contornar.
 */
const abrirGeracaoDeMensalidades = async (page: import('@playwright/test').Page) => {
  await irPara(page, '/associados');
  const modal = await abrirAssociadoParaEditar(page, 'MARIA APARECIDA DA SILVA');

  await destravarNavegacao(page, cpfValido());
  await irParaAba(page, 'Mensalidades');

  // `exact` porque o organograma também oferece "Gerar Mensalidades Agora" no estado vazio.
  await page.getByRole('button', { name: 'Gerar Mensalidades', exact: true }).click();
  await page.getByRole('button', { name: 'Prosseguir' }).click();

  await expect(modal.getByText('Geração de Mensalidades')).toBeVisible({ timeout: 20_000 });
  return modal;
};

/**
 * O valor de uma parcela na prévia, pelo rótulo acessível.
 *
 * A asserção é sempre sobre a **segunda** parcela: a primeira soma a taxa de adesão do plano,
 * então ela não é o valor digitado e usá-la esconderia um erro de base atrás da soma.
 */
const valorDaParcela = (modal: import('@playwright/test').Locator, numero: number) =>
  modal.getByLabel(`Valor da parcela ${numero}`, { exact: true });

test('gerente digita o valor da parcela na aba Mensalidades', async ({ sessao: { page } }) => {
  await entrar(page, USUARIOS.gerente);
  const modal = await abrirGeracaoDeMensalidades(page);

  // 1. O campo existe para quem não é admin. O `placeholder` é o que o identifica sem
  //    depender do rótulo: ele carrega o valor calculado do plano, que é o que o campo
  //    substitui.
  const campo = modal.locator('input[placeholder^="Auto (R$"]');
  await expect(campo).toBeVisible();
  await expect(campo).toBeEditable();

  // 2. A etiqueta "Admin" saiu junto: ela anunciava uma restrição que não existe mais, e
  //    deixá-la faria a tela mentir sobre quem pode usar o campo.
  await expect(modal.getByText('Valor Parcela (R$)')).toBeVisible();
  await expect(modal.getByText('Valor Parcela (R$)').locator('..').getByText('Admin')).toHaveCount(0);

  // 3. E digitar MUDA a projeção — é aqui que a permissão vira efeito. Sem esta asserção o
  //    teste provaria só que o campo está na tela, que é a metade barata da mudança: o
  //    predicado da projeção tinha o mesmo `isAdminOrSuperAdmin` na frente, então um campo
  //    visível com a projeção ainda travada passaria no item 1 e continuaria quebrado.
  await campo.fill('200');

  const segundaParcela = valorDaParcela(modal, 2);
  await expect(segundaParcela).toHaveValue('200', { timeout: 10_000 });

  // 4. "Restaurar" devolve o cálculo do plano — o caminho de volta precisa existir para quem
  //    digitou por engano.
  await modal.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect(campo).toHaveValue('');
  await expect(segundaParcela).not.toHaveValue('200', { timeout: 10_000 });
});

test('gerente digita o valor da parcela no cadastro novo, e ele chega ao servidor', async ({
  sessao: { page, servidor },
}) => {
  const nome = `TESTE VALOR MANUAL ${marcaDaRodada()}`;

  await entrar(page, USUARIOS.gerente);
  await irPara(page, '/associados');

  // O outro caminho: o assistente de contrato, que é por onde o CADASTRO NOVO gera as
  // mensalidades. O campo é o mesmo e estava atrás do mesmo `isAdminOrSuperAdmin`.
  await abrirNovoAssociado(page);
  await preencherDadosBasicos(page, { nome, cpf: cpfValido() });
  await avancarEtapa(page); // Dados Básicos -> Dependentes
  await avancarEtapa(page); // Dependentes -> Contrato

  await page.getByText('Editar', { exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar Novo Contrato' }).click();
  await page
    .locator('select:visible:has(option:text-is("Plano Individual"))')
    .selectOption({ label: 'Plano Individual' });
  await page.getByRole('button', { name: 'Avançar' }).click();
  await expect(page.getByText(/Prévia das Mensalidades/i)).toBeVisible();

  const campo = page.locator('input[placeholder^="Auto (R$"]');
  await expect(campo).toBeVisible();
  await expect(campo).toBeEditable();
  await expect(page.getByText('Automático: R$')).toBeVisible();

  await campo.fill('250');
  await expect(page.getByText('Valor manual por parcela')).toBeVisible();

  await page.getByRole('button', { name: 'Avançar' }).click();
  await page.getByRole('button', { name: 'Confirmar e Gerar Mensalidades' }).click();
  await expect(page.locator('.fixed.inset-0')).toHaveCount(0, { timeout: 30_000 });

  test.skip(!contraODuble, 'as asserções de payload só valem contra o dublê');

  /**
   * A asserção que importa é sobre o que SAIU, não sobre o que a tela mostrou: a permissão só
   * vira efeito quando o valor digitado por um gerente chega gravado. Com o predicado antigo o
   * campo nem apareceria — e, se aparecesse sem o segundo `isAdminOrSuperAdmin` cair junto, as
   * parcelas sairiam com os R$ 60,00 do plano e a tela não diria nada.
   */
  const parcelas = servidor!.linhas('parcelas_receber').filter((p) => p.devedor_nome === nome);
  expect(parcelas.length, 'nenhuma parcela foi gravada para o associado novo').toBeGreaterThan(0);

  const porNumero = (n: number) => parcelas.find((p) => p.numero_parcela === n);
  expect(porNumero(2)!.valor).toBe(250); // o valor digitado, não os R$ 60,00 do plano
  expect(porNumero(1)!.valor).toBe(300); // a primeira soma a taxa de adesão (R$ 50,00)
});

test('admin continua com o campo, agora sem a etiqueta que virou mentira', async ({
  sessao: { page },
}) => {
  await entrar(page, USUARIOS.admin);
  const modal = await abrirGeracaoDeMensalidades(page);

  const campo = modal.locator('input[placeholder^="Auto (R$"]');
  await expect(campo).toBeVisible();

  await campo.fill('88.50');
  await expect(valorDaParcela(modal, 2)).toHaveValue('88.5', { timeout: 10_000 });

  // E a primeira continua somando a taxa de adesão do plano por cima do valor digitado — o
  // campo troca a BASE da parcela, não o total do contrato.
  await expect(valorDaParcela(modal, 1)).toHaveValue('168.5');
});
