import React from 'react';
import { uploadDocumentoAssociado } from '../../services/associadosService';
import { downloadDocumento, isImageDocument, isPdfDocument } from '../../utils/documentUtils';
import { ContratoDocumentosGenerator } from './ContratoDocumentosGenerator';
import { AlertTriangle, Download, Eye, FileText, ImageIcon, Trash2, UploadCloud } from 'lucide-react';

interface Props {
  editingAssociado: any;
  isDraggingDoc: any;
  isUploadingDoc: any;
  setDocumentoVisualizando: any;
  setEditingAssociado: any;
  setIsDraggingDoc: any;
  setIsUploadingDoc: any;
  state: any;
  toast: any;
  valorPlanoAtivo: any;
}

/**
 * A aba de documentos: upload com arrastar-e-soltar, a lista de anexos e o gerador de
 * documentos do contrato.
 *
 * Cada anexo é guardado como **data URI em base64** dentro de `associado.documentos[]` — é
 * daí que vinham os 28 MB de `auditoria.detalhes` que o CLAUDE.md documenta. O enxugamento
 * mora em `utils/detalhesAuditoria.ts`, no funil da auditoria, não aqui.
 */
export const AssociadoDocumentosTab: React.FC<Props> = ({ editingAssociado, isDraggingDoc, isUploadingDoc, setDocumentoVisualizando, setEditingAssociado, setIsDraggingDoc, setIsUploadingDoc, state, toast, valorPlanoAtivo }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border-default pb-4">
        <div>
          <h4 className="text-text-base font-semibold text-base">
            Documentos do Associado
          </h4>
          <p className="text-xs text-text-subtle mt-0.5">
            Gere modelos de documentos ou anexe contratos assinados, documentos pessoais e comprovantes.
          </p>
        </div>
      </div>

      <div className="bg-bg-subtle p-6 rounded-2xl border border-border-default/50 mb-6">
        <ContratoDocumentosGenerator associado={editingAssociado} valorMensalidade={valorPlanoAtivo} />
      </div>

      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingDoc(true);
          }}
          onDragLeave={() => setIsDraggingDoc(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setIsDraggingDoc(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              try {
                setIsUploadingDoc(true);
                const novoDoc = await uploadDocumentoAssociado(file, editingAssociado.id, state.isOnline);
                setEditingAssociado({
                  ...editingAssociado,
                  documentos: [
                    ...(editingAssociado.documentos || []),
                    novoDoc,
                  ],
                });
                toast.success("Documento anexado com sucesso!");
              } catch (err: any) {
                toast.error(err.message || "Falha ao anexar documento.");
              } finally {
                setIsUploadingDoc(false);
              }
            }
          }}
          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${
            isDraggingDoc 
              ? 'border-[#3B82F6] bg-[#3B82F6]/10 scale-[1.01]' 
              : 'border-border-default hover:border-[#3B82F6]/50 bg-bg-surface/50'
          }`}
        >
          <input
            type="file"
            id="upload-doc"
            className="hidden"
            accept=".pdf,image/*"
            disabled={isUploadingDoc}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  setIsUploadingDoc(true);
                  const novoDoc = await uploadDocumentoAssociado(file, editingAssociado.id, state.isOnline);
                  setEditingAssociado({
                    ...editingAssociado,
                    documentos: [
                      ...(editingAssociado.documentos || []),
                      novoDoc,
                    ],
                  });
                  toast.success("Documento anexado com sucesso!");
                } catch (err: any) {
                  toast.error(err.message || "Falha ao anexar documento.");
                } finally {
                  setIsUploadingDoc(false);
                  e.target.value = "";
                }
              }
            }}
          />
          <label
            htmlFor="upload-doc"
            className="cursor-pointer flex flex-col items-center group w-full"
          >
            <div className="w-14 h-14 bg-bg-hover group-hover:bg-[#3B82F6]/10 rounded-2xl flex items-center justify-center mb-3 transition-colors">
              {isUploadingDoc ? (
                <div className="w-6 h-6 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <UploadCloud className="w-7 h-7 text-[#3B82F6] group-hover:scale-110 transition-transform" />
              )}
            </div>
            <p className="text-sm font-semibold text-text-base mb-1 text-center">
              {isUploadingDoc ? "Processando e anexando arquivo..." : "Clique para enviar ou arraste um documento aqui"}
            </p>
            <p className="text-xs text-text-subtle text-center">
              Suporta PDF, JPG, PNG e WebP (máx. 10MB)
            </p>
          </label>
        </div>

        {editingAssociado.documentos &&
          editingAssociado.documentos.length > 0 && (
            <div className="space-y-3 mt-6">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-semibold text-text-subtle flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#3B82F6]" />
                  <span>Arquivos Salvos ({editingAssociado.documentos.length})</span>
                </h5>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {editingAssociado.documentos.map((doc: any, idx: number) => {
                  const isPdf = isPdfDocument(doc);
                  const isImg = isImageDocument(doc);
                  const isLegacyBlob = doc.url && doc.url.startsWith("blob:");

                  return (
                    <div
                      key={doc.id || idx}
                      className="flex items-center justify-between p-3.5 bg-bg-surface hover:bg-bg-subtle/80 border border-border-default rounded-xl transition-all group"
                    >
                      <div 
                        onClick={() => setDocumentoVisualizando(doc)}
                        className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1 mr-2"
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                          isPdf 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                            : isImg 
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                            : 'bg-bg-subtle text-text-subtle border border-border-default'
                        }`}>
                          {isPdf ? (
                            <FileText className="w-5 h-5" />
                          ) : isImg ? (
                            <ImageIcon className="w-5 h-5" />
                          ) : (
                            <span className="uppercase">{doc.nome.split(".").pop()?.substring(0, 3)}</span>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm text-text-base font-medium truncate group-hover:text-[#3B82F6] transition-colors" title={doc.nome}>
                            {doc.nome}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-text-subtle">
                              {doc.tamanho ? `${(doc.tamanho / 1024).toFixed(1)} KB` : 'Anexo'}
                              {doc.data_upload && (
                                <> • {new Date(doc.data_upload).toLocaleDateString("pt-BR")}</>
                              )}
                            </p>
                            {isLegacyBlob && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium" title="Arquivo anexado em sessão anterior. Reenvie para visualização permanente.">
                                <AlertTriangle className="w-2.5 h-2.5" /> Reenvio sugerido
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDocumentoVisualizando(doc)}
                          title="Visualizar documento"
                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-bg-hover rounded-xl transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const success = await downloadDocumento(doc);
                            if (!success) toast.error("Não foi possível baixar este arquivo.");
                            else toast.success("Download iniciado!");
                          }}
                          title="Baixar arquivo"
                          className="p-2 text-text-subtle hover:text-emerald-400 hover:bg-bg-hover rounded-xl transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const novosDocs = [
                              ...editingAssociado.documentos!,
                            ];
                            novosDocs.splice(idx, 1);
                            setEditingAssociado({
                              ...editingAssociado,
                              documentos: novosDocs,
                            });
                            toast.success("Documento removido da lista.");
                          }}
                          title="Excluir anexo"
                          className="p-2 text-text-subtle hover:text-rose-500 hover:bg-bg-hover rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};
