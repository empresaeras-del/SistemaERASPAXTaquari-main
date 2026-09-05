import React, { useState } from 'react';
import { Empresa, deleteEmpresa } from '../../../services/empresasService';
import { canEditEmpresa, canDelete } from '../../../utils/permissions';
import { useAppContext } from '../../../context/AppContext';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import { Building, Building2, Plus, Edit2, Trash2 } from 'lucide-react';
import { EmpresaFormModal } from './EmpresaFormModal';

interface ConfigEmpresasTabProps {
  empresas: Empresa[];
  loading: boolean;
  onRefresh: () => void;
}

export const ConfigEmpresasTab: React.FC<ConfigEmpresasTabProps> = ({ empresas, loading, onRefresh }) => {
  const { state } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<Partial<Empresa>>({});

  const handleOpenModal = (empresa: Partial<Empresa> = {}) => {
    setEmpresaEditando(empresa);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, razao_social: string) => {
    if (!state.isOnline) {
      toast.error('Não é possível excluir no modo offline.');
      return;
    }
    
    confirm({
      title: 'Excluir Empresa',
      message: `Tem certeza que deseja excluir a empresa "${razao_social}"? Esta ação removerá a empresa e todos os seus dados associados, incluindo contas bancárias.`,
      danger: true,
      confirmText: 'Excluir Empresa',
      onConfirm: async () => {
        try {
          await deleteEmpresa(id, state.isOnline);
          toast.success('Empresa excluída com sucesso.');
          onRefresh();
        } catch (error: any) {
          console.error(error);
          toast.error(error.message || 'Erro ao excluir empresa.');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#101223] p-4 rounded-xl border border-[#262A45]">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#3B82F6]" />
            Empresas Cadastradas
          </h3>
          <p className="text-sm text-slate-400">Gerencie as empresas e filiais do sistema</p>
        </div>
        <button
          onClick={() => handleOpenModal({ status: 'ativo' })}
          className="px-4 py-2 bg-gradient-to-r from-[#7E4CF3] to-[#4A88E9] text-white rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-[#7E4CF3]/25"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nova Empresa</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center text-slate-400">
            Carregando empresas...
          </div>
        ) : empresas.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 border border-dashed border-[#262A45] rounded-xl bg-[#101223]/50">
            Nenhuma empresa cadastrada.
          </div>
        ) : (
          empresas.map((empresa) => (
            <div key={empresa.id} className="bg-[#101223] rounded-2xl p-6 border border-[#262A45] hover:border-[#3B82F6]/50 transition-colors group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-gradient-to-l from-[#101223] to-transparent">
                {canEditEmpresa(state.user, empresa.id, state.isOnline) && (
                  <button onClick={() => handleOpenModal(empresa)} className="p-2 text-slate-400 hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-xl transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {canDelete(state.user) && (
                  <button onClick={() => handleDelete(empresa.id!, empresa.razao_social)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#181B34] border border-[#262A45] flex items-center justify-center shrink-0">
                  {empresa.logo_url ? (
                    <img src={empresa.logo_url} alt="Logo" className="w-10 h-10 object-contain rounded-lg" />
                  ) : (
                    <Building className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-white truncate max-w-[200px]" title={empresa.nome_fantasia}>
                    {empresa.nome_fantasia}
                  </h4>
                  <p className="text-sm text-slate-400 truncate max-w-[200px]" title={empresa.razao_social}>
                    {empresa.razao_social}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">CNPJ</span>
                  <span className="text-white font-medium">{empresa.cnpj || '---'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${empresa.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {empresa.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <EmpresaFormModal
          empresaInicial={empresaEditando}
          empresasExistentes={empresas}
          onClose={() => setIsModalOpen(false)}
          onSave={() => {
            setIsModalOpen(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
