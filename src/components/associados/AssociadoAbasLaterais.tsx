import React from 'react';
import { Activity, ClipboardList, DollarSign, FileText, FolderOpen, User, Users } from 'lucide-react';

interface Props {
  activeTab: any;
  executarValidacaoOuAlertar: any;
  isEditingMode: any;
  setActiveTab: any;
}

/**
 * A barra de abas do formulário em modo de EDIÇÃO (oito abas, à esquerda).
 *
 * **Toda troca de aba passa por `executarValidacaoOuAlertar()`**, e isso não é detalhe: com
 * um campo obrigatório inválido o clique não faz nada e o formulário fica preso em "Dados
 * Principais", sem nada na tela explicando por quê. A validação é a mesma do salvar — o que
 * ela evita é chegar à última aba para só então descobrir que o cadastro não fecha.
 *
 * As duas últimas abas (Requisições e Atendimentos) só existem em edição: num cadastro novo
 * não há registro para elas listarem.
 */
export const AssociadoAbasLaterais: React.FC<Props> = ({ activeTab, executarValidacaoOuAlertar, isEditingMode, setActiveTab }) => {
  return (
    <div className="w-64 border-r border-border-default bg-bg-surface/30 flex flex-col py-4 shrink-0">
      <button
        type="button"
        onClick={() => {
          if (!executarValidacaoOuAlertar()) return;
          setActiveTab("resumo");
        }}
        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
          activeTab === "resumo"
            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
        }`}
      >
        <Activity className="w-4 h-4" />
        Resumo Financeiro
      </button>
      <button
        type="button"
        onClick={() => {
          if (!executarValidacaoOuAlertar()) return;
          setActiveTab("principal");
        }}
        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
          activeTab === "principal"
            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
        }`}
      >
        <User className="w-4 h-4" />
        Dados Principais
      </button>
      <button
        type="button"
        onClick={() => {
          if (!executarValidacaoOuAlertar()) return;
          setActiveTab("dependentes");
        }}
        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
          activeTab === "dependentes"
            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
        }`}
      >
        <Users className="w-4 h-4" />
        Dependentes
      </button>
      <button
        type="button"
        onClick={() => {
          if (!executarValidacaoOuAlertar()) return;
          setActiveTab("contratos");
        }}
        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
          activeTab === "contratos"
            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
        }`}
      >
        <FileText className="w-4 h-4" />
        Contratos
      </button>
      <button
        type="button"
        onClick={() => {
          if (!executarValidacaoOuAlertar()) return;
          setActiveTab("mensalidades");
        }}
        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
          activeTab === "mensalidades"
            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
        }`}
      >
        <DollarSign className="w-4 h-4" />
        Mensalidades
      </button>
      <button
        type="button"
        onClick={() => {
          if (!executarValidacaoOuAlertar()) return;
          setActiveTab("documentos");
        }}
        className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
          activeTab === "documentos"
            ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
            : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
        }`}
      >
        <FolderOpen className="w-4 h-4" />
        Documentos
      </button>
      {isEditingMode && (
        <>
          <button
            type="button"
            onClick={() => {
              if (!executarValidacaoOuAlertar()) return;
              setActiveTab("requisicoes");
            }}
            className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
              activeTab === "requisicoes"
                ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Requisições
          </button>
          <button
            type="button"
            onClick={() => {
              if (!executarValidacaoOuAlertar()) return;
              setActiveTab("atendimentos");
            }}
            className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
              activeTab === "atendimentos"
                ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
            }`}
          >
            <Activity className="w-4 h-4" />
            Atendimentos
          </button>
        </>
      )}
    </div>
  );
};
