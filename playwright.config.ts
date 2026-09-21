import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// O projeto é `"type": "module"`, então `__dirname` não existe aqui.
const aquiDentro = path.dirname(fileURLToPath(import.meta.url));

/**
 * Estes testes GRAVAM no banco: eles cadastram associado, liquidam parcela e emitem guia.
 * Por isso o ambiente não é opcional nem herdado do `.env.local` de quem está rodando — ele é
 * lido daqui, do arquivo de homologação versionado, e conferido antes de subir o servidor.
 *
 * O projeto de homologação existe exatamente para isto (ver CLAUDE.md): não tem dado de
 * produção, é reconstruído por `supabase/migrations/` + `supabase/seed-homologacao.sql`, e pode
 * ser apagado e recriado a qualquer momento.
 */
const URL_PRODUCAO = 'qigytjkgehwxalhmwpdd';

const lerEnvHomologacao = (): Record<string, string> => {
  const arquivo = path.resolve(aquiDentro, '.env.homologacao.example');
  const env: Record<string, string> = {};

  for (const linha of readFileSync(arquivo, 'utf-8').split('\n')) {
    const casa = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (casa) env[casa[1]] = casa[2];
  }

  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error(`Faltam VITE_SUPABASE_URL/ANON_KEY em ${arquivo}.`);
  }

  // A trava que importa. Um `.env.homologacao.example` apontado para produção por engano faria
  // esta suíte cadastrar associado e liquidar parcela no banco real — e liquidar é justamente o
  // que este sistema trata como irreversível (ver "Parcela liquidada é intocável").
  if (env.VITE_SUPABASE_URL.includes(URL_PRODUCAO)) {
    throw new Error(
      'RECUSADO: a URL de homologação aponta para o projeto de PRODUÇÃO. Estes testes gravam dados.',
    );
  }

  return env;
};

const envHomologacao = lerEnvHomologacao();

export default defineConfig({
  testDir: './e2e',
  // Os três fluxos compartilham o mesmo banco e se atrapalhariam em paralelo: o do recebimento
  // abre lote de caixa, e o schema só permite UM lote aberto por empresa.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // O ambiente já traz o Chromium; a versão dele não casa com a que este @playwright/test
        // baixaria, então o caminho é explícito em vez de um `playwright install`.
        launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...envHomologacao,
      // O service worker do PWA serve o bundle anterior de um cache e faz o teste rodar contra
      // código que não é o do commit. Desligado aqui, não no vite.config, que é de produção.
      VITE_DISABLE_PWA: 'true',
    },
  },
});
