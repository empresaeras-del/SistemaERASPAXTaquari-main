import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));
vi.mock('../lib/syncService', () => ({ addToSyncQueue: vi.fn() }));
vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
  registrarAuditoria: vi.fn(),
}));

import { getFromIDB, saveToIDB, getAllFromIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import {
  getCategoriasFornecedor,
  salvarCategoriaFornecedor,
  desativarCategoriaFornecedor,
} from './categoriasFornecedorService';
import { CategoriaFornecedorRegistro } from '../types/categoriaFornecedor';
import { MENSAGEM_CATEGORIA_DUPLICADA, MENSAGEM_CATEGORIA_SEM_NOME } from '../utils/categoriasFornecedor';
import { MENSAGEM_TENANT_INDEFINIDO } from '../utils/tenant';

const mockGetFromIDB = vi.mocked(getFromIDB);
const mockSaveToIDB = vi.mocked(saveToIDB);
const mockGetAllFromIDB = vi.mocked(getAllFromIDB);
const mockAddToSyncQueue = vi.mocked(addToSyncQueue);

const categoria = (
  over: Partial<CategoriaFornecedorRegistro> & { id: string; nome: string }
): CategoriaFornecedorRegistro => ({
  tenant_id: 'emp-1',
  codigo: 'COD',
  ativo: true,
  ...over,
});

beforeEach(() => {
  mockGetFromIDB.mockReset();
  mockSaveToIDB.mockReset();
  mockGetAllFromIDB.mockReset();
  mockAddToSyncQueue.mockReset();
  mockGetAllFromIDB.mockResolvedValue([]);
});

describe('getCategoriasFornecedor (offline, fallback IDB)', () => {
  it('filtra por tenant e descarta as excluídas', async () => {
    mockGetAllFromIDB.mockResolvedValue([
      categoria({ id: '1', nome: 'Alfa', tenant_id: 'emp-1' }),
      categoria({ id: '2', nome: 'Beta', tenant_id: 'emp-2' }),
      categoria({ id: '3', nome: 'Gama', tenant_id: 'emp-1', deleted_at: '2026-01-01' }),
    ]);
    const lista = await getCategoriasFornecedor(false, 'emp-1');
    expect(lista.map((c) => c.id)).toEqual(['1']);
  });

  it('ativas primeiro, desativadas no fim', async () => {
    mockGetAllFromIDB.mockResolvedValue([
      categoria({ id: '1', nome: 'Zebra' }),
      categoria({ id: '2', nome: 'Antiga', ativo: false }),
      categoria({ id: '3', nome: 'Alfa' }),
    ]);
    const lista = await getCategoriasFornecedor(false, 'emp-1');
    expect(lista.map((c) => c.nome)).toEqual(['Alfa', 'Zebra', 'Antiga']);
  });
});

describe('salvarCategoriaFornecedor (offline)', () => {
  it('deriva o código do nome e enfileira para sincronizar', async () => {
    const salva = await salvarCategoriaFornecedor(false, {
      tenant_id: 'emp-1',
      nome: '  Urnas   e Caixões ',
    });
    expect(salva.nome).toBe('Urnas e Caixões');
    expect(salva.codigo).toBe('URNAS-E-CAIXOES');
    expect(salva.ativo).toBe(true);
    expect(mockAddToSyncQueue).toHaveBeenCalledTimes(1);
  });

  it('recusa sem empresa resolvida, em vez de carimbar um coringa', async () => {
    await expect(salvarCategoriaFornecedor(false, { nome: 'Alfa' })).rejects.toThrow(
      MENSAGEM_TENANT_INDEFINIDO,
    );
  });

  it('recusa nome vazio', async () => {
    await expect(
      salvarCategoriaFornecedor(false, { tenant_id: 'emp-1', nome: '   ' }),
    ).rejects.toThrow(MENSAGEM_CATEGORIA_SEM_NOME);
  });

  it('recusa nome que já existe na empresa, sem esperar a violação de constraint', async () => {
    await expect(
      salvarCategoriaFornecedor(false, { tenant_id: 'emp-1', nome: 'outros' }, [
        categoria({ id: 'c1', nome: 'Outros' }),
      ]),
    ).rejects.toThrow(MENSAGEM_CATEGORIA_DUPLICADA);
  });

  it('o código de uma categoria que já existe NÃO muda quando ela é renomeada', async () => {
    // É por ele que quem exportou relatório reconhece a categoria.
    mockGetFromIDB.mockResolvedValue(categoria({ id: 'c1', nome: 'Antigo', codigo: 'ANTIGO' }));
    const salva = await salvarCategoriaFornecedor(false, {
      id: 'c1',
      tenant_id: 'emp-1',
      nome: 'Nome Novo',
    });
    expect(salva.codigo).toBe('ANTIGO');
    expect(salva.nome).toBe('Nome Novo');
  });

  it('renomear propaga o nome novo para os fornecedores daquela categoria', async () => {
    // `fornecedores.categoria` NÃO é snapshot: é classificação operacional, e a categoria
    // renomeada tem de aparecer com o nome de hoje na listagem, no filtro e no relatório.
    mockGetFromIDB.mockResolvedValue(categoria({ id: 'c1', nome: 'Antigo', codigo: 'ANTIGO' }));
    mockGetAllFromIDB.mockResolvedValue([
      { id: 'f1', categoria_id: 'c1', categoria: 'Antigo' },
      { id: 'f2', categoria_id: 'c2', categoria: 'Outra' },
    ] as never);

    await salvarCategoriaFornecedor(false, { id: 'c1', tenant_id: 'emp-1', nome: 'Nome Novo' });

    const gravados = mockSaveToIDB.mock.calls.filter(([store]) => store === 'fornecedores');
    expect(gravados).toHaveLength(1);
    expect(gravados[0][1]).toMatchObject({ id: 'f1', categoria: 'Nome Novo' });
  });

  it('salvar sem renomear não toca em fornecedor nenhum', async () => {
    mockGetFromIDB.mockResolvedValue(categoria({ id: 'c1', nome: 'Igual', codigo: 'IGUAL' }));
    mockGetAllFromIDB.mockResolvedValue([{ id: 'f1', categoria_id: 'c1', categoria: 'Igual' }] as never);

    await salvarCategoriaFornecedor(false, {
      id: 'c1',
      tenant_id: 'emp-1',
      nome: 'Igual',
      descricao: 'só mudou a descrição',
    });

    expect(mockSaveToIDB.mock.calls.filter(([store]) => store === 'fornecedores')).toHaveLength(0);
  });
});

describe('desativarCategoriaFornecedor', () => {
  it('marca inativa sem excluir — o fornecedor que a usa continua válido', async () => {
    mockGetFromIDB.mockResolvedValue(categoria({ id: 'c1', nome: 'Alfa', codigo: 'ALFA' }));
    const salva = await desativarCategoriaFornecedor(false, categoria({ id: 'c1', nome: 'Alfa', codigo: 'ALFA' }));
    expect(salva.ativo).toBe(false);
    expect(salva.deleted_at).toBeUndefined();
  });
});
