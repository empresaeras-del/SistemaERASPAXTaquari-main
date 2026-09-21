import { expect, test as base, type Page } from '@playwright/test';
import { instalarDubleDoServidor, type Servidor } from './dubleDoServidor';
import { montarBancoDeHomologacao, USUARIOS } from './dadosDeHomologacao';

/**
 * O alvo é escolhido por `E2E_ALVO`, e o padrão é o dublê de propósito: a suíte precisa rodar
 * onde não há rede nem segredo — este ambiente e a CI — sem ninguém configurar nada.
 *
 *   E2E_ALVO=duble        (padrão) servidor em memória, instalado com `page.route`
 *   E2E_ALVO=homologacao  o Supabase de homologação de verdade
 *
 * No modo `homologacao` o dublê não é instalado e `servidor` é `null`: as asserções sobre o
 * payload enviado não valem ali, e os specs as pulam explicitamente em vez de silenciá-las.
 */
export const ALVO = (process.env.E2E_ALVO ?? 'duble') as 'duble' | 'homologacao';
export const contraODuble = ALVO === 'duble';

export interface Sessao {
  page: Page;
  servidor: Servidor | null;
}

export const test = base.extend<{ sessao: Sessao }>({
  sessao: async ({ page }, usar) => {
    let servidor: Servidor | null = null;

    if (contraODuble) {
      servidor = await instalarDubleDoServidor(page, montarBancoDeHomologacao());
    }

    // Um erro de render vira tela em branco e um timeout ilegível dez linhas adiante. Falhar no
    // ponto em que o React quebrou é o que transforma "não achei o botão" em um diagnóstico.
    const quebras: string[] = [];
    page.on('pageerror', (e) => quebras.push(String(e)));

    await usar({ page, servidor });

    expect(quebras, `A página lançou: ${quebras.join(' | ')}`).toEqual([]);
  },
});

export { expect };

export const entrar = async (
  page: Page,
  usuario: { email: string; senha: string } = USUARIOS.admin,
) => {
  await page.goto('/login');
  await page.fill('#login-email', usuario.email);
  await page.fill('#login-password', usuario.senha);
  await page.click('button:has-text("Entrar no Sistema")');

  await expect(page, 'o login não saiu de /login — credencial ou backend').not.toHaveURL(/\/login/);
  await expect(page.locator('aside, nav').first()).toBeVisible();

  await fecharBoasVindas(page);
};

/**
 * O `WelcomeModal` abre sozinho no primeiro acesso da sessão e é um overlay `fixed inset-0` com
 * `backdrop-blur`: ele intercepta o clique em QUALQUER botão da tela por baixo. Todo fluxo que
 * loga bate nele.
 *
 * Ele é fechado clicando no X, como o operador fecha — e não semeando
 * `sessionStorage.has_seen_welcome_modal`, que seria desligar a tela em vez de passar por ela.
 * O dia em que esse modal quebrar, os fluxos falham aqui, com o nome certo. `welcome.spec.ts`
 * cobre o modal em si, para que os outros três não precisem afirmar nada sobre ele.
 */
export const fecharBoasVindas = async (page: Page) => {
  // Ele abre DEPOIS de um `loadData()`, então não está na tela quando o login termina: procurar
  // uma vez e seguir faria o overlay reaparecer no meio do fluxo, e o sintoma seria um clique
  // interceptado dez linhas adiante. Por isso a espera é pela saudação, e ela é explícita.
  const saudacao = page.getByText(/Bem-vindo\(a\)/i).first();
  const apareceu = await saudacao.waitFor({ state: 'visible', timeout: 15_000 }).then(
    () => true,
    () => false,
  );
  if (!apareceu) return;

  await page.locator('button[title="Fechar"]').first().click();
  await expect(saudacao).toBeHidden({ timeout: 10_000 });
};

/** Espera o app parar de carregar antes de procurar qualquer coisa na tela. */
export const esperarTelaPronta = async (page: Page) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.locator('text=/carregando/i').first()).toBeHidden({ timeout: 20_000 }).catch(() => {});
};

export const irPara = async (page: Page, rota: string) => {
  await page.goto(rota);
  await esperarTelaPronta(page);
};
