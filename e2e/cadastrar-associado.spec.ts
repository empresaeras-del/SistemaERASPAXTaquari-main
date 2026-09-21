import { test, expect, entrar, irPara, contraODuble } from './apoio/sessao';
import { cpfValido, marcaDaRodada } from './apoio/documentos';
import {
  abrirNovoAssociado,
  avancarEtapa,
  contratarPlano,
  preencherDadosBasicos,
} from './apoio/formularioDeAssociado';
import { EMPRESA_PAX, PLANO_INDIVIDUAL } from './apoio/dadosDeHomologacao';

/**
 * Fluxo 1 — cadastrar associado com plano.
 *
 * O que a suíte de unidade deste projeto NÃO alcança e este teste alcança: que as cinco etapas
 * do formulário navegam, que o assistente de contrato abre a partir de um card, que a validação
 * de CPF barra na etapa certa, e **o que sai no payload** quando o operador clica em confirmar.
 *
 * As asserções de payload são o miolo. Quase todo defeito grave deste repositório foi um payload
 * errado saindo calado — o `plano_pax_id` que virava `null` no retry de `resilientSupabaseUpsert`
 * (a tela dizia "salvo com sucesso" e a mensalidade perdia a base de cálculo), o `fornecedor_id`
 * desestruturado para fora, o `status` de associado copiado num contrato que o `CHECK` recusa.
 */
test('cadastra um associado com plano e o vínculo chega ao servidor', async ({
  sessao: { page, servidor },
}) => {
  const nome = `TESTE DE FLUXO ${marcaDaRodada()}`;
  const cpf = cpfValido();

  await entrar(page);
  await irPara(page, '/associados');

  await abrirNovoAssociado(page);
  await preencherDadosBasicos(page, { nome, cpf });

  await avancarEtapa(page); // Dados Básicos -> Dependentes
  await expect(page.getByText(/Dependentes do Associado/i)).toBeVisible();

  await avancarEtapa(page); // Dependentes -> Contrato
  await expect(page.getByText(/Contratos do Associado/i)).toBeVisible();

  const numeroDoContrato = await contratarPlano(page, 'Plano Individual');
  expect(numeroDoContrato).toMatch(/^CTR-/);

  // O titular aparece na LISTA, com o plano ao lado. A primeira versão deste teste procurava o
  // nome em qualquer lugar da página e passava com zero escritas no servidor — ele estava no
  // cabeçalho do próprio formulário ainda aberto. Procurar dentro de `main`, com o modal já
  // fechado, é o que torna a asserção uma afirmação sobre o cadastro e não sobre o formulário.
  const naLista = page.locator('main').getByText(nome, { exact: true });
  await expect(naLista).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('main')).toContainText(cpf);

  test.skip(!contraODuble, 'as asserções de payload só valem contra o dublê');

  const escritas = servidor!.escritasEm('associados');
  expect(escritas.length, 'o associado não foi enviado ao servidor').toBeGreaterThan(0);

  const gravado = servidor!.linhas('associados').find((a) => a.nome === nome);
  expect(gravado, 'o associado não existe no servidor depois do fluxo').toBeTruthy();

  // 1. O plano precisa CHEGAR. É este campo que o retry antigo anulava para conseguir gravar.
  expect(gravado!.plano_pax_id, 'o associado foi gravado SEM plano').toBe(PLANO_INDIVIDUAL);

  // 2. O tenant é o da empresa do usuário, nunca um literal inventado.
  expect(gravado!.tenant_id).toBe(EMPRESA_PAX);
  expect(['default_tenant', 'empresa_padrao', 'all', 'emp-001', 'system']).not.toContain(
    gravado!.tenant_id,
  );

  // 3. Nenhum payload leva coluna legada. As 10 foram dropadas na migration 20260915132838, e
  //    um nome desses no corpo volta como PGRST204 contra o banco de verdade.
  const LEGADAS = ['logradouro', 'numero', 'bairro', 'cidade', 'cep', 'uf', 'plano_id'];
  for (const escrita of escritas) {
    const corpo = Array.isArray(escrita.payload) ? escrita.payload : [escrita.payload];
    for (const linha of corpo) {
      for (const legada of LEGADAS) {
        expect(Object.keys(linha ?? {}), `payload de associados com a coluna legada "${legada}"`)
          .not.toContain(legada);
      }
    }
  }

  // 4. O contrato nasce com status do domínio de CONTRATOS. `associados.status` aceita
  //    'inadimplente' e `contratos_status_check` não — copiar um no outro dá 23514.
  const contrato = servidor!
    .linhas('contratos')
    .find((c) => c.numero_contrato === numeroDoContrato);
  expect(contrato, 'o contrato não foi gravado').toBeTruthy();
  expect(['ativo', 'inativo', 'encerrado', 'cancelado']).toContain(contrato!.status);
  expect(contrato!.plano_pax_id).toBe(PLANO_INDIVIDUAL);
  expect(contrato!.tenant_id).toBe(EMPRESA_PAX);

  // 5. As mensalidades do contrato nasceram junto — uma receita e as 12 parcelas dela. Sem
  //    isto, "cadastrou com plano" significaria só uma linha em `associados`, e o associado
  //    ficaria exatamente no estado que a própria tela denuncia como "SEM MENSALIDADES".
  const receita = servidor!.linhas('receitas').find((r) => r.associado_nome === nome);
  expect(receita, 'o contrato não gerou receita').toBeTruthy();

  const parcelas = servidor!.linhas('parcelas_receber').filter((p) => p.receita_id === receita!.id);
  expect(parcelas).toHaveLength(12);
  expect(new Set(parcelas.map((p) => p.numero_parcela)).size, 'parcelas com número repetido').toBe(12);
  expect(parcelas.every((p) => p.tenant_id === EMPRESA_PAX)).toBe(true);

  // A primeira parcela carrega a taxa de adesão (R$ 50 do Plano Individual sobre R$ 60), as
  // demais são o valor de face. É o número que o operador leu na prévia antes de confirmar.
  const porNumero = new Map(parcelas.map((p) => [p.numero_parcela, p]));
  expect(Number(porNumero.get(1)!.valor)).toBe(110);
  expect(Number(porNumero.get(2)!.valor)).toBe(60);
});
