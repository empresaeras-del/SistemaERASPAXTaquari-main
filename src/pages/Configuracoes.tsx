import React, { useState, useEffect, useRef } from "react";
import { generateUUID } from '../utils/uuid';
import { useAppContext } from "../context/AppContext";
import { getContasBancarias, salvarContaBancaria, deletarContaBancaria } from "../services/contasBancariasService";
import { ContaBancaria } from "../types/contasBancarias";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import {
  getEmpresas,
  saveEmpresa,
  deleteEmpresa,
  uploadArquivo,
  Empresa,
} from "../services/empresasService";
import {
  canCreateEmpresa,
  canEditEmpresa,
  canDeleteEmpresa,
  canEditUser,
  canDeleteUser,
  canDelete,
  getAvailableNiveisForUser,
  canChangeUserPassword,
  canManageUserModules,
  MODULOS_SISTEMA,
  getAllModuleAndSubmoduleIds
} from "../utils/permissions";
import { ModuloPermissionSelector } from "../components/usuarios/ModuloPermissionSelector";
import {
  getUsuarios,
  saveUsuario,
  deleteUsuario,
  UsuarioCadastro,
} from "../services/usuariosService";
import { AlertaAlteracoesPendentes } from "../components/common/AlertaAlteracoesPendentes";
import {
  Plus,
  Edit2,
  Trash2,
  Building,
  Upload,
  X,
  Save,
  Loader2,
  Users,
  Search,
  Wallet,
  Database,
  DownloadCloud,
  Eye,
  EyeOff,
  MessageCircle,
  Layers,
  Shield,
  Check,
  CheckSquare,
  Square } from "lucide-react";

import {
  filtrarUsuarios,
  formatAgenciaOuConta,
  normalizeModulos,
  normalizarModulosParaSalvar,
} from '../utils/configuracoesHelpers';
import { SistemaBackupPanel } from '../components/configuracoes/SistemaBackupPanel';
import { MensagensConfigTab } from '../components/configuracoes/MensagensConfigTab';
import { SessaoSegurancaCard } from '../components/configuracoes/SessaoSegurancaCard';
import { OrganogramaCanvas } from '../components/configuracoes/OrganogramaCanvas';
import { useAuth } from '../context/AuthContext';

export const ConfiguracoesPage: React.FC = () => {
  const { state } = useAppContext();
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<"empresas" | "usuarios" | "sistema" | "mensagens">(
    "empresas"
  );

  // Empresas State
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewEmpresa, setPreviewEmpresa] = useState<any>(null);
  const [previewUsuario, setPreviewUsuario] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Partial<Empresa> | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [modalActiveTab, setModalActiveTab] = useState<'dados' | 'contas'>('dados');
  const [empresaContas, setEmpresaContas] = useState<ContaBancaria[]>([]);
  const [editingConta, setEditingConta] = useState<Partial<ContaBancaria> | null>(null);


  // Usuários State
  const [usuarios, setUsuarios] = useState<UsuarioCadastro[]>([]);
  const [isUsuarioModalOpen, setIsUsuarioModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] =
    useState<Partial<UsuarioCadastro> | null>(null);
  const [usuarioSearchTerm, setUsuarioSearchTerm] = useState("");
  const [usuarioStatusFilter, setUsuarioStatusFilter] = useState<
    "todos" | "ativo" | "inativo"
  >("todos");
  const [usuarioTenantFilter, setUsuarioTenantFilter] = useState<string>("all");
  const [usuarioSubTab, setUsuarioSubTab] = useState<'lista' | 'organograma'>('lista');

  const [initialEmpresaJson, setInitialEmpresaJson] = useState<string>('');
  const [initialUsuarioJson, setInitialUsuarioJson] = useState<string>('');

  const isEmpresaDirty = React.useMemo(() => {
    if (!isModalOpen || !editingEmpresa || !initialEmpresaJson) return false;
    return JSON.stringify(editingEmpresa) !== initialEmpresaJson;
  }, [isModalOpen, editingEmpresa, initialEmpresaJson]);

  const isUsuarioDirty = React.useMemo(() => {
    if (!isUsuarioModalOpen || !editingUsuario || !initialUsuarioJson) return false;
    return JSON.stringify(editingUsuario) !== initialUsuarioJson;
  }, [isUsuarioModalOpen, editingUsuario, initialUsuarioJson]);

  const loadData = async () => {
    setLoading(true);
    try {
      const empresasData = await getEmpresas(state.isOnline);
      if (empresasData.length === 0) {
        const mockData: Empresa[] = [
          {
            id: "1",
            razao_social: "ERAS Assistência Funerária Ltda",
            nome_fantasia: "ERAS Principal",
            cnpj: "00.000.000/0001-00",
            email: "contato@eras.com",
            telefone: "(11) 99999-9999",
            endereco: "Rua Principal, 100, Centro",
            status: "ativo",
          },
        ];
        setEmpresas(mockData);
      } else {
        setEmpresas(empresasData);
      }

      const usuariosData = await getUsuarios(state.isOnline, "all");
      if (usuariosData.length === 0 && state.empresaSelecionada) {
        const mockUsuarios: UsuarioCadastro[] = [
          {
            id: "u1",
            tenant_id: state.empresaSelecionada,
            nome: "Admin ERAS",
            email: "admin@eras.com",
            nivel: "admin",
            modulos_permitidos: ["*"],
            status: "ativo",
          },
        ];
        setUsuarios(mockUsuarios);
      } else {
        setUsuarios(usuariosData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [state.isOnline, state.empresaSelecionada]);

  const filteredUsuarios = filtrarUsuarios(usuarios, {
    searchTerm: usuarioSearchTerm,
    statusFilter: usuarioStatusFilter,
    tenantFilter: usuarioTenantFilter,
  });

  const formatAgencia = formatAgenciaOuConta;
  const formatConta = formatAgenciaOuConta;

  const handleOpenModal = async (empresa?: Empresa) => {
    if (empresa) {
      if (!canEditEmpresa(state.user, empresa.id)) {
        toast.error("Você só tem permissão para editar os dados da sua respectiva empresa.");
        return;
      }
      setModalActiveTab('dados');
      const cloned = { ...empresa };
      setEditingEmpresa(cloned);
      setInitialEmpresaJson(JSON.stringify(cloned));
      const contas = await getContasBancarias(empresa.id, state.isOnline);
      setEmpresaContas(contas);
    } else {
      if (!canCreateEmpresa(state.user)) {
        toast.error("Somente o Super Admin pode incluir novas empresas no sistema.");
        return;
      }
      setModalActiveTab('dados');
      const novaEmp: Partial<Empresa> = {
        id: generateUUID(),
        status: "ativo",
      };
      setEditingEmpresa(novaEmp);
      setInitialEmpresaJson(JSON.stringify(novaEmp));
      setEmpresaContas([]);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmpresa(null);
    setInitialEmpresaJson('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.isOnline) {
      toast.error("Operação bloqueada no Modo de Visualização (Offline).");
      return;
    }
    if (!editingEmpresa || !editingEmpresa.id) return;

    const isNew = !empresas.some(emp => emp.id === editingEmpresa.id);
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
      await loadData();
      handleCloseModal();
      toast.success("Empresa salva com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar", error);
      toast.error(error?.message || "Erro ao salvar empresa no Supabase.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDeleteEmpresa(state.user, state.isOnline)) {
      toast.error(
        !state.isOnline
          ? "Exclusão bloqueada no Modo de Visualização (Offline)."
          : "Somente o Super Admin pode excluir empresas."
      );
      return;
    }

    confirm({
      title: "Excluir Empresa",
      message: "Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.",
      danger: true,
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await deleteEmpresa(id, state.isOnline);
          await loadData();
          toast.success("Empresa excluída com sucesso!");
        } catch (error: any) {
          console.error("Erro ao excluir", error);
          toast.error(error?.message || "Erro ao excluir empresa.");
        }
      }
    });
  };

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
          const fileName = `${editingEmpresa?.id}_${field}_${Date.now()}.${ext}`;
          const publicUrl = await uploadArquivo(file, fileName);
          setEditingEmpresa((prev) =>
            prev ? { ...prev, [field]: publicUrl } : null,
          );
        } catch (error) {
          console.error("Erro no upload", error);
        } finally {
          setUploading(false);
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setEditingEmpresa((prev) =>
            prev ? { ...prev, [field]: reader.result as string } : null,
          );
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const [senhaUsuario, setSenhaUsuario] = useState('');
  const [showSenhaUsuario, setShowSenhaUsuario] = useState(false);

  const handleOpenUsuarioModal = (usuario?: UsuarioCadastro) => {
    setSenhaUsuario('');
    setShowSenhaUsuario(false);
    if (usuario) {
      if (!canEditUser(state.user, usuario)) {
        toast.error("Você não tem permissão para editar usuários deste nível.");
        return;
      }
      const cloned = {
        ...usuario,
        modulos_permitidos: normalizeModulos(usuario.modulos_permitidos)
      };
      setEditingUsuario(cloned);
      setInitialUsuarioJson(JSON.stringify(cloned));
    } else {
      if (state.user?.nivel !== 'super_admin' && state.user?.nivel !== 'admin') {
        toast.error("Você não tem permissão para cadastrar usuários.");
        return;
      }
      const availableNiveis = getAvailableNiveisForUser(state.user);
      const novoUser: Partial<UsuarioCadastro> = {
        id: generateUUID(),
        tenant_id: state.user?.nivel === 'super_admin' ? (state.empresaSelecionada || "") : (state.user?.tenant_id || state.empresaSelecionada || ""),
        status: "ativo",
        nome: "",
        email: "",
        nivel: availableNiveis[0]?.value || "funcionario",
        modulos_permitidos: getAllModuleAndSubmoduleIds(),
      };
      setEditingUsuario(novoUser);
      setInitialUsuarioJson(JSON.stringify(novoUser));
    }
    setIsUsuarioModalOpen(true);
  };

  const handleCloseUsuarioModal = () => {
    setIsUsuarioModalOpen(false);
    setEditingUsuario(null);
    setInitialUsuarioJson('');
    setSenhaUsuario('');
  };

  const handleSaveUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.isOnline) {
      toast.error("Operação bloqueada no Modo de Visualização (Offline).");
      return;
    }
    if (!editingUsuario || !editingUsuario.id) return;

    const isNew = !usuarios.some(u => u.id === editingUsuario.id);

    if (isNew) {
      if (state.user?.nivel !== 'super_admin' && state.user?.nivel !== 'admin') {
        toast.error("Você não tem permissão para cadastrar novos usuários.");
        return;
      }
      if (state.user?.nivel === 'admin' && editingUsuario.nivel === 'super_admin') {
        toast.error("Administradores não podem criar usuários de nível Super Admin.");
        return;
      }
      if (!senhaUsuario || senhaUsuario.trim().length < 6) {
        toast.error("Para cadastrar um novo usuário no Supabase, a senha deve ter pelo menos 6 caracteres.");
        return;
      }
    } else {
      if (!canEditUser(state.user, editingUsuario as UsuarioCadastro, state.isOnline)) {
        toast.error("Você não tem permissão para editar usuários deste nível.");
        return;
      }
      if (senhaUsuario && senhaUsuario.trim().length > 0 && senhaUsuario.trim().length < 6) {
        toast.error("Para alterar a senha, informe no mínimo 6 caracteres (requisito Supabase Auth).");
        return;
      }
    }

    try {
      const novoUsuario: UsuarioCadastro = {
        ...(editingUsuario as UsuarioCadastro),
        nome: (editingUsuario.nome || '').trim().toUpperCase(),
        email: (editingUsuario.email || '').trim().toLowerCase(),
        modulos_permitidos: normalizarModulosParaSalvar(editingUsuario.nivel, editingUsuario.modulos_permitidos)
      };
      const senhaLimpa = senhaUsuario ? senhaUsuario.trim() : undefined;
      await saveUsuario(novoUsuario, state.isOnline, senhaLimpa, state.user || undefined);
      if (editingUsuario.id === state.user?.id) {
        await refreshProfile();
      }
      await loadData();
      handleCloseUsuarioModal();
      toast.success(
        isNew 
          ? "Usuário criado com sucesso no Supabase!" 
          : (senhaLimpa ? "Usuário e senha atualizados com sucesso no Supabase!" : "Usuário atualizado com sucesso!")
      );
    } catch (error: any) {
      console.error("Erro ao salvar usuário", error);
      toast.error(error?.message || "Erro ao salvar usuário. Verifique sua conexão.");
    }
  };

  const handleDeleteUsuario = async (id: string) => {
    const userToDelete = usuarios.find(u => u.id === id);
    if (userToDelete && !canDeleteUser(state.user, userToDelete, state.isOnline)) {
      toast.error(
        !state.isOnline
          ? "Exclusão bloqueada no Modo de Visualização (Offline)."
          : "Permissão negada. Somente o Super Admin pode excluir usuários do mesmo nível ou superiores."
      );
      return;
    }

    confirm({
      title: "Excluir Usuário",
      message: "Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.",
      danger: true,
      confirmText: "Excluir",
      onConfirm: async () => {
        try {
          await deleteUsuario(id, state.isOnline);
          await loadData();
          toast.success("Usuário excluído com sucesso!");
        } catch (error: any) {
          console.error("Erro ao excluir usuário", error);
          toast.error(error?.message || "Erro ao excluir usuário.");
        }
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Configurações
          </h2>
          <p className="text-slate-400 mt-1">
            Gestão de empresas e controle de acesso.
          </p>
        </div>

        {activeTab === "empresas" ? (
          canCreateEmpresa(state.user) && (
            <button
              disabled={!state.isOnline}
              onClick={() => handleOpenModal()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#7E4CF3] hover:bg-[#6A3DE8] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Nova Empresa
            </button>
          )
        ) : (
          (state.user?.nivel === 'super_admin' || state.user?.nivel === 'admin') && (
            <button
              disabled={!state.isOnline || (!state.empresaSelecionada && state.user?.nivel === 'super_admin')}
              onClick={() => handleOpenUsuarioModal()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#7E4CF3] hover:bg-[#6A3DE8] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Novo Usuário
            </button>
          )
        )}
      </div>

      <div className="flex border-b border-[#262A45]">
        {state.user?.nivel === 'super_admin' && (<button onClick={() => setActiveTab("empresas")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "empresas"
              ? "border-[#7E4CF3] text-[#7E4CF3]"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-[#262A45]"
          }`}
        >
          <Building className="w-4 h-4" />
          Empresas (Tenants)</button>)}
        <button
          onClick={() => setActiveTab("usuarios")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "usuarios"
              ? "border-[#7E4CF3] text-[#7E4CF3]"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:border-[#262A45]"
          }`}
        >
          <Users className="w-4 h-4" />
          Usuários e Acessos
        </button>
        {state.user?.nivel === 'super_admin' && (
          <button
            onClick={() => setActiveTab("sistema")}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "sistema"
                ? "border-[#7E4CF3] text-[#7E4CF3]"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-[#262A45]"
            }`}
          >
            <Database className="w-4 h-4" />
            Sistema / Backup
          </button>
        )}
        {(state.user?.nivel === 'admin' || state.user?.nivel === 'super_admin') && (
          <button
            onClick={() => setActiveTab("mensagens")}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "mensagens"
                ? "border-[#7E4CF3] text-[#7E4CF3]"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-[#262A45]"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            Mensagens e Templates
          </button>
        )}
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
      {activeTab === "empresas" && (
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          {/* Card de Segurança de Sessão — visível na aba Empresas */}
          <SessaoSegurancaCard />

          <div className={`bg-[#181B34] border border-[#262A45] rounded-2xl overflow-hidden shadow-sm flex flex-col ${previewEmpresa ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-[#262A45] bg-[#101223]/50 flex items-center gap-2">
            <Building className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-white">
              Empresas Cadastradas
            </h3>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#101223]/30 border-b border-[#262A45]">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome Fantasia</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">CNPJ</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">E-mail</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A45]">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      Carregando empresas...
                    </td>
                  </tr>
                ) : empresas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                ) : (
                  empresas.map((empresa) => (
                    <tr
                      key={empresa.id}
                      className="hover:bg-[#101223]/30 transition-colors cursor-pointer" onClick={() => setPreviewEmpresa(empresa)}
                    >
                      <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                        {empresa.logo_url ? (
                          <img
                            src={empresa.logo_url}
                            alt="Logo"
                            className="w-8 h-8 rounded object-cover border border-[#262A45]"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-[#101223] border border-[#262A45] flex items-center justify-center">
                            <Building className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        {empresa.nome_fantasia}
                      </td>
                      <td className="px-6 py-4">{empresa.cnpj}</td>
                      <td className="px-6 py-4">{empresa.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                            empresa.status === "ativo"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          }`}
                        >
                          {empresa.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEditEmpresa(state.user, empresa.id) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenModal(empresa); }}
                              className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                              title="Editar Empresa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDeleteEmpresa(state.user) && (
                            <button
                              disabled={!state.isOnline}
                              onClick={(e) => { e.stopPropagation(); handleDelete(empresa.id); }}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Excluir Empresa (Super Admin)"
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
          </div>
        </div>
      )}

      {previewEmpresa && activeTab === "empresas" && (
        <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 bg-[#181B34] border border-[#262A45] rounded-2xl flex flex-col shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#262A45] flex items-center justify-between bg-[#101223]/50">
            <h3 className="font-semibold text-white">Detalhes da Empresa</h3>
            <button onClick={() => setPreviewEmpresa(null)} className="text-slate-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div className="flex items-center gap-4">
              {previewEmpresa.logo_url ? (
                <img src={previewEmpresa.logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-[#262A45]" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-[#101223] border border-[#262A45] flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
              )}
              <div>
                <h4 className="text-lg font-medium text-white mb-1">{previewEmpresa.nome_fantasia || previewEmpresa.razao_social}</h4>
                <p className="text-sm text-slate-400">{previewEmpresa.cnpj}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#101223] p-3 rounded-xl border border-[#262A45]">
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${previewEmpresa.status === "ativo" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>{previewEmpresa.status}</span>
              </div>
            </div>

            <div>
              <h5 className="text-sm font-medium text-slate-300 mb-3 border-b border-[#262A45] pb-2">Contato</h5>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Email</span>
                  <span className="text-sm text-white">{previewEmpresa.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-400">Telefone</span>
                  <span className="text-sm text-white">{previewEmpresa.telefone || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-[#262A45] bg-[#101223]/50 flex gap-2">
            <button onClick={() => { handleOpenModal(previewEmpresa); setPreviewEmpresa(null); }} className="flex-1 py-2 bg-[#222542] hover:bg-[#2A2D48] text-white rounded-lg text-sm font-medium transition-colors border border-[#2A2D48]">
              Editar
            </button>
          </div>
        </div>
      )}

      {isModalOpen && editingEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0C16]/80 backdrop-blur-sm p-4">
          <div className="bg-[#181B34] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-[#262A45] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#262A45] flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-white tracking-tight">
                {editingEmpresa.razao_social
                  ? "Editar Empresa"
                  : "Nova Empresa"}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
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
              {(
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
              )}
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-bg-base/50">
              {modalActiveTab === 'dados' ? (
              <form
                id="empresaForm"
                onSubmit={handleSave}
                className="space-y-6"
              >
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
                      <label className="block text-sm font-semibold text-slate-400 mb-1">
                        Razão Social *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingEmpresa.razao_social || ""}
                        onChange={(e) =>
                          setEditingEmpresa({
                            ...editingEmpresa,
                            razao_social: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-400 mb-1">
                        Nome Fantasia *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingEmpresa.nome_fantasia || ""}
                        onChange={(e) =>
                          setEditingEmpresa({
                            ...editingEmpresa,
                            nome_fantasia: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-400 mb-1">
                        CNPJ *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingEmpresa.cnpj || ""}
                        onChange={(e) =>
                          setEditingEmpresa({
                            ...editingEmpresa,
                            cnpj: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-1">
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={editingEmpresa.email || ""}
                          onChange={(e) =>
                            setEditingEmpresa({
                              ...editingEmpresa,
                              email: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-1">
                          Telefone
                        </label>
                        <input
                          type="text"
                          value={editingEmpresa.telefone || ""}
                          onChange={(e) =>
                            setEditingEmpresa({
                              ...editingEmpresa,
                              telefone: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-400 mb-1">
                        Endereço Completo
                      </label>
                      <input
                        type="text"
                        value={editingEmpresa.endereco || ""}
                        onChange={(e) =>
                          setEditingEmpresa({
                            ...editingEmpresa,
                            endereco: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#7E4CF3]/50 focus:border-[#7E4CF3] transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-400 mb-1">
                        Status
                      </label>
                      <select
                        value={editingEmpresa.status || "ativo"}
                        onChange={(e) =>
                          setEditingEmpresa({
                            ...editingEmpresa,
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

                  <div className="space-y-6">
                    {/* Upload Logo */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-400 mb-2">
                        Logotipo da Empresa
                      </label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#262A45] border-dashed rounded-xl hover:bg-[#101223] transition-colors">
                        <div className="space-y-2 text-center">
                          {uploading ? (
                            <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                          ) : editingEmpresa.logo_url ? (
                            <img
                              src={editingEmpresa.logo_url}
                              alt="Logotipo"
                              className="mx-auto h-24 object-contain"
                            />
                          ) : (
                            <Upload className="mx-auto h-12 w-12 text-slate-400" />
                          )}
                          <div className="flex text-sm text-slate-400 justify-center">
                            <label className="relative cursor-pointer bg-transparent rounded-md font-medium text-[#7E4CF3] hover:text-[#4A88E9] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                              <span>Fazer upload do arquivo</span>
                              <input
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                disabled={uploading}
                                onChange={(e) =>
                                  handleImageUpload(e, "logo_url")
                                }
                              />
                            </label>
                          </div>
                          <p className="text-xs text-slate-400">
                            PNG, JPG, GIF até 5MB
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Upload Assinatura */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-400 mb-2">
                        Assinatura Digital
                      </label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[#262A45] border-dashed rounded-xl hover:bg-[#101223] transition-colors">
                        <div className="space-y-2 text-center">
                          {uploading ? (
                            <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                          ) : editingEmpresa.assinatura_url ? (
                            <img
                              src={editingEmpresa.assinatura_url}
                              alt="Assinatura"
                              className="mx-auto h-24 object-contain"
                            />
                          ) : (
                            <Upload className="mx-auto h-12 w-12 text-slate-400" />
                          )}
                          <div className="flex text-sm text-slate-400 justify-center">
                            <label className="relative cursor-pointer bg-transparent rounded-md font-medium text-[#7E4CF3] hover:text-[#4A88E9] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                              <span>Fazer upload do arquivo</span>
                              <input
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                disabled={uploading}
                                onChange={(e) =>
                                  handleImageUpload(e, "assinatura_url")
                                }
                              />
                            </label>
                          </div>
                          <p className="text-xs text-slate-400">
                            Fundo transparente recomendado (PNG)
                          </p>
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
                        <button
                          type="button"
                          onClick={() => setEditingConta({ status: 'ativo', tenant_id: editingEmpresa.id })}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                        >
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
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 bg-[#222542] border border-[#2A2D48] text-slate-300 rounded-xl font-medium hover:bg-[#2A2D48] hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="empresaForm"
                disabled={!state.isOnline}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#7E4CF3] to-[#4A88E9] text-white rounded-xl font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#7E4CF3]/25 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Salvar Empresa
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "usuarios" && (
        <div className={`bg-[#181B34] border border-[#262A45] rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col ${previewUsuario ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header com subtabs */}
          <div className="p-4 border-b border-[#262A45] bg-[#101223]/50 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-white">Usuários do Sistema</h3>
              </div>
              {/* Subtabs: Lista / Organograma */}
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

            {/* Filtros — só visíveis na lista */}
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
                {state.user?.nivel === 'super_admin' && (<select
                  value={usuarioTenantFilter}
                  onChange={(e) => setUsuarioTenantFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-sm bg-[#101223] border border-[#262A45] rounded-lg text-white focus:outline-none focus:border-[#7E4CF3]"
                >
                  <option className="bg-[#101223]" value="all">Todas as Empresas</option>
                  {empresas.map((empresa) => (
                    <option className="bg-[#101223]" key={empresa.id} value={empresa.id}>
                      {empresa.nome_fantasia}
                    </option>
                  ))}
                </select>)}
                <select
                  value={usuarioStatusFilter}
                  onChange={(e) =>
                    setUsuarioStatusFilter(e.target.value as any)
                  }
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

        {/* Vista Organograma */}
          {usuarioSubTab === 'organograma' && (
            <div className="p-6 flex-1 overflow-auto">
              <OrganogramaCanvas
                usuarios={usuarios}
                tenantId={state.user?.nivel === 'super_admin' ? usuarioTenantFilter : (state.empresaSelecionada || state.user?.tenant_id || null)}
                isSuperAdmin={state.user?.nivel === 'super_admin'}
              />
            </div>
          )}

          {/* Vista Lista */}
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
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-slate-400"
                    >
                      Carregando usuários...
                    </td>
                  </tr>
                ) : filteredUsuarios.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-slate-400"
                    >
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
                      <td className="px-6 py-4 font-medium text-white">
                        {usuario.nome}
                      </td>
                      <td className="px-6 py-4">{usuario.email}</td>
                      <td className="px-6 py-4 text-slate-400 truncate max-w-[150px]">
                        {empresas.find((e) => e?.id === usuario?.tenant_id || e?.nome_fantasia?.toLowerCase() === usuario?.tenant_id?.toLowerCase() || e?.razao_social?.toLowerCase() === usuario?.tenant_id?.toLowerCase())
                          ?.nome_fantasia || usuario?.tenant_id || "Desconhecida"}
                      </td>
                      <td className="px-6 py-4 capitalize">{usuario.nivel}</td>
                      <td className="px-6 py-4">
                        {usuario.nivel === 'super_admin' || usuario.modulos_permitidos?.includes('*') || (usuario.modulos_permitidos && usuario.modulos_permitidos.length >= MODULOS_SISTEMA.length) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                            <Shield className="w-3 h-3" />
                            Todos (Global)
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30"
                            title={(usuario.modulos_permitidos || []).map(id => MODULOS_SISTEMA.find(m => m.id === id)?.label || id).join(', ')}
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
                              onClick={(e) => { e.stopPropagation(); handleDeleteUsuario(usuario.id); }}
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
      )}

      {previewUsuario && activeTab === "usuarios" && (
        <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 bg-[#181B34] border border-[#262A45] rounded-2xl flex flex-col shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#262A45] flex items-center justify-between bg-[#101223]/50">
            <h3 className="font-semibold text-white">Detalhes do Usuário</h3>
            <button onClick={() => setPreviewUsuario(null)} className="text-slate-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div>
              <h4 className="text-lg font-medium text-white mb-1">{previewUsuario.nome}</h4>
              <p className="text-sm text-slate-400">{previewUsuario.email}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#101223] p-3 rounded-xl border border-[#262A45]">
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${previewUsuario.status === "ativo" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>{previewUsuario.status}</span>
              </div>
              <div className="bg-[#101223] p-3 rounded-xl border border-[#262A45]">
                <p className="text-xs text-slate-500 mb-1">Nível</p>
                <p className="text-sm text-white capitalize">{previewUsuario.nivel.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-[#262A45] bg-[#101223]/50 flex gap-2">
            <button onClick={() => { handleOpenUsuarioModal(previewUsuario); setPreviewUsuario(null); }} className="flex-1 py-2 bg-[#222542] hover:bg-[#2A2D48] text-white rounded-lg text-sm font-medium transition-colors border border-[#2A2D48]">
              Editar
            </button>
          </div>
        </div>
      )}

      {activeTab === "sistema" && state.user?.nivel === 'super_admin' && (
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
          <SistemaBackupPanel
            empresas={empresas}
            isSuperAdmin={state.user?.nivel === 'super_admin'}
            usuarioEmpresaId={state.user?.tenant_id || state.empresaSelecionada || ''}
            usuarioNome={state.user?.nome}
            usuarioId={state.user?.id}
          />
        </div>
      )}

      {activeTab === "mensagens" && (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <MensagensConfigTab />
        </div>
      )}
      </div>

      {isUsuarioModalOpen && editingUsuario && (
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
                onClick={handleCloseUsuarioModal}
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
                {!usuarios.some(u => u.id === editingUsuario.id) ? (
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
                ) : canChangeUserPassword(state.user, editingUsuario) ? (
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
                onClick={handleCloseUsuarioModal}
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
      )}
    </div>
  );
};
