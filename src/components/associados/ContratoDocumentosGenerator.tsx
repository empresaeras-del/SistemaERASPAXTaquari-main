import React, { useState, useEffect } from 'react';
import { useDocumentosPadroes } from '../../hooks/useDocumentosPadroes';
import { FileText, Eye } from 'lucide-react';
import { Associado } from '../../services/associadosService';
import { DocumentoPadrao } from '../../types/documentos';
import { getEmpresas, getEmpresaById, Empresa } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';
import { formatLocalDate } from '../../utils/dateUtils';
import { VisualizadorDocumentoPadraoModal } from '../documentos/VisualizadorDocumentoPadraoModal';

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

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

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

    const dataAtual = new Date();
    const enderecoCompleto = [
      associado.endereco_logradouro,
      associado.endereco_numero ? `nº ${associado.endereco_numero}` : '',
      associado.endereco_bairro ? `Bairro: ${associado.endereco_bairro}` : '',
      associado.endereco_cidade || '',
      associado.endereco_cep ? `CEP: ${associado.endereco_cep}` : ''
    ].filter(Boolean).join(' - ');

    const vars: Record<string, string> = {
      '{{associado_nome}}': associado.nome || '',
      '{{associado_cpf}}': associado.cpf || '',
      '{{associado_rg}}': associado.rg || '',
      '{{associado_telefone}}': associado.telefone || '',
      '{{associado_email}}': associado.email || '',
      '{{associado_endereco}}': enderecoCompleto,
      '{{associado_logradouro}}': associado.endereco_logradouro || '',
      '{{associado_numero}}': associado.endereco_numero || '',
      '{{associado_bairro}}': associado.endereco_bairro || '',
      '{{associado_cidade}}': associado.endereco_cidade || '',
      '{{associado_cep}}': associado.endereco_cep || '',
      '{{associado_status}}': associado.status || '',
      '{{plano_atual}}': associado.plano_nome || '',
      '{{plano_nome}}': associado.plano_nome || '',
      '{{valor_mensalidade}}': formatBRL(valorMensalidade || associado.valor_plano || 0),
      '{{data_adesao}}': associado.data_adesao ? formatLocalDate(associado.data_adesao) : '',
      '{{numero_contrato}}': (associado as any).numero_contrato || (associado as any).numero_contrato_fisico || associado.id.substring(0, 8).toUpperCase(),
      '{{associado_dependentes}}': (associado.dependentes && associado.dependentes.length > 0) 
        ? associado.dependentes.map(d => `${d.nome} (${d.parentesco || 'Dependente'} - CPF: ${d.cpf || 'Não informado'})`).join('<br/>') 
        : 'Nenhum dependente vinculado',
      '{{quantidade_dependentes}}': (associado.dependentes?.length || 0).toString(),
      '{{data_atual}}': formatLocalDate(dataAtual),
      '{{hora_atual}}': dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      '{{data_hora_atual}}': `${formatLocalDate(dataAtual)} às ${dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      '{{mes_atual}}': dataAtual.toLocaleDateString('pt-BR', { month: 'long' }),
      '{{ano_atual}}': dataAtual.getFullYear().toString(),
      '{{empresa_nome}}': empresaData?.nome_fantasia || empresaData?.razao_social || '',
      '{{empresa_cnpj}}': empresaData?.cnpj || '',
      '{{empresa_endereco}}': empresaData?.endereco || '',
      '{{empresa_telefone}}': empresaData?.telefone || '',
      '{{empresa_email}}': empresaData?.email || '',
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
