import React from 'react';
import { TipoDocumento } from '../../types/documentos';
import { Check, Download, FileText, Move, Printer, RotateCw, SlidersHorizontal, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';


const TIPO_LABELS: Record<TipoDocumento, string> = {
  contrato_adesao: 'Contrato de Adesão',
  termo_rescisao: 'Termo de Rescisão',
  termo_credenciamento: 'Termo de Credenciamento',
  aditivo: 'Aditivo/Atualização',
  outro: 'Outro',
};

interface Props {
  assinaturaConfig: any;
  customTitle: any;
  documento: any;
  handleExportPDF: any;
  handleImprimir: any;
  handleIniciarPosicionamentoAssinatura: any;
  handleRemoverPosicaoPersonalizada: any;
  handleSalvarPosicaoAssinatura: any;
  handleTrocarOrientacao: any;
  handleZoomIn: any;
  handleZoomOut: any;
  handleZoomReset: any;
  isExportingPDF: any;
  isPosicionandoAssinatura: any;
  onClose: any;
  onSaveAssinaturaConfig: any;
  orientation: any;
  preenchidasVars: any;
  setShowSidebar: any;
  showSidebar: any;
  totalVars: any;
  zoom: any;
}

export const VisualizadorDocumentoToolbar: React.FC<Props> = ({ assinaturaConfig, customTitle, documento, handleExportPDF, handleImprimir, handleIniciarPosicionamentoAssinatura, handleRemoverPosicaoPersonalizada, handleSalvarPosicaoAssinatura, handleTrocarOrientacao, handleZoomIn, handleZoomOut, handleZoomReset, isExportingPDF, isPosicionandoAssinatura, onClose, onSaveAssinaturaConfig, orientation, preenchidasVars, setShowSidebar, showSidebar, totalVars, zoom }) => {
  return (
    <>
    <header className="h-16 bg-[#13171f] border-b border-[#2d3544] px-4 sm:px-6 flex items-center justify-between shadow-xl shrink-0 z-30">
      {/* Lado Esquerdo: Identificação do Documento */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className="text-sm sm:text-base font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md"
              title={documento.nome}
            >
              {customTitle || documento.nome}
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
              {TIPO_LABELS[documento.tipo as TipoDocumento] || documento.tipo}
            </span>
            <span
              className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border shrink-0 ${
                documento.ativo
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-700/50 text-slate-400 border-slate-600'
              }`}
            >
              {documento.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            Visualizador Interativo • {preenchidasVars} de {totalVars} variáveis preenchidas
          </p>
        </div>
      </div>

      {/* Centro: Controles de Orientação, Zoom e Sidebar */}
      <div className="hidden md:flex items-center gap-3 bg-[#181d27] px-3 py-1.5 rounded-xl border border-[#2d3544]">
        <button
          type="button"
          onClick={() => setShowSidebar(!showSidebar)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
            showSidebar
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
          title={showSidebar ? 'Ocultar Painel Lateral' : 'Exibir Painel Lateral'}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Painel de Dados</span>
        </button>

        <div className="h-4 w-px bg-[#2d3544]" />

        {/* Seletor de Orientação */}
        <div className="flex items-center gap-1 bg-[#13171f] p-0.5 rounded-lg border border-[#2d3544]">
          <button
            type="button"
            onClick={() => handleTrocarOrientacao('portrait')}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-all ${
              orientation === 'portrait'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Modo Retrato (Vertical - A4 210x297mm)"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Retrato</span>
          </button>
          <button
            type="button"
            onClick={() => handleTrocarOrientacao('landscape')}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md transition-all ${
              orientation === 'landscape'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Modo Paisagem (Horizontal - A4 297x210mm)"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Paisagem</span>
          </button>
        </div>

        <div className="h-4 w-px bg-[#2d3544]" />

        {/* Controles de Zoom */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544] transition-colors"
            title="Reduzir Zoom (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleZoomReset}
            className="px-2 py-1 text-xs font-bold text-slate-200 hover:bg-[#2d3544] rounded-lg transition-colors min-w-[48px] text-center"
            title="Resetar para 100%"
          >
            {zoom}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544] transition-colors"
            title="Ampliar Zoom (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {onSaveAssinaturaConfig && (
          <>
            <div className="h-4 w-px bg-[#2d3544]" />
            {!isPosicionandoAssinatura ? (
              <button
                type="button"
                onClick={handleIniciarPosicionamentoAssinatura}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544] transition-colors"
                title="Escolher livremente onde a assinatura da empresa aparece no documento"
              >
                <Move className="w-3.5 h-3.5 text-fuchsia-400" />
                <span className="hidden md:inline">Posicionar Assinatura</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="hidden md:inline text-[10px] text-fuchsia-300 font-semibold">
                  Arraste/redimensione a assinatura na folha
                </span>
                {assinaturaConfig && (
                  <button
                    type="button"
                    onClick={handleRemoverPosicaoPersonalizada}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-300 hover:bg-[#2d3544] transition-colors"
                    title="Remover posicionamento personalizado (voltar ao rodapé padrão)"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSalvarPosicaoAssinatura}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-xs font-bold transition-colors"
                  title="Concluir e salvar a posição da assinatura"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Concluir</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lado Direito: Ações (Salvar PDF, Imprimir, Fechar) */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={handleExportPDF}
          disabled={isExportingPDF || isPosicionandoAssinatura}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20 active:scale-95"
          title={
            isPosicionandoAssinatura
              ? 'Conclua o posicionamento da assinatura antes de exportar'
              : 'Baixar arquivo PDF diretamente'
          }
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Salvar PDF</span>
        </button>

        <button
          type="button"
          onClick={handleImprimir}
          disabled={isPosicionandoAssinatura}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/20 active:scale-95"
          title={
            isPosicionandoAssinatura
              ? 'Conclua o posicionamento da assinatura antes de imprimir'
              : 'Abrir impressão limpa nativa / Salvar como PDF'
          }
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Imprimir</span>
        </button>

        <div className="h-6 w-px bg-[#2d3544]" />

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2d3544] transition-colors"
          title="Fechar Visualizador (ESC)"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </header>
    </>
  );
};
