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
 * Abre um associado JÁ CADASTRADO para edição, pelo nome que aparece na lista.
 *
 * O botão é identificado pelo `title`, que é o que o operador lê ao passar o mouse — a linha
 * inteira não é clicável e o ícone não tem texto. Devolve o modal, para as asserções ficarem
 * escopadas nele: com o formulário aberto, quase todo texto existe em dois lugares da página,
 * e o de fora é o que não prova nada.
 */
export const abrirAssociadoParaEditar = async (page: Page, nome: string) => {
  // A lista abre em cards, e um card é um `<div>` sem papel nenhum — não há como escopar o
  // botão ao registro certo por estrutura. O modo tabela dá uma `<tr>` por associado, então
  // o teste troca de modo pelo botão que o operador tem, em vez de adivinhar a hierarquia.
  await page.getByRole('button', { name: 'Visualização em Tabela' }).click();

  const linha = page.locator('tr').filter({ hasText: nome }).first();
  await linha.locator('button[title="Editar Associado"]').click();

  const modal = page.locator('.fixed.inset-0').first();
  await expect(modal.getByText('Editar Associado', { exact: true })).toBeVisible();
  return modal;
};

/**
 * Troca de aba no formulário aberto em modo de edição — a barra lateral, não o stepper do
 * cadastro novo. As duas coexistem e só uma está montada de cada vez.
 *
 * **Toda troca de aba passa por `executarValidacaoOuAlertar()`**: com um campo obrigatório
 * inválido, o clique não faz nada e o formulário fica preso em "Dados Principais". Por isso
 * quem navega chama antes `destravarNavegacao` — ver o comentário dela.
 */
export const irParaAba = async (page: Page, rotulo: string) => {
  // A barra de abas fica FORA do `<form>` — ele começa depois dela —, então o escopo aqui é o
  // modal, não `#associado-form`. Os rótulos das abas e os das sub-abas não se repetem, e o
  // `exact` separa "Contato" de "Contratos".
  await page.locator('.fixed.inset-0').first()
    .getByRole('button', { name: rotulo, exact: true })
    .click();
};

/**
 * Troca de sub-aba dentro de "Dados Principais". Ao contrário das abas, **não é validada** —
 * o operador circula entre as seções livremente; o que trava é sair de Dados Principais.
 *
 * Escopado ao `<form>`: "Informações do Sistema" também é o `title` do botão de informações
 * no topo da Sidebar da aplicação, e sem o escopo o seletor casa com os dois.
 */
export const irParaSubAba = async (page: Page, rotulo: string) => {
  await page.locator('#associado-form').getByRole('button', { name: rotulo, exact: true }).click();
};

/**
 * Completa o que falta ao cadastro semeado para ele passar na validação do formulário.
 *
 * Os associados da semente **não validam**: o CPF não fecha o dígito verificador (decisão
 * deliberada registrada no CLAUDE.md — "ninguém os confunde com pessoa real") e `data_adesao`
 * não é semeada. Como cada troca de aba é validada, um teste que só abrisse o cadastro ficaria
 * preso na primeira aba — e passaria a afirmar coisas sobre a tela errada.
 *
 * Preencher aqui é o que o operador faria, e é honesto quanto ao que está sendo exercitado:
 * a navegação do formulário, não a qualidade da semente.
 */
export const destravarNavegacao = async (page: Page, cpf: string) => {
  await irParaSubAba(page, 'Informações Básicas');
  await page.getByPlaceholder('000.000.000-00').first().fill(cpf);

  await irParaSubAba(page, 'Informações do Sistema');
  await page.locator('#associado-form input[type="date"]:visible').first().fill('2024-01-15');
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
