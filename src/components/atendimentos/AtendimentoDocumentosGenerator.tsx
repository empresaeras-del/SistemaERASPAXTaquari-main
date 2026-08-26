import React, { useState, useEffect } from 'react';
import { FileText, Eye } from 'lucide-react';
import { Atendimento } from '../../types/atendimentos';
import { ParcelaReceber } from '../../services/financeiroService';
import { getEmpresas, getEmpresaById, Empresa } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';
import { useDocumentosPadroes } from '../../hooks/useDocumentosPadroes';
import { getAssociados, Associado } from '../../services/associadosService';
import { formatLocalDate } from '../../utils/dateUtils';
import { VisualizadorDocumentoPadraoModal } from '../documentos/VisualizadorDocumentoPadraoModal';

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

    const dataAtual = new Date();
    
    // Format itens
    const itensStr = (atendimento.itens || []).map(i => `${i.quantidade}x ${i.item_nome || 'Item'} (R$ ${(i.valor_unitario * i.quantidade).toFixed(2)})`).join(', ') || 'Nenhum item adicionado';
    
    // Format parcelas
    const parcelasStr = parcelas.map(p => `Parcela ${p.numero_parcela} - Vencimento: ${formatLocalDate(p.data_vencimento)} - Valor: R$ ${p.valor.toFixed(2)} - Status: ${p.status}`).join('<br/>') || 'Nenhuma parcela financeira';

    const vars: Record<string, string> = {
      // Atendimento Data
      '{{atendimento_id}}': atendimento.id,
      '{{atendimento_tipo}}': atendimento.tipo_cliente === 'associado' ? 'Associado' : 'Cliente Externo',
      '{{atendimento_falecido_nome}}': atendimento.falecido_nome || '',
      '{{atendimento_falecido_cpf}}': atendimento.falecido_cpf || '',
      '{{atendimento_falecido_data_nascimento}}': formatLocalDate(atendimento.falecido_data_nascimento, 'dd/MM/yyyy', ''),
      '{{atendimento_local_velorio}}': atendimento.local_velorio || '',
      '{{atendimento_local_sepultamento}}': atendimento.local_sepultamento || '',
      '{{atendimento_data_obito}}': formatLocalDate(atendimento.data_obito, 'dd/MM/yyyy', ''),
      '{{atendimento_data_velorio}}': formatLocalDate(atendimento.data_velorio, 'dd/MM/yyyy', ''),
      '{{atendimento_data_sepultamento}}': formatLocalDate(atendimento.data_sepultamento, 'dd/MM/yyyy', ''),
      '{{atendimento_valor_total}}': `R$ ${(atendimento.valor_total || 0).toFixed(2)}`,
      '{{atendimento_itens_lista}}': itensStr,
      '{{atendimento_parcelas_lista}}': parcelasStr,
      '{{data_atual}}': formatLocalDate(dataAtual),
      '{{hora_atual}}': dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      '{{data_hora_atual}}': `${formatLocalDate(dataAtual)} às ${dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      '{{ano_atual}}': dataAtual.getFullYear().toString(),
      '{{mes_atual}}': dataAtual.toLocaleDateString('pt-BR', { month: 'long' }),
      
      // Associado Data (if applicable)
      '{{associado_nome}}': associadoData?.nome || '',
      '{{associado_cpf}}': associadoData?.cpf || '',
      '{{associado_rg}}': associadoData?.rg || '',
      '{{associado_telefone}}': associadoData?.telefone || '',
      '{{associado_endereco}}': `${associadoData?.endereco_logradouro || ''} ${associadoData?.endereco_numero || ''}`.trim(),
      '{{associado_cidade}}': associadoData?.endereco_cidade || '',
      '{{associado_estado}}': (associadoData as any)?.endereco_estado || '',
      '{{associado_cep}}': associadoData?.endereco_cep || '',

      // Empresa
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
    <div className="bg-bg-surface rounded-2xl border border-border-default overflow-hidden shadow-sm mt-6">
      <div className="p-4 border-b border-border-default flex items-center justify-between bg-bg-subtle/50">
        <h3 className="flex items-center gap-2 text-sm font-bold text-text-base uppercase tracking-wider">
          <FileText className="w-4 h-4 text-blue-500" /> 
          Emissão de Documentos e Termos de Atendimento
        </h3>
        <span className="text-xs text-text-subtle">
          {documentos.filter(d => d.ativo).length} modelos disponíveis
        </span>
      </div>
      
      <div className="p-6 space-y-4">
        <p className="text-xs text-text-subtle">
          Selecione um documento padrão cadastrado para preencher os dados do atendimento (falecido, itens, parcelas, velório e sepultamento).
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

      {/* Visualizador Profissional Interativo de Documentos Padrões */}
      <VisualizadorDocumentoPadraoModal
        isOpen={Boolean(docToPrint)}
        onClose={() => setDocToPrint(null)}
        documento={docToPrint}
        empresaData={empresaData}
        empresas={empresas}
        associados={associadoData ? [associadoData] : []}
        initialPlaceholderValues={placeholderValues}
        customTitle={`${docToPrint?.nome || 'Documento'} • Atendimento #${atendimento.id.substring(0, 8).toUpperCase()}`}
      />
    </div>
  );
};
