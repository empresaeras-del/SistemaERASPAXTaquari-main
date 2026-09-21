import { test, expect, entrar, irPara, contraODuble } from './apoio/sessao';
import { emitirGuia, preencherGuia } from './apoio/formularioDeGuia';
import { CREDENCIADO, EMPRESA_PAX, PROCEDIMENTO } from './apoio/dadosDeHomologacao';

/**
 * Fluxo 3 — emitir uma guia.
 *
 * Três defeitos deste caminho estão travados aqui:
 *
 * - **A cobrança era automática.** Até 11/09/2026 emitir uma guia com co-participação criava a
 *   conta a receber sozinha, no meio do salvamento — não havia como emitir uma guia de cortesia,
 *   e na reedição ela cobrava de novo, em silêncio, a cada save. Por isso o segundo teste é o
 *   que mais importa: ele exige que "não" termine com a guia gravada e ZERO receita.
 * - **O `CHECK` de `status` não conhecia `'emitida'`**, o status com que o app cria toda guia, e
 *   um retry regravava com `'pendente'` — um estado que o operador não escolheu.
 * - **A co-participação nunca chegava ao servidor** (migration `20260920141609`): o valor que a
 *   grade mostra sai de `credenciados_procedimentos.valor_coparticipacao`, a coluna que até
 *   20/09 não existia. É ele que vira o valor da conta a receber.
 */
const GUIA = {
  associado: 'MARIA APARECIDA DA SILVA',
  credenciado: 'Clinica Exemplo',
  procedimento: 'Consulta em consultorio',
};

test('emite a guia e gera a cobrança da co-participação', async ({ sessao: { page, servidor } }) => {
  await entrar(page);
  await irPara(page, '/requisicoes');

  await preencherGuia(page, GUIA);

  // A co-participação vem do VÍNCULO credenciado↔procedimento, não digitada. Esta asserção é o
  // fluxo alcançando a coluna que a migration 20260920141609 criou — sem ela o valor ficava só
  // no IndexedDB de quem digitou, e a grade de todos os outros mostrava zero.
  const linhaDoItem = page.locator('tr', { hasText: 'Consulta em consultorio' });
  await expect(linhaDoItem).toContainText('R$ 20,00');

  await emitirGuia(page);

  // A pergunta mostra o que será criado ANTES de existir registro: montar a proposta não grava
  // nada, e é isso que torna a recusa tão barata quanto a confirmação.
  // Escopado ao diálogo, não à página: o nome do associado também está no `<option>` do select
  // por baixo, e um `getByText(...).first()` casaria com ele — afirmando sobre o formulário em
  // vez de sobre a pergunta. O resumo é o que o operador lê para decidir; ele tem de estar aqui.
  const perguntaDeCobranca = page.locator('.fixed.inset-0').filter({ hasText: 'Gerar cobrança?' });
  await expect(perguntaDeCobranca).toBeVisible();
  await expect(perguntaDeCobranca).toContainText('R$ 140,00');
  await expect(perguntaDeCobranca).toContainText(GUIA.associado);
  await expect(perguntaDeCobranca).toContainText(/REQ-[\d-]+/);

  await page.getByRole('button', { name: 'Sim, gerar cobrança' }).click();

  // O aviso nomeia a guia: é a confirmação de que ela foi emitida, e o número é o mesmo que a
  // listagem passa a mostrar. Esperar só o modal fechar não distinguiria sucesso de erro.
  await expect(page.getByText(/Guia REQ-[\d-]+ emitida com sucesso/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('tr', { hasText: GUIA.associado })).toHaveCount(1);

  test.skip(!contraODuble, 'as asserções sobre o que foi gravado só valem contra o dublê');

  const guias = servidor!.linhas('requisicoes');
  expect(guias).toHaveLength(1);
  const guia = guias[0];

  // `'emitida'` é o status do domínio do app. O retry removido gravava `'pendente'`, que não
  // está em `StatusRequisicao` e aparecia na tela com um `as any` denunciando o problema.
  expect(guia.status).toBe('emitida');
  expect(guia.tenant_id).toBe(EMPRESA_PAX);
  expect(guia.credenciado_id).toBe(CREDENCIADO);

  const itens = servidor!.linhas('requisicao_itens').filter((i) => i.requisicao_id === guia.id);
  expect(itens).toHaveLength(1);
  expect(itens[0].procedimento_id).toBe(PROCEDIMENTO);

  // Filtrado pela guia: o banco de homologação já nasce com a mensalidade do João semeada, e
  // contar a tabela inteira faria este teste afirmar algo sobre o seed, não sobre o fluxo.
  const daGuia = servidor!.linhas('receitas').filter((r) => r.requisicao_id === guia.id);
  expect(daGuia, 'a resposta "sim" não gerou a conta a receber').toHaveLength(1);
  // O vínculo é por id, não pelo texto da descrição — é ele que faz a reedição saber que já
  // cobrou, e é a coluna que a migration 20260911124654 criou exatamente para esta pergunta.
  expect(daGuia[0].tenant_id).toBe(EMPRESA_PAX);
  expect(Number(daGuia[0].valor_total)).toBe(140);
});

test('recusar a cobrança emite a guia mesmo assim, sem receita nenhuma', async ({
  sessao: { page, servidor },
}) => {
  // O caso que era impossível antes de 11/09/2026: emitir sem cobrar. A guia já está gravada
  // quando a pergunta aparece, então "não" não pode desfazer nada — nem criar nada.
  await entrar(page);
  await irPara(page, '/requisicoes');

  await preencherGuia(page, GUIA);
  await emitirGuia(page);

  await expect(page.locator('.fixed.inset-0').filter({ hasText: 'Gerar cobrança?' })).toBeVisible();
  await page.getByRole('button', { name: 'Não gerar' }).click();

  // O aviso diz explicitamente que NÃO houve cobrança — um "emitida com sucesso" sozinho
  // deixaria o operador sem saber se a conta a receber nasceu ou não.
  await expect(page.getByText(/sem cobrança de co-participação/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Guia REQ-[\d-]+ emitida com sucesso/)).toBeVisible();

  test.skip(!contraODuble, 'as asserções sobre o que foi gravado só valem contra o dublê');

  const guias = servidor!.linhas('requisicoes');
  expect(guias, 'a guia não foi gravada').toHaveLength(1);

  // Nenhuma receita aponta para esta guia. Contar a tabela inteira não serviria: o seed já traz
  // a mensalidade do João, e o teste precisa falar do que ESTE fluxo criou.
  const daGuia = servidor!.linhas('receitas').filter((r) => r.requisicao_id === guias[0].id);
  expect(daGuia, '"não gerar" criou cobrança assim mesmo').toHaveLength(0);
});
