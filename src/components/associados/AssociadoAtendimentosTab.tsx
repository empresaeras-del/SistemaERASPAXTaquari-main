import React, { useState, useEffect } from 'react';
import { Associado } from '../../services/associadosService';
import { Atendimento } from '../../types/atendimentos';
import { getAtendimentos } from '../../services/atendimentosService';
import { useAppContext } from '../../context/AppContext';
import { Activity, Search, MapPin } from 'lucide-react';
import { formatLocalDate } from '../../utils/dateUtils';

interface AssociadoAtendimentosTabProps {
  associado: Associado;
}

export const AssociadoAtendimentosTab: React.FC<AssociadoAtendimentosTabProps> = ({ associado }) => {
  const { state } = useAppContext();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchAtendimentos = async () => {
      setLoading(true);
      try {
        const data = await getAtendimentos(state.isOnline, state.empresaSelecionada || 'all');
        const associadoAts = data.filter(a => a.associado_id === associado.id);
        // sort by newest
        associadoAts.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
        setAtendimentos(associadoAts);
      } catch (err) {
        console.error('Error fetching atendimentos:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAtendimentos();
  }, [associado.id, state.isOnline, state.empresaSelecionada]);

  const filteredAtendimentos = atendimentos.filter(a => 
    a.falecido_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.local_velorio && a.local_velorio.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-4">
        <div>
          <h4 className="text-text-base font-medium flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Atendimentos Funerários
          </h4>
          <p className="text-xs text-text-subtle mt-1">Histórico de atendimentos registrados para este associado ou seus dependentes.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por nome do falecido ou local..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border-default rounded-xl text-sm focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-text-subtle text-sm">Carregando...</div>
        ) : filteredAtendimentos.length > 0 ? (
          filteredAtendimentos.map(atd => (
            <div key={atd.id} className="p-4 bg-bg-surface border border-border-default rounded-xl hover:border-primary/30 transition-colors shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-text-base">{atd.falecido_nome}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      atd.status === 'aberto' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                      atd.status === 'em_andamento' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                      atd.status === 'concluido' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    }`}>
                      {atd.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-text-subtle mb-3">Óbito: {formatLocalDate(atd.data_obito, 'dd/MM/yyyy', 'Não informado')}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-text-subtle">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate max-w-[200px]">{atd.local_velorio || 'Velório N/I'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end justify-between">
                  <div className="text-right">
                    <span className="text-xs text-text-subtle block">Valor Particular</span>
                    <span className="font-bold text-text-base">R$ {atd.valor_total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 bg-bg-surface/50 rounded-xl border border-border-default/50 border-dashed">
            <Activity className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-text-subtle text-sm">Nenhum atendimento registrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};
