import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Printer,
  FileText,
  AlertTriangle,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { DocumentoAssociado } from '../../services/associadosService';
import {
  isPdfDocument,
  isImageDocument,
  getSafeDocumentUrl,
  downloadDocumento,
  openDocumentoInNewTab,
} from '../../utils/documentUtils';
import { useToast } from '../../context/ToastContext';

interface Props {
  documento: DocumentoAssociado | null;
  onClose: () => void;
}

export const VisualizadorDocumentoModal: React.FC<Props> = ({ documento, onClose }) => {
  const toast = useToast();
  const [safeUrl, setSafeUrl] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLegacyBlob, setIsLegacyBlob] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!documento) {
      setSafeUrl('');
      setHasError(false);
      setIsLegacyBlob(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasError(false);
    setZoom(100);
    setRotation(0);

    // Se for URL blob legada
    if (documento.url.startsWith('blob:')) {
      setIsLegacyBlob(true);
      fetch(documento.url)
        .then((res) => {
          if (!res.ok) throw new Error('Blob indisponível');
          return res.blob();
        })
        .then((blob) => {
          const fresh = URL.createObjectURL(blob);
          setSafeUrl(fresh);
          setIsLegacyBlob(false);
          setLoading(false);
        })
        .catch(() => {
          setHasError(true);
          setLoading(false);
        });
      return;
    }

    try {
      const url = getSafeDocumentUrl(documento.url, documento.tipo);
      setSafeUrl(url);
      setLoading(false);
    } catch (e) {
      console.error('Erro ao processar URL do documento:', e);
      setHasError(true);
      setLoading(false);
    }

    return () => {
      // Limpeza de blob URL criado dinamicamente
      if (safeUrl && safeUrl.startsWith('blob:') && !documento.url.startsWith('blob:')) {
        URL.revokeObjectURL(safeUrl);
      }
    };
  }, [documento]);

  if (!documento) return null;

  const isPdf = isPdfDocument(documento);
  const isImg = isImageDocument(documento);

  const handleDownload = async () => {
    const success = await downloadDocumento(documento);
    if (!success) {
      toast.error('Não foi possível baixar este arquivo.');
    } else {
      toast.success('Download iniciado com sucesso!');
    }
  };

  const handleOpenNewTab = async () => {
    const success = await openDocumentoInNewTab(documento);
    if (!success) {
      toast.error('Não foi possível abrir o arquivo em nova aba.');
    }
  };

  const handlePrint = () => {
    if (isPdf && safeUrl) {
      const printWindow = window.open(safeUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      }
    } else if (isImg && safeUrl) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>${documento.nome}</title></head>
            <body style="margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh;">
              <img src="${safeUrl}" style="max-width:100%; max-height:100vh;" onload="window.print(); window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } else {
      window.print();
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Tamanho desconhecido';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-bg-base border border-border-default rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-default bg-bg-surface shrink-0">
          <div className="flex items-center gap-3 overflow-hidden pr-4">
            <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center shrink-0 text-[#3B82F6]">
              {isPdf ? (
                <FileText className="w-5 h-5 text-rose-400" />
              ) : isImg ? (
                <ImageIcon className="w-5 h-5 text-indigo-400" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="overflow-hidden">
              <h3
                className="font-semibold text-text-base text-sm sm:text-base truncate"
                title={documento.nome}
              >
                {documento.nome}
              </h3>
              <p className="text-xs text-text-subtle flex items-center gap-2">
                <span>{formatFileSize(documento.tamanho)}</span>
                {documento.data_upload && (
                  <>
                    <span>•</span>
                    <span>
                      Anexado em {new Date(documento.data_upload).toLocaleDateString('pt-BR')}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isImg && !hasError && (
              <div className="hidden sm:flex items-center bg-bg-subtle rounded-xl p-1 border border-border-default mr-2">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(prev - 25, 25))}
                  title="Diminuir zoom"
                  className="p-1.5 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-lg transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-text-muted px-2 min-w-[45px] text-center font-mono">
                  {zoom}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(prev + 25, 300))}
                  title="Aumentar zoom"
                  className="p-1.5 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-lg transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  title="Girar 90°"
                  className="p-1.5 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-lg transition-colors ml-1 border-l border-border-default"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}

            {!hasError && (
              <>
                <button
                  type="button"
                  onClick={handlePrint}
                  title="Imprimir"
                  className="p-2 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl transition-colors"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  title="Abrir em Nova Aba"
                  className="p-2 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  title="Baixar Arquivo"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Baixar</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl transition-colors ml-1"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BODY / VIEWER */}
        <div className="flex-1 bg-black/40 relative overflow-auto flex items-center justify-center p-2 sm:p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-text-subtle">
              <div className="w-8 h-8 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm">Carregando visualização do documento...</p>
            </div>
          ) : hasError || (isLegacyBlob && !safeUrl) ? (
            <div className="max-w-md p-6 bg-bg-surface border border-rose-500/30 rounded-2xl text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-bold text-text-base text-base">Arquivo Inacessível</h4>
                <p className="text-xs text-text-subtle leading-relaxed">
                  {isLegacyBlob
                    ? 'Este arquivo foi anexado em formato temporário na versão anterior do sistema e sua sessão de memória expirou. Para torná-lo acessível permanentemente, favor reenviar o arquivo.'
                    : 'Não foi possível carregar o conteúdo deste documento.'}
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-bg-hover hover:bg-bg-hover/80 text-text-base text-xs font-semibold rounded-xl transition-colors"
                >
                  Fechar Visualizador
                </button>
              </div>
            </div>
          ) : isPdf ? (
            <iframe
              src={`${safeUrl}#toolbar=1`}
              title={documento.nome}
              className="w-full h-full rounded-xl bg-white shadow-lg border border-border-default"
            />
          ) : isImg ? (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
              <img
                src={safeUrl}
                alt={documento.nome}
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
              />
            </div>
          ) : (
            <div className="max-w-md p-6 bg-bg-surface border border-border-default rounded-2xl text-center space-y-4">
              <FileText className="w-12 h-12 text-text-subtle mx-auto" />
              <div className="space-y-1">
                <h4 className="font-bold text-text-base text-base">{documento.nome}</h4>
                <p className="text-xs text-text-subtle">
                  Pré-visualização direta não disponível para este tipo de arquivo.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
              >
                <Download className="w-4 h-4" />
                Baixar Arquivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
