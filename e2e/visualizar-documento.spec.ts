import { test, expect, entrar, irPara } from './apoio/sessao';

/**
 * Linha de base do visualizador de documento padrão, escrita contra o arquivo monolítico
 * (1912 linhas) e passando nele antes de qualquer extração.
 *
 * O que este visualizador existe para fazer é **resolver `{{variavel}}`**: o modelo é escrito
 * uma vez, com marcadores, e cada documento impresso sai com os dados de uma empresa, de um
 * associado, de um atendimento. Um teste que só verificasse "o modal abriu" não mediria nada
 * disso — e é justamente a sincronia entre o catálogo de variáveis e o resolver que o
 * CLAUDE.md registra como divergência **muda**: a tag aparece no painel e nunca preenche.
 *
 * Por isso as asserções são sobre a folha: a tag some, o valor entra, e a tag de um módulo
 * que ninguém selecionou continua visível — é ela que diz que a substituição foi seletiva e
 * não uma limpeza cega de `{{...}}`.
 */

/**
 * Abre o visualizador e devolve o corpo da FOLHA.
 *
 * O escopo é `.doc-content` — a classe que `documentoPrintStyles.ts` nomeia —, e isso não é
 * preferência: a barra lateral lista cada `{{variavel}}` como texto ao lado do nome dela, então
 * `not.toContainText('{{empresa_nome}}')` no modal inteiro **nunca** passa, com ou sem defeito.
 * Ao afirmar que uma tag sumiu, pergunte de onde aquele texto viria.
 */
const abrirVisualizador = async (page: import('@playwright/test').Page) => {
  await irPara(page, '/documentos');

  const linha = page.locator('tr').filter({ hasText: 'Contrato de Adesao PAX' }).first();
  await linha.locator('button[title="Visualizar Impressão"]').click();

  await expect(page.getByText('Empresa Emissora')).toBeVisible();
  const folha = page.locator('.doc-content').first();
  await expect(folha).toBeVisible();
  return folha;
};

const ASSOCIADO_MARIA_LABEL =
  'MARIA APARECIDA DA SILVA (CPF: 000.000.000-01) [Contrato: CTR-HML00001]';

test('o visualizador abre com o modelo e a barra identifica o documento', async ({
  sessao: { page },
}) => {
  await entrar(page);
  const modal = page.locator('.fixed.inset-0').first();

  await abrirVisualizador(page);

  await expect(modal).toContainText('Contrato de Adesao PAX');
  // Os oito seletores da barra lateral são o painel de inserção automática — cada um
  // alimenta um módulo de variáveis diferente.
  await expect(modal).toContainText('Empresa Emissora');
  await expect(modal).toContainText('Associado & Contrato');
  await expect(modal).toContainText('Plano PAX');
});

test('escolher a empresa resolve as variáveis do módulo empresa — e só elas', async ({
  sessao: { page },
}) => {
  await entrar(page);
  const modal = page.locator('.fixed.inset-0').first();

  const folha = await abrirVisualizador(page);

  await modal
    .locator('select:visible:has(option:text-is("Selecione a empresa..."))')
    .selectOption({ label: 'PAX Homologacao' });

  // A tag SOME e o valor ENTRA. Verificar só uma das duas coisas deixa passar os dois
  // defeitos opostos: uma tag apagada sem substituição, e um valor escrito ao lado da tag.
  await expect(folha).not.toContainText('{{empresa_nome}}');
  await expect(folha).toContainText('PAX Homologacao');

  // E o módulo que ninguém escolheu continua com a tag à mostra: é isso que separa
  // "resolveu a empresa" de "apagou todo `{{...}}` da folha".
  await expect(folha).toContainText('{{associado_nome}}');
});

test('escolher o associado resolve nome, CPF e plano na folha', async ({ sessao: { page } }) => {
  await entrar(page);
  const modal = page.locator('.fixed.inset-0').first();

  const folha = await abrirVisualizador(page);

  await modal
    .locator('select:visible:has(option:text-is("Selecione um associado..."))')
    .selectOption({ label: ASSOCIADO_MARIA_LABEL });

  await expect(folha).not.toContainText('{{associado_nome}}');
  await expect(folha).toContainText('MARIA APARECIDA DA SILVA');

  // Três variáveis do MESMO módulo, porque o resolver preenche o módulo inteiro de uma vez:
  // se só a primeira casasse, o defeito seria exatamente o que o catálogo esconde.
  await expect(folha).not.toContainText('{{associado_cpf}}');
  await expect(folha).toContainText('000.000.000-01');
  await expect(folha).not.toContainText('{{plano_nome}}');
  await expect(folha).toContainText('Plano Familiar');
});

test('DEFEITO: trocar para paisagem grava no servidor e a TELA volta para retrato', async ({
  sessao: { page, servidor },
}) => {
  await entrar(page);
  const modal = page.locator('.fixed.inset-0').first();

  await abrirVisualizador(page);

  const papel = page.locator('#print-area-documento');
  await expect(papel).toHaveAttribute('style', /width: 210mm/);

  await modal.getByRole('button', { name: /Paisagem/i }).click();
  // A folha vira paisagem por um instante e é revertida. Esperar o assentamento é o que
  // torna este teste determinístico: a primeira versão usava `toPass`, que às vezes pegava
  // o transiente e passava — flaky por medir um estado que não dura.
  await page.waitForTimeout(2500);

  // O SERVIDOR recebeu 'paisagem', sem erro nenhum...
  const gravado = servidor!.linhas('documentos_padroes')[0];
  expect(gravado.orientacao, 'a orientação não chegou ao servidor').toBe('paisagem');

  // ...e a TELA voltou para retrato. O efeito de inicialização (deps
  // `[documento, isOpen, modulosDetectados]`) re-roda depois que `editar` recarrega a lista
  // e reaplica `documento.orientacao` do objeto AINDA ANTIGO que a página segura em
  // `docToPrint` — ela nunca o atualiza a partir da lista recarregada.
  //
  // **Defeito de produção, não da decomposição**: reproduzido igual contra o arquivo
  // monolítico, 3 de 3. E não é cosmético — o operador clica em Paisagem, vê a folha voltar
  // ao retrato e clica de novo, o que grava 'retrato' por cima. Corrigir é decisão sobre
  // quem manda na orientação depois de salvar (a página, atualizando `docToPrint`, ou o
  // visualizador, deixando de reaplicar), e não cabe numa passada de decomposição.
  await expect(papel).toHaveAttribute('style', /width: 210mm/);
});

test('QUIRK: limpar as seleções esvazia os selects e NÃO devolve as tags à folha', async ({
  sessao: { page },
}) => {
  await entrar(page);
  const modal = page.locator('.fixed.inset-0').first();

  const folha = await abrirVisualizador(page);

  const seletor = modal.locator(
    'select:visible:has(option:text-is("Selecione um associado..."))',
  );
  await seletor.selectOption({ label: ASSOCIADO_MARIA_LABEL });
  await expect(folha).toContainText('MARIA APARECIDA DA SILVA');

  await modal.getByRole('button', { name: 'Limpar Seleções de Módulos' }).click();

  // O select volta ao vazio...
  await expect(seletor).toHaveValue('');

  // ...mas a FOLHA continua com os dados da pessoa anterior. `handleResetSelections` zera os
  // nove ids selecionados e não toca em `placeholderValues`, que é de onde `renderedHtml`
  // sai — quem limpa os valores é o outro botão, "Limpar Campos".
  //
  // **Documentado, não corrigido.** O estado alcançável é: o operador limpa, não escolhe
  // ninguém, e imprime um contrato com o nome do associado anterior — sem nada na tela
  // dizendo isso. Fazer os dois botões virarem um é decisão de produto sobre o que "limpar"
  // significa aqui, não limpeza de código, e não cabe numa passada de decomposição. O teste
  // trava o comportamento atual para que a mudança, quando vier, seja deliberada.
  await expect(folha).toContainText('MARIA APARECIDA DA SILVA');
  await expect(folha).not.toContainText('{{associado_nome}}');
});
