import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Associado } from '../../services/associadosService';
import { Requisicao } from '../../types/requisicoes';
import { getRequisicoes, gerarPDFGuiaRequisicao } from '../../services/requisicoesService';
import { getEmpresaById } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';
import { FileText, Search, ClipboardList, Filter, Printer } from 'lucide-react';

interface AssociadoRequisicoesTabProps {
  associado: Associado;
}

export const AssociadoRequisicoesTab: React.FC<AssociadoRequisicoesTabProps> = ({ associado }) => {
  const navigate = useNavigate();
  const { state } = useAppContext();
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchRequisicoes = async () => {
      setLoading(true);
      try {
        const data = await getRequisicoes(state.isOnline, state.empresaSelecionada || 'all');
        const associadoReqs = data.filter(r => r.associado_id === associado.id);
        // sort by newest
        associadoReqs.sort((a, b) => new Date(b.data_emissao).getTime() - new Date(a.data_emissao).getTime());
        setRequisicoes(associadoReqs);
      } catch (err) {
        console.error('Error fetching requisicoes:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequisicoes();
  }, [associado.id, state.isOnline, state.empresaSelecionada]);

  const filteredRequisicoes = requisicoes.filter(r => 
    r.codigo_requisicao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.paciente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.credenciado_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-4">
        <div>
          <h4 className="text-text-base font-medium flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Requisições Emitidas
          </h4>
          <p className="text-xs text-text-subtle mt-1">Guia de procedimentos e atendimentos de rede credenciada vinculados a este associado.</p>
        </div>
        
        <button
          onClick={() => {
             // Navigation will be done via useNavigate hook
             navigate(`/requisicoes?associadoId=${associado.id}&action=new`);
          }}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-medium shadow-lg shadow-primary/20 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <ClipboardList className="w-4 h-4" />
          <span>Nova Requisição</span>
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por número, paciente ou prestador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-default rounded-xl text-sm focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-text-subtle text-sm">Carregando...</div>
        ) : filteredRequisicoes.length > 0 ? (
          filteredRequisicoes.map(req => (
            <div key={req.id} className="p-4 bg-bg-surface border border-border-default rounded-xl hover:border-primary/30 transition-colors shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-text-base">{req.codigo_requisicao}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      req.status === 'emitida' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                      req.status === 'autorizada' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      req.status === 'realizada' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                      'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-text-subtle mb-3">Emitida em: {new Date(req.data_emissao).toLocaleDateString()}</p>
                  
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div>
                      <span className="text-xs text-text-subtle block">Paciente</span>
                      <span className="font-medium text-text-base">{req.paciente_nome}</span>
                      <span className="text-xs text-text-muted block">{req.paciente_tipo === 'titular' ? 'Titular' : 'Dependente'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-text-subtle block">Prestador</span>
                      <span className="font-medium text-text-base">{req.credenciado_nome}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end justify-between">
                  <button
                    onClick={async () => {
                      const tenantId = state.empresaSelecionada || 'default_tenant';
                      const empresa = await getEmpresaById(tenantId, state.isOnline);
                      await gerarPDFGuiaRequisicao(req, empresa);
                    }}
                    className="p-2 text-text-subtle hover:text-primary hover:bg-primary/10 rounded-lg transition-colors self-end mb-2"
                    title="Imprimir Guia"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <div className="text-right">
                    <span className="text-xs text-text-subtle block">Valor Total Assoc (Co-part)</span>
                    <span className="font-bold text-[#3B82F6]">
                      R$ {req.itens ? req.itens.reduce((acc, i) => acc + i.valor_total + (i.valor_coparticipacao || 0), 0).toFixed(2) : req.valor_total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 bg-bg-surface/50 rounded-xl border border-border-default/50 border-dashed">
            <ClipboardList className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-text-subtle text-sm">Nenhuma requisição encontrada.</p>
          </div>
        )}
      </div>
    </div>
  );
};
