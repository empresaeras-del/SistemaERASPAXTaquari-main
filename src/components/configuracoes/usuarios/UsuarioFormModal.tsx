import React, { useState, useMemo } from 'react';
import { UsuarioCadastro as Usuario, saveUsuario } from '../../../services/usuariosService';
import { Empresa } from '../../../services/empresasService';
import { useAppContext } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { AlertaAlteracoesPendentes } from '../../common/AlertaAlteracoesPendentes';
import { Users, X, Save, Eye, EyeOff } from 'lucide-react';
import { canChangeUserPassword, canManageUserModules, getAvailableNiveisForUser } from '../../../utils/permissions';
import { ModuloPermissionSelector } from '../../usuarios/ModuloPermissionSelector';


interface UsuarioFormModalProps {
  usuarioInicial: Partial<Usuario>;
  empresas: Empresa[];
  usuariosExistentes: Usuario[];
  onClose: () => void;
  onSave: () => void;
}

export const UsuarioFormModal: React.FC<UsuarioFormModalProps> = ({
  usuarioInicial,
  empresas,
  usuariosExistentes,
  onClose,
  onSave
}) => {
  const { state } = useAppContext();
  const toast = useToast();

  const [editingUsuario, setEditingUsuario] = useState<Partial<Usuario>>(usuarioInicial);
  const [initialUsuarioJson] = useState<string>(JSON.stringify(usuarioInicial));
  const [senhaUsuario, setSenhaUsuario] = useState("");
  const [showSenhaUsuario, setShowSenhaUsuario] = useState(false);

  const isUsuarioDirty = useMemo(() => {
    return JSON.stringify(editingUsuario) !== initialUsuarioJson || senhaUsuario.length > 0;
  }, [editingUsuario, initialUsuarioJson, senhaUsuario]);

  const handleSaveUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.isOnline) {
      toast.error("Operação bloqueada no Modo de Visualização (Offline).");
      return;
    }
    if (!editingUsuario) return;
    
    const isNew = !usuariosExistentes.some(u => u.id === editingUsuario.id);

    // Validação de senha
    if (isNew && senhaUsuario.length < 6) {
      toast.error("A senha inicial deve ter pelo menos 6 caracteres.");
      return;
    }
    if (!isNew && senhaUsuario && senhaUsuario.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      // Se não for super admin, só pode editar usuários da própria empresa
      if (state.user?.nivel !== 'super_admin' && state.user?.tenant_id && editingUsuario.tenant_id !== state.user.tenant_id) {
          toast.error("Você só pode criar/editar usuários da sua empresa.");
          return;
      }
      
      const novoUsuario = editingUsuario as Usuario;
      await saveUsuario(novoUsuario, state.isOnline, senhaUsuario);
      
      toast.success("Usuário salvo com sucesso!");
      onSave();
    } catch (error: any) {
      console.error("Erro ao salvar", error);
      toast.error(error?.message || "Erro ao salvar usuário no Supabase.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0C16]/80 backdrop-blur-sm p-4">
      <div className="bg-[#181B34] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#262A45] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#262A45] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#7E4CF3]/20 border border-[#7E4CF3]/30 text-[#7E4CF3]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {editingUsuario.nome ? "Editar Usuário" : "Novo Usuário"}
              </h3>
              <p className="text-xs text-slate-400">
                Gerencie os dados cadastrais, credenciais e permissões de módulos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form
            id="usuarioForm"
            onSubmit={handleSaveUsuario}
            className="space-y-4"
          >
            {isUsuarioDirty && (
              <AlertaAlteracoesPendentes
                visivel={isUsuarioDirty}
                formId="usuarioForm"
                posicao="compact"
                mensagem="Existem alterações pendentes no cadastro deste usuário. Salve para registrar no banco de dados."
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editingUsuario.nome || ""}
                  onChange={(e) =>
                    setEditingUsuario({
                      ...editingUsuario,
                      nome: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white uppercase focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  required
                  value={editingUsuario.email || ""}
                  onChange={(e) =>
                    setEditingUsuario({
                      ...editingUsuario,
                      email: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                />
              </div>
            </div>

            {/* CAMPO DE SENHA (NOVO CADASTRO OU EDIÇÃO COM PERMISSÃO) */}
            {!usuariosExistentes.some(u => u.id === editingUsuario.id) ? (
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">
                  Senha Inicial de Acesso (Supabase Auth) *
                </label>
                <div className="relative">
                  <input
                    type={showSenhaUsuario ? "text" : "password"}
                    id="novo-usuario-senha"
                    name="senha"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    data-no-uppercase="true"
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={senhaUsuario}
                    onChange={(e) => setSenhaUsuario(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenhaUsuario(!showSenhaUsuario)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showSenhaUsuario ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Esta senha será usada pelo colaborador para entrar no sistema.
                </span>
              </div>
            ) : canChangeUserPassword(state.user, editingUsuario as Usuario) ? (
              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">
                  Alterar Senha de Acesso (Supabase Auth)
                </label>
                <div className="relative">
                  <input
                    type={showSenhaUsuario ? "text" : "password"}
                    id="alterar-usuario-senha"
                    name="senha"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    data-no-uppercase="true"
                    placeholder="Deixe em branco para manter a atual (mínimo 6 caracteres)"
                    value={senhaUsuario}
                    onChange={(e) => setSenhaUsuario(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenhaUsuario(!showSenhaUsuario)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showSenhaUsuario ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  {state.user?.nivel === 'super_admin' && state.user?.id !== editingUsuario.id
                    ? "Como Super Admin, você pode redefinir a senha deste usuário (mínimo 6 caracteres)."
                    : "Preencha para redefinir sua senha de acesso ao sistema (mínimo 6 caracteres)."}
                </span>
              </div>
            ) : null}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(state.user?.nivel === 'super_admin' || state.user?.nivel === 'admin') && (
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">
                    Empresa Vinculada *
                  </label>
                  <select
                    required
                    value={editingUsuario.tenant_id || ''}
                    onChange={(e) =>
                      setEditingUsuario({
                        ...editingUsuario,
                        tenant_id: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                  >
                    <option className="bg-[#101223]" value="" disabled>
                      Selecione a Empresa...
                    </option>
                    {state.user?.nivel === 'super_admin' && (
                      <option className="bg-[#101223]" value="all">Todas as Empresas (Acesso Global)</option>
                    )}
                    {empresas.map((e) => (
                      <option className="bg-[#101223]" key={e.id} value={e.id}>
                        {e.nome_fantasia || e.razao_social}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">
                  Nível de Acesso *
                </label>
                <select
                  required
                  value={editingUsuario.nivel || "funcionario"}
                  onChange={(e) =>
                    setEditingUsuario({
                      ...editingUsuario,
                      nivel: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                >
                  {getAvailableNiveisForUser(state.user).map(opt => (
                    <option key={opt.value} className="bg-[#101223]" value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={editingUsuario.status || "ativo"}
                  onChange={(e) =>
                    setEditingUsuario({
                      ...editingUsuario,
                      status: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                >
                  <option className="bg-[#101223]" value="ativo">Ativo</option>
                  <option className="bg-[#101223]" value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            {/* SELEÇÃO DE MÓDULOS, SUB-MÓDULOS E FORMULÁRIOS */}
            {canManageUserModules(state.user) && (
              <ModuloPermissionSelector
                selectedModulos={editingUsuario.modulos_permitidos || []}
                onChange={(mods) =>
                  setEditingUsuario({
                    ...editingUsuario,
                    modulos_permitidos: mods,
                  })
                }
                userNivel={editingUsuario.nivel || "funcionario"}
                currentUser={state.user}
                disabled={!state.isOnline}
              />
            )}
          </form>
        </div>

        <div className="px-6 py-4 border-t border-[#262A45] bg-[#101223]/50 flex items-center justify-end gap-3 shrink-0 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#222542] border border-[#2A2D48] text-slate-300 rounded-xl font-medium hover:bg-[#2A2D48] hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="usuarioForm"
            disabled={!state.isOnline}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#7E4CF3] to-[#4A88E9] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#7E4CF3]/25 disabled:opacity-50 text-sm"
          >
            <Save className="w-4 h-4" />
            Salvar Usuário
          </button>
        </div>
      </div>
    </div>
  );
};
