import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/idb', () => ({
  getFromIDB: vi.fn(),
  saveToIDB: vi.fn(),
  getAllFromIDB: vi.fn(),
  deleteFromIDB: vi.fn(),
}));

const signInWithPassword = vi.fn();
const signOutIsolado = vi.fn();
const updateUser = vi.fn();
const registrarAuditoriaMock = vi.fn();
const rpc = vi.fn();
const upsert = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { updateUser: (...args: unknown[]) => updateUser(...args) },
    from: () => ({ upsert: (...args: unknown[]) => upsert(...args) }),
    rpc: (...args: unknown[]) => rpc(...args),
  },
  isolatedSupabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      signOut: (...args: unknown[]) => signOutIsolado(...args),
    },
  },
  registrarAuditoria: (...args: unknown[]) => registrarAuditoriaMock(...args),
}));

import {
  alterarPropriaSenha,
  saveUsuario,
  MENSAGEM_SENHA_SEM_CONEXAO,
  MENSAGEM_SENHA_ATUAL_INCORRETA,
  MENSAGEM_SENHA_SEM_EMAIL,
  MENSAGEM_SENHA_MUITAS_TENTATIVAS,
  MENSAGEM_SENHA_SEM_PERMISSAO,
  UsuarioCadastro,
} from './usuariosService';
import { getFromIDB } from '../lib/idb';
import {
  MENSAGEM_CONFIRMACAO_DIFERENTE,
  MENSAGEM_SENHA_IGUAL_A_ATUAL,
} from '../utils/senhaUsuario';

const troca = {
  email: 'operador@empresa.com',
  senhaAtual: 'atual123',
  novaSenha: 'NovaSenha!2026',
  confirmacao: 'NovaSenha!2026',
};

describe('alterarPropriaSenha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPassword.mockResolvedValue({ data: {}, error: null });
    signOutIsolado.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ data: {}, error: null });
    registrarAuditoriaMock.mockResolvedValue(undefined);
  });

  it('troca a senha e registra auditoria quando tudo confere', async () => {
    await expect(alterarPropriaSenha(troca, true)).resolves.toBeUndefined();

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'operador@empresa.com',
      password: 'atual123',
    });
    expect(updateUser).toHaveBeenCalledWith({ password: 'NovaSenha!2026' });
    expect(registrarAuditoriaMock).toHaveBeenCalledWith(
      'Alterar Própria Senha',
      expect.objectContaining({ email: 'operador@empresa.com' })
    );
  });

  it('encerra a conferência com scope local — o padrão global derrubaria a sessão em uso', async () => {
    await alterarPropriaSenha(troca, true);
    expect(signOutIsolado).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('manda a senha exatamente como digitada, sem aparar espaços', async () => {
    await alterarPropriaSenha(
      {
        email: 'operador@empresa.com',
        senhaAtual: ' atual com espaco ',
        novaSenha: ' nova com espaco ',
        confirmacao: ' nova com espaco ',
      },
      true
    );
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'operador@empresa.com',
      password: ' atual com espaco ',
    });
    expect(updateUser).toHaveBeenCalledWith({ password: ' nova com espaco ' });
  });

  it('recusa offline sem gastar nenhuma chamada de rede', async () => {
    await expect(alterarPropriaSenha(troca, false)).rejects.toThrow(
      MENSAGEM_SENHA_SEM_CONEXAO
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('valida antes de tocar no servidor', async () => {
    await expect(
      alterarPropriaSenha({ ...troca, confirmacao: 'outra coisa' }, true)
    ).rejects.toThrow(MENSAGEM_CONFIRMACAO_DIFERENTE);
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('recusa quando o e-mail da conta não veio', async () => {
    await expect(alterarPropriaSenha({ ...troca, email: '' }, true)).rejects.toThrow(
      MENSAGEM_SENHA_SEM_EMAIL
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('senha atual errada não chega a trocar nada', async () => {
    signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });

    await expect(alterarPropriaSenha(troca, true)).rejects.toThrow(
      MENSAGEM_SENHA_ATUAL_INCORRETA
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(registrarAuditoriaMock).not.toHaveBeenCalled();
  });

  it('traduz o limite de tentativas na conferência', async () => {
    signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Too many requests' },
    });
    await expect(alterarPropriaSenha(troca, true)).rejects.toThrow(
      MENSAGEM_SENHA_MUITAS_TENTATIVAS
    );
  });

  it('propaga a recusa do servidor na troca, sem auditar sucesso', async () => {
    updateUser.mockResolvedValue({
      data: {},
      error: { message: 'New password should be different from the old password.' },
    });

    await expect(alterarPropriaSenha(troca, true)).rejects.toThrow(
      MENSAGEM_SENHA_IGUAL_A_ATUAL
    );
    expect(registrarAuditoriaMock).not.toHaveBeenCalled();
  });

  it('a senha nunca entra no log de auditoria', async () => {
    await alterarPropriaSenha(troca, true);
    const detalhes = JSON.stringify(registrarAuditoriaMock.mock.calls[0][1]);
    expect(detalhes).not.toContain('NovaSenha!2026');
    expect(detalhes).not.toContain('atual123');
  });

  it('falha ao encerrar a conferência não impede a troca', async () => {
    signOutIsolado.mockRejectedValue(new Error('rede caiu'));
    await expect(alterarPropriaSenha(troca, true)).resolves.toBeUndefined();
    expect(updateUser).toHaveBeenCalled();
  });
});


const alvo: UsuarioCadastro = {
  id: 'func-1',
  tenant_id: 'emp-1',
  nome: 'GIZELLE LEMES',
  email: 'func@empresa.com',
  nivel: 'funcionario',
  modulos_permitidos: ['dashboard'],
  status: 'ativo',
};

describe('saveUsuario: quem pode redefinir a senha de outro usuário', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // o usuário já existe no cache => o save é edição, não criação
    vi.mocked(getFromIDB).mockResolvedValue(alvo as never);
    rpc.mockResolvedValue({ error: null });
    upsert.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ data: {}, error: null });
    registrarAuditoriaMock.mockResolvedValue(undefined);
  });

  it('super_admin redefine pela RPC', async () => {
    await saveUsuario(alvo, true, 'NovaSenha!2026', {
      id: 'super',
      nivel: 'super_admin',
    });

    expect(rpc).toHaveBeenCalledWith('admin_alterar_senha_usuario', {
      target_user_id: 'func-1',
      new_password: 'NovaSenha!2026',
    });
  });

  it('admin é RECUSADO antes de chegar ao servidor — e a senha não some em silêncio', async () => {
    await expect(
      saveUsuario(alvo, true, 'NovaSenha!2026', { id: 'admin-1', nivel: 'admin' })
    ).rejects.toThrow(MENSAGEM_SENHA_SEM_PERMISSAO);

    expect(rpc).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    // e o cadastro tampouco é gravado como se tivesse dado certo
    expect(upsert).not.toHaveBeenCalled();
  });

  it('o próprio usuário troca a dele por updateUser, sem RPC', async () => {
    await saveUsuario(alvo, true, 'NovaSenha!2026', {
      id: 'func-1',
      nivel: 'funcionario',
    });

    expect(updateUser).toHaveBeenCalledWith({ password: 'NovaSenha!2026' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a recusa da RPC chega inteira, sem retry com outro payload', async () => {
    rpc.mockResolvedValue({ error: { message: 'Permissão negada.' } });

    await expect(
      saveUsuario(alvo, true, 'NovaSenha!2026', { id: 'super', nivel: 'super_admin' })
    ).rejects.toThrow('Permissão negada.');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('salvar sem senha não aciona guarda nenhuma', async () => {
    await saveUsuario(alvo, true, '', { id: 'admin-1', nivel: 'admin' });

    expect(rpc).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalled();
  });
});
