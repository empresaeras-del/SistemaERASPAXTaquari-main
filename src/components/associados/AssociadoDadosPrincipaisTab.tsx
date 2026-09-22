import React from 'react';
import { Associado } from '../../services/associadosService';
import { encontrarAssociadoComCpfDuplicado } from '../../utils/associadoHelpers';
import { validarDadosAssociado } from '../../utils/associadoValidation';
import { formatPhone } from '../../utils/formatters';
import { maskCPFOrCNPJ } from '../../utils/validators';
import { AlertCircle, MapPin, Phone, Search, ShieldCheck, User, Users } from 'lucide-react';

interface Props {
  activeSubTab: any;
  associados: any;
  buscandoCep: any;
  buscarCepViaCep: any;
  editingAssociado: any;
  fieldErrors: any;
  handleFieldChange: any;
  setActiveSubTab: any;
  toast: any;
}

/**
 * A aba "Dados Principais" e suas cinco sub-abas: básicas, filiação, contato, endereço e
 * sistema.
 *
 * Duas coisas que não são óbvias no código:
 *
 * - **As seções inativas ficam `hidden`, não desmontadas.** O que o operador digitou numa
 *   sub-aba continua no DOM ao trocar para outra, e a contagem de erros por sub-aba (o badge
 *   vermelho ao lado do nome) é calculada sobre o cadastro inteiro, de uma vez.
 * - **A troca de sub-aba NÃO é validada**, ao contrário da troca de aba: circular entre as
 *   seções é livre; o que trava é sair de Dados Principais com campo obrigatório pendente.
 */
export const AssociadoDadosPrincipaisTab: React.FC<Props> = ({ activeSubTab, associados, buscandoCep, buscarCepViaCep, editingAssociado, fieldErrors, handleFieldChange, setActiveSubTab, toast }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-full">
      {/* Sub-tabs para Dados Principais (Fichários) */}
      <div className="flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-border-default/50 custom-scrollbar shrink-0">
        {(() => {
          const { erros } = validarDadosAssociado(editingAssociado);
          const errBasicas = erros.filter(e => e.subTab === "basicas").length;
          const errContato = erros.filter(e => e.subTab === "contato").length;
          const errEndereco = erros.filter(e => e.subTab === "endereco").length;
          const errSistema = erros.filter(e => e.subTab === "sistema").length;

          return (
            <>
              <button
                type="button"
                onClick={() => setActiveSubTab("basicas")}
                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "basicas" ? "bg-[#3B82F6]/10 text-[#3B82F6]" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
              >
                <span>Informações Básicas</span>
                {Object.keys(fieldErrors).length > 0 && errBasicas > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                    {errBasicas}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("filiacao")}
                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "filiacao" ? "bg-indigo-500/10 text-indigo-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
              >
                <span>Filiação</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("contato")}
                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "contato" ? "bg-emerald-500/10 text-emerald-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
              >
                <span>Contato</span>
                {Object.keys(fieldErrors).length > 0 && errContato > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                    {errContato}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("endereco")}
                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "endereco" ? "bg-amber-500/10 text-amber-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
              >
                <span>Endereço</span>
                {Object.keys(fieldErrors).length > 0 && errEndereco > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                    {errEndereco}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("sistema")}
                className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors flex items-center gap-1.5 ${activeSubTab === "sistema" ? "bg-purple-500/10 text-purple-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
              >
                <span>Informações do Sistema</span>
                {Object.keys(fieldErrors).length > 0 && errSistema > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                    {errSistema}
                  </span>
                )}
              </button>
            </>
          );
        })()}
      </div>

      <div className="space-y-8">
      {/* Section: Informações Básicas */}
      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "basicas" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
          <div className="p-2 bg-[#3B82F6]/10 rounded-xl text-[#3B82F6]">
            <User className="w-5 h-5" />
          </div>
          <h4 className="text-lg font-bold text-text-base tracking-tight">
            Informações Básicas
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              value={editingAssociado.nome || ""}
              onChange={(e) => handleFieldChange("nome", e.target.value)}
              placeholder="Digite o nome completo"
              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                fieldErrors.nome
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            />
            {fieldErrors.nome && (
              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.nome}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              CPF *
            </label>
            <input
              type="text"
              maxLength={14}
              placeholder="000.000.000-00"
              value={editingAssociado.cpf || ""}
              onChange={(e) => {
                const formatted = maskCPFOrCNPJ(e.target.value, false);
                handleFieldChange("cpf", formatted);
                const cpfLimpo = formatted.replace(/\D/g, '');
                if (cpfLimpo.length === 11) {
                  // Mesmo predicado do salvar, e por isso a mesma função:
                  // escrito à mão aqui, este aviso ignorava a empresa e
                  // acusava duplicidade de outra companhia.
                  const duplicateUser = encontrarAssociadoComCpfDuplicado(
                    associados, formatted, editingAssociado.tenant_id, editingAssociado.id,
                  );
                  if (duplicateUser) {
                    toast.error(`ATENÇÃO: CPF já cadastrado nesta empresa no associado ativo: ${duplicateUser.nome}`);
                  }
                }
              }}
              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                fieldErrors.cpf
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            />
            {fieldErrors.cpf && (
              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.cpf}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              RG
            </label>
            <input
              type="text"
              value={editingAssociado.rg || ""}
              onChange={(e) => handleFieldChange("rg", e.target.value)}
              placeholder="Número do RG"
              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              Data de Nascimento *
            </label>
            <input
              type="date"
              value={editingAssociado.data_nascimento || ""}
              onChange={(e) => handleFieldChange("data_nascimento", e.target.value)}
              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                fieldErrors.data_nascimento
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            />
            {fieldErrors.data_nascimento && (
              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.data_nascimento}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              Sexo *
            </label>
            <select
              value={editingAssociado.sexo || ""}
              onChange={(e) => handleFieldChange("sexo", e.target.value)}
              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                fieldErrors.sexo
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            >
              <option value="">Selecione</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
            {fieldErrors.sexo && (
              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.sexo}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section: Filiação */}
      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "filiacao" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
          <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <h4 className="text-lg font-bold text-text-base tracking-tight">
            Filiação
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              Nome da Mãe
            </label>
            <input
              type="text"
              value={editingAssociado.nome_mae || ""}
              onChange={(e) => handleFieldChange("nome_mae", e.target.value)}
              placeholder="Nome da mãe"
              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              Nome do Pai
            </label>
            <input
              type="text"
              value={editingAssociado.nome_pai || ""}
              onChange={(e) => handleFieldChange("nome_pai", e.target.value)}
              placeholder="Nome do pai"
              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section: Contato */}
      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "contato" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
            <Phone className="w-5 h-5" />
          </div>
          <h4 className="text-lg font-bold text-text-base tracking-tight">
            Contato
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              Telefone *
            </label>
            <input
              type="tel"
              maxLength={15}
              placeholder="(00) 00000-0000"
              value={editingAssociado.telefone || ""}
              onChange={(e) => {
                const formatted = formatPhone(e.target.value);
                handleFieldChange("telefone", formatted);
              }}
              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                fieldErrors.telefone
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            />
            {fieldErrors.telefone && (
              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.telefone}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              E-mail
            </label>
            <input
              type="email"
              value={editingAssociado.email || ""}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              placeholder="exemplo@email.com"
              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section: Endereço */}
      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "endereco" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
        <div className="flex items-center justify-between border-b border-border-default/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-text-base tracking-tight">
                Endereço Residencial
              </h4>
              <p className="text-xs text-text-subtle">Digite o CEP para buscar automaticamente ou preencha os campos abaixo</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* CEP */}
          <div className="space-y-1 md:col-span-3">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              CEP *
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                maxLength={9}
                placeholder="00000-000"
                value={editingAssociado.endereco_cep || editingAssociado.cep || ""}
                onChange={(e) => handleFieldChange("endereco_cep", e.target.value)}
                className={`w-full px-3.5 py-2.5 pr-10 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                  fieldErrors.endereco_cep || fieldErrors.cep
                    ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                    : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
                }`}
              />
              <button
                type="button"
                disabled={buscandoCep}
                onClick={() => buscarCepViaCep(editingAssociado.endereco_cep || editingAssociado.cep || "")}
                title="Buscar endereço pelo CEP"
                className="absolute right-2 p-1.5 text-text-subtle hover:text-[#3B82F6] hover:bg-bg-hover rounded-lg transition-colors disabled:opacity-50"
              >
                {buscandoCep ? (
                  <div className="w-4 h-4 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>
            {(fieldErrors.endereco_cep || fieldErrors.cep) && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.endereco_cep || fieldErrors.cep}
              </p>
            )}
          </div>

          {/* Logradouro */}
          <div className="space-y-1 md:col-span-6">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Logradouro *
            </label>
            <input
              type="text"
              placeholder="Rua, Avenida, Alameda, Travessa..."
              value={editingAssociado.endereco_logradouro || editingAssociado.logradouro || ""}
              onChange={(e) => handleFieldChange("endereco_logradouro", e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                fieldErrors.endereco_logradouro || fieldErrors.logradouro
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            />
            {(fieldErrors.endereco_logradouro || fieldErrors.logradouro) && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.endereco_logradouro || fieldErrors.logradouro}
              </p>
            )}
          </div>

          {/* Número */}
          <div className="space-y-1 md:col-span-3">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Número *
            </label>
            <input
              type="text"
              placeholder="Nº ou S/N"
              value={editingAssociado.endereco_numero || editingAssociado.numero || ""}
              onChange={(e) => handleFieldChange("endereco_numero", e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                fieldErrors.endereco_numero || fieldErrors.numero
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            />
            {(fieldErrors.endereco_numero || fieldErrors.numero) && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.endereco_numero || fieldErrors.numero}
              </p>
            )}
          </div>

          {/* Bairro */}
          <div className="space-y-1 md:col-span-6">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Bairro *
            </label>
            <input
              type="text"
              placeholder="Nome do bairro"
              value={editingAssociado.endereco_bairro || editingAssociado.bairro || ""}
              onChange={(e) => handleFieldChange("endereco_bairro", e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                fieldErrors.endereco_bairro || fieldErrors.bairro
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            />
            {(fieldErrors.endereco_bairro || fieldErrors.bairro) && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.endereco_bairro || fieldErrors.bairro}
              </p>
            )}
          </div>

          {/* Cidade / UF / Município */}
          <div className="space-y-1 md:col-span-6">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
              Município / UF *
            </label>
            <input
              type="text"
              placeholder="Ex: Coxim - MS ou Taquari"
              value={editingAssociado.endereco_cidade || editingAssociado.cidade || editingAssociado.municipio || ""}
              onChange={(e) => handleFieldChange("endereco_cidade", e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-bg-surface border rounded-xl text-text-base text-sm focus:outline-none transition-all ${
                fieldErrors.endereco_cidade || fieldErrors.cidade
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            />
            {(fieldErrors.endereco_cidade || fieldErrors.cidade) && (
              <p className="text-[11px] text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.endereco_cidade || fieldErrors.cidade}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section: Sistema */}
      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "sistema" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>
        <div className="flex items-center gap-3 border-b border-border-default/50 pb-4">
          <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-lg font-bold text-text-base tracking-tight">
            Informações do Sistema
          </h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              Data de Adesão *
            </label>
            <input
              type="date"
              value={editingAssociado.data_adesao || ""}
              onChange={(e) => handleFieldChange("data_adesao", e.target.value)}
              className={`w-full px-4 py-2.5 bg-bg-surface border rounded-xl text-text-base focus:outline-none transition-all ${
                fieldErrors.data_adesao
                  ? "border-rose-500 ring-2 ring-rose-500/30 bg-rose-500/5"
                  : "border-border-default focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]"
              }`}
            />
            {fieldErrors.data_adesao && (
              <p className="text-xs text-rose-500 flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {fieldErrors.data_adesao}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-text-muted uppercase tracking-wider mb-1">
              Status *
            </label>
            <select
              value={editingAssociado.status || "ativo"}
              onChange={(e) => handleFieldChange("status", e.target.value as Associado["status"])}
              className="w-full px-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-base focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] transition-all"
            >
              <option value="ativo">Ativo</option>
              <option value="inadimplente">Inadimplente</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
