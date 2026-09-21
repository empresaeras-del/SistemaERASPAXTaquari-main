import { test, expect, entrar, esperarTelaPronta, fecharBoasVindas } from './apoio/sessao';
import { USUARIOS } from './apoio/dadosDeHomologacao';

test('entra no sistema e chega numa tela autenticada', async ({ sessao: { page } }) => {
  await entrar(page);
  await esperarTelaPronta(page);
  expect(page.url()).not.toContain('/login');
  await expect(page.getByRole('link', { name: 'Lista de Associados' })).toBeVisible();
});

test('credencial errada não entra, e a mensagem diz o que houve', async ({ sessao: { page } }) => {
  await page.goto('/login');
  await page.fill('#login-email', USUARIOS.admin.email);
  await page.fill('#login-password', 'senha-que-nao-e-a-dele');
  await page.click('button:has-text("Entrar no Sistema")');

  await expect(page).toHaveURL(/\/login/);
  // `Invalid login credentials` significa senha errada — o GoTrue confere a senha ANTES de
  // olhar a confirmação do e-mail, e o CLAUDE.md registra que distinguir os dois erros é o que
  // separa "redefinir a senha" de "reenviar o convite".
  await expect(page.getByText(/inválid|incorret|credenc/i).first()).toBeVisible({ timeout: 20_000 });
});

test('o modal de boas-vindas abre no primeiro acesso e fecha pelo X', async ({ sessao: { page } }) => {
  // Este teste existe para os outros três fluxos NÃO precisarem afirmar nada sobre ele. O
  // `WelcomeModal` é um overlay `fixed inset-0` com `backdrop-blur` que intercepta o clique em
  // qualquer botão por baixo, então todo fluxo que loga passa por ele — e `entrar()` o fecha
  // clicando no X, como o operador fecha, em vez de semear `sessionStorage`. Se ele quebrar, os
  // fluxos falham lá; é aqui que o defeito ganha nome.
  await page.goto('/login');
  await page.fill('#login-email', USUARIOS.admin.email);
  await page.fill('#login-password', USUARIOS.admin.senha);
  await page.click('button:has-text("Entrar no Sistema")');

  const saudacao = page.getByText(/Bem-vindo\(a\)/i).first();
  await expect(saudacao).toBeVisible({ timeout: 20_000 });

  await fecharBoasVindas(page);
  await expect(saudacao).toBeHidden();
});
