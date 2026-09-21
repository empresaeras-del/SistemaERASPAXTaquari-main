import { test, expect, entrar, irPara, contraODuble } from './apoio/sessao';
import { abrirLoteDeCaixa } from './apoio/caixa';
import { EMPRESA_PAX, RECEITA_JOAO, USUARIOS } from './apoio/dadosDeHomologacao';

/**
 * Fluxo 2 — receber uma parcela.
 *
 * É o fluxo com mais história de defeito neste repositório, e cada asserção abaixo trava um
 * deles: o lote e a movimentação nasciam com `'tenant-1'`/`'tenant-default'` carimbados (e, com
 * o seletor em `'all'`, o super_admin recebia no caixa de OUTRA empresa); o recibo só existia
 * como reimpressão, então o recebimento terminava sem documento; e a parcela liquidada seguia
 * editável e excluível em Contas a Receber.
 */
test('liquida uma parcela: baixa, movimentação no caixa e recibo', async ({
  sessao: { page, servidor },
}) => {
  await entrar(page);
  const codigoDoLote = await abrirLoteDeCaixa(page);
  expect(codigoDoLote).toMatch(/^LOTE-/);

  await irPara(page, '/financeiro/contas-a-receber');

  const linhaDaParcela = page.locator('tr', { hasText: 'Mensalidade Plano Individual 4/12' });
  await expect(linhaDaParcela).toContainText('Pendente');

  await linhaDaParcela.getByRole('button', { name: 'Receber' }).click();
  await expect(page.getByText('Registrar Recebimento')).toBeVisible();
  // Minúsculo no DOM: o "PARCELA 4/12" que se lê na tela é `text-transform: uppercase`, e um
  // dump do innerText mostra a forma JÁ transformada. Casar pelo que se vê quebraria aqui.
  await expect(page.getByText(/parcela 4\/12/i).first()).toBeVisible();

  // O modal já vem com a data de hoje, o valor de face, a forma de pagamento e a conta: o
  // operador confirma. Preencher tudo de novo aqui esconderia um padrão que sumisse.
  await page.getByRole('button', { name: 'Confirmar Recebimento' }).click();

  // Segunda confirmação, e ela existe por um bom motivo: mostra em QUAL lote o dinheiro vai
  // entrar. Foi justamente esse destino que o `'all'` desligando o filtro de tenant levava para
  // o caixa de outra empresa, sem nada na tela dizendo.
  await expect(page.getByText('Confirmação de Registro no Lote')).toBeVisible();
  await expect(page.getByText(codigoDoLote).first()).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar e Registrar no Lote' }).click();

  // O recibo abre SOZINHO ao fim da liquidação. Antes ele só existia no botão de reimpressão da
  // linha, e quem acabava de receber tinha de achar a parcela certa e clicar.
  await expect(page.getByText(/Recibo de Pagamento/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Quitado').first()).toBeVisible();
  await expect(page.getByText(/JOAO BATISTA SOUZA/).first()).toBeVisible();

  test.skip(!contraODuble, 'as asserções sobre o que foi gravado só valem contra o dublê');

  const parcela = servidor!
    .linhas('parcelas_receber')
    .find((p) => p.receita_id === RECEITA_JOAO && p.numero_parcela === 4)!;

  // 1. A baixa. "Liquidada" tem dois nomes neste schema, e quem checa um só cobre metade.
  expect(['recebido', 'pago']).toContain(parcela.status);
  expect(Number(parcela.valor_recebido)).toBe(60);
  expect(parcela.data_pagamento, 'a parcela foi marcada sem data de liquidação').toBeTruthy();

  // 2. O lote e a movimentação nascem na empresa certa — nunca num literal inventado.
  const lote = servidor!.linhas('lotes_caixa').find((l) => l.codigo_lote === codigoDoLote)!;
  expect(lote.tenant_id).toBe(EMPRESA_PAX);
  expect(['tenant-1', 'tenant-default', 'default_tenant', 'empresa_padrao', 'all']).not.toContain(
    lote.tenant_id,
  );

  const movimentacoes = servidor!.linhas('movimentacoes_caixa').filter((m) => m.lote_id === lote.id);
  expect(movimentacoes, 'a liquidação não gerou movimentação no lote aberto').toHaveLength(1);
  expect(movimentacoes[0].tenant_id).toBe(EMPRESA_PAX);
  expect(Number(movimentacoes[0].valor)).toBe(60);
  expect(movimentacoes[0].tipo).toBe('entrada');
  // A movimentação aponta para a parcela: é o que torna a sincronização idempotente por
  // `referencia_id` — sem ele, rodar de novo traria o mesmo recebimento duas vezes.
  expect(movimentacoes[0].referencia_id).toBe(parcela.id);
});

test('parcela liquidada perde editar e excluir na tela', async ({ sessao: { page } }) => {
  // A guarda de verdade está no ponto de escrita (`atualizarParcelaReceber` lança), e há teste
  // de unidade para ela. O que só esta camada alcança é a outra metade: que a tela não OFERECE
  // a ação. Em Contas a Receber os botões eram `disabled` — um botão desabilitado convida ao
  // clique e não explica nada —, e passaram a sumir.
  await entrar(page);
  await irPara(page, '/financeiro/contas-a-receber');

  const liquidada = page.locator('tr', { hasText: 'Mensalidade Plano Individual 1/12' });
  await expect(liquidada).toContainText('Recebido');
  await expect(liquidada.getByTitle('Excluir Parcela')).toHaveCount(0);
  await expect(liquidada.getByTitle('Editar Receita')).toHaveCount(0);
  await expect(liquidada.getByRole('button', { name: 'Receber' })).toHaveCount(0);

  const emAberto = page.locator('tr', { hasText: 'Mensalidade Plano Individual 5/12' });
  await expect(emAberto).toContainText('Pendente');
  await expect(emAberto.getByTitle('Excluir Parcela')).toHaveCount(1);
  await expect(emAberto.getByRole('button', { name: 'Receber' })).toHaveCount(1);
});

test('DEFEITO ARMADO: super_admin sem empresa abre o caixa com o tenant "default"', async ({
  sessao: { page, servidor },
}) => {
  /**
   * Achado por este teste, e ele é o único caminho desta suíte que o alcança.
   *
   * O super_admin entra com o seletor do topo em `'all'`, e `tenantDeEscrita('all', 'default')`
   * cai no segundo ramo: `'default'` é o `tenant_id` do próprio super_admin e **não** está em
   * `TENANTS_LEGADOS_CORINGA`, então passa em `ehTenantUtilizavel`. O lote de caixa nasce
   * carimbado com um valor que não é empresa nenhuma.
   *
   * É a mesma classe do `'system'` da Ata de Ocorrências, na variante que ESCONDE: nenhum admin
   * enxerga esse lote (a RLS avalia `has_tenant_access('default')`, falso para todos), e o
   * dinheiro recebido nele não aparece no caixa de ninguém. O CLAUDE.md já registra o princípio
   * em `utils/escopoAuditoria.ts` — "o `tenant_id` do próprio super_admin nunca vira filtro, ele
   * é `'default'` em produção" —, mas `tenantDeEscrita` não conhece a exceção.
   *
   * **Armado, nunca disparado**: conferido em produção, o super_admin é de fato `'default'` e
   * NENHUMA linha de `lotes_caixa`, `movimentacoes_caixa`, `receitas`, `despesas`,
   * `parcelas_receber` ou `associados` tem esse tenant — na prática ele sempre escolhe a
   * empresa antes de gravar. Basta não escolher uma vez.
   *
   * Corrigir é acrescentar `'default'` à lista de tenants inutilizáveis, e isso muda o
   * comportamento de 34 call sites de uma vez: o super_admin passaria a ser RECUSADO em toda
   * gravação enquanto não escolhesse a empresa. É decisão de produto sobre um papel inteiro,
   * não limpeza — por isso o teste trava o comportamento atual em vez de descrevê-lo. Quando a
   * correção vier, ele reprova e obriga a mudança a ser deliberada.
   */
  await entrar(page, USUARIOS.superAdmin);

  // O seletor do topo confirma o estado: é ele que vale `'all'`.
  await expect(page.locator('select:visible').first()).toHaveValue('all');

  await irPara(page, '/financeiro/caixas');
  await page.getByRole('button', { name: 'Abrir Caixa' }).click();
  await page.locator('input[type="number"]:visible').fill('100');
  await page.getByRole('button', { name: 'Abrir Lote' }).click();

  await expect(page.getByText(/Caixa Atual: LOTE-/)).toBeVisible({ timeout: 20_000 });

  test.skip(!contraODuble, 'as asserções sobre o que foi gravado só valem contra o dublê');

  const lotes = servidor!.linhas('lotes_caixa');
  expect(lotes).toHaveLength(1);

  // O comportamento de hoje. Se algum dia isto virar `MENSAGEM_TENANT_INDEFINIDO`, ou se o
  // valor mudar para outro literal, este teste reprova — que é exatamente o que se quer.
  expect(lotes[0].tenant_id).toBe('default');
  expect(lotes[0].tenant_id).not.toBe(EMPRESA_PAX);
});
