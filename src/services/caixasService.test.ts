import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));

vi.mock('../lib/syncService', () => ({
  addToSyncQueue: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  registrarAuditoria: vi.fn(),
}));

vi.mock('./financeiroService', () => ({
  getParcelasReceber: vi.fn(async () => []),
  getParcelasPagar: vi.fn(async () => []),
  estornarRecebimento: vi.fn(async () => undefined),
  estornarPagamento: vi.fn(async () => undefined),
}));

import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { supabase, registrarAuditoria } from '../lib/supabase';
import { addToSyncQueue } from '../lib/syncService';
import {
  getParcelasReceber,
  getParcelasPagar,
  estornarRecebimento,
  estornarPagamento,
} from './financeiroService';
import {
  gerarCodigoLote,
  getLotesCaixa,
  getLoteAbertoAtivo,
  abrirLoteCaixa,
  fecharLoteCaixa,
  recalcularTotaisLote,
  getMovimentacoesCaixa,
  registrarMovimentacao,
  estornarMovimentacaoCaixa,
  registrarSuprimento,
  registrarSangria,
  sincronizarLancamentosFinanceiros,
  calcularResumoFluxoCaixa,
  reabrirLoteCaixa,
  excluirLoteCaixa,
} from './caixasService';
import { LoteCaixa, MovimentacaoCaixa } from '../types/caixas';

const mockGetFromIDB = vi.mocked(getFromIDB);
const mockSaveToIDB = vi.mocked(saveToIDB);
const mockGetAllFromIDB = vi.mocked(getAllFromIDB);
const mockDeleteFromIDB = vi.mocked(deleteFromIDB);
const mockAddToSyncQueue = vi.mocked(addToSyncQueue);
const mockSupabaseFrom = vi.mocked(supabase.from);
const mockRegistrarAuditoria = vi.mocked(registrarAuditoria);
const mockGetParcelasReceber = vi.mocked(getParcelasReceber);
const mockGetParcelasPagar = vi.mocked(getParcelasPagar);
const mockEstornarRecebimento = vi.mocked(estornarRecebimento);
const mockEstornarPagamento = vi.mocked(estornarPagamento);

/**
 * IndexedDB falso, com estado de verdade.
 *
 * As funções deste service se chamam entre si e dependem do que a anterior gravou —
 * `registrarMovimentacao` grava a movimentação e logo em seguida `recalcularTotaisLote`
 * relê **todas** as movimentações do lote para somar. Um `mockResolvedValueOnce` por
 * chamada não sustenta esse encadeamento: o teste passaria a depender da ordem interna
 * das leituras, e quebraria a cada refatoração que não muda comportamento nenhum.
 */
type Registro = Record<string, any>;
const bancoLocal = new Map<string, Map<string, Registro>>();

const semear = (store: string, itens: Registro[]) => {
  bancoLocal.set(store, new Map(itens.map(i => [String(i.id), i])));
};

const guardados = <T = Registro>(store: string): T[] =>
  [...(bancoLocal.get(store)?.values() ?? [])] as T[];

const guardado = <T = Registro>(store: string, id: string): T | undefined =>
  bancoLocal.get(store)?.get(id) as T | undefined;

const prepararBancoLocal = () => {
  bancoLocal.clear();

  mockGetFromIDB.mockReset();
  mockSaveToIDB.mockReset();
  mockGetAllFromIDB.mockReset();
  mockDeleteFromIDB.mockReset();
  mockAddToSyncQueue.mockReset();

  mockGetFromIDB.mockImplementation((async (store: string, id: string) =>
    bancoLocal.get(store)?.get(id) ?? null) as any);
  mockGetAllFromIDB.mockImplementation((async (store: string) =>
    [...(bancoLocal.get(store)?.values() ?? [])]) as any);
  mockSaveToIDB.mockImplementation((async (store: string, data: Registro) => {
    if (!bancoLocal.has(store)) bancoLocal.set(store, new Map());
    bancoLocal.get(store)!.set(String(data.id), data);
  }) as any);
  mockDeleteFromIDB.mockImplementation((async (store: string, id: string) => {
    bancoLocal.get(store)?.delete(id);
  }) as any);
  mockAddToSyncQueue.mockImplementation((async () => undefined) as any);
};

const loteBase: LoteCaixa = {
  id: 'lote-1',
  tenant_id: 'emp-1',
  codigo_lote: 'LOTE-20260919-001',
  terminal_caixa: 'Caixa Principal',
  operador_nome: 'ANA',
  data_abertura: '2026-09-19T08:00:00.000Z',
  saldo_inicial: 100,
  saldo_entradas: 0,
  saldo_saidas: 0,
  saldo_esperado: 100,
  status: 'aberto',
};

const movBase: MovimentacaoCaixa = {
  id: 'mov-1',
  tenant_id: 'emp-1',
  lote_id: 'lote-1',
  tipo: 'entrada',
  origem: 'contas_receber',
  categoria: 'Receita / Mensalidade',
  descricao: 'Recebimento',
  valor: 50,
  forma_pagamento: 'dinheiro',
  data_movimentacao: '2026-09-19T09:00:00.000Z',
  operador_nome: 'ANA',
};

// ============================================================================
// gerarCodigoLote — função pura
// ============================================================================

describe('gerarCodigoLote', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa a data local do dia, com mês e dia sempre em dois dígitos', () => {
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0));
    expect(gerarCodigoLote(1)).toBe('LOTE-20260105-001');
  });

  it('preenche o sufixo com zeros à esquerda até três dígitos', () => {
    vi.setSystemTime(new Date(2026, 8, 19, 12, 0, 0));
    expect(gerarCodigoLote(7)).toBe('LOTE-20260919-007');
    expect(gerarCodigoLote(42)).toBe('LOTE-20260919-042');
  });

  it('não trunca quando o índice passa de três dígitos', () => {
    vi.setSystemTime(new Date(2026, 8, 19, 12, 0, 0));
    expect(gerarCodigoLote(1234)).toBe('LOTE-20260919-1234');
  });

  it('sem índice informado, assume o primeiro lote do dia', () => {
    vi.setSystemTime(new Date(2026, 8, 19, 12, 0, 0));
    expect(gerarCodigoLote()).toBe('LOTE-20260919-001');
  });
});

// ============================================================================
// calcularResumoFluxoCaixa — função pura, e é ela que alimenta os cards da tela
// ============================================================================

describe('calcularResumoFluxoCaixa', () => {
  const mov = (over: Partial<MovimentacaoCaixa>): MovimentacaoCaixa => ({
    ...movBase,
    id: `m-${Math.random()}`,
    ...over,
  });

  it('soma entradas e saídas e devolve o saldo do período', () => {
    const resumo = calcularResumoFluxoCaixa(
      [
        mov({ tipo: 'entrada', valor: 100 }),
        mov({ tipo: 'entrada', valor: 50 }),
        mov({ tipo: 'saida', valor: 30 }),
      ],
      [],
    );
    expect(resumo.total_entradas).toBe(150);
    expect(resumo.total_saidas).toBe(30);
    expect(resumo.saldo_periodo).toBe(120);
  });

  it('ignora a movimentação estornada em todos os totais', () => {
    const resumo = calcularResumoFluxoCaixa(
      [
        mov({ tipo: 'entrada', valor: 100, forma_pagamento: 'pix' }),
        mov({ tipo: 'entrada', valor: 999, forma_pagamento: 'pix', estornado: true }),
      ],
      [],
    );
    expect(resumo.total_entradas).toBe(100);
    expect(resumo.total_pix).toBe(100);
  });

  it('nos totais por forma de pagamento a saída ENTRA NEGATIVA — é saldo, não volume', () => {
    // total_entradas/total_saidas respondem "quanto entrou e quanto saiu"; os totais por
    // forma respondem outra pergunta: "quanto sobrou em dinheiro na gaveta". Somar a saída
    // como positiva ali faria a gaveta parecer mais cheia justamente depois de uma sangria.
    const resumo = calcularResumoFluxoCaixa(
      [
        mov({ tipo: 'entrada', valor: 200, forma_pagamento: 'dinheiro' }),
        mov({ tipo: 'saida', valor: 80, forma_pagamento: 'dinheiro' }),
      ],
      [],
    );
    expect(resumo.total_dinheiro).toBe(120);
  });

  it('crédito e débito caem no mesmo balde de cartões', () => {
    const resumo = calcularResumoFluxoCaixa(
      [
        mov({ tipo: 'entrada', valor: 100, forma_pagamento: 'cartao_credito' }),
        mov({ tipo: 'entrada', valor: 40, forma_pagamento: 'cartao_debito' }),
      ],
      [],
    );
    expect(resumo.total_cartoes).toBe(140);
  });

  it('forma de pagamento fora das conhecidas cai em "outros", em vez de sumir da conta', () => {
    const resumo = calcularResumoFluxoCaixa(
      [mov({ tipo: 'entrada', valor: 75, forma_pagamento: 'boleto' })],
      [],
    );
    expect(resumo.total_outros).toBe(75);
    expect(resumo.total_dinheiro).toBe(0);
  });

  it('suprimento e sangria são contados pelo valor bruto, sem sinal', () => {
    const resumo = calcularResumoFluxoCaixa(
      [
        mov({ tipo: 'entrada', valor: 300, origem: 'suprimento' }),
        mov({ tipo: 'saida', valor: 120, origem: 'sangria' }),
      ],
      [],
    );
    expect(resumo.total_suprimentos).toBe(300);
    expect(resumo.total_sangrias).toBe(120);
  });

  it('o lote AUDITADO conta como fechado — a contagem é "não está aberto"', () => {
    // `StatusLoteCaixa` tem três valores, e o contador olha `status !== 'aberto'`.
    // Um contador que comparasse com 'fechado' perderia o auditado em silêncio, e a soma
    // dos dois cards deixaria de bater com o total de lotes da lista.
    const lotes: LoteCaixa[] = [
      { ...loteBase, id: 'l1', status: 'aberto' },
      { ...loteBase, id: 'l2', status: 'fechado' },
      { ...loteBase, id: 'l3', status: 'auditado' },
    ];
    const resumo = calcularResumoFluxoCaixa([], lotes);
    expect(resumo.lotes_abertos_count).toBe(1);
    expect(resumo.lotes_fechados_count).toBe(2);
    expect(resumo.lotes_abertos_count + resumo.lotes_fechados_count).toBe(lotes.length);
  });

  it('valor em texto não vira NaN e contamina o total', () => {
    const resumo = calcularResumoFluxoCaixa(
      [mov({ tipo: 'entrada', valor: '90' as unknown as number }), mov({ tipo: 'entrada', valor: undefined as unknown as number })],
      [],
    );
    expect(resumo.total_entradas).toBe(90);
  });

  it('sem movimentação nenhuma, devolve tudo zerado em vez de indefinido', () => {
    const resumo = calcularResumoFluxoCaixa([], []);
    expect(resumo).toEqual({
      total_entradas: 0,
      total_saidas: 0,
      saldo_periodo: 0,
      total_dinheiro: 0,
      total_pix: 0,
      total_cartoes: 0,
      total_outros: 0,
      total_suprimentos: 0,
      total_sangrias: 0,
      lotes_abertos_count: 0,
      lotes_fechados_count: 0,
    });
  });
});

// ============================================================================
// Leituras (offline, fallback IDB)
// ============================================================================

describe('getLotesCaixa (offline)', () => {
  beforeEach(prepararBancoLocal);

  const lotes: LoteCaixa[] = [
    { ...loteBase, id: 'l1', tenant_id: 'emp-1', data_abertura: '2026-09-17T08:00:00.000Z' },
    { ...loteBase, id: 'l2', tenant_id: 'emp-2', data_abertura: '2026-09-19T08:00:00.000Z' },
    { ...loteBase, id: 'l3', tenant_id: 'emp-1', data_abertura: '2026-09-18T08:00:00.000Z' },
  ];

  it('filtra pelo tenant pedido', async () => {
    semear('lotes_caixa', lotes);
    const out = await getLotesCaixa(false, 'emp-1');
    expect(out.map(l => l.id).sort()).toEqual(['l1', 'l3']);
  });

  it('com tenantId "all", NÃO filtra — e é por isso que "all" nunca pode virar destino de escrita', async () => {
    // O CLAUDE.md registra o incidente: `getLoteAbertoAtivo(..., empresaSelecionada || 'x')`
    // com 'all' devolvia o lote aberto de OUTRA empresa, e a movimentação caía no caixa dela.
    // O filtro se desliga sozinho aqui; quem chama é que precisa resolver a empresa antes.
    semear('lotes_caixa', lotes);
    const out = await getLotesCaixa(false, 'all');
    expect(out.map(l => l.id).sort()).toEqual(['l1', 'l2', 'l3']);
  });

  it('devolve do mais recente para o mais antigo, por data de abertura', async () => {
    semear('lotes_caixa', lotes);
    const out = await getLotesCaixa(false, 'all');
    expect(out.map(l => l.id)).toEqual(['l2', 'l3', 'l1']);
  });

  it('lista vazia quando o cache não tem nada', async () => {
    semear('lotes_caixa', []);
    expect(await getLotesCaixa(false, 'emp-1')).toEqual([]);
  });
});

describe('getLoteAbertoAtivo (offline)', () => {
  beforeEach(prepararBancoLocal);

  it('devolve o lote aberto da empresa', async () => {
    semear('lotes_caixa', [
      { ...loteBase, id: 'l1', status: 'fechado' },
      { ...loteBase, id: 'l2', status: 'aberto' },
    ]);
    const out = await getLoteAbertoAtivo(false, 'emp-1');
    expect(out?.id).toBe('l2');
  });

  it('devolve null — nunca um lote fechado — quando não há nenhum aberto', async () => {
    semear('lotes_caixa', [{ ...loteBase, id: 'l1', status: 'fechado' }]);
    expect(await getLoteAbertoAtivo(false, 'emp-1')).toBeNull();
  });

  it('não enxerga o lote aberto de outra empresa', async () => {
    semear('lotes_caixa', [{ ...loteBase, id: 'l1', tenant_id: 'emp-2', status: 'aberto' }]);
    expect(await getLoteAbertoAtivo(false, 'emp-1')).toBeNull();
  });
});

describe('getMovimentacoesCaixa (offline)', () => {
  beforeEach(prepararBancoLocal);

  const movs: MovimentacaoCaixa[] = [
    { ...movBase, id: 'm1', tenant_id: 'emp-1', lote_id: 'lote-1', data_movimentacao: '2026-09-19T09:00:00.000Z' },
    { ...movBase, id: 'm2', tenant_id: 'emp-1', lote_id: 'lote-2', data_movimentacao: '2026-09-19T10:00:00.000Z' },
    { ...movBase, id: 'm3', tenant_id: 'emp-2', lote_id: 'lote-1', data_movimentacao: '2026-09-19T11:00:00.000Z' },
  ];

  it('filtra por tenant e por lote ao mesmo tempo', async () => {
    semear('movimentacoes_caixa', movs);
    const out = await getMovimentacoesCaixa(false, 'emp-1', 'lote-1');
    expect(out.map(m => m.id)).toEqual(['m1']);
  });

  it('sem loteId, devolve as movimentações de todos os lotes da empresa', async () => {
    semear('movimentacoes_caixa', movs);
    const out = await getMovimentacoesCaixa(false, 'emp-1');
    expect(out.map(m => m.id).sort()).toEqual(['m1', 'm2']);
  });

  it('devolve da mais recente para a mais antiga', async () => {
    semear('movimentacoes_caixa', movs);
    const out = await getMovimentacoesCaixa(false, 'all');
    expect(out.map(m => m.id)).toEqual(['m3', 'm2', 'm1']);
  });
});

// ============================================================================
// Abertura e fechamento do lote
// ============================================================================

describe('abrirLoteCaixa (offline)', () => {
  beforeEach(() => {
    prepararBancoLocal();
    vi.setSystemTime(new Date(2026, 8, 19, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const dados = {
    tenant_id: 'emp-1',
    terminal_caixa: 'Guichê 01',
    operador_nome: 'ANA',
    saldo_inicial: 250,
  };

  it('recusa abrir um segundo lote enquanto houver um aberto na empresa', async () => {
    semear('lotes_caixa', [{ ...loteBase, id: 'l1', status: 'aberto', codigo_lote: 'LOTE-X' }]);
    await expect(abrirLoteCaixa(false, dados)).rejects.toThrow(/já existe um Lote de Caixa aberto/i);
    expect(mockSaveToIDB).not.toHaveBeenCalled();
  });

  it('o lote aberto de OUTRA empresa não bloqueia a abertura', async () => {
    semear('lotes_caixa', [{ ...loteBase, id: 'l1', tenant_id: 'emp-2', status: 'aberto' }]);
    const novo = await abrirLoteCaixa(false, dados);
    expect(novo.status).toBe('aberto');
    expect(novo.tenant_id).toBe('emp-1');
  });

  it('numera o lote pela quantidade já aberta HOJE, ignorando os de outros dias', async () => {
    semear('lotes_caixa', [
      { ...loteBase, id: 'l1', status: 'fechado', data_abertura: new Date(2026, 8, 19, 7, 0, 0).toISOString() },
      { ...loteBase, id: 'l2', status: 'fechado', data_abertura: new Date(2026, 8, 18, 7, 0, 0).toISOString() },
      { ...loteBase, id: 'l3', status: 'fechado', data_abertura: new Date(2026, 8, 19, 8, 0, 0).toISOString() },
    ]);
    const novo = await abrirLoteCaixa(false, dados);
    expect(novo.codigo_lote).toBe('LOTE-20260919-003');
  });

  it('o saldo esperado de um lote recém-aberto é o saldo inicial', async () => {
    const novo = await abrirLoteCaixa(false, dados);
    expect(novo.saldo_inicial).toBe(250);
    expect(novo.saldo_esperado).toBe(250);
    expect(novo.saldo_entradas).toBe(0);
    expect(novo.saldo_saidas).toBe(0);
  });

  it('saldo inicial ausente ou em texto não vira NaN', async () => {
    const novo = await abrirLoteCaixa(false, { ...dados, saldo_inicial: undefined as unknown as number });
    expect(novo.saldo_inicial).toBe(0);
    expect(novo.saldo_esperado).toBe(0);
  });

  it('terminal em branco cai para "Caixa Principal"', async () => {
    const novo = await abrirLoteCaixa(false, { ...dados, terminal_caixa: '' });
    expect(novo.terminal_caixa).toBe('Caixa Principal');
  });

  it('offline, grava no cache e enfileira para subir depois', async () => {
    const novo = await abrirLoteCaixa(false, dados);
    expect(guardado('lotes_caixa', novo.id)).toBeDefined();
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'lotes_caixa', action: 'update' }),
    );
  });
});

describe('fecharLoteCaixa (offline)', () => {
  beforeEach(() => {
    prepararBancoLocal();
    vi.setSystemTime(new Date('2026-09-19T18:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lança quando o lote não está no cache e não há rede para buscá-lo', async () => {
    semear('lotes_caixa', []);
    await expect(fecharLoteCaixa(false, 'lote-1', { saldo_fechamento_informado: 100 }))
      .rejects.toThrow(/não encontrado/i);
  });

  it('recalcula entradas e saídas a partir das movimentações, não do que estava gravado no lote', async () => {
    // O lote carrega saldo_entradas/saldo_saidas como cache; o fechamento é o momento em que
    // esse cache não vale mais nada — o dinheiro conferido na gaveta é comparado com a soma
    // das movimentações de verdade.
    semear('lotes_caixa', [{ ...loteBase, saldo_entradas: 9999, saldo_saidas: 9999 }]);
    semear('movimentacoes_caixa', [
      { ...movBase, id: 'm1', tipo: 'entrada', valor: 200 },
      { ...movBase, id: 'm2', tipo: 'saida', valor: 50 },
    ]);
    const fechado = await fecharLoteCaixa(false, 'lote-1', { saldo_fechamento_informado: 250 });
    expect(fechado.saldo_entradas).toBe(200);
    expect(fechado.saldo_saidas).toBe(50);
    expect(fechado.saldo_esperado).toBe(250); // 100 inicial + 200 - 50
  });

  it('a movimentação estornada não entra na conferência', async () => {
    semear('lotes_caixa', [loteBase]);
    semear('movimentacoes_caixa', [
      { ...movBase, id: 'm1', tipo: 'entrada', valor: 200 },
      { ...movBase, id: 'm2', tipo: 'entrada', valor: 500, estornado: true },
    ]);
    const fechado = await fecharLoteCaixa(false, 'lote-1', { saldo_fechamento_informado: 300 });
    expect(fechado.saldo_entradas).toBe(200);
    expect(fechado.diferenca_quebra_sobra).toBe(0);
  });

  it('a diferença é o informado menos o esperado: negativa é quebra, positiva é sobra', async () => {
    semear('lotes_caixa', [loteBase]);
    semear('movimentacoes_caixa', [{ ...movBase, id: 'm1', tipo: 'entrada', valor: 100 }]);

    const comQuebra = await fecharLoteCaixa(false, 'lote-1', { saldo_fechamento_informado: 180 });
    expect(comQuebra.saldo_esperado).toBe(200);
    expect(comQuebra.diferenca_quebra_sobra).toBe(-20);

    semear('lotes_caixa', [loteBase]);
    const comSobra = await fecharLoteCaixa(false, 'lote-1', { saldo_fechamento_informado: 230 });
    expect(comSobra.diferenca_quebra_sobra).toBe(30);
  });

  it('marca o lote como fechado, carimba a data e enfileira a alteração', async () => {
    semear('lotes_caixa', [loteBase]);
    semear('movimentacoes_caixa', []);
    const fechado = await fecharLoteCaixa(false, 'lote-1', {
      saldo_fechamento_informado: 100,
      observacao_fechamento: 'conferido a dois',
    });
    expect(fechado.status).toBe('fechado');
    expect(fechado.data_fechamento).toBe('2026-09-19T18:00:00.000Z');
    expect(fechado.observacao_fechamento).toBe('conferido a dois');
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'lotes_caixa', action: 'update' }),
    );
  });
});

describe('recalcularTotaisLote (offline)', () => {
  beforeEach(prepararBancoLocal);

  it('devolve null em silêncio quando o lote não está no cache', async () => {
    // Quem chama é `registrarMovimentacao`, e travar a baixa de uma parcela porque o lote
    // não está no cache local seria pior que o total do lote ficar desatualizado.
    semear('lotes_caixa', []);
    expect(await recalcularTotaisLote(false, 'lote-1')).toBeNull();
  });

  it('soma só as movimentações daquele lote, ignorando as de outro', async () => {
    semear('lotes_caixa', [loteBase]);
    semear('movimentacoes_caixa', [
      { ...movBase, id: 'm1', lote_id: 'lote-1', tipo: 'entrada', valor: 70 },
      { ...movBase, id: 'm2', lote_id: 'lote-2', tipo: 'entrada', valor: 900 },
    ]);
    const out = await recalcularTotaisLote(false, 'lote-1');
    expect(out?.saldo_entradas).toBe(70);
    expect(out?.saldo_esperado).toBe(170);
  });

  it('a movimentação estornada sai do saldo esperado', async () => {
    semear('lotes_caixa', [loteBase]);
    semear('movimentacoes_caixa', [
      { ...movBase, id: 'm1', tipo: 'entrada', valor: 70 },
      { ...movBase, id: 'm2', tipo: 'saida', valor: 20, estornado: true },
    ]);
    const out = await recalcularTotaisLote(false, 'lote-1');
    expect(out?.saldo_saidas).toBe(0);
    expect(out?.saldo_esperado).toBe(170);
  });
});

// ============================================================================
// Movimentações
// ============================================================================

describe('registrarMovimentacao (offline)', () => {
  beforeEach(() => {
    prepararBancoLocal();
    semear('lotes_caixa', [loteBase]);
  });

  const nova = (over: Partial<MovimentacaoCaixa> = {}) => {
    const { id: _id, criado_em: _criado, ...semId } = { ...movBase, ...over };
    return semId as Omit<MovimentacaoCaixa, 'id' | 'criado_em'>;
  };

  it('herda a conta contábil do lançamento que originou o recebimento', async () => {
    // A receita já foi classificada quando nasceu; a movimentação é a liquidação dela.
    // Perguntar de novo abriria espaço para o mesmo dinheiro cair em duas contas no relatório.
    semear('parcelas_receber', [{ id: 'parc-1', receita_id: 'rec-1' }]);
    semear('receitas', [{ id: 'rec-1', conta_contabil_id: 'conta-receita' }]);

    const mov = await registrarMovimentacao(false, nova({ origem: 'contas_receber', referencia_id: 'parc-1' }));
    expect(mov.conta_contabil_id).toBe('conta-receita');
  });

  it('herda pelo lado das despesas quando a origem é contas a pagar', async () => {
    semear('parcelas_pagar', [{ id: 'parc-9', despesa_id: 'desp-9' }]);
    semear('despesas', [{ id: 'desp-9', conta_contabil_id: 'conta-despesa' }]);

    const mov = await registrarMovimentacao(false, nova({
      tipo: 'saida', origem: 'contas_pagar', referencia_id: 'parc-9',
    }));
    expect(mov.conta_contabil_id).toBe('conta-despesa');
  });

  it('não sobrescreve a conta quando o chamador já resolveu uma', async () => {
    semear('parcelas_receber', [{ id: 'parc-1', receita_id: 'rec-1' }]);
    semear('receitas', [{ id: 'rec-1', conta_contabil_id: 'conta-do-lancamento' }]);

    const mov = await registrarMovimentacao(false, nova({
      origem: 'contas_receber', referencia_id: 'parc-1', conta_contabil_id: 'conta-explicita',
    }));
    expect(mov.conta_contabil_id).toBe('conta-explicita');
  });

  it('suprimento e sangria nascem SEM conta contábil, de propósito', async () => {
    // Transferir numerário entre caixa e banco não é receita nem despesa; classificá-las
    // inflaria o resultado do exercício. O trigger do banco isenta as duas origens.
    const suprimento = await registrarMovimentacao(false, nova({
      origem: 'suprimento', referencia_id: 'parc-1', conta_contabil_id: undefined,
    }));
    expect(suprimento.conta_contabil_id).toBeUndefined();
  });

  it('sem parcela e sem lançamento para resolver, a conta fica nula em vez de travar a baixa', async () => {
    semear('parcelas_receber', []);
    const mov = await registrarMovimentacao(false, nova({ origem: 'contas_receber', referencia_id: 'parc-orfa' }));
    expect(mov.conta_contabil_id).toBeNull();
  });

  it('a parcela existe mas o lançamento é legado, sem conta: devolve nulo sem lançar', async () => {
    semear('parcelas_receber', [{ id: 'parc-1', receita_id: 'rec-1' }]);
    semear('receitas', [{ id: 'rec-1' }]);
    const mov = await registrarMovimentacao(false, nova({ origem: 'contas_receber', referencia_id: 'parc-1' }));
    expect(mov.conta_contabil_id).toBeNull();
  });

  it('atualiza o saldo do lote na mesma operação', async () => {
    await registrarMovimentacao(false, nova({ tipo: 'entrada', valor: 40, origem: 'suprimento' }));
    const lote = guardado<LoteCaixa>('lotes_caixa', 'lote-1');
    expect(lote?.saldo_entradas).toBe(40);
    expect(lote?.saldo_esperado).toBe(140);
  });

  it('offline, grava no cache e enfileira a movimentação', async () => {
    const mov = await registrarMovimentacao(false, nova({ origem: 'suprimento' }));
    expect(guardado('movimentacoes_caixa', mov.id)).toBeDefined();
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'movimentacoes_caixa', action: 'update' }),
    );
  });

  it('gera id próprio e carimba criado_em', async () => {
    const mov = await registrarMovimentacao(false, nova({ origem: 'suprimento' }));
    expect(mov.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(mov.criado_em).toBeTruthy();
  });
});

describe('registrarSuprimento e registrarSangria (offline)', () => {
  beforeEach(() => {
    prepararBancoLocal();
    semear('lotes_caixa', [loteBase]);
  });

  it('suprimento é entrada em dinheiro e sobe o saldo esperado do lote', async () => {
    const mov = await registrarSuprimento(false, 'emp-1', 'lote-1', 300, '', 'ANA');
    expect(mov.tipo).toBe('entrada');
    expect(mov.origem).toBe('suprimento');
    expect(mov.forma_pagamento).toBe('dinheiro');
    expect(mov.descricao).toBe('Aporte/Suprimento de saldo no caixa');
    expect(guardado<LoteCaixa>('lotes_caixa', 'lote-1')?.saldo_esperado).toBe(400);
  });

  it('sangria é saída em dinheiro e baixa o saldo esperado do lote', async () => {
    const mov = await registrarSangria(false, 'emp-1', 'lote-1', 30, 'depósito no banco', 'ANA');
    expect(mov.tipo).toBe('saida');
    expect(mov.origem).toBe('sangria');
    expect(mov.descricao).toBe('depósito no banco');
    expect(guardado<LoteCaixa>('lotes_caixa', 'lote-1')?.saldo_esperado).toBe(70);
  });
});

describe('estornarMovimentacaoCaixa (offline)', () => {
  beforeEach(() => {
    prepararBancoLocal();
    mockEstornarRecebimento.mockClear();
    mockEstornarPagamento.mockClear();
  });

  it('lança quando a movimentação não é encontrada', async () => {
    semear('movimentacoes_caixa', []);
    await expect(estornarMovimentacaoCaixa(false, 'mov-1', 'engano'))
      .rejects.toThrow(/Movimentação não encontrada/i);
  });

  it('lança quando o lote da movimentação não é encontrado', async () => {
    semear('movimentacoes_caixa', [movBase]);
    semear('lotes_caixa', []);
    await expect(estornarMovimentacaoCaixa(false, 'mov-1', 'engano'))
      .rejects.toThrow(/Lote não encontrado/i);
  });

  it('recusa estornar dentro de um lote já fechado', async () => {
    // O lote fechado já teve a gaveta conferida e a diferença registrada; mexer no dinheiro
    // dele depois desfaria um número que já foi apurado. O caminho é reabrir o lote.
    semear('movimentacoes_caixa', [movBase]);
    semear('lotes_caixa', [{ ...loteBase, status: 'fechado' }]);
    await expect(estornarMovimentacaoCaixa(false, 'mov-1', 'engano'))
      .rejects.toThrow(/lote fechado/i);
    expect(mockEstornarRecebimento).not.toHaveBeenCalled();
  });

  it('estorna também a parcela de origem, não só a movimentação do caixa', async () => {
    semear('movimentacoes_caixa', [{ ...movBase, origem: 'contas_receber', referencia_id: 'parc-1' }]);
    semear('lotes_caixa', [loteBase]);
    await estornarMovimentacaoCaixa(false, 'mov-1', 'valor errado');
    expect(mockEstornarRecebimento).toHaveBeenCalledWith(false, 'parc-1', 'valor errado');
    expect(mockEstornarPagamento).not.toHaveBeenCalled();
  });

  it('usa o estorno de pagamento quando a origem é contas a pagar', async () => {
    semear('movimentacoes_caixa', [{ ...movBase, tipo: 'saida', origem: 'contas_pagar', referencia_id: 'parc-9' }]);
    semear('lotes_caixa', [loteBase]);
    await estornarMovimentacaoCaixa(false, 'mov-1', 'engano');
    expect(mockEstornarPagamento).toHaveBeenCalledWith(false, 'parc-9', 'engano');
    expect(mockEstornarRecebimento).not.toHaveBeenCalled();
  });

  it('suprimento e sangria não têm parcela a estornar', async () => {
    semear('movimentacoes_caixa', [{ ...movBase, origem: 'suprimento', referencia_id: undefined }]);
    semear('lotes_caixa', [loteBase]);
    await estornarMovimentacaoCaixa(false, 'mov-1', 'engano');
    expect(mockEstornarRecebimento).not.toHaveBeenCalled();
    expect(mockEstornarPagamento).not.toHaveBeenCalled();
  });

  it('marca a movimentação como estornada preservando a observação anterior', async () => {
    semear('movimentacoes_caixa', [{ ...movBase, origem: 'suprimento', observacao: 'aporte da manhã' }]);
    semear('lotes_caixa', [loteBase]);
    await estornarMovimentacaoCaixa(false, 'mov-1', 'duplicado');
    const salva = guardado<MovimentacaoCaixa>('movimentacoes_caixa', 'mov-1');
    expect(salva?.estornado).toBe(true);
    expect(salva?.observacao).toBe('aporte da manhã | ESTORNADO: duplicado');
  });

  it('o estorno tira o valor do saldo do lote — é o que faz a conferência voltar a bater', async () => {
    semear('lotes_caixa', [loteBase]); // saldo_inicial 100
    semear('movimentacoes_caixa', [
      { ...movBase, id: 'mov-1', origem: 'suprimento', tipo: 'entrada', valor: 50 },
      { ...movBase, id: 'mov-2', origem: 'suprimento', tipo: 'entrada', valor: 30 },
    ]);
    await estornarMovimentacaoCaixa(false, 'mov-1', 'duplicado');
    const lote = guardado<LoteCaixa>('lotes_caixa', 'lote-1');
    expect(lote?.saldo_entradas).toBe(30);
    expect(lote?.saldo_esperado).toBe(130);
  });

  it('offline, enfileira a movimentação estornada', async () => {
    semear('movimentacoes_caixa', [{ ...movBase, origem: 'suprimento' }]);
    semear('lotes_caixa', [loteBase]);
    await estornarMovimentacaoCaixa(false, 'mov-1', 'engano');
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'movimentacoes_caixa', action: 'update' }),
    );
  });
});

// ============================================================================
// Reabertura e exclusão
// ============================================================================

describe('reabrirLoteCaixa (offline)', () => {
  beforeEach(() => {
    prepararBancoLocal();
    vi.setSystemTime(new Date('2026-09-19T20:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fechado: LoteCaixa = {
    ...loteBase,
    status: 'fechado',
    data_fechamento: '2026-09-19T18:00:00.000Z',
    saldo_fechamento_informado: 180,
    diferenca_quebra_sobra: -20,
    observacao_fechamento: 'quebra de 20',
  };

  it('lança quando o lote não é encontrado', async () => {
    semear('lotes_caixa', []);
    await expect(reabrirLoteCaixa(false, 'lote-1', 'erro de digitação', 'ANA'))
      .rejects.toThrow(/Lote não encontrado/i);
  });

  it('lança quando o lote já está aberto', async () => {
    semear('lotes_caixa', [loteBase]);
    await expect(reabrirLoteCaixa(false, 'lote-1', 'x', 'ANA')).rejects.toThrow(/já está aberto/i);
  });

  it('recusa reabrir enquanto outro lote da empresa estiver aberto', async () => {
    // Dois lotes abertos ao mesmo tempo fariam a próxima movimentação cair num deles por
    // sorteio — `getLoteAbertoAtivo` devolve o primeiro que encontrar.
    semear('lotes_caixa', [fechado, { ...loteBase, id: 'l2', status: 'aberto', codigo_lote: 'LOTE-ATUAL' }]);
    await expect(reabrirLoteCaixa(false, 'lote-1', 'x', 'ANA'))
      .rejects.toThrow(/já existe um lote aberto \(LOTE-ATUAL\)/i);
  });

  it('o lote aberto de outra empresa não impede a reabertura', async () => {
    semear('lotes_caixa', [fechado, { ...loteBase, id: 'l2', tenant_id: 'emp-2', status: 'aberto' }]);
    const out = await reabrirLoteCaixa(false, 'lote-1', 'erro de digitação', 'ANA');
    expect(out.status).toBe('aberto');
  });

  it('limpa os dados do fechamento anterior, para a próxima conferência ser feita do zero', async () => {
    semear('lotes_caixa', [fechado]);
    const out = await reabrirLoteCaixa(false, 'lote-1', 'erro de digitação', 'ANA');
    expect(out.data_fechamento).toBeNull();
    expect(out.saldo_fechamento_informado).toBeNull();
    expect(out.diferenca_quebra_sobra).toBeNull();
  });

  it('a reabertura fica registrada na observação, com quem reabriu e por quê', async () => {
    semear('lotes_caixa', [fechado]);
    const out = await reabrirLoteCaixa(false, 'lote-1', 'erro de digitação', 'ANA');
    expect(out.observacao_fechamento).toBe('quebra de 20 | REABERTO por ANA: erro de digitação');
  });

  it('offline, grava no cache e enfileira', async () => {
    semear('lotes_caixa', [fechado]);
    await reabrirLoteCaixa(false, 'lote-1', 'erro', 'ANA');
    expect(guardado<LoteCaixa>('lotes_caixa', 'lote-1')?.status).toBe('aberto');
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'lotes_caixa', action: 'update' }),
    );
  });
});

describe('excluirLoteCaixa (offline)', () => {
  beforeEach(prepararBancoLocal);

  it('apaga o lote e SÓ as movimentações dele', async () => {
    semear('lotes_caixa', [loteBase, { ...loteBase, id: 'lote-2' }]);
    semear('movimentacoes_caixa', [
      { ...movBase, id: 'm1', lote_id: 'lote-1' },
      { ...movBase, id: 'm2', lote_id: 'lote-1' },
      { ...movBase, id: 'm3', lote_id: 'lote-2' },
    ]);
    await excluirLoteCaixa(false, 'lote-1');
    expect(guardados('lotes_caixa').map(l => l.id)).toEqual(['lote-2']);
    expect(guardados('movimentacoes_caixa').map(m => m.id)).toEqual(['m3']);
  });

  it('offline, enfileira a exclusão do lote', async () => {
    semear('lotes_caixa', [loteBase]);
    semear('movimentacoes_caixa', []);
    await excluirLoteCaixa(false, 'lote-1');
    expect(mockAddToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'lotes_caixa', action: 'delete', data: { id: 'lote-1' } }),
    );
  });
});

// ============================================================================
// Integração com o financeiro
// ============================================================================

describe('sincronizarLancamentosFinanceiros (offline)', () => {
  beforeEach(() => {
    prepararBancoLocal();
    vi.setSystemTime(new Date(2026, 8, 19, 10, 0, 0));
    mockGetParcelasReceber.mockReset();
    mockGetParcelasPagar.mockReset();
    mockGetParcelasReceber.mockResolvedValue([] as any);
    mockGetParcelasPagar.mockResolvedValue([] as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const parcelaRecebida = (over: Record<string, any> = {}) => ({
    id: 'parc-1',
    tenant_id: 'emp-1',
    receita_id: 'rec-1',
    numero_parcela: 1,
    total_parcelas: 12,
    valor: 89.9,
    valor_recebido: 89.9,
    data_vencimento: '2026-09-10',
    data_recebimento: '2026-09-09T12:00:00.000Z',
    status: 'recebido',
    devedor_nome: 'MARIA',
    descricao: 'Mensalidade',
    ...over,
  });

  const parcelaPaga = (over: Record<string, any> = {}) => ({
    id: 'parcp-1',
    tenant_id: 'emp-1',
    despesa_id: 'desp-1',
    numero_parcela: 2,
    total_parcelas: 3,
    valor: 40,
    valor_pago: 40,
    data_vencimento: '2026-09-10',
    data_pagamento: '2026-09-11T12:00:00.000Z',
    status: 'pago',
    credor_nome: 'FORNECEDOR X',
    descricao: 'Aluguel',
    ...over,
  });

  it('abre um lote automático quando não há nenhum aberto', async () => {
    semear('lotes_caixa', []);
    await sincronizarLancamentosFinanceiros(false, 'emp-1');
    const lotes = guardados<LoteCaixa>('lotes_caixa');
    expect(lotes).toHaveLength(1);
    expect(lotes[0].terminal_caixa).toBe('Caixa Automático Integrado');
    expect(lotes[0].status).toBe('aberto');
  });

  it('aproveita o lote já aberto em vez de abrir outro', async () => {
    semear('lotes_caixa', [loteBase]);
    mockGetParcelasReceber.mockResolvedValue([parcelaRecebida()] as any);
    await sincronizarLancamentosFinanceiros(false, 'emp-1');
    expect(guardados('lotes_caixa')).toHaveLength(1);
    expect(guardados<MovimentacaoCaixa>('movimentacoes_caixa')[0].lote_id).toBe('lote-1');
  });

  it('só a parcela liquidada vira movimentação — pendente e cancelada ficam de fora', async () => {
    semear('lotes_caixa', [loteBase]);
    mockGetParcelasReceber.mockResolvedValue([
      parcelaRecebida({ id: 'p1', status: 'recebido' }),
      parcelaRecebida({ id: 'p2', status: 'pendente' }),
      parcelaRecebida({ id: 'p3', status: 'cancelado' }),
    ] as any);
    const out = await sincronizarLancamentosFinanceiros(false, 'emp-1');
    expect(out.novosContasReceber).toBe(1);
    expect(guardados<MovimentacaoCaixa>('movimentacoes_caixa').map(m => m.referencia_id)).toEqual(['p1']);
  });

  it('NÃO duplica a movimentação de uma parcela que já foi trazida antes', async () => {
    // É a garantia central desta função: ela pode rodar quantas vezes for, e rodar de novo
    // não pode fazer o mesmo recebimento entrar duas vezes no caixa. O critério é o
    // `referencia_id` das movimentações que já existem.
    semear('lotes_caixa', [loteBase]);
    semear('movimentacoes_caixa', [{ ...movBase, id: 'm-antiga', referencia_id: 'parc-1' }]);
    mockGetParcelasReceber.mockResolvedValue([parcelaRecebida({ id: 'parc-1' })] as any);

    const out = await sincronizarLancamentosFinanceiros(false, 'emp-1');
    expect(out.novosContasReceber).toBe(0);
    expect(guardados('movimentacoes_caixa')).toHaveLength(1);
  });

  it('traz recebimentos como entrada e pagamentos como saída, contando cada lado', async () => {
    semear('lotes_caixa', [loteBase]);
    mockGetParcelasReceber.mockResolvedValue([parcelaRecebida()] as any);
    mockGetParcelasPagar.mockResolvedValue([parcelaPaga()] as any);

    const out = await sincronizarLancamentosFinanceiros(false, 'emp-1');
    expect(out).toEqual({ novosContasReceber: 1, novosContasPagar: 1 });

    const movs = guardados<MovimentacaoCaixa>('movimentacoes_caixa');
    const entrada = movs.find(m => m.origem === 'contas_receber');
    const saida = movs.find(m => m.origem === 'contas_pagar');
    expect(entrada?.tipo).toBe('entrada');
    expect(entrada?.valor).toBe(89.9);
    expect(entrada?.documento_ref).toBe('Parc. 1/12');
    expect(saida?.tipo).toBe('saida');
    expect(saida?.valor).toBe(40);
  });

  it('usa o valor efetivamente recebido, não o valor de face da parcela', async () => {
    semear('lotes_caixa', [loteBase]);
    mockGetParcelasReceber.mockResolvedValue([parcelaRecebida({ valor: 100, valor_recebido: 85 })] as any);
    await sincronizarLancamentosFinanceiros(false, 'emp-1');
    expect(guardados<MovimentacaoCaixa>('movimentacoes_caixa')[0].valor).toBe(85);
  });

  it('cai para o valor de face quando a baixa não guardou o valor recebido', async () => {
    semear('lotes_caixa', [loteBase]);
    mockGetParcelasReceber.mockResolvedValue([parcelaRecebida({ valor: 100, valor_recebido: undefined })] as any);
    await sincronizarLancamentosFinanceiros(false, 'emp-1');
    expect(guardados<MovimentacaoCaixa>('movimentacoes_caixa')[0].valor).toBe(100);
  });

  it('a movimentação nasce com a data da liquidação, não com a de hoje', async () => {
    semear('lotes_caixa', [loteBase]);
    mockGetParcelasReceber.mockResolvedValue([parcelaRecebida({ data_recebimento: '2026-09-09T12:00:00.000Z' })] as any);
    await sincronizarLancamentosFinanceiros(false, 'emp-1');
    expect(guardados<MovimentacaoCaixa>('movimentacoes_caixa')[0].data_movimentacao)
      .toBe('2026-09-09T12:00:00.000Z');
  });

  it('herda a conta contábil do lançamento, como qualquer movimentação de liquidação', async () => {
    semear('lotes_caixa', [loteBase]);
    semear('parcelas_receber', [{ id: 'parc-1', receita_id: 'rec-1' }]);
    semear('receitas', [{ id: 'rec-1', conta_contabil_id: 'conta-receita' }]);
    mockGetParcelasReceber.mockResolvedValue([parcelaRecebida()] as any);

    await sincronizarLancamentosFinanceiros(false, 'emp-1');
    expect(guardados<MovimentacaoCaixa>('movimentacoes_caixa')[0].conta_contabil_id).toBe('conta-receita');
  });

  it('sem nada liquidado, não abre movimentação nenhuma e devolve zero dos dois lados', async () => {
    semear('lotes_caixa', [loteBase]);
    const out = await sincronizarLancamentosFinanceiros(false, 'emp-1');
    expect(out).toEqual({ novosContasReceber: 0, novosContasPagar: 0 });
    expect(guardados('movimentacoes_caixa')).toHaveLength(0);
  });
});

// ============================================================================
// Caminho ONLINE: recusa do servidor × queda de rede
//
// É a regra que o CLAUDE.md fixa desde `saveAtendimento` e que este service era o último a
// não aplicar. O invariante que estes testes cobram: **ou a escrita subiu, ou ela está na
// fila de sync** — nunca nenhum dos dois, que era o estado antigo (console.warn + IndexedDB,
// com a tela dizendo sucesso e o registro preso no navegador de quem operou).
// ============================================================================

describe('caminho online: recusa do servidor × queda de rede', () => {
  type ModoDoServidor = 'aceito' | 'recusa' | 'rede';
  let modo: ModoDoServidor = 'aceito';
  let leituraRemota: Record<string, Registro[]> = {};

  const RECUSA = { code: '23514', message: 'new row violates check constraint "lotes_caixa_status_check"' };

  const construirQuery = (tabela: string) => {
    const escrever = async () => {
      // Rede fora lança de dentro do `await` — é assim que o supabase-js se comporta com o
      // fetch abortado, e é o que separa este caso da recusa devolvida em `error`.
      if (modo === 'rede') throw new TypeError('Failed to fetch');
      if (modo === 'recusa') return { data: null, error: RECUSA };
      return { data: null, error: null };
    };
    const q: any = {
      select: () => q,
      eq: () => q,
      order: () => q,
      insert: escrever,
      upsert: escrever,
      update: escrever,
      delete: escrever,
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (ok: any, falha: any) =>
        Promise.resolve({ data: leituraRemota[tabela] ?? [], error: null }).then(ok, falha),
    };
    return q;
  };

  beforeEach(() => {
    prepararBancoLocal();
    modo = 'aceito';
    leituraRemota = { lotes_caixa: [], movimentacoes_caixa: [] };
    mockSupabaseFrom.mockReset();
    mockSupabaseFrom.mockImplementation(((tabela: string) => construirQuery(tabela)) as any);
    mockRegistrarAuditoria.mockReset();
    mockEstornarRecebimento.mockClear();
    vi.setSystemTime(new Date(2026, 8, 19, 10, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const dadosDeAbertura = {
    tenant_id: 'emp-1',
    terminal_caixa: 'Caixa Principal',
    operador_nome: 'ANA',
    saldo_inicial: 100,
  };

  describe('abrirLoteCaixa', () => {
    it('recusa do servidor LANÇA, com o motivo do Postgres na mensagem', async () => {
      modo = 'recusa';
      await expect(abrirLoteCaixa(true, dadosDeAbertura)).rejects.toThrow(/violates check constraint/);
    });

    it('recusa NÃO vai para a fila de sync — repetir o mesmo payload dá o mesmo erro', async () => {
      modo = 'recusa';
      await expect(abrirLoteCaixa(true, dadosDeAbertura)).rejects.toThrow();
      expect(mockAddToSyncQueue).not.toHaveBeenCalled();
    });

    it('recusa NÃO grava no cache local: o lote não existe em lugar nenhum', async () => {
      // Era exatamente isto que acontecia antes — o lote ficava só no IndexedDB de quem
      // operou, invisível para todo o resto da empresa e para a conferência do caixa.
      modo = 'recusa';
      await expect(abrirLoteCaixa(true, dadosDeAbertura)).rejects.toThrow();
      expect(guardados('lotes_caixa')).toHaveLength(0);
    });

    it('recusa NÃO registra auditoria de abertura', async () => {
      // A trilha não pode afirmar que um lote foi aberto quando o servidor o recusou.
      modo = 'recusa';
      await expect(abrirLoteCaixa(true, dadosDeAbertura)).rejects.toThrow();
      expect(mockRegistrarAuditoria).not.toHaveBeenCalled();
    });

    it('queda de rede NÃO lança: grava no cache e enfileira', async () => {
      modo = 'rede';
      const lote = await abrirLoteCaixa(true, dadosDeAbertura);
      expect(guardado('lotes_caixa', lote.id)).toBeDefined();
      expect(mockAddToSyncQueue).toHaveBeenCalledWith(
        expect.objectContaining({ storeName: 'lotes_caixa', action: 'update' }),
      );
    });

    it('aceito pelo servidor: grava, audita e NÃO enfileira', async () => {
      const lote = await abrirLoteCaixa(true, dadosDeAbertura);
      expect(guardado('lotes_caixa', lote.id)).toBeDefined();
      expect(mockRegistrarAuditoria).toHaveBeenCalledWith(
        'Abertura de Lote de Caixa',
        expect.objectContaining({ lote_id: lote.id }),
      );
      expect(mockAddToSyncQueue).not.toHaveBeenCalled();
    });
  });

  describe('fecharLoteCaixa', () => {
    beforeEach(() => {
      semear('lotes_caixa', [loteBase]);
    });

    it('recusa lança e não enfileira o fechamento', async () => {
      modo = 'recusa';
      await expect(fecharLoteCaixa(true, 'lote-1', { saldo_fechamento_informado: 100 })).rejects.toThrow();
      expect(mockAddToSyncQueue).not.toHaveBeenCalled();
      expect(mockRegistrarAuditoria).not.toHaveBeenCalled();
    });

    it('recusa deixa o lote ABERTO no cache — a tela não pode mostrar fechado o que não fechou', async () => {
      modo = 'recusa';
      await expect(fecharLoteCaixa(true, 'lote-1', { saldo_fechamento_informado: 100 })).rejects.toThrow();
      expect(guardado<LoteCaixa>('lotes_caixa', 'lote-1')?.status).toBe('aberto');
    });

    it('queda de rede fecha localmente e enfileira', async () => {
      modo = 'rede';
      const fechado = await fecharLoteCaixa(true, 'lote-1', { saldo_fechamento_informado: 100 });
      expect(fechado.status).toBe('fechado');
      expect(mockAddToSyncQueue).toHaveBeenCalledWith(
        expect.objectContaining({ storeName: 'lotes_caixa', action: 'update' }),
      );
    });
  });

  describe('registrarMovimentacao', () => {
    const nova = () => {
      const { id: _id, criado_em: _c, ...semId } = { ...movBase, origem: 'suprimento' as const };
      return semId as Omit<MovimentacaoCaixa, 'id' | 'criado_em'>;
    };

    beforeEach(() => {
      semear('lotes_caixa', [loteBase]);
    });

    it('recusa lança, não grava e não enfileira', async () => {
      modo = 'recusa';
      await expect(registrarMovimentacao(true, nova())).rejects.toThrow(/violates check constraint/);
      expect(guardados('movimentacoes_caixa')).toHaveLength(0);
      expect(mockAddToSyncQueue).not.toHaveBeenCalled();
    });

    it('recusa NÃO mexe no saldo do lote: o dinheiro não entrou', async () => {
      modo = 'recusa';
      await expect(registrarMovimentacao(true, nova())).rejects.toThrow();
      expect(guardado<LoteCaixa>('lotes_caixa', 'lote-1')?.saldo_esperado).toBe(100);
    });

    it('queda de rede grava e enfileira', async () => {
      modo = 'rede';
      const mov = await registrarMovimentacao(true, nova());
      expect(guardado('movimentacoes_caixa', mov.id)).toBeDefined();
      expect(mockAddToSyncQueue).toHaveBeenCalledWith(
        expect.objectContaining({ storeName: 'movimentacoes_caixa', action: 'update' }),
      );
    });

    it('aceito: grava e NÃO enfileira', async () => {
      const mov = await registrarMovimentacao(true, nova());
      expect(guardado('movimentacoes_caixa', mov.id)).toBeDefined();
      expect(mockAddToSyncQueue).not.toHaveBeenCalled();
    });
  });

  describe('estornarMovimentacaoCaixa', () => {
    beforeEach(() => {
      semear('lotes_caixa', [loteBase]);
      semear('movimentacoes_caixa', [{ ...movBase, origem: 'suprimento', referencia_id: undefined }]);
    });

    it('recusa lança e a movimentação continua NÃO estornada no cache', async () => {
      modo = 'recusa';
      await expect(estornarMovimentacaoCaixa(true, 'mov-1', 'engano')).rejects.toThrow();
      expect(guardado<MovimentacaoCaixa>('movimentacoes_caixa', 'mov-1')?.estornado).toBeFalsy();
      expect(mockAddToSyncQueue).not.toHaveBeenCalled();
    });

    it('queda de rede estorna localmente e enfileira', async () => {
      modo = 'rede';
      await estornarMovimentacaoCaixa(true, 'mov-1', 'engano');
      expect(guardado<MovimentacaoCaixa>('movimentacoes_caixa', 'mov-1')?.estornado).toBe(true);
      expect(mockAddToSyncQueue).toHaveBeenCalledWith(
        expect.objectContaining({ storeName: 'movimentacoes_caixa', action: 'update' }),
      );
    });
  });

  it('o invariante dos quatro caminhos: ou subiu, ou está na fila', async () => {
    // Um só teste varrendo os quatro, porque o que importa aqui não é cada função e sim que
    // nenhuma delas volte a terminar nos dois estados de uma vez — gravada no navegador e
    // fora da fila, que é como um registro de caixa desaparecia sem erro nenhum.
    const caminhos: { nome: string; executar: () => Promise<unknown> }[] = [
      { nome: 'abrirLoteCaixa', executar: () => abrirLoteCaixa(true, dadosDeAbertura) },
      {
        nome: 'fecharLoteCaixa',
        executar: () => fecharLoteCaixa(true, 'lote-1', { saldo_fechamento_informado: 100 }),
      },
      {
        nome: 'registrarMovimentacao',
        executar: () => {
          const { id: _i, criado_em: _c, ...m } = { ...movBase, origem: 'suprimento' as const };
          return registrarMovimentacao(true, m as Omit<MovimentacaoCaixa, 'id' | 'criado_em'>);
        },
      },
      { nome: 'estornarMovimentacaoCaixa', executar: () => estornarMovimentacaoCaixa(true, 'mov-1', 'x') },
    ];

    for (const caminho of caminhos) {
      // --- rede fora: nada sobe, então TEM de estar na fila
      prepararBancoLocal();
      mockSupabaseFrom.mockImplementation(((t: string) => construirQuery(t)) as any);
      semear('lotes_caixa', [loteBase]);
      semear('movimentacoes_caixa', [{ ...movBase, origem: 'suprimento', referencia_id: undefined }]);
      modo = 'rede';
      await caminho.executar();
      expect(mockAddToSyncQueue, `${caminho.nome} sem rede deveria enfileirar`).toHaveBeenCalled();

      // --- recusa: nada sobe e nada é enfileirado, mas o erro CHEGA a quem chamou
      prepararBancoLocal();
      mockSupabaseFrom.mockImplementation(((t: string) => construirQuery(t)) as any);
      semear('lotes_caixa', [loteBase]);
      semear('movimentacoes_caixa', [{ ...movBase, origem: 'suprimento', referencia_id: undefined }]);
      modo = 'recusa';
      await expect(caminho.executar(), `${caminho.nome} deveria lançar na recusa`).rejects.toThrow();
      expect(mockAddToSyncQueue, `${caminho.nome} não deveria enfileirar uma recusa`).not.toHaveBeenCalled();
    }
  });
});
