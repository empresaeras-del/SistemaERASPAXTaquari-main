import { expect, type Page } from '@playwright/test';
import { irPara } from './sessao';

/**
 * Liquidar uma parcela exige um lote de caixa aberto — sem ele o modal de recebimento mostra
 * "Operação Bloqueada". Só pode haver UM lote aberto por empresa, e é por isso que a suíte roda
 * com `workers: 1`: dois fluxos abrindo lote ao mesmo tempo se recusariam mutuamente.
 */
export const abrirLoteDeCaixa = async (page: Page, saldoInicial = '100') => {
  await irPara(page, '/financeiro/caixas');
  await page.getByRole('button', { name: 'Abrir Caixa' }).click();
  await page.locator('input[type="number"]:visible').fill(saldoInicial);
  await page.getByRole('button', { name: 'Abrir Lote' }).click();

  // O código do lote no cabeçalho é a confirmação de que ele existe — não o modal ter fechado.
  const cabecalho = page.getByText(/Caixa Atual: LOTE-/);
  await expect(cabecalho).toBeVisible({ timeout: 20_000 });
  return (await cabecalho.innerText()).replace('Caixa Atual: ', '').trim();
};
