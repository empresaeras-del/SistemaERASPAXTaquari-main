import type { Page, Route } from '@playwright/test';
import { aplicarSelect, filtrar, ordenar, type Banco, type Linha } from './postgrest';

/**
 * Um Supabase em memória, instalado com `page.route`, para os testes de fluxo rodarem onde não
 * há rede até `*.supabase.co` — este ambiente, entre outros, e a CI.
 *
 * O que ele PROVA: que a tela monta, navega, valida, e **o que exatamente ela manda ao
 * servidor**. Essa segunda metade é a que importa: quase todo defeito grave deste repositório
 * foi um payload errado saindo calado — `fornecedor_id` desestruturado para fora, o retry que
 * regravava com outro status, `valor_exclusivo` numa coluna que não existe, o `''` numa coluna
 * `date`. O dublê registra cada chamada, então o teste pergunta *com o quê*, não só *se*.
 *
 * O que ele NÃO prova, e por isso o modo `homologacao` existe: RLS, constraint, trigger,
 * `PGRST204`. Nada aqui é o Postgres.
 */

export interface RegistroDeChamada {
  metodo: string;
  tabela: string;
  url: string;
  payload: any;
  prefer: string;
}

export interface Servidor {
  banco: Banco;
  chamadas: RegistroDeChamada[];
  /** Todas as escritas (POST/PATCH/DELETE) numa tabela, na ordem. */
  escritasEm(tabela: string): RegistroDeChamada[];
  linhas(tabela: string): Linha[];
  linha(tabela: string, id: string): Linha | undefined;
  semear(tabela: string, linhas: Linha[]): void;
  /** Faz a próxima escrita na tabela ser recusada, como o Postgres recusaria. */
  recusarProxima(tabela: string, erro: { code: string; message: string }): void;
}

const uuid = () =>
  '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
    (c ^ (Math.random() * 16)) .toString(16),
  );

/** Um JWT bem formado o bastante para o supabase-js guardar e reenviar. Não é assinado. */
const jwtFalso = (sub: string, tenantId: string, nivel: string) => {
  const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const agora = Math.floor(Date.now() / 1000);
  return [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ sub, aud: 'authenticated', role: 'authenticated', exp: agora + 3600, iat: agora,
          email: '', app_metadata: { provider: 'email' }, user_metadata: { tenant_id: tenantId, nivel } }),
    'assinatura-de-mentira',
  ].join('.');
};

export const instalarDubleDoServidor = async (page: Page, banco: Banco): Promise<Servidor> => {
  const chamadas: RegistroDeChamada[] = [];
  const recusas = new Map<string, { code: string; message: string }>();

  const servidor: Servidor = {
    banco,
    chamadas,
    escritasEm: (tabela) =>
      chamadas.filter((c) => c.tabela === tabela && c.metodo !== 'GET' && c.metodo !== 'HEAD'),
    linhas: (tabela) => banco.get(tabela) ?? [],
    linha: (tabela, id) => (banco.get(tabela) ?? []).find((l) => l.id === id),
    semear: (tabela, linhas) => banco.set(tabela, [...(banco.get(tabela) ?? []), ...linhas]),
    recusarProxima: (tabela, erro) => recusas.set(tabela, erro),
  };

  const json = (route: Route, corpo: any, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'content-range': '*/*' },
      body: JSON.stringify(corpo),
    });

  // ------------------------------------------------------------------ auth
  await page.route('**/auth/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());

    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

    if (url.pathname.endsWith('/token')) {
      const corpo = req.postDataJSON?.() ?? {};
      const usuario = servidor.linhas('__auth_users').find((u) => u.email === corpo.email);

      if (!usuario || corpo.password !== usuario.password) {
        return json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      }

      const authUser = {
        id: usuario.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: usuario.email,
        email_confirmed_at: new Date().toISOString(),
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: { nome: usuario.nome, nivel: usuario.nivel, tenant_id: usuario.tenant_id },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return json(route, {
        access_token: jwtFalso(usuario.id, usuario.tenant_id, usuario.nivel),
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: `refresh-${usuario.id}`,
        user: authUser,
      });
    }

    if (url.pathname.endsWith('/user')) {
      const usuario = servidor.linhas('__auth_users')[0];
      return json(route, { id: usuario?.id, email: usuario?.email, app_metadata: {}, user_metadata: {} });
    }

    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });

    return json(route, {});
  });

  // --------------------------------------------------------------- postgrest
  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const metodo = req.method();

    if (metodo === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

    const tabela = url.pathname.replace(/^.*\/rest\/v1\//, '').split('?')[0];
    const params = url.searchParams;
    const prefer = req.headers()['prefer'] ?? '';
    const payload = metodo === 'GET' || metodo === 'DELETE' ? null : req.postDataJSON?.() ?? null;

    chamadas.push({ metodo, tabela, url: req.url(), payload, prefer });

    // RPC não tem tabela; as duas que o app chama no caminho destes fluxos devolvem vazio.
    if (tabela.startsWith('rpc/')) return json(route, []);

    if (!banco.has(tabela)) banco.set(tabela, []);
    const linhas = banco.get(tabela)!;

    const recusa = recusas.get(tabela);
    if (recusa && metodo !== 'GET') {
      recusas.delete(tabela);
      return json(route, { code: recusa.code, message: recusa.message, details: null, hint: null }, 400);
    }

    const umSo = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const responder = (resultado: Linha[]) => {
      if (prefer.includes('return=minimal')) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      if (umSo) {
        if (resultado.length === 1) return json(route, resultado[0]);
        // `maybeSingle` aceita zero; `single` não. O dublê devolve o erro do PostgREST e deixa
        // o supabase-js decidir — é ele quem distingue os dois.
        return json(route, { code: 'PGRST116', message: `JSON object requested, multiple (or no) rows returned`, details: `Results contain ${resultado.length} rows` }, 406);
      }
      return json(route, resultado);
    };

    if (metodo === 'GET' || metodo === 'HEAD') {
      let saida = ordenar(filtrar(linhas, params), params);
      const limite = params.get('limit');
      if (limite) saida = saida.slice(0, Number(limite));
      return responder(aplicarSelect(saida, params.get('select'), banco, tabela));
    }

    if (metodo === 'POST') {
      const novas: Linha[] = Array.isArray(payload) ? payload : [payload];
      const conflito = (params.get('on_conflict') ?? 'id').split(',');
      const mescla = prefer.includes('merge-duplicates');
      const gravadas: Linha[] = [];

      for (const bruta of novas) {
        const nova: Linha = { id: bruta.id ?? uuid(), ...bruta };
        const i = linhas.findIndex((l) => conflito.every((c) => l[c] !== undefined && l[c] === nova[c]));
        if (i >= 0 && mescla) {
          linhas[i] = { ...linhas[i], ...nova };
          gravadas.push(linhas[i]);
        } else if (i >= 0) {
          return json(route, { code: '23505', message: `duplicate key value violates unique constraint "${tabela}_pkey"` }, 409);
        } else {
          linhas.push(nova);
          gravadas.push(nova);
        }
      }
      return responder(gravadas);
    }

    if (metodo === 'PATCH') {
      const alvos = filtrar(linhas, params);
      for (const alvo of alvos) Object.assign(alvo, payload);
      return responder(alvos);
    }

    if (metodo === 'DELETE') {
      const alvos = filtrar(linhas, params);
      banco.set(tabela, linhas.filter((l) => !alvos.includes(l)));
      return responder(alvos);
    }

    return json(route, { message: `Método ${metodo} não implementado no dublê` }, 501);
  });

  return servidor;
};
