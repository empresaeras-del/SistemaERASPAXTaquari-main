import React from 'react';
import {  Dependente } from '../../services/associadosService';
import { Empresa } from '../../services/empresasService';
import { Receita } from '../../services/financeiroService';
import { Atendimento } from '../../types/atendimentos';
import { Credenciado } from '../../types/credenciados';
import { Fornecedor } from '../../types/fornecedores';
import { formatLocalDate } from '../../utils/dateUtils';
import { format } from 'date-fns';
import { AlertCircle, Building2, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, CreditCard, Flame, Hospital, RotateCcw, Sparkles, Truck, User, UserCircle2, Wallet } from 'lucide-react';

interface Props {
  associados: any[];
  atendimentos: any[];
  credenciados: any[];
  currentEmpresa: any;
  empresas: any[];
  fornecedores: any[];
  handleAssociadoChange: any;
  handleAtendimentoChange: any;
  handleCredenciadoChange: any;
  handleDependenteChange: any;
  handleEmpresaChange: any;
  handleFornecedorChange: any;
  handleParcelaReceberChange: any;
  handlePlanoChange: any;
  handleReceitaChange: any;
  handleRequisicaoChange: any;
  handleResetSelections: any;
  modulosDetectados: any;
  openSections: any;
  parcelasReceber: any[];
  planos: any[];
  receitas: any[];
  requisicoes: any[];
  selectedAssociadoId: any;
  selectedAtendimentoId: any;
  selectedCredenciadoId: any;
  selectedDependenteId: any;
  selectedEmpresaId: any;
  selectedFornecedorId: any;
  selectedParcelaReceberId: any;
  selectedPlanoId: any;
  selectedReceitaId: any;
  selectedRequisicaoId: any;
  toggleSection: any;
}

export const VisualizadorDocumentoSeletores: React.FC<Props> = ({ associados, atendimentos, credenciados, currentEmpresa, empresas, fornecedores, handleAssociadoChange, handleAtendimentoChange, handleCredenciadoChange, handleDependenteChange, handleEmpresaChange, handleFornecedorChange, handleParcelaReceberChange, handlePlanoChange, handleReceitaChange, handleRequisicaoChange, handleResetSelections, modulosDetectados, openSections, parcelasReceber, planos, receitas, requisicoes, selectedAssociadoId, selectedAtendimentoId, selectedCredenciadoId, selectedDependenteId, selectedEmpresaId, selectedFornecedorId, selectedParcelaReceberId, selectedPlanoId, selectedReceitaId, selectedRequisicaoId, toggleSection }) => {
  return (
    <>
    {/* ── SELETOR 1: EMPRESA EMISSORA ── */}
    <div className="bg-[#181d27] rounded-xl border border-[#2d3544] overflow-hidden">
      <button
        type="button"
        onClick={() => toggleSection('empresa')}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
          <Building2 className="w-4 h-4" />
          <span>Empresa Emissora</span>
        </div>
        <div className="flex items-center gap-1.5">
          {selectedEmpresaId && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              title="Empresa Selecionada"
            />
          )}
          {openSections.empresa ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {openSections.empresa && (
        <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
          <select
            value={selectedEmpresaId}
            onChange={(e) => handleEmpresaChange(e.target.value)}
            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-amber-500 outline-none transition-colors"
          >
            <option value="">Selecione a empresa...</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nome_fantasia || emp.razao_social}
              </option>
            ))}
          </select>
          {currentEmpresa && (
            <div className="text-[10px] text-slate-400 pt-1.5 flex flex-wrap items-center gap-2 border-t border-[#2d3544]">
              <span className="flex items-center gap-1">
                {currentEmpresa.logo_url ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                )}
                Logo: {currentEmpresa.logo_url ? 'Vinculado' : 'Sem logo'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {currentEmpresa.assinatura_url ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                )}
                Assinatura:{' '}
                {currentEmpresa.assinatura_url ? 'Vinculada' : 'Sem assinatura'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>

    {/* ── SELETOR 2: ATENDIMENTO / ÓBITO ── */}
    <div
      className={`bg-[#181d27] rounded-xl border transition-all ${
        modulosDetectados.hasAtendimento
          ? 'border-indigo-500/50 shadow-md shadow-indigo-500/5'
          : 'border-[#2d3544]'
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => toggleSection('atendimento')}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
          <Flame className="w-4 h-4" />
          <span>Atendimento / Óbito</span>
          {modulosDetectados.hasAtendimento && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Detectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {selectedAtendimentoId && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              title="Atendimento Selecionado"
            />
          )}
          {openSections.atendimento ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {openSections.atendimento && (
        <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
          <select
            value={selectedAtendimentoId}
            onChange={(e) => handleAtendimentoChange(e.target.value)}
            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none transition-colors"
          >
            <option value="">Selecione o atendimento do falecido...</option>
            {atendimentos.map((atd) => (
              <option key={atd.id} value={atd.id}>
                {atd.falecido_nome}{' '}
                {atd.data_obito ? `(Óbito: ${formatLocalDate(atd.data_obito)})` : ''} -
                Status: {(atd.status || '').toUpperCase()}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">
            Preenche falecido, datas de óbito, velório, sepultamento, médico, CRM,
            tanatopraxia e vincula associado se houver.
          </p>
        </div>
      )}
    </div>

    {/* ── SELETOR 3: ASSOCIADO & CONTRATO ── */}
    <div
      className={`bg-[#181d27] rounded-xl border transition-all ${
        modulosDetectados.hasAssociado
          ? 'border-blue-500/50 shadow-md shadow-blue-500/5'
          : 'border-[#2d3544]'
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => toggleSection('associado')}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
          <User className="w-4 h-4" />
          <span>Associado & Contrato</span>
          {modulosDetectados.hasAssociado && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Detectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {selectedAssociadoId && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              title="Associado Selecionado"
            />
          )}
          {openSections.associado ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {openSections.associado && (
        <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
          <select
            value={selectedAssociadoId}
            onChange={(e) => handleAssociadoChange(e.target.value)}
            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors"
          >
            <option value="">Selecione um associado...</option>
            {associados.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} {a.cpf ? `(CPF: ${a.cpf})` : ''}{' '}
                {a.numero_contrato ? `[Contrato: ${a.numero_contrato}]` : ''}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">
            Preenche nome, CPF, endereço, número do contrato, plano, dependentes e data de
            adesão.
          </p>

          {selectedAssociadoId &&
            (() => {
              const assocSelecionado = associados.find(
                (a) => a.id === selectedAssociadoId,
              );
              const dependentes = assocSelecionado?.dependentes || [];
              if (dependentes.length === 0) return null;
              return (
                <div className="pt-2 border-t border-[#2d3544]/60 space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-300 uppercase tracking-wider">
                    <UserCircle2 className="w-3 h-3" />
                    Dependente (opcional)
                  </label>
                  <select
                    value={selectedDependenteId}
                    onChange={(e) => handleDependenteChange(e.target.value)}
                    className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-blue-500 outline-none transition-colors"
                  >
                    <option value="">Selecione um dependente...</option>
                    {dependentes.map((d: Dependente) => (
                      <option key={d.id} value={d.id}>
                        {d.nome} {d.cpf ? `(CPF: ${d.cpf})` : ''}{' '}
                        {d.parentesco ? `[${d.parentesco}]` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400">
                    Preenche nome, CPF, data de nascimento e parentesco do dependente
                    selecionado.
                  </p>
                </div>
              );
            })()}
        </div>
      )}
    </div>

    {/* ── SELETOR 4: PLANO PAX ── */}
    <div
      className={`bg-[#181d27] rounded-xl border transition-all ${
        modulosDetectados.hasPlano
          ? 'border-emerald-500/50 shadow-md shadow-emerald-500/5'
          : 'border-[#2d3544]'
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => toggleSection('plano')}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
          <CreditCard className="w-4 h-4" />
          <span>Plano PAX</span>
          {modulosDetectados.hasPlano && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Detectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {selectedPlanoId && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              title="Plano Selecionado"
            />
          )}
          {openSections.plano ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {openSections.plano && (
        <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
          <select
            value={selectedPlanoId}
            onChange={(e) => handlePlanoChange(e.target.value)}
            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-emerald-500 outline-none transition-colors"
          >
            <option value="">Selecione o plano PAX...</option>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.codigo}) -{' '}
                {p.tipo_plano === 'individual' ? 'Individual' : 'Coletivo'} -{' '}
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(p.valor_mensalidade || 0)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">
            Preenche nome do plano, código, tipo, valor de mensalidade, taxa de adesão e
            carências.
          </p>
        </div>
      )}
    </div>

    {/* ── SELETOR 5: REDE CREDENCIADA / PRESTADOR ── */}
    <div
      className={`bg-[#181d27] rounded-xl border transition-all ${
        modulosDetectados.hasCredenciado
          ? 'border-rose-500/50 shadow-md shadow-rose-500/5'
          : 'border-[#2d3544]'
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => toggleSection('credenciado')}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
          <Hospital className="w-4 h-4" />
          <span>Rede Credenciada / Prestador</span>
          {modulosDetectados.hasCredenciado && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Detectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {selectedCredenciadoId && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              title="Credenciado Selecionado"
            />
          )}
          {openSections.credenciado ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {openSections.credenciado && (
        <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
          <select
            value={selectedCredenciadoId}
            onChange={(e) => handleCredenciadoChange(e.target.value)}
            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-rose-500 outline-none transition-colors"
          >
            <option value="">Selecione o credenciado / clínica...</option>
            {credenciados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razao_social} {c.nome_fantasia ? `(${c.nome_fantasia})` : ''} -{' '}
                {c.ramo_atividade || 'Saúde'}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">
            Preenche razão social, nome fantasia, CNPJ/CPF, endereço, telefone, e-mail e
            responsável.
          </p>
        </div>
      )}
    </div>

    {/* ── SELETOR 6: FORNECEDOR ── */}
    <div
      className={`bg-[#181d27] rounded-xl border transition-all ${
        modulosDetectados.hasFornecedor
          ? 'border-orange-500/50 shadow-md shadow-orange-500/5'
          : 'border-[#2d3544]'
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => toggleSection('fornecedor')}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
          <Truck className="w-4 h-4" />
          <span>Fornecedor</span>
          {modulosDetectados.hasFornecedor && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Detectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {selectedFornecedorId && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              title="Fornecedor Selecionado"
            />
          )}
          {openSections.fornecedor ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {openSections.fornecedor && (
        <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
          <select
            value={selectedFornecedorId}
            onChange={(e) => handleFornecedorChange(e.target.value)}
            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-orange-500 outline-none transition-colors"
          >
            <option value="">Selecione o fornecedor...</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.razao_social} {f.nome_fantasia ? `(${f.nome_fantasia})` : ''} -{' '}
                {f.cnpj_cpf}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">
            Preenche razão social, CNPJ/CPF, endereço, telefone, contato e dados
            bancários/PIX.
          </p>
        </div>
      )}
    </div>

    {/* ── SELETOR 7: FINANCEIRO (RECEITA / PARCELA A RECEBER) ── */}
    <div
      className={`bg-[#181d27] rounded-xl border transition-all ${
        modulosDetectados.hasFinanceiro
          ? 'border-teal-500/50 shadow-md shadow-teal-500/5'
          : 'border-[#2d3544]'
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => toggleSection('financeiro')}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-teal-400 uppercase tracking-wider">
          <Wallet className="w-4 h-4" />
          <span>Financeiro (Receita / Recibo)</span>
          {modulosDetectados.hasFinanceiro && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Detectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {(selectedReceitaId || selectedParcelaReceberId) && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Selecionado" />
          )}
          {openSections.financeiro ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {openSections.financeiro && (
        <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
          <select
            value={selectedReceitaId}
            onChange={(e) => handleReceitaChange(e.target.value)}
            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-teal-500 outline-none transition-colors"
          >
            <option value="">Selecione a receita...</option>
            {receitas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.descricao} -{' '}
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(r.valor_total || 0)}
              </option>
            ))}
          </select>
          <select
            value={selectedParcelaReceberId}
            onChange={(e) => handleParcelaReceberChange(e.target.value)}
            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-teal-500 outline-none transition-colors"
          >
            <option value="">Selecione a parcela a receber...</option>
            {parcelasReceber.map((p) => (
              <option key={p.id} value={p.id}>
                Parcela {p.numero_parcela} - {p.devedor_nome || 'Sem devedor'} -{' '}
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(p.valor || 0)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">
            Preenche descrição, categoria, valores, vencimento/pagamento, status e dados
            do devedor — ideal para recibos.
          </p>
        </div>
      )}
    </div>

    {/* ── SELETOR 8: REQUISIÇÃO / GUIA ── */}
    <div
      className={`bg-[#181d27] rounded-xl border transition-all ${
        modulosDetectados.hasRequisicao
          ? 'border-cyan-500/50 shadow-md shadow-cyan-500/5'
          : 'border-[#2d3544]'
      } overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => toggleSection('requisicao')}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-[#202735] transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
          <ClipboardList className="w-4 h-4" />
          <span>Requisição / Guia</span>
          {modulosDetectados.hasRequisicao && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Detectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {selectedRequisicaoId && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              title="Requisição Selecionada"
            />
          )}
          {openSections.requisicao ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {openSections.requisicao && (
        <div className="p-3 pt-0 border-t border-[#2d3544]/60 space-y-2">
          <select
            value={selectedRequisicaoId}
            onChange={(e) => handleRequisicaoChange(e.target.value)}
            className="w-full bg-[#13171f] border border-[#2d3544] rounded-lg px-3 py-2 text-white text-xs focus:border-cyan-500 outline-none transition-colors"
          >
            <option value="">Selecione a requisição...</option>
            {requisicoes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.codigo_requisicao} - {r.paciente_nome} (
                {(r.status || '').toUpperCase()})
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">
            Preenche código, datas, paciente, credenciado, médico solicitante, itens e
            valor total.
          </p>
        </div>
      )}
    </div>

    {/* Botão para limpar seleções */}
    {(selectedAssociadoId ||
      selectedAtendimentoId ||
      selectedPlanoId ||
      selectedCredenciadoId ||
      selectedFornecedorId ||
      selectedReceitaId ||
      selectedParcelaReceberId ||
      selectedRequisicaoId) && (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleResetSelections}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Limpar Seleções de Módulos
        </button>
      </div>
    )}
    </>
  );
};
