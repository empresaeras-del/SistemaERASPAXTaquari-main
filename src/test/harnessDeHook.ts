/**
 * Harness compartilhado dos testes de hook que gravam.
 *
 * Os seis hooks de cadastro (`useFornecedores`, `useItensFunerarios`, `useProcedimentos`,
 * `useCredenciados`, `usePlanosPax`, `useCentrosCusto`/`useCategoriasFornecedor`) repetem o
 * mesmo desenho: carregam do Supabase, espelham no IndexedDB, gravam, e **recarregam a lista
 * relendo o store inteiro**. Testar isso exige duas coisas que um `mockResolvedValueOnce` não
 * dá:
 *
 * - **Um IndexedDB com estado de verdade**, porque toda escrita termina chamando o
 *   `carregar` do próprio hook. Mockando por chamada, o teste passa a depender da ordem
 *   interna das leituras e quebra em refatoração que não muda comportamento nenhum.
 * - **Um Supabase que registra a CHAMADA, não só devolve a resposta.** O que interessa
 *   perguntar é *quantas vezes* o hook tentou gravar e *com qual payload* — foi assim que o
 *   retry que apagava coluna em `useDocumentosPadroes` ficou visível.
 *
 * Cada arquivo de teste declara os próprios `vi.mock` (eles são içados por arquivo) e liga
 * os mocks aqui.
 */

export type Registro = Record<string, any>;

// ============================================================================
// IndexedDB falso
// ============================================================================

export interface BancoLocal {
  semear: (store: string, itens: Registro[]) => void;
  guardados: <T = Registro>(store: string) => T[];
  guardado: <T = Registro>(store: string, id: string) => T | undefined;
  limpar: () => void;
  /** Liga os quatro mocks de `lib/idb` neste banco. Chame no `beforeEach`. */
  ligar: (mocks: {
    getFromIDB: any;
    saveToIDB: any;
    getAllFromIDB: any;
    deleteFromIDB: any;
  }) => void;
}

export const criarBancoLocal = (): BancoLocal => {
  const stores = new Map<string, Map<string, Registro>>();

  const semear = (store: string, itens: Registro[]) => {
    stores.set(store, new Map(itens.map((i) => [String(i.id), i])));
  };

  const guardados = <T = Registro>(store: string): T[] =>
    [...(stores.get(store)?.values() ?? [])] as T[];

  const guardado = <T = Registro>(store: string, id: string): T | undefined =>
    stores.get(store)?.get(id) as T | undefined;

  const ligar: BancoLocal['ligar'] = (mocks) => {
    mocks.getFromIDB.mockImplementation(async (store: string, id: string) =>
      stores.get(store)?.get(id) ?? null);
    mocks.getAllFromIDB.mockImplementation(async (store: string) =>
      [...(stores.get(store)?.values() ?? [])]);
    mocks.saveToIDB.mockImplementation(async (store: string, data: Registro) => {
      if (!stores.has(store)) stores.set(store, new Map());
      stores.get(store)!.set(String(data?.id), data);
    });
    mocks.deleteFromIDB.mockImplementation(async (store: string, id: string) => {
      stores.get(store)?.delete(id);
    });
  };

  return { semear, guardados, guardado, limpar: () => stores.clear(), ligar };
};

// ============================================================================
// Supabase falso que registra as escritas
// ============================================================================

export type Operacao = 'insert' | 'update' | 'delete' | 'upsert';

export interface ChamadaGravada {
  tabela: string;
  operacao: Operacao;
  payload: Registro;
}

export interface RespostaDeEscrita {
  data: Registro | Registro[] | null;
  error: Registro | null;
}

export interface SupabaseFalso {
  /** Toda escrita que passou pelo cliente, na ordem. */
  chamadas: ChamadaGravada[];
  /** Escritas de uma tabela, na ordem. */
  escritasEm: (tabela: string) => ChamadaGravada[];
  /** O que um `select(...).order(...)`/`await query` devolve, por tabela (padrão: lista vazia). */
  definirLeitura: (tabela: string, resposta: { data: Registro[] | null; error?: Registro | null }) => void;
  /** O que uma escrita devolve, por tabela. Sem definição: aceita e ecoa o payload. */
  definirEscrita: (tabela: string, resposta: RespostaDeEscrita | ((payload: Registro) => RespostaDeEscrita)) => void;
  /** Faz a escrita naquela tabela LANÇAR, como o fetch abortado de uma rede fora. */
  derrubarRede: (tabela: string) => void;
  limpar: () => void;
  /** A função a pôr em `supabase.from`. */
  from: (tabela: string) => any;
}

/** Recusa do PostgREST por coluna ausente — o sinal de migration faltando. */
export const recusaColunaAusente = (tabela: string, coluna: string) => ({
  code: 'PGRST204',
  message: `Could not find the '${coluna}' column of '${tabela}' in the schema cache`,
});

/** Recusa por violação de `CHECK` — valor fora do domínio que o banco impõe. */
export const recusaDominio = (constraint: string) => ({
  code: '23514',
  message: `new row for relation violates check constraint "${constraint}"`,
});

/** Recusa por unicidade — o `23505` que um teste de permissão mal feito confunde com RLS. */
export const recusaDuplicado = (constraint: string) => ({
  code: '23505',
  message: `duplicate key value violates unique constraint "${constraint}"`,
});

export const criarSupabaseFalso = (): SupabaseFalso => {
  const chamadas: ChamadaGravada[] = [];
  const leituras = new Map<string, { data: Registro[] | null; error: Registro | null }>();
  const escritas = new Map<string, RespostaDeEscrita | ((p: Registro) => RespostaDeEscrita)>();
  const redeFora = new Set<string>();

  const respostaDeLeitura = (tabela: string) =>
    leituras.get(tabela) ?? { data: [], error: null };

  const respostaDeEscrita = (tabela: string, payload: Registro): RespostaDeEscrita => {
    if (redeFora.has(tabela)) throw new TypeError('Failed to fetch');
    const definida = escritas.get(tabela);
    if (!definida) return { data: payload, error: null }; // aceita e ecoa
    return typeof definida === 'function' ? definida(payload) : definida;
  };

  const from = (tabela: string): any => {
    // `ultimoPayload` guarda o que a escrita mandou para o `.select().single()` poder ecoá-lo.
    let ultimoPayload: Registro = {};
    let ehEscrita = false;

    const registrar = (operacao: Operacao, payload: Registro) => {
      ultimoPayload = payload;
      ehEscrita = true;
      chamadas.push({ tabela, operacao, payload: { ...payload } });
      return q;
    };

    const q: any = {
      select: () => q,
      eq: () => q,
      in: () => q,
      is: () => q,
      or: () => q,
      gt: () => q,
      lt: () => q,
      neq: () => q,
      limit: () => q,
      // Devolve o próprio builder: há consultas com `.order(...).order(...)` no projeto, e
      // `q` é thenable, então um `await query.order(...)` continua resolvendo a leitura.
      order: () => q,
      single: () => Promise.resolve(respostaDeEscrita(tabela, ultimoPayload)),
      maybeSingle: () => Promise.resolve(respostaDeEscrita(tabela, ultimoPayload)),
      insert: (payload: Registro | Registro[]) =>
        registrar('insert', Array.isArray(payload) ? payload[0] : payload),
      upsert: (payload: Registro | Registro[]) =>
        registrar('upsert', Array.isArray(payload) ? payload[0] : payload),
      update: (payload: Registro) => registrar('update', payload),
      delete: () => registrar('delete', {}),
      then: (ok: any, falha: any) => {
        const p = ehEscrita
          ? (() => {
              try {
                return Promise.resolve(respostaDeEscrita(tabela, ultimoPayload));
              } catch (e) {
                return Promise.reject(e);
              }
            })()
          : Promise.resolve(respostaDeLeitura(tabela));
        return p.then(ok, falha);
      },
    };
    return q;
  };

  return {
    chamadas,
    escritasEm: (tabela) => chamadas.filter((c) => c.tabela === tabela),
    definirLeitura: (tabela, resposta) =>
      leituras.set(tabela, { data: resposta.data, error: resposta.error ?? null }),
    definirEscrita: (tabela, resposta) => escritas.set(tabela, resposta),
    derrubarRede: (tabela) => redeFora.add(tabela),
    limpar: () => {
      chamadas.length = 0;
      leituras.clear();
      escritas.clear();
      redeFora.clear();
    },
    from,
  };
};
