import React, { useState, useEffect } from "react";
import { generateUUID } from '../../../utils/uuid';
import { useAppContext } from "../../../context/AppContext";
import { getContasBancarias, salvarContaBancaria, deletarContaBancaria } from "../../../services/contasBancariasService";
import { ContaBancaria } from "../../../types/contasBancarias";
import { useToast } from "../../../context/ToastContext";
import { useConfirm } from "../../../context/ConfirmContext";
import {
  saveEmpresa,
  uploadArquivo,
  Empresa,
} from "../../../services/empresasService";
import {
  canCreateEmpresa,
  canEditEmpresa,
  canDelete
} from "../../../utils/permissions";
import { AlertaAlteracoesPendentes } from "../../common/AlertaAlteracoesPendentes";
import {
  Plus,
  Edit2,
  Trash2,
  Upload,
  X,
  Save,
  Loader2,
  Wallet
} from "lucide-react";
import { formatAgenciaOuConta } from '../../../utils/configuracoesHelpers';

interface EmpresaFormModalProps {
  empresaInicial: Partial<Empresa>;
  onClose: () => void;
  onSave: () => void;
  empresasExistentes: Empresa[];
}

export const EmpresaFormModal: React.FC<EmpresaFormModalProps> = ({ empresaInicial, onClose, onSave, empresasExistentes }) => {
  const { state } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [editingEmpresa, setEditingEmpresa] = useState<Partial<Empresa>>(empresaInicial);
  const [initialEmpresaJson, setInitialEmpresaJson] = useState<string>(JSON.stringify(empresaInicial));
  
  const [modalActiveTab, setModalActiveTab] = useState<'dados' | 'contas'>('dados');
  const [uploading, setUploading] = useState(false);
  
  const [empresaContas, setEmpresaContas] = useState<ContaBancaria[]>([]);
  const [editingConta, setEditingConta] = useState<Partial<ContaBancaria> | null>(null);

  useEffect(() => {
    if (empresaInicial.id && empresasExistentes.some(e => e.id === empresaInicial.id)) {
      getContasBancarias(empresaInicial.id, state.isOnline).then(setEmpresaContas);
    }
  }, [empresaInicial.id, state.isOnline, empresasExistentes]);

  const isEmpresaDirty = React.useMemo(() => {
    return JSON.stringify(editingEmpresa) !== initialEmpresaJson;
  }, [editingEmpresa, initialEmpresaJson]);

  const formatAgencia = formatAgenciaOuConta;
  const formatConta = formatAgenciaOuConta;

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo_url" | "assinatura_url",
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (state.isOnline) {
        try {
          setUploading(true);
          const ext = file.name.split(".").pop();
          const fileName = `${editingEmpresa.id}_${field}_${Date.now()}.${ext}`;
          const publicUrl = await uploadArquivo(file, fileName);
          setEditingEmpresa((prev) => ({ ...prev, [field]: publicUrl }));
        } catch (error) {
          console.error("Erro no upload", error);
        } finally {
          setUploading(false);
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setEditingEmpresa((prev) => ({ ...prev, [field]: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.isOnline) {
      toast.error("Operação bloqueada no Modo de Visualização (Offline).");
      return;
    }
    if (!editingEmpresa || !editingEmpresa.id) return;

    const isNew = !empresasExistentes.some(emp => emp.id === editingEmpresa.id);
    if (isNew && !canCreateEmpresa(state.user, state.isOnline)) {
      toast.error("Somente o Super Admin pode incluir novas empresas no sistema.");
      return;
    }
    if (!isNew && !canEditEmpresa(state.user, editingEmpresa.id, state.isOnline)) {
      toast.error("Você só tem permissão para editar os dados da sua respectiva empresa.");
      return;
    }

    try {
      const novaEmpresa = editingEmpresa as Empresa;
      await saveEmpresa(novaEmpresa, state.isOnline);
      toast.success("Empresa salva com sucesso!");
      onSave();
    } catch (error: any) {
      console.error("Erro ao salvar", error);
      toast.error(error?.message || "Erro ao salvar empresa no Supabase.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0C16]/80 backdrop-blur-sm p-4">
      <div className="bg-[#181B34] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-[#262A45] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#262A45] flex items-center justify-between shrink-0">
          <h3 className="text-xl font-bold text-white tracking-tight">
            {editingEmpresa.razao_social ? "Editar Empresa" : "Nova Empresa"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* TABS */}
        <div className="px-6 border-b border-[#262A45] flex gap-4">
          <button
            type="button"
            onClick={() => setModalActiveTab('dados')}
            className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
              modalActiveTab === 'dados' 
                ? 'border-[#3B82F6] text-[#3B82F6]' 
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Dados Gerais
          </button>
          <button
            type="button"
            onClick={() => setModalActiveTab('contas')}
            className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
              modalActiveTab === 'contas' 
                ? 'border-[#3B82F6] text-[#3B82F6]' 
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Contas Bancárias
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-bg-base/50">
          {modalActiveTab === 'dados' ? (
          <form id="empresaForm" onSubmit={handleSave} className="space-y-6">
            {isEmpresaDirty && (
              <AlertaAlteracoesPendentes
                visivel={isEmpresaDirty}
                formId="empresaForm"
                posicao="compact"
                mensagem="Existem alterações pendentes nos dados desta empresa. Salve para registrar no banco de dados."
              />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">Razão Social *</label>
                  <input type="text" required value={editingEmpresa.razao_social || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, razao_social: e.target.value }) } className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">Nome Fantasia *</label>
                  <input type="text" required value={editingEmpresa.nome_fantasia || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, nome_fantasia: e.target.value }) } className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">CNPJ *</label>
                  <input type="text" required value={editingEmpresa.cnpj || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, cnpj: e.target.value }) } className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-400 mb-1">E-mail</label>
                    <input type="email" value={editingEmpresa.email || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, email: e.target.value }) } className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-400 mb-1">Telefone</label>
                    <input type="text" value={editingEmpresa.telefone || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, telefone: e.target.value }) } className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">Endereço Completo</label>
                  <input type="text" value={editingEmpresa.endereco || ""} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, endereco: e.target.value }) } className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-1">Status</label>
                  <select value={editingEmpresa.status || "ativo"} onChange={(e) => setEditingEmpresa({ ...editingEmpresa, status: e.target.value as any }) } className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all">
                    <option className="bg-[#101223]" value="ativo">Ativo</option>
                    <option className="bg-[#101223]" value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-2">Logotipo da Empresa</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#262A45] border-dashed rounded-xl hover:bg-[#101223] transition-colors">
                    <div className="space-y-2 text-center">
                      {uploading ? (
                        <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                      ) : editingEmpresa.logo_url ? (
                        <img src={editingEmpresa.logo_url} alt="Logotipo" className="mx-auto h-24 object-contain" />
                      ) : (
                        <Upload className="mx-auto h-12 w-12 text-slate-400" />
                      )}
                      <div className="flex text-sm text-slate-400 justify-center">
                        <label className="relative cursor-pointer bg-transparent rounded-md font-medium text-[#7E4CF3] hover:text-[#4A88E9]">
                          <span>Fazer upload do arquivo</span>
                          <input type="file" className="sr-only" accept="image/*" disabled={uploading} onChange={(e) => handleImageUpload(e, "logo_url") } />
                        </label>
                      </div>
                      <p className="text-xs text-slate-400">PNG, JPG, GIF até 5MB</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-2">Assinatura Digital</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#262A45] border-dashed rounded-xl hover:bg-[#101223] transition-colors">
                    <div className="space-y-2 text-center">
                      {uploading ? (
                        <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                      ) : editingEmpresa.assinatura_url ? (
                        <img src={editingEmpresa.assinatura_url} alt="Assinatura" className="mx-auto h-24 object-contain" />
                      ) : (
                        <Upload className="mx-auto h-12 w-12 text-slate-400" />
                      )}
                      <div className="flex text-sm text-slate-400 justify-center">
                        <label className="relative cursor-pointer bg-transparent rounded-md font-medium text-[#7E4CF3] hover:text-[#4A88E9]">
                          <span>Fazer upload do arquivo</span>
                          <input type="file" className="sr-only" accept="image/*" disabled={uploading} onChange={(e) => handleImageUpload(e, "assinatura_url") } />
                        </label>
                      </div>
                      <p className="text-xs text-slate-400">Fundo transparente recomendado (PNG)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
          ) : (
            <div className="space-y-6">
              {!editingConta ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-text-base">Contas Vinculadas</h4>
                    <button type="button" onClick={() => setEditingConta({ status: 'ativo', tenant_id: editingEmpresa.id })} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
                      <Plus className="w-4 h-4" /> Nova Conta
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {empresaContas.map(conta => (
                      <div key={conta.id} className="bg-bg-surface border border-border-default rounded-xl p-4 flex flex-col relative group">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-text-base">{conta.nome}</h5>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button type="button" onClick={() => setEditingConta(conta)} className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                            {canDelete(state.user) && (
                              <button type="button" onClick={() => {
                                confirm({
                                  title: "Excluir Conta Bancária",
                                  message: `Tem certeza que deseja excluir a conta "${conta.nome}"? Esta ação não pode ser desfeita.`,
                                  danger: true,
                                  confirmText: "Excluir",
                                  onConfirm: async () => {
                                    await deletarContaBancaria(state.isOnline, conta.id);
                                    setEmpresaContas(empresaContas.filter(c => c.id !== conta.id));
                                    toast.success('Conta excluída com sucesso!');
                                  }
                                });
                              }} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-text-subtle space-y-1">
                          <p>Banco: <span className="text-text-base">{conta.banco}</span></p>
                          <p>Ag: <span className="text-text-base">{conta.agencia}</span> | CC: <span className="text-text-base">{conta.conta}</span></p>
                          {conta.chave_pix && <p>PIX: <span className="text-text-base">{conta.chave_pix}</span></p>}
                          <p>Status: <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conta.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{conta.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></p>
                        </div>
                      </div>
                    ))}
                    
                    {empresaContas.length === 0 && (
                      <div className="col-span-full py-8 text-center text-text-subtle bg-bg-surface rounded-xl border border-border-default border-dashed">
                        Nenhuma conta bancária cadastrada para esta empresa.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-bg-surface border border-border-default rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-semibold text-text-base flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-[#3B82F6]" />
                      {editingConta.id ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
                    </h4>
                    <button type="button" onClick={() => setEditingConta(null)} className="text-text-subtle hover:text-text-base">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-text-subtle mb-1">Nome/Apelido *</label>
                      <input type="text" value={editingConta.nome || ''} onChange={e => setEditingConta({...editingConta, nome: e.target.value})} className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-text-base" placeholder="Ex: Itaú - Recebimentos" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-text-subtle mb-1">Banco *</label>
                      <input type="text" value={editingConta.banco || ''} onChange={e => setEditingConta({...editingConta, banco: e.target.value})} className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-text-base" placeholder="Ex: 341 - Itaú Unibanco S.A." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-subtle mb-1">Agência</label>
                      <input type="text" value={editingConta.agencia || ''} onChange={e => setEditingConta({...editingConta, agencia: formatAgencia(e.target.value)})} className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-text-base" placeholder="Ex: 0001" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-subtle mb-1">Conta</label>
                      <input type="text" value={editingConta.conta || ''} onChange={e => setEditingConta({...editingConta, conta: formatConta(e.target.value)})} className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-text-base" placeholder="Ex: 12345-6" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-text-subtle mb-1">Chave PIX (Para Recebimentos)</label>
                      <input type="text" value={editingConta.chave_pix || ''} onChange={e => setEditingConta({...editingConta, chave_pix: e.target.value})} className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-text-base" placeholder="CPF, CNPJ, E-mail, Celular ou Chave Aleatória" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-subtle mb-1">Status</label>
                      <select value={editingConta.status || 'ativo'} onChange={e => setEditingConta({...editingConta, status: e.target.value as 'ativo'|'inativo'})} className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-text-base">
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-subtle mb-1">Saldo Inicial (R$)</label>
                      <input type="number" step="0.01" value={editingConta.saldo_inicial || 0} onChange={e => setEditingConta({...editingConta, saldo_inicial: Number(e.target.value)})} className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-text-base" />
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                    <button type="button" onClick={() => setEditingConta(null)} className="px-5 py-2.5 text-text-muted hover:text-text-base hover:bg-bg-hover rounded-xl font-medium transition-colors">Cancelar</button>
                    <button type="button" onClick={async () => {
                      if (!editingConta.nome || !editingConta.banco) {
                        toast.error('Preencha os campos obrigatórios.');
                        return;
                      }
                      if (editingConta.agencia && !/^[0-9A-Z]+(?:-[0-9A-Z]+)?$/.test(editingConta.agencia)) {
                        toast.error('Formato de agência inválido.');
                        return;
                      }
                      if (editingConta.conta && !/^[0-9A-Z]+(?:-[0-9A-Z]+)?$/.test(editingConta.conta)) {
                        toast.error('Formato de conta inválido.');
                        return;
                      }
                      const isNew = !editingConta.id;
                      const isValidUUID = editingConta.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editingConta.id);
                      const contaToSave: ContaBancaria = {
                        ...editingConta as ContaBancaria,
                        id: isValidUUID ? (editingConta.id as string) : generateUUID(),
                        tenant_id: editingEmpresa.id!,
                        criado_em: editingConta.criado_em || new Date().toISOString()
                      };
                      await salvarContaBancaria(state.isOnline, contaToSave);
                      toast.success(isNew ? 'Conta criada!' : 'Conta atualizada!');
                      const novas = await getContasBancarias(editingEmpresa.id!, state.isOnline);
                      setEmpresaContas(novas);
                      setEditingConta(null);
                    }} className="px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-medium transition-colors">Salvar Conta</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#262A45] bg-[#101223]/50 flex items-center justify-end gap-3 shrink-0 rounded-b-3xl">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-[#222542] border border-[#2A2D48] text-slate-300 rounded-xl font-medium hover:bg-[#2A2D48] hover:text-white transition-colors">
            Cancelar
          </button>
          <button type="submit" form="empresaForm" disabled={!state.isOnline} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#7E4CF3] to-[#4A88E9] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#7E4CF3]/25 disabled:opacity-50">
            <Save className="w-4 h-4" />
            Salvar Empresa
          </button>
        </div>
      </div>
    </div>
  );
};
