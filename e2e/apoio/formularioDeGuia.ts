import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Escolhe a opção cujo texto contém `trecho`, no select que a oferece.
 *
 * Duas coisas que esta função resolve de propósito:
 *
 * - **O select é identificado pela OPÇÃO que ele tem**, não por posição. A tela de Requisições
 *   mostra cinco selects (dois são filtros da listagem, por baixo do modal), e um `nth()` faria
 *   o teste preencher outro campo em silêncio no dia em que alguém acrescentasse um filtro.
 * - **A escolha vai pelo `value`**, que é o id do registro. `selectOption({ label })` exige o
 *   rótulo inteiro — aqui "MARIA APARECIDA DA SILVA (CPF: 000.000.000-01) - Plano: Plano
 *   Familiar" —, e um teste amarrado a essa string quebra quando a tela muda o formato do
 *   rótulo, que é apresentação, não identidade.
 */
export const escolherPorTrecho = async (page: Page, trecho: string): Promise<Locator> => {
  const select = page.locator(`select:visible:has(option:text-matches("${trecho}"))`);
  const valor = await select.locator(`option:text-matches("${trecho}")`).first().getAttribute('value');
  if (!valor) throw new Error(`A opção "${trecho}" existe mas não tem value — seletor errado?`);
  await select.selectOption(valor);
  return select;
};

export const preencherGuia = async (
  page: Page,
  { associado, credenciado, procedimento }: { associado: string; credenciado: string; procedimento: string },
) => {
  await page.getByRole('button', { name: 'Nova Guia de Requisição' }).click();

  await escolherPorTrecho(page, associado);
  // Só aparece depois de escolher o associado: a guia é do titular ou de um dependente dele.
  await expect(page.getByText('Paciente da Guia')).toBeVisible();

  await escolherPorTrecho(page, credenciado);
  await escolherPorTrecho(page, procedimento);

  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText(/Nenhum procedimento\/exame adicionado/)).toHaveCount(0);
};

export const emitirGuia = async (page: Page) => {
  await page.getByRole('button', { name: 'Emitir e Imprimir Guia' }).click();
};
