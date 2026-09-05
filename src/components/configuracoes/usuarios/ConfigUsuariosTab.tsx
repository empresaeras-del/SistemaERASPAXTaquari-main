import React, { useState, useMemo } from 'react';
import { UsuarioCadastro as Usuario, deleteUsuario } from '../../../services/usuariosService';
import { Empresa } from '../../../services/empresasService';
import { useAppContext } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { Users, Layers, Search, Shield, Edit2, Trash2, Plus } from 'lucide-react';
import { canEditUser, canDeleteUser, MODULOS_SISTEMA } from '../../../utils/permissions';
import { UsuarioFormModal } from './UsuarioFormModal';
import { OrganogramaCanvas } from '../OrganogramaCanvas';

interface ConfigUsuariosTabProps {
  usuarios: Usuario[];
  empresas: Empresa[];
  loading: boolean;
  onRefresh: () => void;
}

export const ConfigUsuariosTab: React.FC<ConfigUsuariosTabProps> = ({ usuarios, empresas, loading, onRefresh }) => {
  const { state } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();
  
  const [usuarioSubTab, setUsuarioSubTab] = useState<'lista' | 'organograma'>('lista');
  const [usuarioSearchTerm, setUsuarioSearchTerm] = useState("");
  const [usuarioTenantFilter, setUsuarioTenantFilter] = useState("all");
  const [usuarioStatusFilter, setUsuarioStatusFilter] = useState<'todos' | 'ativo' | 'inativo'>("todos");
  const [previewUsuario, setPreviewUsuario] = useState<Usuario | null>(null);
  
  const [isUsuarioModalOpen, setIsUsuarioModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Partial<Usuario> | null>(null);

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(u => {
      const matchName = u.nome?.toLowerCase().includes(usuarioSearchTerm.toLowerCase());
      const matchEmail = u.email?.toLowerCase().includes(usuarioSearchTerm.toLowerCase());
      const matchTenant = usuarioTenantFilter === 'all' || u.tenant_id === usuarioTenantFilter;
      const matchStatus = usuarioStatusFilter === 'todos' || u.status === usuarioStatusFilter;
      return (matchName || matchEmail) && matchTenant && matchStatus;
    });
  }, [usuarios, usuarioSearchTerm, usuarioTenantFilter, usuarioStatusFilter]);

  const handleOpenUsuarioModal = (usuario: Partial<Usuario> = {}) => {
    setEditingUsuario(usuario);
    setIsUsuarioModalOpen(true);
  };

  const handleDeleteUsuario = async (id: string) => {
    if (!state.isOnline) {
      toast.error('Não é possível excluir no modo offline.');
      return;
    }
    
    confirm({
      title: 'Excluir Usuário',
      message: 'Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.',
      danger: true,
      confirmText: 'Excluir Usuário',
      onConfirm: async () => {
        try {
          await deleteUsuario(id, state.isOnline);
          toast.success('Usuário excluído com sucesso.');
          onRefresh();
        } catch (error: any) {
          console.error(error);
          toast.error(error.message || 'Erro ao excluir usuário.');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#101223] p-4 rounded-xl border border-[#262A45]">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#3B82F6]" />
            Usuários Cadastrados
          </h3>
          <p className="text-sm text-slate-400">Gerencie os acessos ao sistema</p>
        </div>
        <button
          onClick={() => handleOpenUsuarioModal({ status: 'ativo' })}
          className="px-4 py-2 bg-gradient-to-r from-[#7E4CF3] to-[#4A88E9] text-white rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-[#7E4CF3]/25"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Novo Usuário</span>
        </button>
      </div>

      <div className={`bg-[#181B34] border border-[#262A45] rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col ${previewUsuario ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-[#262A45] bg-[#101223]/50 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-white">Usuários do Sistema</h3>
            </div>
            <div className="flex items-center gap-1 bg-[#0D0F20] p-1 rounded-xl border border-[#262A45]">
              <button
                onClick={() => setUsuarioSubTab('lista')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  usuarioSubTab === 'lista'
                    ? 'bg-[#7E4CF3] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Lista
              </button>
              <button
                onClick={() => setUsuarioSubTab('organograma')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  usuarioSubTab === 'organograma'
                    ? 'bg-[#7E4CF3] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Organograma
              </button>
            </div>
          </div>

          {usuarioSubTab === 'lista' && (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar usuário..."
                  value={usuarioSearchTerm}
                  onChange={(e) => setUsuarioSearchTerm(e.target.value)}
                  className="w-full bg-[#101223] border border-[#262A45] rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#7E4CF3]"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {state.user?.nivel === 'super_admin' && (
                  <select
                    value={usuarioTenantFilter}
                    onChange={(e) => setUsuarioTenantFilter(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 text-sm bg-[#101223] border border-[#262A45] rounded-lg text-white focus:outline-none focus:border-[#7E4CF3]"
                  >
                    <option className="bg-[#101223]" value="all">Todas as Empresas</option>
                    {empresas.map((empresa) => (
                      <option className="bg-[#101223]" key={empresa.id} value={empresa.id!}>
                        {empresa.nome_fantasia}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={usuarioStatusFilter}
                  onChange={(e) => setUsuarioStatusFilter(e.target.value as any)}
                  className="w-full sm:w-auto px-3 py-2 text-sm bg-[#101223] border border-[#262A45] rounded-lg text-white focus:outline-none focus:border-[#7E4CF3]"
                >
                  <option className="bg-[#101223]" value="todos">Todos os Status</option>
                  <option className="bg-[#101223]" value="ativo">Ativo</option>
                  <option className="bg-[#101223]" value="inativo">Inativo</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {usuarioSubTab === 'organograma' && (
          <div className="p-6 flex-1 overflow-auto">
            <OrganogramaCanvas
              usuarios={usuarios}
              tenantId={state.user?.nivel === 'super_admin' ? (usuarioTenantFilter === 'all' ? null : usuarioTenantFilter) : (state.empresaSelecionada || state.user?.tenant_id || null)}
              isSuperAdmin={state.user?.nivel === 'super_admin'}
            />
          </div>
        )}

        {usuarioSubTab === 'lista' && (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#101223]/30 border-b border-[#262A45]">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">E-mail</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nível</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Módulos</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A45]">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                      Carregando usuários...
                    </td>
                  </tr>
                ) : filteredUsuarios.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsuarios.map((usuario) => (
                    <tr
                      key={usuario.id}
                      className="hover:bg-[#101223]/30 transition-colors cursor-pointer" 
                      onClick={() => canEditUser(state.user, usuario) && handleOpenUsuarioModal(usuario)}
                    >
                      <td className="px-6 py-4 font-medium text-white">{usuario.nome}</td>
                      <td className="px-6 py-4">{usuario.email}</td>
                      <td className="px-6 py-4 text-slate-400 truncate max-w-[150px]">
                        {empresas.find((e) => e?.id === usuario?.tenant_id || e?.nome_fantasia?.toLowerCase() === usuario?.tenant_id?.toLowerCase() || e?.razao_social?.toLowerCase() === usuario?.tenant_id?.toLowerCase())
                          ?.nome_fantasia || usuario?.tenant_id || "Desconhecida"}
                      </td>
                      <td className="px-6 py-4 capitalize">{usuario.nivel.replace('_', ' ')}</td>
                      <td className="px-6 py-4">
                        {usuario.nivel === 'super_admin' || usuario.modulos_permitidos?.includes('*') || (usuario.modulos_permitidos && usuario.modulos_permitidos.length >= MODULOS_SISTEMA.length) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                            <Shield className="w-3 h-3" />
                            Todos (Global)
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30"
                            title={(usuario.modulos_permitidos || []).map((id: string) => MODULOS_SISTEMA.find(m => m.id === id)?.label || id).join(', ')}
                          >
                            <Layers className="w-3 h-3" />
                            {(usuario.modulos_permitidos || []).length} de {MODULOS_SISTEMA.length} módulos
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            usuario.status === "ativo"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          }`}
                        >
                          {usuario.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEditUser(state.user, usuario) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenUsuarioModal(usuario); }}
                              className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                              title="Editar Usuário"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDeleteUser(state.user, usuario) && (
                            <button
                              disabled={!state.isOnline}
                              onClick={(e) => { e.stopPropagation(); handleDeleteUsuario(usuario.id!); }}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Excluir Usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isUsuarioModalOpen && editingUsuario && (
        <UsuarioFormModal
          usuarioInicial={editingUsuario}
          empresas={empresas}
          usuariosExistentes={usuarios}
          onClose={() => setIsUsuarioModalOpen(false)}
          onSave={() => {
            setIsUsuarioModalOpen(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
