import React, { useState, useEffect } from 'react';
import { FileText, Eye } from 'lucide-react';
import { Atendimento } from '../../types/atendimentos';
import { ParcelaReceber } from '../../services/financeiroService';
import { getEmpresas, getEmpresaById, Empresa } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';
import { useDocumentosPadroes } from '../../hooks/useDocumentosPadroes';
import { getAssociados, Associado } from '../../services/associadosService';
import { VisualizadorDocumentoPadraoModal } from '../documentos/VisualizadorDocumentoPadraoModal';
import {
  resolverVariaveisAtendimento,
  resolverVariaveisAtendimentoParcelas,
  resolverVariaveisAssociado,
  resolverVariaveisEmpresa,
  resolverVariaveisSistema,
} from '../../utils/documentoVariaveis';

interface Props {
  atendimento: Atendimento;
  parcelas: ParcelaReceber[];
}

export const AtendimentoDocumentosGenerator: React.FC<Props> = ({ atendimento, parcelas }) => {
  const { state } = useAppContext();
  const { isOnline, empresaSelecionada } = state;
  const { documentos, loading } = useDocumentosPadroes();

  const [selectedDoc, setSelectedDoc] = useState('');
  const [docToPrint, setDocToPrint] = useState<any>(null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [empresaData, setEmpresaData] = useState<Empresa | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [associadoData, setAssociadoData] = useState<Associado | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const emps = await getEmpresas(isOnline);
        setEmpresas(emps);
        const tenantId = empresaSelecionada || (emps[0]?.id) || 'default_tenant';
        const emp = emps.find(e => e.id === tenantId) || await getEmpresaById(tenantId, isOnline);
        if (emp) setEmpresaData(emp);

        if (atendimento.associado_id) {
          const assocs = await getAssociados(isOnline, tenantId);
          const found = assocs.find(a => a.id === atendimento.associado_id);
          if (found) setAssociadoData(found);
        }
      } catch (e) {
        console.error('Erro ao carregar dados auxiliares para geração de documentos:', e);
      }
    };
    loadData();
  }, [atendimento.associado_id, isOnline, empresaSelecionada]);

  const handleGenerate = () => {
    if (!selectedDoc) return;
    const doc = documentos.find(d => d.id === selectedDoc);
    if (!doc) return;

    const vars: Record<string, string> = {
      ...resolverVariaveisSistema(),
      ...resolverVariaveisAtendimento(atendimento),
      ...resolverVariaveisAtendimentoParcelas(parcelas),
      ...(associadoData ? resolverVariaveisAssociado(associadoData) : {}),
      ...(empresaData ? resolverVariaveisEmpresa(empresaData) : {}),
    };

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
    <div className="bg-bg-surface rounded-2xl border border-border-default overflow-hidden shadow-sm mt-6">
      <div className="p-4 border-b border-border-default flex items-center justify-between bg-bg-subtle/50">
        <h3 className="flex items-center gap-2 text-sm font-bold text-text-base uppercase tracking-wider">
          <FileText className="w-4 h-4 text-blue-500" /> 
          Emissão de Documentos e Termos de Atendimento
        </h3>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
          {documentos.filter(d => d.ativo).length} modelos disponíveis
        </span>
      </div>
      
      <div className="p-5 space-y-4">
        <p className="text-xs text-text-subtle">
          Selecione um dos modelos padrões cadastrados no sistema para gerar o documento preenchido automaticamente com todos os dados deste atendimento e do falecido.
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
                {doc.nome} - {doc.tipo.replace(/_/g, ' ').toUpperCase()}
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
      </div>

      <VisualizadorDocumentoPadraoModal
        isOpen={Boolean(docToPrint)}
        onClose={() => setDocToPrint(null)}
        documento={docToPrint}
        empresaData={empresaData}
        empresas={empresas}
        associados={associadoData ? [associadoData] : []}
        atendimentos={[atendimento]}
        initialPlaceholderValues={placeholderValues}
        customTitle={`${docToPrint?.nome || 'Documento'} • Atendimento #${atendimento.id.substring(0, 8).toUpperCase()}`}
      />
    </div>
  );
};
