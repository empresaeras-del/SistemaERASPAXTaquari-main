import React, {  useRef} from 'react';
import {



  SlidersHorizontal,


  RefreshCw,


} from 'lucide-react';
import { Rnd } from 'react-rnd';
import { format } from 'date-fns';
import { DocumentoPadrao,  AssinaturaConfig } from '../../types/documentos';
import { Empresa} from '../../services/empresasService';
import { Associado} from '../../services/associadosService';
import { Atendimento } from '../../types/atendimentos';
import { getAtendimentos } from '../../services/atendimentosService';
import { PlanoPax } from '../../types/planosPax';
import { Credenciado } from '../../types/credenciados';
import { Fornecedor } from '../../types/fornecedores';
import { Requisicao } from '../../types/requisicoes';
import { getRequisicoes } from '../../services/requisicoesService';
import { formatLocalDate } from '../../utils/dateUtils';
import { getAllFromIDB } from '../../lib/idb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { montarHtmlImpressaoDocumento } from '../../utils/documentoPrintStyles';
import type {  OrientacaoPapel } from '../../types/documentos';
import { sanitizeDocumentoHtml } from '../../utils/sanitizeHtml';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { VisualizadorDocumentoToolbar } from './VisualizadorDocumentoToolbar';
import { VisualizadorDocumentoSeletores } from './VisualizadorDocumentoSeletores';
import { VisualizadorDocumentoVariaveis } from './VisualizadorDocumentoVariaveis';
import { VisualizadorDocumentoFolha } from './VisualizadorDocumentoFolha';


export interface VisualizadorDocumentoPadraoModalProps {
  isOpen: boolean;
  onClose: () => void;
  documento: DocumentoPadrao | null;
  empresaData?: Empresa | null;
  empresas?: Empresa[];
  associados?: Associado[];
  atendimentos?: Atendimento[];
  planos?: PlanoPax[];
  credenciados?: Credenciado[];
  fornecedores?: Fornecedor[];
  initialPlaceholderValues?: Record<string, string>;
  onEmpresaSelect?: (empresaId: string) => void;
  onAssociadoSelect?: (associadoId: string) => void;
  onAtendimentoSelect?: (atendimentoId: string) => void;
  onPlanoSelect?: (planoId: string) => void;
  onCredenciadoSelect?: (credenciadoId: string) => void;
  onFornecedorSelect?: (fornecedorId: string) => void;
  customTitle?: string;
  /** Quando informado, habilita o modo de posicionamento livre (drag-and-drop) da assinatura da empresa e persiste a escolha através deste callback. */
  onSaveAssinaturaConfig?: (config: AssinaturaConfig | null) => void;
  /** Persiste a orientação do papel escolhida na barra de ferramentas. */
  onSaveOrientacao?: (orientacao: OrientacaoPapel) => void;
}

import { useVisualizadorDocumento } from '../../hooks/useVisualizadorDocumento';

/**
 * Visualizador de documento padrão.
 *
 * Este arquivo **monta**: a moldura do modal, a barra lateral e as quatro peças
 * (`Toolbar`, `Seletores`, `Variaveis`, `Folha`). O estado inteiro vive em
 * `hooks/useVisualizadorDocumento.ts` — não espere mais encontrar lógica aqui.
 */
export const VisualizadorDocumentoPadraoModal: React.FC<VisualizadorDocumentoPadraoModalProps> = (props) => {
  // Fora daqui, de propósito: `empresas`, `associados`, `atendimentos`, `planos`, `credenciados`, `fornecedores`.
  // No monolito o `useState` do corpo SOMBREAVA a prop de mesmo nome — a prop era o dado
  // inicial e o estado o carregado —, e é a versão do hook que vale.
  const {
    isOpen,
    onClose,
    documento,
    customTitle,
    onSaveAssinaturaConfig,
    } = props;

  const {
    alturaUtilFolhaMm,
    areaAssinaturaRef,
    assinaturaConfig,
    associados,
    atendimentos,
    credenciados,
    currentEmpresa,
    empresas,
    escalaPxPorMm,
    fornecedores,
    handleAssinaturaDragResizeStop,
    handleAssociadoChange,
    handleAtendimentoChange,
    handleCredenciadoChange,
    handleDependenteChange,
    handleEmpresaChange,
    handleExportPDF,
    handleFornecedorChange,
    handleImprimir,
    handleIniciarPosicionamentoAssinatura,
    handleParcelaReceberChange,
    handlePlanoChange,
    handleReceitaChange,
    handleRemoverPosicaoPersonalizada,
    handleRequisicaoChange,
    handleResetSelections,
    handleSalvarPosicaoAssinatura,
    handleTrocarOrientacao,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    isExportingPDF,
    isPosicionandoAssinatura,
    margens,
    modulosDetectados,
    openSections,
    orientation,
    parcelasReceber,
    placeholderValues,
    planos,
    preenchidasVars,
    printAreaRef,
    receitas,
    renderedHtml,
    requisicoes,
    searchVar,
    selectedAssociadoId,
    selectedAtendimentoId,
    selectedCredenciadoId,
    selectedDependenteId,
    selectedEmpresaId,
    selectedFornecedorId,
    selectedParcelaReceberId,
    selectedPlanoId,
    selectedReceitaId,
    selectedRequisicaoId,
    setPlaceholderValues,
    setSearchVar,
    setShowSidebar,
    showSidebar,
    toggleSection,
    totalVars,
    variaveisDoDocumento,
    zoom,
  } = useVisualizadorDocumento(props);

  if (!isOpen || !documento) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#1e232a] text-slate-100 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      {/* ─── TOOLBAR SUPERIOR DO VISUALIZADOR PROFISSIONAL ─── */}
      <VisualizadorDocumentoToolbar assinaturaConfig={assinaturaConfig} customTitle={customTitle} documento={documento} handleExportPDF={handleExportPDF} handleImprimir={handleImprimir} handleIniciarPosicionamentoAssinatura={handleIniciarPosicionamentoAssinatura} handleRemoverPosicaoPersonalizada={handleRemoverPosicaoPersonalizada} handleSalvarPosicaoAssinatura={handleSalvarPosicaoAssinatura} handleTrocarOrientacao={handleTrocarOrientacao} handleZoomIn={handleZoomIn} handleZoomOut={handleZoomOut} handleZoomReset={handleZoomReset} isExportingPDF={isExportingPDF} isPosicionandoAssinatura={isPosicionandoAssinatura} onClose={onClose} onSaveAssinaturaConfig={onSaveAssinaturaConfig} orientation={orientation} preenchidasVars={preenchidasVars} setShowSidebar={setShowSidebar} showSidebar={showSidebar} totalVars={totalVars} zoom={zoom} />

      {/* ─── CORPO PRINCIPAL: SIDEBAR MULTI-MÓDULO + ÁREA DE TRABALHO ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* SIDEBAR DE INSERÇÃO AUTOMÁTICA E VARIÁVEIS */}
        {showSidebar && (
          <aside className="w-80 lg:w-[410px] bg-[#13171f] border-r border-[#2d3544] flex flex-col shrink-0 z-20 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Header da Sidebar */}
            <div className="p-4 border-b border-[#2d3544] bg-[#181d27]">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                  Inserção Automática de Dados
                </h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {variaveisDoDocumento.length} variáveis
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Selecione os registros dos módulos abaixo para preenchimento imediato.
              </p>
            </div>

            {/* Conteúdo Rolável da Sidebar */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              <VisualizadorDocumentoSeletores associados={associados} atendimentos={atendimentos} credenciados={credenciados} currentEmpresa={currentEmpresa} empresas={empresas} fornecedores={fornecedores} handleAssociadoChange={handleAssociadoChange} handleAtendimentoChange={handleAtendimentoChange} handleCredenciadoChange={handleCredenciadoChange} handleDependenteChange={handleDependenteChange} handleEmpresaChange={handleEmpresaChange} handleFornecedorChange={handleFornecedorChange} handleParcelaReceberChange={handleParcelaReceberChange} handlePlanoChange={handlePlanoChange} handleReceitaChange={handleReceitaChange} handleRequisicaoChange={handleRequisicaoChange} handleResetSelections={handleResetSelections} modulosDetectados={modulosDetectados} openSections={openSections} parcelasReceber={parcelasReceber} planos={planos} receitas={receitas} requisicoes={requisicoes} selectedAssociadoId={selectedAssociadoId} selectedAtendimentoId={selectedAtendimentoId} selectedCredenciadoId={selectedCredenciadoId} selectedDependenteId={selectedDependenteId} selectedEmpresaId={selectedEmpresaId} selectedFornecedorId={selectedFornecedorId} selectedParcelaReceberId={selectedParcelaReceberId} selectedPlanoId={selectedPlanoId} selectedReceitaId={selectedReceitaId} selectedRequisicaoId={selectedRequisicaoId} toggleSection={toggleSection} />

              <VisualizadorDocumentoVariaveis documento={documento} placeholderValues={placeholderValues} preenchidasVars={preenchidasVars} searchVar={searchVar} setPlaceholderValues={setPlaceholderValues} setSearchVar={setSearchVar} totalVars={totalVars} variaveisDoDocumento={variaveisDoDocumento} />
            </div>

            {/* Rodapé da Sidebar */}
            <div className="p-3 border-t border-[#2d3544] bg-[#181d27] flex items-center justify-between text-xs text-slate-400">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setPlaceholderValues((prev) => ({
                    ...prev,
                    '{{data_atual}}': formatLocalDate(now),
                    '{{hora_atual}}': now.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                    '{{data_hora_atual}}': `${formatLocalDate(now)} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
                    '{{ano_atual}}': now.getFullYear().toString(),
                  }));
                  toast.success('Datas e horas atualizadas!');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#13171f] hover:bg-[#232936] text-slate-300 rounded-lg text-xs transition-colors border border-[#2d3544]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar Datas
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Deseja limpar todos os campos de variáveis preenchidos?')) {
                    const emptyVals: Record<string, string> = {};
                    Object.keys(placeholderValues).forEach((k) => {
                      emptyVals[k] = '';
                    });
                    setPlaceholderValues(emptyVals);
                    handleResetSelections();
                    toast.success('Campos limpos!');
                  }
                }}
                className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
              >
                Limpar Campos
              </button>
            </div>
          </aside>
        )}

        {/* ─── ÁREA DE TRABALHO CENTRALIZADA (A4 SHEET PREVIEW) ─── */}
        <VisualizadorDocumentoFolha alturaUtilFolhaMm={alturaUtilFolhaMm} areaAssinaturaRef={areaAssinaturaRef} assinaturaConfig={assinaturaConfig} currentEmpresa={currentEmpresa} documento={documento} escalaPxPorMm={escalaPxPorMm} handleAssinaturaDragResizeStop={handleAssinaturaDragResizeStop} isPosicionandoAssinatura={isPosicionandoAssinatura} margens={margens} orientation={orientation} printAreaRef={printAreaRef} renderedHtml={renderedHtml} zoom={zoom} />
      </div>
    </div>
  );
};
