import { test, expect, entrar, irPara } from './apoio/sessao';

/**
 * Linha de base de `pages/ContasReceberPage.tsx`, escrita contra o arquivo monolítico
 * (1574 linhas) e passando nele antes de qualquer extração.
 *
 * `receber-parcela.spec.ts` já cobre o caminho feliz da liquidação — o botão Receber, as três
 * etapas do modal de baixa e o recibo — e continua sendo o dono dele. Este arquivo cobre o que
 * aquele não alcança, que é justamente o que uma decomposição mexe: o cabeçalho com o menu de
 * relatórios, a barra de filtros, os indicadores que escrevem no filtro de status, a ordenação
 * da tabela, o modal de detalhes (com a busca assíncrona da receita pai) e a etapa de bloqueio
 * do modal de baixa, que nenhum teste havia exercitado.
 *
 * **Escrito antes da extração, e provado por mutação**: uma suíte verde no fim não distingue
 * "nada quebrou" de "o teste não mede nada".
 */

/** As duas receitas semeadas: 12 parcelas cada, nos dois alvos. */
const MARIA = 'MARIA APARECIDA DA SILVA';
const JOAO = 'JOAO BATISTA SOUZA';

const abrirFiltros = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'Filtros Avançados' }).click();
  await expect(page.getByPlaceholder('Nome, documento ou descrição...')).toBeVisible();
};

const linhas = (page: import('@playwright/test').Page) => page.locator('tbody tr');

test('lista as parcelas dos dois devedores, e os indicadores batem com a lista', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-receber');

  // 24 linhas: as 12 da Maria e as 12 do João. A contagem é o que separa "a tabela renderizou"
  // de "a tabela renderizou TUDO" — e é ela que um filtro mal ligado derruba.
  await expect(linhas(page)).toHaveCount(24);
  await expect(linhas(page).filter({ hasText: MARIA })).toHaveCount(12);
  await expect(linhas(page).filter({ hasText: JOAO })).toHaveCount(12);

  /**
   * Os indicadores somam a lista INTEIRA, não a filtrada, e é por isso que eles valem como
   * conferência: se a tabela e o painel discordarem, um dos dois está lendo outra coisa.
   *
   * Os números são estáveis no tempo porque a semente é relativa a `hoje`: a Maria tem 5
   * liquidadas, 1 vencida e 6 a vencer; o João, 3 liquidadas e 9 a vencer.
   */
  await expect(page.getByTitle('Clique para filtrar títulos vencidos / inadimplentes')).toContainText(
    '1 em atraso',
  );
  await expect(page.getByTitle('Clique para filtrar apenas receitas pendentes')).toContainText(
    '16 parcelas',
  );
  await expect(page.getByTitle('Clique para filtrar recebimentos já quitados')).toContainText(
    '8 liquidadas',
  );

  // E a lista concorda: 8 recebidas, 1 vencida, 15 a vencer.
  await expect(linhas(page).filter({ hasText: 'Recebido' })).toHaveCount(8);
  await expect(linhas(page).filter({ hasText: 'Vencido' })).toHaveCount(1);
  await expect(linhas(page).filter({ hasText: 'Pendente' })).toHaveCount(15);
});

test('a busca por nome filtra a tabela — e só ela', async ({ sessao: { page } }) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-receber');
  await expect(linhas(page)).toHaveCount(24);

  await abrirFiltros(page);
  await page.getByPlaceholder('Nome, documento ou descrição...').fill('MARIA');

  await expect(linhas(page)).toHaveCount(12);
  await expect(linhas(page).filter({ hasText: JOAO })).toHaveCount(0);

  // A busca também casa pela DESCRIÇÃO, não só pelo devedor — são três campos no mesmo
  // predicado, e um teste com um só não distingue qual deles ficou ligado.
  await page.getByPlaceholder('Nome, documento ou descrição...').fill('Plano Individual 4/12');
  await expect(linhas(page)).toHaveCount(1);
  await expect(linhas(page).first()).toContainText(JOAO);
});

test('o indicador de vencidas escreve no filtro de status, e "Limpar" desfaz', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-receber');
  await expect(linhas(page)).toHaveCount(24);

  // Este caso atravessa três peças de uma vez: o painel de indicadores chama
  // `onSelectStatusFilter`, o estado da página guarda, e `filteredParcelas` reduz a lista. É o
  // caminho que uma decomposição quebra sem que nada mais na tela mude de aparência.
  await page.getByTitle('Clique para filtrar títulos vencidos / inadimplentes').click();

  await expect(linhas(page)).toHaveCount(1);
  await expect(linhas(page).first()).toContainText('Mensalidade Plano Familiar 6/12');
  await expect(linhas(page).first()).toContainText('Vencido');

  // "Vencido" não é um status gravado: é `pendente` + vencimento no passado. Uma parcela
  // `recebido` de vencimento antigo não pode entrar aqui, e há 8 delas na lista.
  await expect(linhas(page).filter({ hasText: 'Recebido' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Limpar', exact: true }).click();
  await expect(linhas(page)).toHaveCount(24);
});

test('ordenar por devedor inverte a ordem da lista', async ({ sessao: { page } }) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-receber');
  await expect(linhas(page)).toHaveCount(24);

  // Sem ordenação a lista sai na ordem em que o servidor devolveu — a Maria primeiro.
  await expect(linhas(page).first()).toContainText(MARIA);

  const cabecalhoDevedor = page.getByRole('columnheader', { name: 'Devedor' });
  await cabecalhoDevedor.click();
  await expect(linhas(page).first()).toContainText(JOAO);

  // O segundo clique inverte o sentido em vez de reordenar do zero.
  await cabecalhoDevedor.click();
  await expect(linhas(page).first()).toContainText(MARIA);

  // Ordenar não é filtrar: as 24 continuam lá.
  await expect(linhas(page)).toHaveCount(24);
});

test('o menu de Relatórios oferece os dois e abre o escolhido', async ({ sessao: { page } }) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-receber');

  /**
   * Os dois relatórios respondem a perguntas diferentes sobre os MESMOS filtros, e o menu
   * existe para a escolha ser do operador. Um teste que só abrisse um deles não notaria o
   * outro sumindo — foi para não trocar um pelo outro que o menu foi criado.
   */
  await page.getByRole('button', { name: 'Relatórios' }).click();
  await expect(page.getByText('Relação de parcelas')).toBeVisible();
  await expect(page.getByText('Mapa de zonas de cobrança')).toBeVisible();

  await page.getByText('Mapa de zonas de cobrança').click();
  await expect(page.getByText('Mapa de Zonas de Cobrança').first()).toBeVisible({
    timeout: 20_000,
  });

  /**
   * A segunda metade recarrega a tela em vez de fechar o modal, e isso não é preguiça: o X do
   * `RelatorioMapaCalorModal` é um ícone sem `title` nem `aria-label`, então não há nome
   * acessível por onde pegá-lo — e casar por classe do Tailwind ou por `nth()` é exatamente o
   * que esta suíte não faz. (O botão sem nome é um achado à parte, não corrigido aqui: mexer
   * num componente que a decomposição não toca tiraria da suíte o direito de afirmar depois
   * que nada mudou.)
   */
  await irPara(page, '/financeiro/contas-a-receber');
  await page.getByRole('button', { name: 'Relatórios' }).click();
  await page.getByText('Relação de parcelas').click();
  await expect(page.getByText(/Pré-visualização do Relatório de Contas a Receber/i)).toBeVisible({
    timeout: 20_000,
  });
});

test('"Ver Detalhes" traz a parcela E a receita pai, que vem de outra busca', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-receber');

  const linhaDaMaria = linhas(page).filter({ hasText: 'Mensalidade Plano Familiar 7/12' });
  await linhaDaMaria.getByTitle('Ver Detalhes').click();

  const modal = page.locator('.fixed.inset-0').first();
  await expect(modal.getByText('Detalhes da Contas a Receber')).toBeVisible();

  // 1. O que vem da PARCELA, que a tela já tinha em memória.
  await expect(modal).toContainText(MARIA);
  await expect(modal).toContainText('000.000.000-01');
  await expect(modal).toContainText('R$ 100,00');

  /**
   * 2. O que vem da RECEITA PAI, e só dela: `openDetalhes` faz um `getReceitaById` DEPOIS de
   * abrir o modal. Se esse encadeamento se perder numa extração, o modal continua abrindo, com
   * todos os campos da parcela preenchidos, e só estes ficam vazios — falha silenciosa, do tipo
   * que este repositório já registra em outros lugares.
   *
   * **As três asserções abaixo são as que sobreviveram à mutação.** A primeira versão também
   * procurava `'Plano Familiar'` e `'Mensalidade'`, e as duas passavam com a busca da receita
   * pai desligada: as duas palavras estão na DESCRIÇÃO da parcela, que a tela já tinha em
   * memória ("Mensalidade Plano Familiar 7/12"). É a regra que este repositório já registra
   * noutro lugar — ao afirmar que algo apareceu, pergunte de onde aquele texto veio; num modal
   * que mistura duas fontes, o mesmo texto existe nas duas e o errado não prova nada.
   */
  await expect(modal).toContainText('R$ 1.200,00'); // valor_total da receita, não da parcela
  await expect(modal).toContainText('(12x)'); // qtd_parcelas
  await expect(modal).toContainText('Semeada para homologacao'); // observacoes
});

test('"Receber" sem lote de caixa aberto para no bloqueio, e oferece a saída', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-receber');

  /**
   * A etapa 2 do modal de baixa, que nenhum teste exercitava: `receber-parcela.spec.ts` abre
   * um lote antes, de propósito, e cai sempre na etapa 3. Aqui não há lote nenhum.
   *
   * Ela importa porque é a única que NÃO grava: se a checagem do lote se perder numa extração,
   * o caminho errado é o silencioso — a baixa seguiria sem movimentação de caixa, e o dinheiro
   * recebido não apareceria no caixa de ninguém.
   */
  const linhaEmAberto = linhas(page).filter({ hasText: 'Mensalidade Plano Individual 4/12' });
  await linhaEmAberto.getByRole('button', { name: 'Receber' }).click();

  await expect(page.getByText('Registrar Recebimento')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar Recebimento' }).click();

  await expect(page.getByText('Operação Bloqueada')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Nenhum Lote de Caixa Aberto Encontrado')).toBeVisible();
  await expect(page.getByRole('button', { name: /Abrir Lote de Caixa/i })).toBeVisible();

  // "Voltar" devolve ao formulário em vez de fechar o modal: quem chegou aqui por engano não
  // pode perder o que digitou.
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByText('Registrar Recebimento')).toBeVisible();
});
