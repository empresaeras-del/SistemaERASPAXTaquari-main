import { expect, type Page } from '@playwright/test';

/**
 * Dirigir o formulário de associado é longo e os três fluxos precisam dele em graus diferentes,
 * então ele mora aqui. As decisões que valem:
 *
 * - **Os seletores saem do texto que o operador lê** (placeholder, rótulo, opção do select), não
 *   de classe utilitária do Tailwind: `className` muda numa passada de estilo e derrubaria a
 *   suíte sem nada ter quebrado de verdade.
 * - **O card de contrato é um `<div onClick>`**, sem `role` nem `tabIndex` — a mesma lacuna de
 *   acessibilidade que o CLAUDE.md já registra no item-pai de submenu da Sidebar. Por isso o
 *   clique aqui é no texto, e não `getByRole('button')`: não há botão.
 */

export interface DadosDoTitular {
  nome: string;
  cpf: string;
  nascimento?: string;
  telefone?: string;
}

export const abrirNovoAssociado = async (page: Page) => {
  await page.getByRole('button', { name: 'Novo Associado' }).click();
  await expect(page.getByPlaceholder('Digite o nome completo')).toBeVisible();
};

/** Preenche as quatro sub-abas obrigatórias de "Dados Básicos". */
export const preencherDadosBasicos = async (page: Page, dados: DadosDoTitular) => {
  await page.getByPlaceholder('Digite o nome completo').fill(dados.nome);
  await page.getByPlaceholder('000.000.000-00').first().fill(dados.cpf);
  await page.locator('input[type="date"]:visible').first().fill(dados.nascimento ?? '1985-04-17');
  await page.locator('select:visible').first().selectOption({ label: 'Masculino' });

  await page.getByRole('button', { name: 'Contato' }).click();
  await page.getByPlaceholder('(00) 00000-0000').fill(dados.telefone ?? '(67) 91234-5678');

  await page.getByRole('button', { name: 'Endereço' }).click();
  // `exact` porque "00000-000" é substring de "(00) 00000-0000", o placeholder do telefone.
  await page.getByPlaceholder('00000-000', { exact: true }).fill('79400-000');
  await page.getByPlaceholder('Rua, Avenida, Alameda, Travessa...').fill('RUA DO TESTE DE FLUXO');
  await page.getByPlaceholder('Nº ou S/N').fill('42');
  await page.getByPlaceholder('Nome do bairro').fill('CENTRO');
  await page.getByPlaceholder('Ex: Coxim - MS ou Taquari').fill('COXIM - MS');
};

export const avancarEtapa = async (page: Page) => {
  await page.getByRole('button', { name: 'Próximo' }).click();
};

/**
 * Da etapa "Contrato" até o fim do assistente, escolhendo o plano pelo nome.
 * Devolve o número do contrato que a tela gerou — é por ele que se reconhece a linha gravada.
 */
export const contratarPlano = async (page: Page, nomeDoPlano: string): Promise<string> => {
  await page.getByText('Editar', { exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar Novo Contrato' }).click();

  const numero = page.getByText(/^CTR-[A-Z0-9]+$/).first();
  await expect(numero).toBeVisible();
  const numeroDoContrato = (await numero.innerText()).trim();

  // O select é identificado pela opção que ele oferece, não por posição: inserir um campo novo
  // acima dele mudaria um `nth()` e o teste passaria a preencher outra coisa em silêncio.
  await page
    .locator(`select:visible:has(option:text-is("${nomeDoPlano}"))`)
    .selectOption({ label: nomeDoPlano });

  await page.getByRole('button', { name: 'Avançar' }).click();
  await expect(page.getByText(/Prévia das Mensalidades/i)).toBeVisible();

  await page.getByRole('button', { name: 'Avançar' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar e Gerar Mensalidades' })).toBeVisible();

  await page.getByRole('button', { name: 'Confirmar e Gerar Mensalidades' }).click();

  // Confirmar fecha o assistente E o formulário do associado, e é nesse fechamento que o
  // cadastro sobe. Esperar o modal sumir é o que separa "cliquei" de "gravou": sem isto, a
  // asserção seguinte encontraria o nome do titular no CABEÇALHO do próprio formulário e
  // passaria sem nada ter chegado ao servidor.
  await expect(page.locator('.fixed.inset-0')).toHaveCount(0, { timeout: 30_000 });

  return numeroDoContrato;
};
