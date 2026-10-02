import { test, expect, entrar, irPara, contraODuble } from './apoio/sessao';
import { cpfValido } from './apoio/documentos';
import {
  abrirAssociadoParaEditar,
  destravarNavegacao,
  irParaAba,
} from './apoio/formularioDeAssociado';
import { ASSOCIADO_COLETIVO, PLANO_COLETIVO, USUARIOS } from './apoio/dadosDeHomologacao';

/**
 * Limite de vidas de plano coletivo e valor mensal exclusivo por associado.
 *
 * **A medição da produção é o que define o que este arquivo precisa provar.** Os três planos
 * coletivos declaram `limite_vidas = 2` e **11 dos 16 associados coletivos ativos excedem**,
 * chegando a 7 vidas. Ou seja: o aviso âmbar de excesso e a trava que desabilitava
 * "Confirmar e Lançar" eram o **estado normal** da base, não a exceção — e a trava era
 * contornável digitando qualquer número no "valor extra". E o valor exclusivo já existia na
 * prática: 16 de 18 associados coletivos tinham `valor_plano` diferente do valor do plano, em
 * quantias que nenhuma fórmula produz.
 *
 * As três decisões de produto que este arquivo trava:
 *
 *  1. **Só avisa, nunca trava** — exceder o limite é informativo em toda tela.
 *  2. **O valor exclusivo é o valor cheio da mensalidade**, não um acréscimo sobre o cálculo.
 *  3. **O plano não é alterado** — é literalmente o que o pedido pede, e é a asserção que
 *     separa "ajuste deste cadastro" de "mudei o plano de todo mundo".
 *
 * O associado da semente (`ANTONIO COLETIVO DOS SANTOS`, titular + 2 dependentes = 3 vidas num
 * plano de limite 2) existe para isto: antes de 02/10/2026 a semente **não tinha nenhum plano
 * coletivo**, então não havia como exercitar a regra em teste nenhum.
 */

const COLETIVO = 'ANTONIO COLETIVO DOS SANTOS';

/** O painel do contrato ativo, que é onde os dois ajustes moram. */
const abrirContratoAtivo = async (page: import('@playwright/test').Page) => {
  await irPara(page, '/associados');
  const modal = await abrirAssociadoParaEditar(page, COLETIVO);

  await destravarNavegacao(page, cpfValido());
  await irParaAba(page, 'Contratos');

  // O card "ATIVO" é um `<div onClick>` sem papel nenhum — a mesma lacuna que o helper de
  // `contratarPlano` já registra —, por isso o clique é no texto.
  await page.getByText('Editar', { exact: true }).click();
  await expect(modal.getByText('Ajustes deste Associado')).toBeVisible();
  return modal;
};

const campoLimite = (modal: import('@playwright/test').Locator) =>
  modal.getByLabel('Limite de vidas personalizado', { exact: true });

const campoValorExclusivo = (modal: import('@playwright/test').Locator) =>
  modal.getByLabel('Valor mensal exclusivo', { exact: true });

/**
 * Da aba Mensalidades até o assistente de geração, que é a tela onde a trava vivia.
 *
 * O associado coletivo não tem parcelas na semente, então `handleAbrirGeracao` abre direto —
 * sem a pergunta que o caminho da Maria tem.
 */
const abrirGeracao = async (page: import('@playwright/test').Page) => {
  const modal = page.locator('.fixed.inset-0').first();
  await irParaAba(page, 'Mensalidades');
  await page.getByRole('button', { name: /Gerar Mensalidades/ }).first().click();
  await expect(modal.getByText('Geração de Mensalidades')).toBeVisible({ timeout: 20_000 });
  return modal;
};

test('exceder o limite avisa nas duas telas e não bloqueia a geração', async ({
  sessao: { page },
}) => {
  await entrar(page, USUARIOS.admin);
  const modal = await abrirContratoAtivo(page);

  // 1. O aviso diz o número real e o limite que vale, em vez de só alertar.
  await expect(modal.getByText('Vidas acima do limite.')).toBeVisible();
  await expect(modal.getByText(/São 3 vidas e o limite que vale é 2/)).toBeVisible();
  await expect(modal.getByText(/nenhuma operação fica bloqueada por isto/)).toBeVisible();

  // 2. E a geração de mensalidades — onde a trava morava — abre e CONFIRMA.
  //    Esta é a asserção central da decisão "só avisar, nunca travar": antes, o botão ficava
  //    `disabled` até que um valor extra fosse digitado, e isso valia para a maioria da base.
  await abrirGeracao(page);
  await expect(modal.getByText('Vidas acima do limite')).toBeVisible();

  const confirmar = modal.getByRole('button', { name: 'Confirmar e Lançar' });
  await expect(confirmar).toBeVisible();
  await expect(confirmar).toBeEnabled();
});

test('limite personalizado tira o aviso sem tocar no plano', async ({
  sessao: { page, servidor },
}) => {
  await entrar(page, USUARIOS.admin);
  const modal = await abrirContratoAtivo(page);

  await expect(modal.getByText(/Vale 2 vidas \(do plano\)/)).toBeVisible();

  // 5 vidas acordadas só com este associado: as 3 cadastradas passam a caber.
  await campoLimite(modal).fill('5');

  await expect(modal.getByText('PERSONALIZADO')).toBeVisible();
  await expect(modal.getByText(/Vale 5 vidas \(acordo deste associado\)/)).toBeVisible();
  await expect(modal.getByText('Vidas acima do limite.')).toHaveCount(0);

  // "Restaurar" devolve o limite do plano — o caminho de volta existe para quem digitou errado.
  // O `title` é o que separa os dois botões "Restaurar" do card.
  await modal.locator('button[title="Voltar ao limite do plano"]').click();
  await expect(campoLimite(modal)).toHaveValue('');
  await expect(modal.getByText('Vidas acima do limite.')).toBeVisible();

  // Agora grava o acordo e confere o que SAIU.
  await campoLimite(modal).fill('5');
  await modal.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(page.locator('.fixed.inset-0')).toHaveCount(0, { timeout: 30_000 });

  test.skip(!contraODuble, 'as asserções de payload só valem contra o dublê');

  const associado = servidor!.linhas('associados').find((a) => a.id === ASSOCIADO_COLETIVO);
  expect(associado!.limite_vidas_personalizado).toBe(5);

  /**
   * **"sem alterar o respectivo plano selecionado"** é parte do pedido, e é esta asserção.
   * O caminho errado óbvio era editar `planos_pax.limite_vidas` — resolveria o aviso deste
   * associado e mudaria o teto de todos os outros do mesmo plano, em silêncio.
   */
  const plano = servidor!.linhas('planos_pax').find((p) => p.id === PLANO_COLETIVO);
  expect(plano!.limite_vidas).toBe(2);
  expect(plano!.valor_mensalidade).toBe(30);
});

test('valor exclusivo é o valor cheio da mensalidade, no cadastro e nas parcelas', async ({
  sessao: { page, servidor },
}) => {
  await entrar(page, USUARIOS.admin);
  const modal = await abrirContratoAtivo(page);

  // O placeholder anuncia o que o campo substitui: o cálculo do plano, R$ 30,00.
  await expect(campoValorExclusivo(modal)).toHaveAttribute(
    'placeholder',
    'Igual ao plano (R$ 30,00)',
  );
  await expect(modal.getByText('Calculado pelo plano: R$ 30,00')).toBeVisible();

  await campoValorExclusivo(modal).fill('75');

  /**
   * 1. "Valor Mensal" do contrato passa a mostrar o exclusivo. Ele sai de `valorPlanoAtivo`,
   *    que é a MESMA fonte do contrato impresso e do `{{valor_mensalidade}}` dos documentos —
   *    por isso o funil é o hook, e não cada tela.
   *
   * A asserção é **escopada ao campo**, não ao modal: `R$ 75,00` aparece em dois lugares
   * (aqui e no resumo do card do contrato), os dois alimentados pelo mesmo `valorPlanoAtivo`.
   * Um `getByText` solto no modal não diria qual deles apareceu — e é exatamente por isso que
   * a regra deste repositório é perguntar **de onde o texto veio**.
   */
  const valorMensal = modal
    .getByText('Valor Mensal', { exact: true })
    .locator('..')
    .getByText(/^R\$/);
  // A asserção é sobre o NÚMERO, não sobre a string inteira: `formatCurrency` usa
  // `Intl.NumberFormat`, que separa o `R$` do valor com um espaço **não separável** (U+00A0).
  // Um literal `'R$ 75,00'` digitado com espaço comum não casa com o que a tela imprime.
  await expect(valorMensal).toHaveText(/75,00/);
  await expect(
    modal.getByText('Substitui o cálculo do plano nas mensalidades e no contrato'),
  ).toBeVisible();

  /**
   * 2. Gravar o acordo é um passo próprio, e a ordem aqui é a do operador: o acordo é salvo no
   *    cadastro e **só então** as mensalidades são geradas. Gerar antes de salvar funcionaria
   *    na tela (o assistente lê o associado em memória) e deixaria o acordo sem gravar — o
   *    teste passaria afirmando algo que o próximo carregamento desmentiria.
   */
  await modal.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(page.locator('.fixed.inset-0')).toHaveCount(0, { timeout: 30_000 });

  // 3. Reaberto, o acordo está lá — e a geração de mensalidades o usa, dizendo de onde ele vem.
  const reaberto = await abrirContratoAtivo(page);
  await expect(campoValorExclusivo(reaberto)).toHaveValue('75');

  const geracao = await abrirGeracao(page);
  await expect(geracao.getByText('Valor exclusivo deste associado')).toBeVisible();
  await expect(
    geracao.getByText('Valor Calculado p/ Mensalidade').locator('..').getByText(/^R\$/),
  ).toHaveText(/75,00/);

  // Com valor exclusivo acordado, o campo "Valor Extra a Cobrar" sai de cena: ele soma sobre o
  // cálculo do plano, e o cálculo não é mais usado — deixá-lo faria o operador digitar um
  // número sem efeito nenhum.
  await expect(geracao.getByText(/Valor Extra a Cobrar/)).toHaveCount(0);

  await geracao.getByRole('button', { name: 'Confirmar e Lançar' }).click();
  // `onSuccess` do assistente faz `setShowGeracao(false)` e nada mais: o formulário do
  // associado **continua aberto** por baixo. Esperar a pilha inteira sumir aqui esperaria por
  // algo que não acontece.
  await expect(geracao.getByText('Geração de Mensalidades')).toHaveCount(0, { timeout: 30_000 });

  test.skip(!contraODuble, 'as asserções de payload só valem contra o dublê');

  /**
   * As duas asserções que importam, e são sobre o que SAIU:
   *
   *  - `valor_mensalidade_exclusivo` guarda o acordo;
   *  - `valor_plano` é o **snapshot do resultado** — é ele que a ficha impressa e o relatório
   *    leem. Deixá-lo com os R$ 30,00 do plano faria o cadastro afirmar um preço e a família
   *    pagar outro, que é exatamente o estado em que dois associados da produção estão hoje.
   */
  const associado = servidor!.linhas('associados').find((a) => a.id === ASSOCIADO_COLETIVO);
  expect(associado!.valor_mensalidade_exclusivo).toBe(75);
  expect(Number(associado!.valor_plano)).toBe(75);

  const parcelas = servidor!
    .linhas('parcelas_receber')
    .filter((p) => p.devedor_nome === COLETIVO);
  expect(parcelas.length, 'nenhuma parcela foi gravada').toBeGreaterThan(0);
  for (const parcela of parcelas) {
    expect(Number(parcela.valor)).toBe(75);
  }
});

test('apagar o valor exclusivo grava null e devolve o cálculo do plano', async ({
  sessao: { page, servidor },
}) => {
  await entrar(page, USUARIOS.admin);

  // Primeiro grava o acordo, para depois ter o que desfazer.
  let modal = await abrirContratoAtivo(page);
  await campoValorExclusivo(modal).fill('75');
  await modal.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(page.locator('.fixed.inset-0')).toHaveCount(0, { timeout: 30_000 });

  modal = await abrirContratoAtivo(page);
  await expect(campoValorExclusivo(modal)).toHaveValue('75');
  await expect(modal.getByText('PERSONALIZADO')).toBeVisible();

  await modal.locator('button[title="Voltar ao cálculo do plano"]').click();
  await expect(campoValorExclusivo(modal)).toHaveValue('');
  await expect(modal.getByText('Calculado pelo plano: R$ 30,00')).toBeVisible();

  await modal.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(page.locator('.fixed.inset-0')).toHaveCount(0, { timeout: 30_000 });

  test.skip(!contraODuble, 'as asserções de payload só valem contra o dublê');

  /**
   * **`null`, não `undefined`**, e é por isso que este caso existe separado: `JSON.stringify`
   * descarta chave `undefined`, então o `upsert` chegaria ao Postgres sem a coluna e os R$ 75
   * continuariam gravados. O operador apagaria o campo, salvaria, veria "sucesso" — e o acordo
   * velho seguiria valendo. É a armadilha que o CLAUDE.md já registra nos dados do responsável
   * do atendimento e no vínculo da empresa conveniada.
   */
  const associado = servidor!.linhas('associados').find((a) => a.id === ASSOCIADO_COLETIVO);
  expect(associado!.valor_mensalidade_exclusivo).toBeNull();
  expect(Number(associado!.valor_plano)).toBe(30); // volta ao cálculo do plano
});

test('valor exclusivo zero é cortesia, não campo vazio', async ({
  sessao: { page, servidor },
}) => {
  await entrar(page, USUARIOS.admin);
  const modal = await abrirContratoAtivo(page);

  await campoValorExclusivo(modal).fill('0');

  // Zero é um valor acordado — mensalidade de cortesia —, e `0 || x` o trataria como ausência.
  await expect(modal.getByText('PERSONALIZADO')).toBeVisible();
  await expect(
    modal.getByText('Substitui o cálculo do plano nas mensalidades e no contrato'),
  ).toBeVisible();

  await modal.getByRole('button', { name: 'Salvar Alterações' }).click();
  await expect(page.locator('.fixed.inset-0')).toHaveCount(0, { timeout: 30_000 });

  test.skip(!contraODuble, 'as asserções de payload só valem contra o dublê');

  const associado = servidor!.linhas('associados').find((a) => a.id === ASSOCIADO_COLETIVO);
  expect(associado!.valor_mensalidade_exclusivo).toBe(0);
  expect(Number(associado!.valor_plano)).toBe(0);
});

test('o limite não aparece em plano individual, onde não existe teto', async ({
  sessao: { page },
}) => {
  await entrar(page, USUARIOS.admin);

  await irPara(page, '/associados');
  const modal = await abrirAssociadoParaEditar(page, 'MARIA APARECIDA DA SILVA');
  await destravarNavegacao(page, cpfValido());
  await irParaAba(page, 'Contratos');
  await page.getByText('Editar', { exact: true }).click();

  await expect(modal.getByText('Ajustes deste Associado')).toBeVisible();

  // No plano individual o preço escala com as vidas e não há limite para personalizar — um
  // campo ali convidaria a acordar um teto que o cálculo ignora.
  await expect(campoLimite(modal)).toHaveCount(0);
  await expect(campoValorExclusivo(modal)).toBeVisible();
  await expect(modal.getByText('Vidas acima do limite.')).toHaveCount(0);
});
