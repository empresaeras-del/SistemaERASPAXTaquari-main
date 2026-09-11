import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(async () => []),
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
  excluirReceitasPorAtendimento: vi.fn(),
}));

import { saveToIDB } from '../lib/idb';
import { addToSyncQueue } from '../lib/syncService';
import { supabase } from '../lib/supabase';
import { sanitizeAtendimentoForSupabase, saveAtendimento } from './atendimentosService';
import { Atendimento } from '../types/atendimentos';

const base: Atendimento = {
  id: '11111111-1111-4111-8111-111111111111',
  tenant_id: 'emp-1',
  tipo_cliente: 'externo',
  falecido_nome: 'JOSÉ PEREIRA',
  status: 'aberto',
  valor_total: 0,
};

/** Encadeamento `.upsert().select().single()` do supabase-js. */
const mockUpsert = (resultado: { data?: any; error?: any }) => {
  const single = vi.fn(async () => resultado);
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));
  (supabase.from as any).mockReturnValue({ upsert });
  return { upsert };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sanitizeAtendimentoForSupabase', () => {
  it('troca data em branco por null — o Postgres recusa "" com 22007', () => {
    // Foi por isto que a tabela `atendimentos` ficou vazia em produção: o formulário
    // inicializa cada campo com '' e mandava a string vazia para uma coluna `date`.
    const limpo = sanitizeAtendimentoForSupabase({
      ...base,
      falecido_data_nascimento: '',
      data_obito: '',
      data_velorio: '   ',
      data_sepultamento: undefined,
    });

    expect(limpo.falecido_data_nascimento).toBeNull();
    expect(limpo.data_obito).toBeNull();
    expect(limpo.data_velorio).toBeNull();
    expect(limpo.data_sepultamento).toBeNull();
  });

  it('preserva a data preenchida', () => {
    const limpo = sanitizeAtendimentoForSupabase({
      ...base,
      falecido_data_nascimento: '1950-03-14',
      data_obito: '2026-09-11T08:30',
    });

    expect(limpo.falecido_data_nascimento).toBe('1950-03-14');
    expect(limpo.data_obito).toBe('2026-09-11T08:30');
  });

  it('troca uuid em branco ou inválido por null — o caso do cliente externo', () => {
    // `falecidoId` nunca sai de '' quando o atendimento não é de associado, e ia inteiro
    // para `dependente_id` (uuid): 22P02.
    const limpo = sanitizeAtendimentoForSupabase({
      ...base,
      dependente_id: '',
      associado_id: 'associado',
      created_by: undefined,
    });

    expect(limpo.dependente_id).toBeNull();
    expect(limpo.associado_id).toBeNull();
    expect(limpo.created_by).toBeNull();
  });

  it('preserva o uuid válido', () => {
    const assoc = '22222222-2222-4222-8222-222222222222';
    const limpo = sanitizeAtendimentoForSupabase({ ...base, associado_id: assoc });
    expect(limpo.associado_id).toBe(assoc);
  });

  it('tira `itens` do payload — eles são gravados em atendimento_itens', () => {
    const limpo = sanitizeAtendimentoForSupabase({
      ...base,
      itens: [{ id: 'i1', atendimento_id: '', item_id: 'x', quantidade: 1, valor_unitario: 10, coberto: true }],
    });

    expect('itens' in limpo).toBe(false);
    expect(limpo.falecido_nome).toBe('JOSÉ PEREIRA');
  });
});

describe('saveAtendimento', () => {
  it('recusa do servidor lança — nunca vira sucesso aparente', async () => {
    mockUpsert({ error: { code: '22007', message: 'invalid input syntax for type date: ""' } });

    await expect(saveAtendimento(base, true)).rejects.toThrow(/22007/);
    // E não deixa cópia no IndexedDB: um registro que o servidor nunca vai aceitar só
    // reapareceria como fantasma na lista.
    expect(saveToIDB).not.toHaveBeenCalled();
  });

  it('queda de rede guarda local e enfileira — este é o caso offline-first legítimo', async () => {
    (supabase.from as any).mockImplementation(() => {
      throw new Error('Failed to fetch');
    });

    await expect(saveAtendimento(base, true)).resolves.toBeUndefined();
    expect(saveToIDB).toHaveBeenCalledWith('atendimentos', base);
    expect(addToSyncQueue).toHaveBeenCalledWith(
      expect.objectContaining({ storeName: 'atendimentos', action: 'insert' }),
    );
  });

  it('sucesso grava no IndexedDB e envia o payload sanitizado', async () => {
    const { upsert } = mockUpsert({ data: { id: base.id } });

    await saveAtendimento({ ...base, data_obito: '', dependente_id: '' }, true);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ data_obito: null, dependente_id: null }),
    );
    expect(saveToIDB).toHaveBeenCalledWith('atendimentos', expect.objectContaining({ id: base.id }));
  });

  it('offline não toca no servidor', async () => {
    await saveAtendimento(base, false);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(saveToIDB).toHaveBeenCalledWith('atendimentos', base);
  });
});
