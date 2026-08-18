import React, { useState, useEffect } from 'react';
import { useDocumentosPadroes } from '../../hooks/useDocumentosPadroes';
import { FileText, Printer, X } from 'lucide-react';
import { Associado } from '../../services/associadosService';
import { DocumentoPadrao } from '../../types/documentos';
import { getEmpresaById, Empresa } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';
import { formatLocalDate } from '../../utils/dateUtils';

interface Props {
  associado: Associado;
  valorMensalidade: number;
}

export const ContratoDocumentosGenerator: React.FC<Props> = ({ associado, valorMensalidade }) => {
  const { state: { isOnline, empresaSelecionada } } = useAppContext();
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);
  const { documentos, loading } = useDocumentosPadroes();
  const [selectedDoc, setSelectedDoc] = useState<string>('');
  const [docToPrint, setDocToPrint] = useState<DocumentoPadrao | null>(null);

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const handleGenerate = () => {
    const doc = documentos.find(d => d.id === selectedDoc);
    if (!doc) return;

    const dataAtual = new Date();

    const vars: Record<string, string> = {
      '{{associado_nome}}': associado.nome || '',
      '{{associado_cpf}}': associado.cpf || '',
      '{{associado_rg}}': associado.rg || '',
      '{{associado_telefone}}': associado.telefone || '',
      '{{associado_email}}': associado.email || '',
      '{{associado_endereco}}': `${associado.endereco_logradouro || ''}, ${associado.endereco_numero || ''} - ${associado.endereco_bairro || ''} - ${associado.endereco_cidade || ''} - ${associado.endereco_cep || ''}`,
      '{{plano_atual}}': associado.plano_nome || '',
      '{{plano_nome}}': associado.plano_nome || '',
      '{{valor_mensalidade}}': formatBRL(valorMensalidade),
      '{{data_adesao}}': formatLocalDate(associado.data_adesao, 'dd/MM/yyyy', ''),
      '{{numero_contrato}}': (associado as any).numero_contrato || (associado as any).numero_contrato_fisico || associado.id.substring(0, 8).toUpperCase(),
      '{{associado_dependentes}}': (associado.dependentes && associado.dependentes.length > 0) ? associado.dependentes.map(d => `${d.nome} - Parentesco: ${d.parentesco} - CPF: ${d.cpf || 'Não informado'}`).join('<br/>') : 'Nenhum dependente vinculado',
      '{{quantidade_dependentes}}': (associado.dependentes?.length || 0).toString(),
      '{{data_atual}}': formatLocalDate(dataAtual),
    };

    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [...(doc.conteudo || '').matchAll(regex)];
    const initialValues: Record<string, string> = {};
    matches.forEach(match => {
      initialValues[match[0]] = vars[match[0]] || '';
    });
    setPlaceholderValues(initialValues);

    setDocToPrint(doc);
  };

  useEffect(() => {
    if (docToPrint) {
      const fetchEmpresa = async () => {
        try {
          const tenantId = empresaSelecionada || 'default_tenant';
          const empresa = await getEmpresaById(tenantId, isOnline);
          
          if (empresa) {
            setEmpresaData(empresa);
            setPlaceholderValues(prev => {
              const newVals = { ...prev };
              if ('{{empresa_nome}}' in newVals && !newVals['{{empresa_nome}}']) newVals['{{empresa_nome}}'] = empresa.nome_fantasia || empresa.razao_social || '';
              if ('{{empresa_cnpj}}' in newVals && !newVals['{{empresa_cnpj}}']) newVals['{{empresa_cnpj}}'] = empresa.cnpj || '';
              if ('{{empresa_endereco}}' in newVals && !newVals['{{empresa_endereco}}']) newVals['{{empresa_endereco}}'] = `${empresa.endereco || ''}`;
              if ('{{empresa_telefone}}' in newVals && !newVals['{{empresa_telefone}}']) newVals['{{empresa_telefone}}'] = empresa.telefone || '';
              if ('{{empresa_email}}' in newVals && !newVals['{{empresa_email}}']) newVals['{{empresa_email}}'] = empresa.email || '';
              return newVals;
            });
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchEmpresa();
    }
  }, [docToPrint, empresaSelecionada, isOnline]);

  useEffect(() => {
    if (docToPrint) {
      document.body.classList.add('printing-doc');
    } else {
      document.body.classList.remove('printing-doc');
    }
    return () => document.body.classList.remove('printing-doc');
  }, [docToPrint]);

  const handlePrint = () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
          <head>
            <meta charset="utf-8" />
            <title>${docToPrint?.nome || 'Documento'}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 15mm 15mm 15mm 15mm;
              }
              *, *::before, *::after {
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                padding: 0;
                background-color: #ffffff;
                color: #000000;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 11pt;
                line-height: 1.5;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .doc-container {
                width: 100%;
                max-width: 100%;
                margin: 0 auto;
                background: #ffffff;
              }
              .doc-header {
                width: 100%;
                text-align: center;
                border-bottom: 2px solid #0f172a;
                padding-bottom: 12px;
                margin-bottom: 20px;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .doc-header img {
                max-height: 95px;
                width: 100%;
                object-fit: contain;
                display: block;
                margin: 0 auto;
              }
              .doc-content {
                width: 100%;
                page-break-inside: auto;
                break-inside: auto;
              }
              .doc-content p, 
              .doc-content div, 
              .doc-content h1, 
              .doc-content h2, 
              .doc-content h3, 
              .doc-content h4, 
              .doc-content table, 
              .doc-content ul, 
              .doc-content ol {
                page-break-inside: auto;
                break-inside: auto;
                margin-bottom: 10px;
              }
              .doc-footer {
                width: 100%;
                margin-top: 35px;
                padding-top: 15px;
                border-top: 1px solid #cbd5e1;
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                page-break-inside: avoid;
                break-inside: avoid;
              }
              .doc-footer img {
                max-height: 80px;
                max-width: 280px;
                object-fit: contain;
                margin-bottom: 5px;
              }
              .signature-line {
                width: 280px;
                border-top: 1px solid #0f172a;
                margin: 5px auto;
              }
              h1, h2, h3, h4 {
                color: #000000;
              }
              strong {
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="doc-container">
              ${printArea.innerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 350);
    } else {
      window.print();
    }
  };

  return (
    <div className="mt-6 p-5 bg-bg-surface border border-border-default rounded-xl">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          body.printing-doc {
            overflow: visible !important;
            background: #ffffff !important;
          }
          body.printing-doc * {
            visibility: visible !important;
          }
          body.printing-doc nav,
          body.printing-doc header,
          body.printing-doc aside,
          body.printing-doc .print\\:hidden,
          body.printing-doc [class*="print:hidden"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
          }
          body.printing-doc .fixed.inset-0 {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            width: 100% !important;
            height: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          body.printing-doc .flex-1.overflow-y-auto {
            position: static !important;
            display: block !important;
            overflow: visible !important;
            width: 100% !important;
            height: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          body.printing-doc #print-area {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          body.printing-doc #print-area .doc-header {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 20px !important;
          }
          body.printing-doc #print-area .doc-footer {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-top: 30px !important;
          }
          body.printing-doc #print-area .prose {
            font-size: 11pt !important;
            line-height: 1.5 !important;
            color: #000000 !important;
            max-width: 100% !important;
            overflow: visible !important;
          }
          body.printing-doc #print-area .prose p,
          body.printing-doc #print-area .prose div,
          body.printing-doc #print-area .prose table,
          body.printing-doc #print-area .prose h1,
          body.printing-doc #print-area .prose h2,
          body.printing-doc #print-area .prose h3 {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
        }
      `}</style>
      <h4 className="text-sm font-semibold text-text-subtle mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4" /> Geração de Documentos
      </h4>
      <div className="flex flex-col sm:flex-row gap-4">
        <select 
          className="flex-1 px-4 py-2 bg-bg-subtle border border-border-default rounded-xl text-sm text-text-base focus:border-[#3B82F6] outline-none"
          value={selectedDoc}
          onChange={e => setSelectedDoc(e.target.value)}
        >
          <option value="">Selecione um modelo de documento...</option>
          {documentos.filter(d => d.ativo).map(doc => (
            <option key={doc.id} value={doc.id}>{doc.nome} - {doc.tipo.replace('_', ' ').toUpperCase()}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedDoc}
          onClick={handleGenerate}
          className="px-4 py-2 bg-[#3B82F6] text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2 justify-center"
        >
          <FileText className="w-4 h-4" />
          Visualizar e Imprimir
        </button>
      </div>

      {docToPrint && (
        <div className="fixed inset-0 z-[100] bg-white flex overflow-hidden print:static print:block print:overflow-visible">
          <div className="w-80 bg-bg-surface border-r border-border-default flex flex-col print:hidden h-full">
            <div className="p-6 border-b border-border-default bg-[#1A1D36]">
              <h3 className="font-bold text-lg text-text-base mb-1">{docToPrint.nome}</h3>
              <p className="text-sm text-[#3B82F6]">Preencha as variáveis do documento</p>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar bg-bg-base">
                {Object.keys(placeholderValues).length > 0 ? (
                  Object.keys(placeholderValues).map(variable => (
                    <div key={variable}>
                      <label className="block text-xs font-semibold text-text-subtle mb-1.5 uppercase tracking-wider">{variable.replace(/[{}]/g, '').replace(/_/g, ' ')}</label>
                      <input 
                        type="text"
                        value={placeholderValues[variable]}
                        onChange={(e) => setPlaceholderValues(prev => ({ ...prev, [variable]: e.target.value }))}
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base text-sm focus:border-[#3B82F6] outline-none transition-colors"
                        placeholder="Valor..."
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-text-muted">Nenhuma variável encontrada neste documento.</p>
                  </div>
                )}
            </div>
            <div className="p-6 border-t border-border-default bg-bg-surface space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
              <button 
                type="button"
                onClick={handlePrint}
                className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]"
              >
                <Printer className="w-5 h-5" />
                Imprimir Documento
              </button>
              <button 
                type="button"
                onClick={() => setDocToPrint(null)}
                className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-bg-hover hover:bg-[#323654] text-text-base rounded-xl transition-colors font-medium active:scale-[0.98]"
              >
                <X className="w-5 h-5" />
                Voltar
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#0F1123] flex justify-center p-8 print:p-0 print:bg-white custom-scrollbar">
            <div id="print-area" className="a4-simulated shadow-2xl relative flex flex-col justify-between p-10 lg:p-14 min-h-[1056px] bg-white text-black print:min-h-0 print:p-0 print:shadow-none print:border-none">
              <div>
                {/* Cabeçalho com Logotipo alinhado às margens */}
                {empresaData?.logo_url ? (
                  <div className="doc-header w-full pb-4 mb-6 border-b-2 border-slate-900 flex items-center justify-center text-center">
                    <img 
                      src={empresaData.logo_url} 
                      alt={empresaData.nome_fantasia || "Logotipo"} 
                      className="w-full max-h-24 object-contain mx-auto"
                      style={{ maxHeight: '95px', width: '100%', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div className="doc-header w-full pb-3 mb-6 border-b-2 border-slate-900 text-center">
                    <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900">
                      {empresaData?.nome_fantasia || empresaData?.razao_social || 'DOCUMENTO OFICIAL'}
                    </h2>
                    {empresaData?.cnpj && (
                      <p className="text-xs text-slate-600 font-medium">CNPJ: {empresaData.cnpj}</p>
                    )}
                  </div>
                )}

                {/* Conteúdo do Documento */}
                <div 
                  className="prose max-w-none doc-content print:prose-p:m-0 print:prose-p:leading-normal"
                  style={{ fontSize: '12pt', lineHeight: '1.6', fontFamily: 'Arial, sans-serif' }}
                  dangerouslySetInnerHTML={{ 
                    __html: (() => {
                      let html = docToPrint.conteudo ? docToPrint.conteudo : '<p class="text-center italic text-gray-500">Documento vazio</p>';
                      Object.entries(placeholderValues).forEach(([key, value]) => {
                        const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                        const displayValue = value ? `<strong>${value}</strong>` : `<span class="text-rose-500 font-bold bg-rose-50 px-1 rounded print:bg-transparent print:text-black">${key}</span>`;
                        html = html.replace(regex, displayValue);
                      });
                      return html;
                    })()
                  }}
                />
              </div>

              {/* Rodapé com Assinatura da Empresa */}
              <div className="doc-footer w-full mt-12 pt-6 border-t border-slate-200 flex flex-col items-center justify-center text-center print:break-inside-avoid">
                {empresaData?.assinatura_url && (
                  <div className="mb-2 flex justify-center">
                    <img 
                      src={empresaData.assinatura_url} 
                      alt="Assinatura da Empresa" 
                      style={{ maxHeight: '80px', maxWidth: '280px', objectFit: 'contain' }}
                    />
                  </div>
                )}
                <div className="w-72 border-t border-slate-900 my-1 signature-line"></div>
                <p className="text-xs font-bold text-slate-900 uppercase">
                  {empresaData?.nome_fantasia || empresaData?.razao_social || 'Assinatura Autorizada'}
                </p>
                {empresaData?.cnpj && (
                  <p className="text-[10px] text-slate-600">CNPJ: {empresaData.cnpj}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
