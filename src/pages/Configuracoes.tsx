import React, { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { getEmpresas, Empresa } from "../services/empresasService";
import { getUsuarios, UsuarioCadastro } from "../services/usuariosService";
import {
  Building,
  Users,
  Database,
  MessageCircle
} from "lucide-react";

import { SistemaBackupPanel } from '../components/configuracoes/SistemaBackupPanel';
import { MensagensConfigTab } from '../components/configuracoes/MensagensConfigTab';
import { SessaoSegurancaCard } from '../components/configuracoes/SessaoSegurancaCard';
import { ConfigEmpresasTab } from '../components/configuracoes/empresas/ConfigEmpresasTab';
import { ConfigUsuariosTab } from '../components/configuracoes/usuarios/ConfigUsuariosTab';

export const ConfiguracoesPage: React.FC = () => {
  const { state } = useAppContext();
  const [activeTab, setActiveTab] = useState<"empresas" | "usuarios" | "sistema" | "mensagens">(
    "empresas"
  );

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCadastro[]>([]);
  const [loading, setLoading] = useState(true);

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
      </div>

      <div className="flex border-b border-[#262A45] overflow-x-auto">
        {state.user?.nivel === 'super_admin' && (
          <button 
            onClick={() => setActiveTab("empresas")}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
              activeTab === "empresas"
                ? "border-[#7E4CF3] text-[#7E4CF3]"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-[#262A45]"
            }`}
          >
            <Building className="w-4 h-4" />
            Empresas (Tenants)
          </button>
        )}
        <button
          onClick={() => setActiveTab("usuarios")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
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
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
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
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${
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
            <SessaoSegurancaCard />
            <ConfigEmpresasTab
              empresas={empresas}
              loading={loading}
              onRefresh={loadData}
            />
          </div>
        )}

        {activeTab === "usuarios" && (
          <div className="flex-1 flex flex-col gap-6 min-h-0">
            <ConfigUsuariosTab
              usuarios={usuarios}
              empresas={empresas}
              loading={loading}
              onRefresh={loadData}
            />
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
    </div>
  );
};
