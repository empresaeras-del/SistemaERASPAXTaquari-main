import React, { useState, useEffect } from 'react';
import { useDocumentosPadroes } from '../../hooks/useDocumentosPadroes';
import { FileText, Printer, X } from 'lucide-react';
import { Associado } from '../../services/associadosService';
import { DocumentoPadrao } from '../../types/documentos';
import { getEmpresaById } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';

interface Props {
  associado: Associado;
  valorMensalidade: number;
}

export const ContratoDocumentosGenerator: React.FC<Props> = ({ associado, valorMensalidade }) => {
  const { state: { isOnline, empresaSelecionada } } = useAppContext();
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [logoHtml, setLogoHtml] = useState<string>('');
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
      '{{data_adesao}}': associado.data_adesao ? new Date(associado.data_adesao).toLocaleDateString('pt-BR') : '',
      '{{numero_contrato}}': (associado as any).numero_contrato || (associado as any).numero_contrato_fisico || associado.id.substring(0, 8).toUpperCase(),
      '{{associado_dependentes}}': (associado.dependentes && associado.dependentes.length > 0) ? associado.dependentes.map(d => `${d.nome} - Parentesco: ${d.parentesco} - CPF: ${d.cpf || 'Não informado'}`).join('<br/>') : 'Nenhum dependente vinculado',
      '{{quantidade_dependentes}}': (associado.dependentes?.length || 0).toString(),
      '{{data_atual}}': dataAtual.toLocaleDateString('pt-BR'),
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
      const fetchLogoAndEmpresa = async () => {
        try {
          const tenantId = empresaSelecionada || 'default_tenant';
          const empresa = await getEmpresaById(tenantId, isOnline);
          
          if (empresa) {
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

          if (empresa?.logo_url) {
            setLogoHtml(`<div style="width: 100%; text-align: center; margin-bottom: 20px;"><img src="${empresa.logo_url}" style="width: 100%; max-height: 120px; object-fit: contain;" /></div>`);
          } else {
            setLogoHtml('');
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchLogoAndEmpresa();
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

  return (
    <div className="mt-6 p-5 bg-bg-surface border border-border-default rounded-xl">
      <style>{`
        @media print {
          body.printing-doc * {
            visibility: hidden;
          }
          body.printing-doc #print-area, body.printing-doc #print-area * {
            visibility: visible;
          }
          body.printing-doc #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
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
                onClick={() => window.print()}
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
            <div id="print-area" className="a4-simulated shadow-2xl relative">
              <div 
                className="prose max-w-none print:prose-p:m-0 print:prose-p:leading-normal"
                style={{ fontSize: '12pt', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' }}
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    let html = docToPrint.conteudo ? docToPrint.conteudo : '<p class="text-center italic text-gray-500">Documento vazio</p>';
                    if (logoHtml) html = logoHtml + html;
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
          </div>
        </div>
      )}
    </div>
  );
}
