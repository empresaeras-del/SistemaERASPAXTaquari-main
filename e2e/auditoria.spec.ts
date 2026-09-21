import { test, expect, entrar, irPara } from './apoio/sessao';
import { USUARIOS } from './apoio/dadosDeHomologacao';

/**
 * A Ata de Ocorrências, de ponta a ponta.
 *
 * Este spec foi escrito **antes** da decomposição de `pages/Auditoria.tsx` e passou contra o
 * arquivo monolítico — é essa passagem que o torna uma linha de base. O CLAUDE.md registrava a
 * decomposição desta tela como bloqueada "por falta de UI logada"; o que faltava não era o
 * acesso, era poder afirmar depois que nada mudou.
 *
 * O que ele trava, e por que cada um:
 *
 * - **O escopo sai do NÍVEL, não do seletor de empresa.** É a regra central desta tela, e a que
 *   já produziu dois incidentes: um admin não ganha visão global, e o log de outra empresa não
 *   pode aparecer para ele. Sem este caso, a decomposição poderia trocar o escopo por
 *   `state.empresaSelecionada` e a suíte passaria inteira.
 * - **O diff e o painel de detalhes**, que são a razão de a tela existir — e onde mora o
 *   mascaramento de CPF/CNPJ.
 * - **Os filtros e o modo de impressão**, que são o grosso do JSX a ser extraído.
 */

const esperarListaCarregada = async (page: import('@playwright/test').Page) => {
  await expect(page.getByRole('heading', { name: 'Ata de Ocorrências' })).toBeVisible();
  // O selo do escopo só renderiza depois que `escopoDaAuditoria` resolveu; esperar por ele
  // evita afirmar coisas sobre uma lista que ainda está carregando.
  await expect(page.locator('main').getByText(/VISÃO GLOBAL|EMPRESA|SEM ESCOPO/).first()).toBeVisible();
};

/** O card de KPI é `<h3>{numero}</h3><p>{rotulo}</p>` — o número é o irmão anterior do rótulo. */
const kpi = (page: import('@playwright/test').Page, rotulo: string | RegExp) =>
  page.locator('div').filter({ hasText: rotulo }).locator('h3').last();

test('o admin vê a ata da própria empresa — e NÃO a linha de outra', async ({ sessao: { page } }) => {
  await entrar(page, USUARIOS.admin);
  await irPara(page, '/auditoria');
  await esperarListaCarregada(page);

  const principal = page.locator('main');

  // As três da PAX aparecem.
  await expect(principal.getByRole('heading', { name: 'Criar Associado', exact: true })).toBeVisible();
  await expect(principal.getByRole('heading', { name: 'Editar Associado', exact: true })).toBeVisible();
  await expect(
    principal.getByRole('heading', { name: 'Excluir Fornecedor e Despesas Vinculadas' }),
  ).toBeVisible();

  // A da outra empresa e a de `tenant_id = 'system'`, não. É o isolamento que a RLS garante no
  // servidor e que o escopo da tela precisa PEDIR corretamente — pedir demais e depender de o
  // banco aparar é o que esta asserção existe para impedir.
  await expect(principal.getByRole('heading', { name: 'Criar Plano PAX' })).toHaveCount(0);
  await expect(principal.getByRole('heading', { name: 'Reabertura Lote Caixa' })).toHaveCount(0);

  // O selo anuncia o escopo real, não o nível de quem olha.
  await expect(principal.getByText('EMPRESA', { exact: true }).first()).toBeVisible();
});

test('o super_admin sem empresa escolhida vê tudo, inclusive o log sem empresa', async ({
  sessao: { page },
}) => {
  await entrar(page, USUARIOS.superAdmin);
  await irPara(page, '/auditoria');
  await esperarListaCarregada(page);

  const principal = page.locator('main');
  await expect(principal.getByText('VISÃO GLOBAL', { exact: true }).first()).toBeVisible();

  // As duas que o admin não alcança.
  await expect(principal.getByRole('heading', { name: 'Criar Plano PAX' })).toBeVisible();
  await expect(principal.getByRole('heading', { name: 'Reabertura Lote Caixa' })).toBeVisible();

  // E os operadores contam mais de um: quando este número despenca junto com o total, o
  // CLAUDE.md manda suspeitar do cache servido como se fosse o banco.
  await expect(kpi(page, 'Operadores no Período')).not.toHaveText('1');
});

test('a busca e o filtro de tipo recortam a lista', async ({ sessao: { page } }) => {
  await entrar(page, USUARIOS.admin);
  await irPara(page, '/auditoria');
  await esperarListaCarregada(page);

  const principal = page.locator('main');

  await page.getByPlaceholder('Buscar ação, ID, campos...').fill('Excluir Fornecedor');
  await expect(
    principal.getByRole('heading', { name: 'Excluir Fornecedor e Despesas Vinculadas' }),
  ).toBeVisible();
  await expect(principal.getByRole('heading', { name: 'Criar Associado', exact: true })).toHaveCount(0);

  await page.getByPlaceholder('Buscar ação, ID, campos...').fill('nao-existe-nada-assim');
  await expect(principal.getByText('Nenhum registro encontrado')).toBeVisible();
});

test('o diff mostra o campo alterado, com o antes e o depois', async ({ sessao: { page } }) => {
  await entrar(page, USUARIOS.admin);
  await irPara(page, '/auditoria');
  await esperarListaCarregada(page);

  // A linha semeada com `dados_anteriores`/`dados_novos` muda só o telefone.
  await page.getByPlaceholder('Buscar ação, ID, campos...').fill('Editar Associado');
  const principal = page.locator('main');
  await expect(principal.getByRole('heading', { name: 'Editar Associado', exact: true })).toBeVisible();

  await expect(principal.getByText('Campos Modificados')).toBeVisible();
  await expect(principal.getByText('(67) 99999-0000')).toBeVisible();
  await expect(principal.getByText('(67) 99999-0001')).toBeVisible();
});

test('o modo de impressão troca a tela pela folha do relatório', async ({ sessao: { page } }) => {
  await entrar(page, USUARIOS.admin);
  await irPara(page, '/auditoria');
  await esperarListaCarregada(page);

  await page.getByRole('button', { name: 'Imprimir / Gerar PDF' }).click();

  // Na folha o cabeçalho da tela some e entra o documento: emitente, os filtros aplicados
  // (um relatório que não diz por qual filtro foi gerado afirma ser a lista completa sem
  // ser) e a tabela das ocorrências.
  await expect(page.getByRole('heading', { name: 'PAX Homologacao' })).toBeVisible();
  await expect(page.getByText('Relatório de Auditoria')).toBeVisible();
  await expect(page.getByText('Todos os Módulos')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(4); // cabeçalho + as 3 da empresa
  await expect(page.getByRole('heading', { name: 'Ata de Ocorrências' })).toHaveCount(0);

  // O CPF vai mascarado ao papel — é `mascararValorDeCampo`, aplicada no mesmo lugar que a
  // tela e o CSV usam, e este é o único ponto onde dá para ver os três concordando.
  await expect(page.getByText(/\*\*\*\.000\.000-\*\*/)).toBeVisible();
});
