import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { getAllFromIDB } from '../lib/idb';
import { supabase } from '../lib/supabase';
import { getNotificacoes, usuarioJaTeveNotificacao, Notificacao } from './notificacoesService';

const mockGetAllFromIDB = vi.mocked(getAllFromIDB);
const mockFrom = vi.mocked(supabase.from);

/** Encadeia o `.select(...).eq(...)` que `usuarioJaTeveNotificacao` monta. */
const mockContagem = (resultado: { count?: number | null; error?: unknown }) => {
  const eq = vi.fn().mockResolvedValue(resultado);
  mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) } as never);
  return eq;
};

const EU = 'usuario-1';
const OUTRO = 'usuario-2';
const MINHA = 'emp-1';
const OUTRA = 'emp-2';

const base: Notificacao = {
  id: 'n0',
  tenant_id: MINHA,
  usuario_id: EU,
  titulo: 'Título',
  mensagem: 'Mensagem',
  tipo: 'info',
  lida: false,
  created_at: '2026-09-01T00:00:00.000Z',
};

/**
 * O caminho offline lê o IndexedDB inteiro e filtra em memória — é ali que mora a regra
 * de visibilidade do cliente, que precisa espelhar a policy do servidor.
 */
describe('getNotificacoes (offline, fallback IDB)', () => {
  beforeEach(() => vi.clearAllMocks());

  const carregar = (notifs: Notificacao[]) => {
    mockGetAllFromIDB.mockResolvedValue(notifs);
    return getNotificacoes(false, EU, MINHA);
  };

  it('mostra a notificação endereçada a mim', async () => {
    const out = await carregar([{ ...base, id: 'n1', usuario_id: EU }]);
    expect(out.map(n => n.id)).toEqual(['n1']);
  });

  it('mostra a notificação com escopo "all" da minha empresa', async () => {
    const out = await carregar([{ ...base, id: 'n1', usuario_id: 'all', tenant_id: MINHA }]);
    expect(out.map(n => n.id)).toEqual(['n1']);
  });

  it('NÃO mostra a notificação com escopo "all" de outra empresa', async () => {
    // Este é o vazamento: antes, `usuario_id === 'all'` passava sem nenhuma checagem de
    // empresa, então a caixa de entrada de uma empresa aparecia na de outra.
    const out = await carregar([{ ...base, id: 'n1', usuario_id: 'all', tenant_id: OUTRA }]);
    expect(out).toEqual([]);
  });

  it('NÃO mostra notificação sem tenant, mesmo com escopo "all"', async () => {
    const out = await carregar([{ ...base, id: 'n1', usuario_id: 'all', tenant_id: undefined }]);
    expect(out).toEqual([]);
  });

  it('NÃO mostra a notificação de outro usuário, mesmo da minha empresa', async () => {
    const out = await carregar([{ ...base, id: 'n1', usuario_id: OUTRO, tenant_id: MINHA }]);
    expect(out).toEqual([]);
  });

  it('mostra a endereçada a mim mesmo que o tenant dela seja outro', async () => {
    // Uma notificação com o meu id é minha onde quer que eu esteja — é o mesmo critério
    // que a policy do servidor aplica (`usuario_id = auth.uid()`).
    const out = await carregar([{ ...base, id: 'n1', usuario_id: EU, tenant_id: OUTRA }]);
    expect(out.map(n => n.id)).toEqual(['n1']);
  });

  it('exclui notificação com deleted_at, mesmo sendo minha', async () => {
    const out = await carregar([{ ...base, id: 'n1', usuario_id: EU, deleted_at: '2026-09-02T00:00:00.000Z' }]);
    expect(out).toEqual([]);
  });

  it('ordena da mais recente para a mais antiga', async () => {
    const out = await carregar([
      { ...base, id: 'antiga', created_at: '2026-09-01T00:00:00.000Z' },
      { ...base, id: 'nova', created_at: '2026-09-05T00:00:00.000Z' },
      { ...base, id: 'meio', created_at: '2026-09-03T00:00:00.000Z' },
    ]);
    expect(out.map(n => n.id)).toEqual(['nova', 'meio', 'antiga']);
  });

  it('sem empresa definida, mostra só o que está endereçado a mim', async () => {
    mockGetAllFromIDB.mockResolvedValue([
      { ...base, id: 'minha', usuario_id: EU, tenant_id: MINHA },
      { ...base, id: 'de-outra', usuario_id: 'all', tenant_id: OUTRA },
    ]);
    const out = await getNotificacoes(false, EU, null);
    expect(out.map(n => n.id)).toEqual(['minha']);
  });
});


/**
 * É esta função que decide se o usuário ganha as notificações de boas-vindas. Ela conta o
 * histórico — inclusive as excluídas —, e não a caixa de entrada: apagar tudo não pode
 * fazer o usuário parecer novo de novo.
 */
describe('usuarioJaTeveNotificacao', () => {
  beforeEach(() => vi.clearAllMocks());

  it('diz que não, para quem nunca teve nenhuma', async () => {
    mockContagem({ count: 0 });
    expect(await usuarioJaTeveNotificacao(true, EU)).toBe(false);
  });

  it('diz que sim quando existe histórico, mesmo que tudo esteja excluído', async () => {
    // A consulta não filtra `deleted_at`, então as excluídas entram na contagem — é o que
    // impede o seeding de rodar de novo depois que o usuário apaga tudo.
    mockContagem({ count: 24 });
    expect(await usuarioJaTeveNotificacao(true, EU)).toBe(true);
  });

  it('conta pelo destinatário, não pela empresa', async () => {
    const eq = mockContagem({ count: 2 });
    await usuarioJaTeveNotificacao(true, EU);
    expect(eq).toHaveBeenCalledWith('usuario_id', EU);
  });

  it('não pergunta ao servidor quando offline, e responde "sim"', async () => {
    // Offline não dá para distinguir "não tem" de "ainda não sincronizou"; não semear é o
    // lado seguro, e semear no escuro é o que produzia duplicata.
    expect(await usuarioJaTeveNotificacao(false, EU)).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('responde "sim" quando a consulta falha, adiando o seeding em vez de arriscar', async () => {
    mockContagem({ error: new Error('rede caiu') });
    expect(await usuarioJaTeveNotificacao(true, EU)).toBe(true);
  });

  it('trata count nulo como ausência de histórico', async () => {
    mockContagem({ count: null });
    expect(await usuarioJaTeveNotificacao(true, EU)).toBe(false);
  });
});
