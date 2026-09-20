/**
 * `useCentrosCusto` e `useCategoriasFornecedor` são os dois hooks de catálogo da empresa, e
 * têm o mesmo desenho: **só orquestram**. A regra (código derivado do nome, ordenação, o que
 * o seletor oferece) mora em `utils/`, que já é puro e testado, e a gravação mora no service.
 *
 * O que sobra para testar aqui é exatamente o que o hook decide sozinho, e que nenhum dos
 * dois outros lados cobre:
 *
 * - **qual empresa vai no registro novo** — resolvida por `tenantDeEscrita`, nunca por um
 *   literal; e `null` (super_admin sem empresa escolhida) tem de chegar ao service como
 *   `undefined`, para ele recusar com `MENSAGEM_TENANT_INDEFINIDO` em vez de carimbar coringa;
 * - **que toda gravação recarrega a lista** — sem isso o operador salva e não vê;
 * - **que a falha de carregamento vira `error` e lista vazia**, em vez de derrubar a tela.
 *
 * Os dois hooks estão no mesmo arquivo de propósito: eles são a mesma coisa duas vezes, e ler
 * os dois blocos lado a lado é o que mostra que qualquer divergência entre eles é acidental.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Registro } from '../test/harnessDeHook';

const estado: {
  isOnline: boolean;
  empresaSelecionada: string | null;
  user: Registro | null;
} = { isOnline: true, empresaSelecionada: 'emp-1', user: { id: 'u1', tenant_id: 'emp-1' } };

vi.mock('../context/AppContext', () => ({ useAppContext: () => ({ state: estado }) }));

vi.mock('../services/centrosCustoService', () => ({
  getCentrosCusto: vi.fn(async () => []),
  salvarCentroCusto: vi.fn(async (_online: boolean, dados: Registro) => ({ id: 'c-novo', ...dados })),
  desativarCentroCusto: vi.fn(async () => undefined),
  reativarCentroCusto: vi.fn(async () => undefined),
}));

vi.mock('../services/categoriasFornecedorService', () => ({
  getCategoriasFornecedor: vi.fn(async () => []),
  salvarCategoriaFornecedor: vi.fn(async (_online: boolean, dados: Registro) => ({ id: 'k-novo', ...dados })),
  desativarCategoriaFornecedor: vi.fn(async () => undefined),
  reativarCategoriaFornecedor: vi.fn(async () => undefined),
}));

import {
  getCentrosCusto,
  salvarCentroCusto,
  desativarCentroCusto,
  reativarCentroCusto,
} from '../services/centrosCustoService';
import {
  getCategoriasFornecedor,
  salvarCategoriaFornecedor,
  desativarCategoriaFornecedor,
  reativarCategoriaFornecedor,
} from '../services/categoriasFornecedorService';
import { useCentrosCusto } from './useCentrosCusto';
import { useCategoriasFornecedor } from './useCategoriasFornecedor';

const centros = {
  get: vi.mocked(getCentrosCusto),
  salvar: vi.mocked(salvarCentroCusto),
  desativar: vi.mocked(desativarCentroCusto),
  reativar: vi.mocked(reativarCentroCusto),
};
const categorias = {
  get: vi.mocked(getCategoriasFornecedor),
  salvar: vi.mocked(salvarCategoriaFornecedor),
  desativar: vi.mocked(desativarCategoriaFornecedor),
  reativar: vi.mocked(reativarCategoriaFornecedor),
};

beforeEach(() => {
  vi.clearAllMocks();
  estado.isOnline = true;
  estado.empresaSelecionada = 'emp-1';
  estado.user = { id: 'u1', tenant_id: 'emp-1' };
  centros.get.mockResolvedValue([] as any);
  centros.salvar.mockImplementation((async (_o: boolean, d: Registro) => ({ id: 'c-novo', ...d })) as any);
  categorias.get.mockResolvedValue([] as any);
  categorias.salvar.mockImplementation((async (_o: boolean, d: Registro) => ({ id: 'k-novo', ...d })) as any);
});

// ============================================================================
// Centros de custo
// ============================================================================

describe('useCentrosCusto', () => {
  const montar = async () => {
    const utils = renderHook(() => useCentrosCusto());
    await waitFor(() => expect(utils.result.current.loading).toBe(false));
    return utils;
  };

  it('carrega pela empresa selecionada', async () => {
    centros.get.mockResolvedValue([{ id: 'c1', nome: 'ADMINISTRATIVO' }] as any);
    const { result } = await montar();

    expect(centros.get).toHaveBeenCalledWith(true, 'emp-1');
    expect(result.current.centros.map((c) => c.id)).toEqual(['c1']);
  });

  it('a falha de carregamento vira `error` e lista vazia, sem derrubar a tela', async () => {
    centros.get.mockRejectedValue(new Error('sem rede'));
    const { result } = await montar();

    expect(result.current.error).toBe('sem rede');
    expect(result.current.centros).toEqual([]);
  });

  it('o registro novo leva a empresa resolvida por `tenantDeEscrita`', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.salvar({ nome: 'ALMOXARIFADO' } as any);
    });

    const [, dados] = centros.salvar.mock.calls[0] as any[];
    expect(dados.tenant_id).toBe('emp-1');
  });

  it('o `tenant_id` explícito do chamador ganha do seletor', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.salvar({ nome: 'X', tenant_id: 'emp-9' } as any);
    });

    const [, dados] = centros.salvar.mock.calls[0] as any[];
    expect(dados.tenant_id).toBe('emp-9');
  });

  it('sem empresa resolvida manda `undefined`, para o SERVICE recusar', async () => {
    // O hook não inventa nem um literal nem um `null` disfarçado: manda `undefined` e deixa
    // a recusa (`MENSAGEM_TENANT_INDEFINIDO`) no ponto de escrita, que é onde ela vale.
    estado.empresaSelecionada = 'all';
    estado.user = { id: 'u0', tenant_id: null };
    const { result } = await montar();

    await act(async () => {
      await result.current.salvar({ nome: 'X' } as any);
    });

    const [, dados] = centros.salvar.mock.calls[0] as any[];
    expect(dados.tenant_id).toBeUndefined();
  });

  it('salvar, desativar e reativar recarregam a lista', async () => {
    const { result } = await montar();
    centros.get.mockClear();

    await act(async () => {
      await result.current.salvar({ nome: 'A' } as any);
      await result.current.desativar({ id: 'c1' } as any);
      await result.current.reativar({ id: 'c1' } as any);
    });

    expect(centros.get).toHaveBeenCalledTimes(3);
    expect(centros.desativar).toHaveBeenCalledWith(true, { id: 'c1' });
    expect(centros.reativar).toHaveBeenCalledWith(true, { id: 'c1' });
  });

  it('a recusa do service sobe para a tela em vez de virar sucesso', async () => {
    centros.salvar.mockRejectedValue(new Error('empresa indefinida'));
    const { result } = await montar();

    await expect(result.current.salvar({ nome: 'X' } as any)).rejects.toThrow(/empresa indefinida/);
  });
});

// ============================================================================
// Categorias de fornecedor
// ============================================================================

describe('useCategoriasFornecedor', () => {
  const montar = async () => {
    const utils = renderHook(() => useCategoriasFornecedor());
    await waitFor(() => expect(utils.result.current.loading).toBe(false));
    return utils;
  };

  it('carrega pela empresa selecionada', async () => {
    categorias.get.mockResolvedValue([{ id: 'k1', nome: 'Convenios Associados' }] as any);
    const { result } = await montar();

    expect(categorias.get).toHaveBeenCalledWith(true, 'emp-1');
    expect(result.current.categorias.map((c) => c.id)).toEqual(['k1']);
  });

  it('a falha de carregamento vira `error` e lista vazia', async () => {
    categorias.get.mockRejectedValue(new Error('sem rede'));
    const { result } = await montar();

    expect(result.current.error).toBe('sem rede');
    expect(result.current.categorias).toEqual([]);
  });

  it('passa a LISTA ATUAL ao service — é ela que evita código duplicado', async () => {
    // Diferença real entre os dois hooks, e o motivo dela: o código da categoria é derivado
    // do nome, então salvar precisa saber quais códigos já existem para não colidir. O
    // centro de custo não precisa, porque o service dele resolve isso de outro jeito.
    categorias.get.mockResolvedValue([{ id: 'k1', nome: 'URNAS', codigo: 'URNAS' }] as any);
    const { result } = await montar();

    await act(async () => {
      await result.current.salvar({ nome: 'Urnas' } as any);
    });

    const [, , listaAtual] = categorias.salvar.mock.calls[0] as any[];
    expect(listaAtual.map((c: Registro) => c.id)).toEqual(['k1']);
  });

  it('o registro novo leva a empresa resolvida, e o explícito ganha', async () => {
    const { result } = await montar();
    await act(async () => {
      await result.current.salvar({ nome: 'A' } as any);
      await result.current.salvar({ nome: 'B', tenant_id: 'emp-9' } as any);
    });

    const [, primeiro] = categorias.salvar.mock.calls[0] as any[];
    const [, segundo] = categorias.salvar.mock.calls[1] as any[];
    expect(primeiro.tenant_id).toBe('emp-1');
    expect(segundo.tenant_id).toBe('emp-9');
  });

  it('sem empresa resolvida manda `undefined`, para o service recusar', async () => {
    estado.empresaSelecionada = 'all';
    estado.user = { id: 'u0', tenant_id: null };
    const { result } = await montar();

    await act(async () => {
      await result.current.salvar({ nome: 'X' } as any);
    });

    const [, dados] = categorias.salvar.mock.calls[0] as any[];
    expect(dados.tenant_id).toBeUndefined();
  });

  it('salvar, desativar e reativar recarregam a lista', async () => {
    const { result } = await montar();
    categorias.get.mockClear();

    await act(async () => {
      await result.current.salvar({ nome: 'A' } as any);
      await result.current.desativar({ id: 'k1' } as any);
      await result.current.reativar({ id: 'k1' } as any);
    });

    expect(categorias.get).toHaveBeenCalledTimes(3);
  });

  it('offline, o hook repassa `isOnline` ao service em vez de decidir por conta própria', async () => {
    estado.isOnline = false;
    const { result } = await montar();

    await act(async () => {
      await result.current.salvar({ nome: 'A' } as any);
    });

    expect(categorias.get).toHaveBeenCalledWith(false, 'emp-1');
    expect(categorias.salvar.mock.calls[0][0]).toBe(false);
  });
});
