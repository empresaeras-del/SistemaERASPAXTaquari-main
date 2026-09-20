import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  criarBancoLocal,
  criarSupabaseFalso,
  recusaColunaAusente,
  recusaDominio,
  type Registro,
} from '../test/harnessDeHook';

const estado: { isOnline: boolean; empresaSelecionada: string | null } = {
  isOnline: true,
  empresaSelecionada: 'emp-1',
};
const autenticado: { user: Registro | null } = {
  user: { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' },
};

vi.mock('../context/AppContext', () => ({ useAppContext: () => ({ state: estado }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => autenticado }));
vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  registrarAuditoria: vi.fn(),
}));

import { getFromIDB, saveToIDB, getAllFromIDB, deleteFromIDB } from '../lib/idb';
import { supabase, registrarAuditoria } from '../lib/supabase';
import { usePlanosPax } from './usePlanosPax';

const idb = {
  getFromIDB: vi.mocked(getFromIDB),
  saveToIDB: vi.mocked(saveToIDB),
  getAllFromIDB: vi.mocked(getAllFromIDB),
  deleteFromIDB: vi.mocked(deleteFromIDB),
};
const mockFrom = vi.mocked(supabase.from);
const mockAuditoria = vi.mocked(registrarAuditoria);

const banco = criarBancoLocal();
const servidor = criarSupabaseFalso();

/** Formulário mínimo aceito por `criar`. */
const formulario = (over: Registro = {}): Registro => ({
  codigo: 'PLN001',
  nome: 'PLANO FAMILIA',
  tipo_plano: 'individual',
  valor_mensalidade: 89.9,
  regra_calculo: 'fixo',
  ...over,
});

const comFaixas = () =>
  formulario({
    regra_calculo: 'faixa_etaria',
    faixas: [
      { idade_de: 0, idade_ate: 59, valor: 50 },
      { idade_de: 60, idade_ate: 99, valor: 120 },
    ],
  });

beforeEach(() => {
  banco.limpar();
  servidor.limpar();
  estado.isOnline = true;
  estado.empresaSelecionada = 'emp-1';
  autenticado.user = { id: 'u1', nivel: 'admin', tenant_id: 'emp-1' };

  Object.values(idb).forEach((m) => m.mockReset());
  mockFrom.mockReset();
  mockAuditoria.mockReset();

  banco.ligar(idb);
  mockFrom.mockImplementation(((t: string) => servidor.from(t)) as any);
  mockAuditoria.mockImplementation((async () => undefined) as any);
  vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
});

afterEach(() => vi.useRealTimers());

const montar = async () => {
  const utils = renderHook(() => usePlanosPax());
  await waitFor(() => expect(utils.result.current.loading).toBe(false));
  return utils;
};

// ============================================================================
// As faixas são o PREÇO do plano — e elas falhavam caladas
// ============================================================================

describe('criar — a recusa nas tabelas filhas', () => {
  it('a recusa das FAIXAS não pode virar sucesso: elas são o valor do plano', async () => {
    // Até 20/09/2026 este caminho era `if (errFaixas) console.warn(...)`. O plano entrava no
    // banco, as faixas não, a tela dizia "plano criado" e o operador só descobriria quando
    // alguém fosse cobrar: com `planos_pax_faixas` vazia, `calcularValor` ignora a idade do
    // dependente e o plano passa a cobrar outro preço. O cache local ainda guardava as faixas,
    // então o navegador de quem criou mostrava o plano certo e o de todos os outros, errado.
    servidor.definirEscrita('planos_pax_faixas', {
      data: null,
      error: recusaColunaAusente('planos_pax_faixas', 'idade_ate'),
    });
    const { result } = await montar();

    await expect(result.current.criar(comFaixas() as any)).rejects.toThrow(/faixa/i);
  });

  it('o erro das faixas diz que o PLANO foi criado — repetir criaria um plano duplicado', async () => {
    servidor.definirEscrita('planos_pax_faixas', { data: null, error: recusaDominio('x') });
    const { result } = await montar();

    await expect(result.current.criar(comFaixas() as any)).rejects.toThrow(/plano foi criado/i);
  });

  it('a recusa das COBERTURAS também sobe, e diz o que ficou faltando', async () => {
    // A cobertura decide o que o plano cobre. Um plano gravado sem elas cobre nada, e a
    // tela de atendimento passa a oferecer tudo como "fora da cobertura".
    servidor.definirEscrita('planos_pax_coberturas', { data: null, error: recusaDominio('x') });
    const { result } = await montar();

    await expect(
      result.current.criar(formulario({ itensCobertos: ['item-1', 'item-2'] }) as any),
    ).rejects.toThrow(/cobertura/i);
  });

  it('a recusa do PLANO em si continua lançando, antes de tocar nas filhas', async () => {
    servidor.definirEscrita('planos_pax', { data: null, error: recusaDominio('planos_pax_tipo_check') });
    const { result } = await montar();

    await expect(result.current.criar(comFaixas() as any)).rejects.toThrow(/check constraint/);
    expect(servidor.escritasEm('planos_pax_faixas')).toHaveLength(0);
  });

  it('sem faixas nem coberturas, nenhuma escrita filha é tentada', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(formulario() as any);
    });

    expect(servidor.escritasEm('planos_pax_faixas')).toHaveLength(0);
    expect(servidor.escritasEm('planos_pax_coberturas')).toHaveLength(0);
  });
});

// ============================================================================
// O payload
// ============================================================================

describe('criar — o que vai ao Postgres', () => {
  it('aplica as carências padrão do negócio quando o formulário não as informa', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(formulario() as any);
    });

    const insert = servidor.escritasEm('planos_pax')[0];
    expect(insert.payload.carencia_geral_dias).toBe(30);
    expect(insert.payload.carencia_morte_natural_dias).toBe(90);
    expect(insert.payload.carencia_acidente_dias).toBe(0);
  });

  it('`limite_vidas` só existe no plano coletivo — no individual vai NULL', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(formulario({ tipo_plano: 'individual', limite_vidas: 5 }) as any);
      await result.current.criar(formulario({ tipo_plano: 'coletivo', limite_vidas: 5 }) as any);
    });

    const [individual, coletivo] = servidor.escritasEm('planos_pax');
    expect(individual.payload.limite_vidas).toBeNull();
    expect(coletivo.payload.limite_vidas).toBe(5);
  });

  it('o coletivo sem limite informado cai em 2, não em zero', async () => {
    // Zero seria um plano coletivo que não aceita ninguém.
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(formulario({ tipo_plano: 'coletivo' }) as any);
    });
    expect(servidor.escritasEm('planos_pax')[0].payload.limite_vidas).toBe(2);
  });

  it('`idade_maxima` ausente grava NULL — "sem teto" não é "zero anos"', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(formulario() as any);
    });

    const insert = servidor.escritasEm('planos_pax')[0];
    expect(insert.payload.idade_maxima).toBeNull();
    expect(insert.payload.idade_minima).toBe(0);
  });

  it('as faixas só são montadas quando a regra de cálculo é por faixa etária', async () => {
    // Um plano `fixo` com faixas digitadas e depois abandonadas não pode levá-las ao banco:
    // a regra gravada e o preço cobrado passariam a discordar.
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(
        formulario({ regra_calculo: 'fixo', faixas: [{ idade_de: 0, idade_ate: 99, valor: 10 }] }) as any,
      );
    });

    expect(servidor.escritasEm('planos_pax_faixas')).toHaveLength(0);
  });

  it('a faixa aceita os dois nomes de campo que o projeto já usou', async () => {
    // `idade_de`/`idade_ate` é o nome atual; `idade_min`/`idade_max` é o legado do formulário.
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(
        formulario({
          regra_calculo: 'faixa_etaria',
          faixas: [{ idade_min: 18, idade_max: 40, valor: 70 }],
        }) as any,
      );
    });

    const faixa = servidor.escritasEm('planos_pax_faixas')[0];
    expect(faixa.payload.idade_de).toBe(18);
    expect(faixa.payload.idade_ate).toBe(40);
  });

  it('coberto e excluído viram a mesma tabela, separados por `tipo_cobertura`', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(
        formulario({
          itensCobertos: ['i1'],
          itensExcluidos: ['i2'],
          observacoesItens: { i1: 'até 100km' },
        }) as any,
      );
    });

    const escritas = servidor.escritasEm('planos_pax_coberturas');
    expect(escritas).toHaveLength(1); // um insert com o array inteiro
    expect(escritas[0].payload.tipo_cobertura).toBe('coberto');
    expect(escritas[0].payload.observacao).toBe('até 100km');
  });

  it('para quem não é super_admin, o tenant do usuário manda sobre o seletor', async () => {
    estado.empresaSelecionada = 'emp-9';
    autenticado.user = { id: 'u1', nivel: 'gerente', tenant_id: 'emp-1' };
    const { result } = await montar();
    await act(async () => {
      await result.current.criar(formulario() as any);
    });

    expect(servidor.escritasEm('planos_pax')[0].payload.tenant_id).toBe('emp-1');
  });

  it('sem usuário, recusa antes de montar payload nenhum', async () => {
    autenticado.user = null;
    const { result } = await montar();

    await expect(result.current.criar(formulario() as any)).rejects.toThrow(/não autenticado/i);
    expect(servidor.escritasEm('planos_pax')).toHaveLength(0);
  });
});

// ============================================================================
// Exclusão: a guarda de vínculo
// ============================================================================

describe('excluir — a guarda de vínculo', () => {
  it('recusa quando há associado usando o plano, e diz quantos', async () => {
    banco.semear('planos_pax', [{ id: 'pl-1', nome: 'PLANO' }]);
    banco.semear('associados', [
      { id: 'a1', plano_pax_id: 'pl-1', status: 'ativo' },
      { id: 'a2', plano_pax_id: 'pl-1', status: 'ativo' },
    ]);
    const { result } = await montar();

    await expect(result.current.excluir('pl-1')).rejects.toThrow(/2 associado\(s\) ativo\(s\)/);
    expect(banco.guardados('planos_pax')).toHaveLength(1);
  });

  it('a guarda roda antes de qualquer escrita — nada é apagado em cascata', async () => {
    banco.semear('planos_pax', [{ id: 'pl-1' }]);
    banco.semear('associados', [{ id: 'a1', plano_pax_id: 'pl-1', status: 'ativo' }]);
    const { result } = await montar();

    await expect(result.current.excluir('pl-1')).rejects.toThrow();
    expect(servidor.escritasEm('planos_pax_coberturas')).toHaveLength(0);
    expect(servidor.escritasEm('planos_pax_faixas')).toHaveLength(0);
    expect(mockAuditoria).not.toHaveBeenCalled();
  });

  it('sem vínculo, apaga as filhas antes do plano e audita', async () => {
    banco.semear('planos_pax', [{ id: 'pl-1' }]);
    banco.semear('associados', []);
    banco.semear('contratos', []);
    const { result } = await montar();

    await act(async () => {
      await result.current.excluir('pl-1');
    });

    const ordem = servidor.chamadas.filter((c) => c.operacao === 'delete').map((c) => c.tabela);
    expect(ordem).toEqual([
      'planos_pax_coberturas',
      'planos_pax_faixas',
      'credenciados_planos',
      'planos_pax',
    ]);
    expect(mockAuditoria).toHaveBeenCalledWith('Excluir Plano e Vínculos', { id: 'pl-1' });
    expect(banco.guardados('planos_pax')).toHaveLength(0);
  });
});
