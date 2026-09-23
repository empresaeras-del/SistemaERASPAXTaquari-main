import { test, expect, entrar, irPara } from './apoio/sessao';

/**
 * Linha de base de `pages/ContasPagarPage.tsx`, escrita contra o arquivo monolítico
 * (1333 linhas) e passando nele antes de qualquer extração.
 *
 * Esta tela é a gêmea de Contas a Receber — mesma estrutura de filtros, tabela, modal de baixa
 * em três etapas e modal de detalhes —, mas ao contrário dela **nenhum spec a tocava**: até
 * agora `despesas` e `parcelas_pagar` estavam vazias nos dois alvos, então não havia uma linha
 * para mostrar. O primeiro passo foi semear (ver `apoio/dadosDeHomologacao.ts`).
 *
 * **Escrito antes da extração, e provado por mutação**: uma suíte verde no fim não distingue
 * "nada quebrou" de "o teste não mede nada".
 */

const URNAS = 'URNAS EXEMPLO LTDA';
const CONVENIO = 'CONVENIO EXEMPLO LTDA';

const linhas = (page: import('@playwright/test').Page) => page.locator('tbody tr');

const abrirFiltros = async (page: import('@playwright/test').Page) => {
  await page.getByRole('button', { name: 'Filtros Avançados' }).click();
  await expect(page.getByPlaceholder('Credor, documento ou descrição...')).toBeVisible();
};

test('lista as parcelas dos dois credores, e os indicadores batem com a lista', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-pagar');

  // 10 linhas: as 6 das urnas e as 4 do convênio. A contagem é o que separa "a tabela
  // renderizou" de "a tabela renderizou TUDO" — e é ela que um filtro mal ligado derruba.
  await expect(linhas(page)).toHaveCount(10);
  await expect(linhas(page).filter({ hasText: URNAS })).toHaveCount(6);
  await expect(linhas(page).filter({ hasText: CONVENIO })).toHaveCount(4);

  /**
   * Os indicadores somam a lista INTEIRA, não a filtrada, e é por isso que eles valem como
   * conferência: se a tabela e o painel discordarem, um dos dois está lendo outra coisa.
   *
   * Os números são estáveis no tempo porque a semente é relativa a `hoje`: as urnas começam a
   * vencer há 90 dias (2 pagas, 1 vencida em aberto, 3 a vencer) e o convênio só daqui a 15
   * dias (4 a vencer).
   */
  await expect(page.getByTitle('Clique para filtrar contas vencidas')).toContainText('1 em atraso');
  await expect(page.getByTitle('Clique para filtrar apenas despesas pendentes')).toContainText(
    '8 parcelas',
  );
  await expect(page.getByTitle('Clique para filtrar despesas pagas')).toContainText('2 liquidadas');

  // E a lista concorda: 2 pagas, 1 vencida, 7 a vencer.
  await expect(linhas(page).filter({ hasText: 'Pago' })).toHaveCount(2);
  await expect(linhas(page).filter({ hasText: 'Vencido' })).toHaveCount(1);
  await expect(linhas(page).filter({ hasText: 'Pendente' })).toHaveCount(7);
});

test('a busca filtra por credor E por descrição', async ({ sessao: { page } }) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-pagar');
  await expect(linhas(page)).toHaveCount(10);

  await abrirFiltros(page);
  const busca = page.getByPlaceholder('Credor, documento ou descrição...');

  await busca.fill('CONVENIO');
  await expect(linhas(page)).toHaveCount(4);
  await expect(linhas(page).filter({ hasText: URNAS })).toHaveCount(0);

  // São três campos no mesmo predicado (credor, descrição, documento), e um teste com um só
  // não distingue qual deles ficou ligado.
  await busca.fill('Compra de urnas 3/6');
  await expect(linhas(page)).toHaveCount(1);
  await expect(linhas(page).first()).toContainText(URNAS);

  await busca.fill('44.444.444');
  await expect(linhas(page)).toHaveCount(6);
});

test('o indicador de vencidas escreve no filtro de status, e "Limpar" desfaz', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-pagar');
  await expect(linhas(page)).toHaveCount(10);

  // Este caso atravessa três peças de uma vez: o painel de indicadores chama
  // `onSelectStatusFilter`, o estado da página guarda, e `filteredParcelas` reduz a lista.
  await page.getByTitle('Clique para filtrar contas vencidas').click();

  await expect(linhas(page)).toHaveCount(1);
  await expect(linhas(page).first()).toContainText('Compra de urnas 3/6');
  await expect(linhas(page).first()).toContainText('Vencido');

  // "Vencido" não é um status gravado: é `pendente` + vencimento no passado. Uma parcela
  // `pago` de vencimento antigo não pode entrar aqui, e há duas delas na lista.
  await expect(linhas(page).filter({ hasText: 'Pago' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Limpar', exact: true }).click();
  await expect(linhas(page)).toHaveCount(10);
});

test('ordenar por credor inverte a ordem da lista', async ({ sessao: { page } }) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-pagar');
  await expect(linhas(page)).toHaveCount(10);

  // Sem ordenação a lista sai na ordem em que o servidor devolveu — as urnas primeiro.
  await expect(linhas(page).first()).toContainText(URNAS);

  const cabecalhoCredor = page.getByRole('columnheader', { name: /Credor/ });
  await cabecalhoCredor.click();
  await expect(linhas(page).first()).toContainText(CONVENIO);

  // O segundo clique inverte o sentido em vez de reordenar do zero.
  await cabecalhoCredor.click();
  await expect(linhas(page).first()).toContainText(URNAS);

  // Ordenar não é filtrar: as 10 continuam lá.
  await expect(linhas(page)).toHaveCount(10);
});

test('"Exportar PDF" abre a prévia do relatório com os filtros aplicados', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-pagar');

  /**
   * Aqui o cabeçalho tem um relatório só, e por isso um botão direto — ao contrário de Contas
   * a Receber, que ganhou um menu quando o segundo relatório entrou. É a diferença que uma
   * decomposição "por simetria" apagaria sem ninguém notar.
   */
  await page.getByRole('button', { name: 'Exportar PDF' }).click();

  await expect(page.getByText('Relatório de Contas a Pagar').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(URNAS).first()).toBeVisible();
});

test('"Ver Detalhes" traz a parcela E a despesa pai, que vem de outra busca', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-pagar');

  const linhaDasUrnas = linhas(page).filter({ hasText: 'Compra de urnas 4/6' });
  await linhaDasUrnas.getByTitle('Ver Detalhes').click();

  const modal = page.locator('.fixed.inset-0').first();
  await expect(modal.getByText('Detalhes da Contas a Pagar')).toBeVisible();

  // 1. O que vem da PARCELA, que a tela já tinha em memória.
  await expect(modal).toContainText(URNAS);
  await expect(modal).toContainText('44.444.444/0001-44');
  await expect(modal).toContainText('R$ 500,00');

  /**
   * 2. O que vem da DESPESA PAI, e só dela: `openDetalhes` faz um `getDespesaById` DEPOIS de
   * abrir o modal. Se esse encadeamento se perder numa extração, o modal continua abrindo, com
   * todos os campos da parcela preenchidos, e só estes ficam vazios — falha silenciosa.
   *
   * As asserções abaixo são as que **só a despesa pai** pode satisfazer. `'Compra de urnas'`
   * ficaria de fora mesmo estando lá: a descrição da parcela já a contém, e o teste passaria
   * com a busca desligada — a armadilha que o lado das receitas já registrou.
   */
  await expect(modal).toContainText('R$ 3.000,00'); // valor_total da despesa, não da parcela
  await expect(modal).toContainText('(6x)'); // qtd_parcelas
  await expect(modal).toContainText('Materiais'); // categoria, que a parcela não carrega
  await expect(modal).toContainText('Semeada para homologacao'); // observacoes
});

test('"Pagar" sem lote de caixa aberto para no bloqueio, e oferece a saída', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-pagar');

  /**
   * A etapa 2 do modal de baixa. Ela importa porque é a única que NÃO grava: se a checagem do
   * lote se perder numa extração, o caminho errado é o silencioso — a baixa seguiria sem
   * movimentação de caixa, e o dinheiro que saiu não apareceria no caixa de ninguém.
   */
  const emAberto = linhas(page).filter({ hasText: 'Repasse de convenio 1/4' });
  await emAberto.getByRole('button', { name: 'Pagar' }).click();

  await expect(page.getByText('Registrar Pagamento')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar Pagamento' }).click();

  await expect(page.getByText('Operação Bloqueada')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Nenhum Lote de Caixa Aberto Encontrado')).toBeVisible();
  await expect(page.getByRole('button', { name: /Abrir Lote de Caixa/i })).toBeVisible();

  // "Voltar" devolve ao formulário em vez de fechar o modal: quem chegou aqui por engano não
  // pode perder o que digitou.
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(page.getByText('Registrar Pagamento')).toBeVisible();
});

test('QUIRK: parcela paga apenas DESABILITA editar e excluir — não os remove', async ({
  sessao: { page },
}) => {
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-pagar');

  /**
   * **Assimetria com Contas a Receber, documentada e não corrigida aqui.**
   *
   * Do lado das receitas, 14/09/2026 trocou os botões `disabled` por botões AUSENTES, com um
   * cadeado e o motivo no `title` — "um botão desabilitado convida ao clique e não explica
   * nada" —, e pôs a recusa no ponto de escrita (`excluirParcelaReceber` lança
   * `MENSAGEM_PARCELA_LIQUIDADA`). O lado das despesas ficou como estava, e a diferença tem
   * três partes:
   *
   *  1. os botões continuam presentes e `disabled`, sem explicar por quê;
   *  2. a condição é `status === 'pago'` escrita à mão, não `parcelaLiquidada` — então
   *     `'recebido'`, que `ParcelaPagar['status']` declara, passaria batido;
   *  3. **`excluirParcelaPagar` não tem guarda nenhuma** — a "segurança" aqui é só o atributo
   *     `disabled`, e o caminho de escrita segue alcançável pela fila de sync ou por qualquer
   *     chamador novo.
   *
   * Nada disso é da decomposição, e corrigir mudaria comportamento numa passada que precisa
   * poder afirmar depois que nada mudou. O teste trava o estado atual para que a mudança,
   * quando vier, seja deliberada.
   */
  const paga = linhas(page).filter({ hasText: 'Compra de urnas 1/6' });
  await expect(paga).toContainText('Pago');
  await expect(paga.getByTitle('Editar Despesa')).toBeDisabled();
  await expect(paga.getByTitle('Excluir Parcela')).toBeDisabled();
  await expect(paga.getByRole('button', { name: 'Pagar' })).toHaveCount(0);

  const emAberto = linhas(page).filter({ hasText: 'Compra de urnas 4/6' });
  await expect(emAberto).toContainText('Pendente');
  await expect(emAberto.getByTitle('Editar Despesa')).toBeEnabled();
  await expect(emAberto.getByTitle('Excluir Parcela')).toBeEnabled();
  await expect(emAberto.getByRole('button', { name: 'Pagar' })).toHaveCount(1);
});
