import React, { useMemo } from 'react';
import { Layers, Plus, FileText } from 'lucide-react';
import { MargensConfig } from './DocumentoMargensModal';
import { sanitizeDocumentoHtml } from '../../utils/sanitizeHtml';
import { alturaPapelMm, larguraPapelMm } from '../../utils/assinaturaPosicao';
import { OrientacaoPapel } from '../../types/documentos';

export interface DocumentoMiniaturasPreviewProps {
  htmlContent: string;
  margens: MargensConfig;
  orientacao?: OrientacaoPapel;
  onInsertPageBreak?: () => void;
  onSelectPage?: (pageIndex: number) => void;
}

const PX_POR_MM = 96 / 25.4;
/** Largura da miniatura na coluna lateral, em px (equivale ao antigo `w-48`). */
const LARGURA_MINIATURA_PX = 192;

export const DocumentoMiniaturasPreview: React.FC<DocumentoMiniaturasPreviewProps> = ({
  htmlContent,
  margens,
  orientacao = 'retrato',
  onInsertPageBreak,
  onSelectPage
}) => {
  // A miniatura acompanha a orientação do documento: em vez de escala fixa, a folha
  // é reduzida até caber na largura da coluna, e a altura sai da proporção do papel.
  const larguraFolhaMm = larguraPapelMm(orientacao);
  const alturaFolhaMm = alturaPapelMm(orientacao);
  const escala = LARGURA_MINIATURA_PX / (larguraFolhaMm * PX_POR_MM);
  const alturaMiniaturaPx = Math.round(alturaFolhaMm * PX_POR_MM * escala);

  // Separa o conteúdo em páginas através das tags de quebra de página
  const paginas = useMemo(() => {
    if (!htmlContent || !htmlContent.trim()) {
      return ['<p style="color: #94a3b8; font-style: italic; text-align: center; margin-top: 40px;">Página 1 (Vazia)</p>'];
    }

    // Procura divisores de página por classes ou estilo
    const regexQuebra = /<div[^>]*class=["'][^"']*page-break[^"']*["'][^>]*>.*?<\/div>|<hr[^>]*class=["'][^"']*page-break[^"']*["'][^>]*\/?>|<div[^>]*style=["'][^"']*page-break-after:\s*always[^"']*["'][^>]*>.*?<\/div>/gi;
    
    const partes = htmlContent.split(regexQuebra).filter(p => p.trim().length > 0);
    
    if (partes.length > 0) {
      return partes;
    }

    return [htmlContent];
  }, [htmlContent]);

  return (
    <div className="w-64 xl:w-72 shrink-0 bg-[#13171f] border-l border-[#2d3544] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-[#2d3544] flex items-center justify-between bg-[#181d27]/70 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Miniaturas ({paginas.length} {paginas.length === 1 ? 'Pág.' : 'Págs.'})
          </span>
        </div>

        {onInsertPageBreak && (
          <button
            type="button"
            onClick={onInsertPageBreak}
            title="Inserir quebra para criar nova página"
            className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white rounded-lg text-[10px] font-bold border border-blue-500/30 transition-all flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Quebra
          </button>
        )}
      </div>

      {/* Lista de Miniaturas em Scroll */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar bg-[#0f1219]">
        {paginas.map((paginaHtml, index) => (
          <div
            key={index}
            onClick={() => onSelectPage?.(index)}
            className="flex flex-col items-center group cursor-pointer"
          >
            {/* Tag da página */}
            <div
              className="flex items-center justify-between mb-1.5 px-1"
              style={{ width: LARGURA_MINIATURA_PX }}
            >
              <span className="text-[11px] font-bold text-slate-400 group-hover:text-blue-400 transition-colors flex items-center gap-1">
                <FileText className="w-3 h-3 text-blue-400" />
                Página {index + 1}
              </span>
              <span className="text-[9px] text-slate-500 bg-[#1e2533] px-1.5 py-0.5 rounded border border-[#2d3544]">
                A4 {larguraFolhaMm}×{alturaFolhaMm}
              </span>
            </div>

            {/* Folha A4 em Miniatura */}
            <div
              className="bg-white rounded-xl shadow-xl border border-slate-300 group-hover:border-blue-500 group-hover:ring-2 group-hover:ring-blue-500/40 transition-all overflow-hidden relative select-none"
              style={{ width: LARGURA_MINIATURA_PX, height: alturaMiniaturaPx }}
            >
              {/* Conteúdo escalado */}
              <div
                className="origin-top-left pointer-events-none text-slate-900 leading-normal"
                style={{
                  width: `${larguraFolhaMm}mm`,
                  minHeight: `${alturaFolhaMm}mm`,
                  transform: `scale(${escala})`,
                  transformOrigin: '0 0',
                  padding: `${margens.top}mm ${margens.right}mm ${margens.bottom}mm ${margens.left}mm`,
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '11pt',
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeDocumentoHtml(paginaHtml) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
