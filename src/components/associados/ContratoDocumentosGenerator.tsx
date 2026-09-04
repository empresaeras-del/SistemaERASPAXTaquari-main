import React, { useState, useEffect } from 'react';
import { useDocumentosPadroes } from '../../hooks/useDocumentosPadroes';
import { FileText, Eye } from 'lucide-react';
import { Associado } from '../../services/associadosService';
import { DocumentoPadrao } from '../../types/documentos';
import { getEmpresas, getEmpresaById, Empresa } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';
import { VisualizadorDocumentoPadraoModal } from '../documentos/VisualizadorDocumentoPadraoModal';
import {
  resolverVariaveisAssociado,
  resolverVariaveisContrato,
  resolverVariaveisEmpresa,
  resolverVariaveisSistema,
} from '../../utils/documentoVariaveis';

interface Props {
  associado: Associado;
  valorMensalidade: number;
}

export const ContratoDocumentosGenerator: React.FC<Props> = ({ associado, valorMensalidade }) => {
  const { state: { isOnline, empresaSelecionada } } = useAppContext();
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const { documentos, loading } = useDocumentosPadroes();
  const [selectedDoc, setSelectedDoc] = useState<string>('');
  const [docToPrint, setDocToPrint] = useState<DocumentoPadrao | null>(null);

  useEffect(() => {
    const loadEmpresas = async () => {
      try {
        const emps = await getEmpresas(isOnline);
        setEmpresas(emps);
        const tenantId = empresaSelecionada || (emps[0]?.id) || 'default_tenant';
        const emp = emps.find(e => e.id === tenantId) || await getEmpresaById(tenantId, isOnline);
        if (emp) setEmpresaData(emp);
      } catch (e) {
        console.error('Erro ao carregar dados de empresas no gerador de contratos:', e);
      }
    };
    loadEmpresas();
  }, [empresaSelecionada, isOnline]);

  const handleGenerate = () => {
    const doc = documentos.find(d => d.id === selectedDoc);
    if (!doc) return;

    const vars: Record<string, string> = {
      ...resolverVariaveisSistema(),
      ...(empresaData ? resolverVariaveisEmpresa(empresaData) : {}),
      ...resolverVariaveisAssociado(associado),
      ...resolverVariaveisContrato(associado),
    };
    if (valorMensalidade) {
      vars['{{valor_mensalidade}}'] = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorMensalidade);
      vars['{{contrato_valor_mensalidade}}'] = vars['{{valor_mensalidade}}'];
    }

    const regex = /\{\{([^}]+)\}\}/g;
    const matches = [...(doc.conteudo || '').matchAll(regex)];
    const initialValues: Record<string, string> = {};
    matches.forEach(match => {
      initialValues[match[0]] = vars[match[0]] !== undefined ? vars[match[0]] : '';
    });
    setPlaceholderValues(initialValues);

    setDocToPrint(doc);
  };

  return (
    <div className="mt-6 p-5 bg-bg-surface border border-border-default rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          Emissão de Contratos e Termos do Associado
        </h4>
        <span className="text-xs text-text-subtle">
          {documentos.filter(d => d.ativo).length} modelos disponíveis
        </span>
      </div>

      <p className="text-xs text-text-subtle mb-4">
        Selecione o modelo cadastrado para gerar e visualizar o documento com todos os dados preenchidos deste associado.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <select 
          className="flex-1 px-4 py-2.5 bg-bg-base border border-border-default rounded-xl text-sm text-text-base focus:border-blue-500 outline-none transition-colors"
          value={selectedDoc}
          onChange={e => setSelectedDoc(e.target.value)}
          disabled={loading}
        >
          <option value="">Selecione um modelo de documento...</option>
          {documentos.filter(d => d.ativo).map(doc => (
            <option key={doc.id} value={doc.id}>
              {doc.nome} ({doc.tipo.replace(/_/g, ' ').toUpperCase()})
            </option>
          ))}
        </select>
        
        <button
          type="button"
          disabled={!selectedDoc}
          onClick={handleGenerate}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center gap-2 justify-center shadow-lg shadow-blue-500/20 active:scale-95 shrink-0"
        >
          <Eye className="w-4 h-4" />
          Visualizar Documento
        </button>
      </div>

      {/* Visualizador Profissional Interativo de Documentos Padrões */}
      <VisualizadorDocumentoPadraoModal
        isOpen={Boolean(docToPrint)}
        onClose={() => setDocToPrint(null)}
        documento={docToPrint}
        empresaData={empresaData}
        empresas={empresas}
        associados={[associado]}
        initialPlaceholderValues={placeholderValues}
        customTitle={`${docToPrint?.nome || 'Documento'} • ${associado.nome}`}
      />
    </div>
  );
};
