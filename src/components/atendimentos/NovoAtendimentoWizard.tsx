import React, { useState, useEffect, useMemo } from 'react';
import { generateUUID } from '../../utils/uuid';
import { useAppContext } from '../../context/AppContext';
import { getAssociados, saveAssociado, Associado, Dependente } from '../../services/associadosService';
import { useItensFunerarios } from '../../hooks/useItensFunerarios';
import { usePlanosPax } from '../../hooks/usePlanosPax';
import { saveAtendimento } from '../../services/atendimentosService';
import { salvarReceita } from '../../services/financeiroService';
import { registrarAuditoria } from '../../lib/supabase';
import { X, Search, FileText, CheckCircle2, ChevronRight, User, AlertTriangle, Plus, Trash2, UserX, UserMinus, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../../context/ToastContext';
import { formatLocalDate } from '../../utils/dateUtils';
import { maskCPFOrCNPJ } from '../../utils/validators';
import { Atendimento, AtendimentoItem } from '../../types/atendimentos';
import { BotaoSalvar } from '../common/BotaoSalvar';
import { AlertaAlteracoesPendentes } from '../common/AlertaAlteracoesPendentes';

export const NovoAtendimentoWizard: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const { state } = useAppContext();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inactivating, setInactivating] = useState(false);
  
  // Associados & Planos & Itens
  const [associados, setAssociados] = useState<Associado[]>([]);
  const { planos } = usePlanosPax();
  const { itens } = useItensFunerarios();

  // Modal / Etapa de Questionamento de Status pós-atendimento
  const [statusQuestionData, setStatusQuestionData] = useState<{
    associado: Associado;
    isTitular: boolean;
    dependente?: Dependente;
  } | null>(null);

  useEffect(() => {
    getAssociados(state.isOnline, state.empresaSelecionada).then(setAssociados);
  }, [state.isOnline, state.empresaSelecionada]);

  // Form State
  const [tipoCliente, setTipoCliente] = useState<'associado' | 'externo'>('associado');
  const [selectedAssociado, setSelectedAssociado] = useState<Associado | null>(null);
  const [associadoSearch, setAssociadoSearch] = useState('');
  
  // Quem é o falecido? (associado ou dependente, quando aplicável)
  const [falecidoId, setFalecidoId] = useState<string>(''); // 'associado' ou id do dependente
  
  // Dados Falecido (manual/externo)
  const [falecidoNome, setFalecidoNome] = useState('');
  const [falecidoDataNascimento, setFalecidoDataNascimento] = useState('');
  const [falecidoCpf, setFalecidoCpf] = useState('');

  // Locais e Datas
  const [localVelorio, setLocalVelorio] = useState('');
  const [localSepultamento, setLocalSepultamento] = useState('');
  const [dataObito, setDataObito] = useState(format(new Date(), 'yyyy-MM-dd\'T\'HH:mm'));
  const [dataVelorio, setDataVelorio] = useState('');
  const [dataSepultamento, setDataSepultamento] = useState('');

  // Dados médicos / declaração de óbito (opcionais nesta etapa — podem ser completados depois)
  const [sexoFalecido, setSexoFalecido] = useState('');
  const [corFalecido, setCorFalecido] = useState('');
  const [localObito, setLocalObito] = useState('');
  const [horaObito, setHoraObito] = useState('');
  const [declaracaoObito, setDeclaracaoObito] = useState('');
  const [medicoResponsavel, setMedicoResponsavel] = useState('');
  const [crmMedico, setCrmMedico] = useState('');
  const [rqeMedico, setRqeMedico] = useState('');
  const [inicioTanato, setInicioTanato] = useState('');
  const [terminoTanato, setTerminoTanato] = useState('');
  
  // Itens Funerários
  const [selectedItens, setSelectedItens] = useState<{ id: string, quantidade: number }[]>([]);

  // Funções Utilitárias
  const filteredAssociados = useMemo(() => {
    if (!associadoSearch) return associados.slice(0, 10);
    return associados.filter(a => a.nome.toLowerCase().includes(associadoSearch.toLowerCase()) || a.cpf?.includes(associadoSearch)).slice(0, 10);
  }, [associados, associadoSearch]);

  const toggleItem = (itemId: string) => {
    setSelectedItens(prev => {
      const exists = prev.find(p => p.id === itemId);
      if (exists) return prev.filter(p => p.id !== itemId);
      return [...prev, { id: itemId, quantidade: 1 }];
    });
  };

  const updateItemQuantidade = (itemId: string, qtd: number) => {
    setSelectedItens(prev => prev.map(p => p.id === itemId ? { ...p, quantidade: qtd } : p));
  };

  const currentPlano = useMemo(() => {
    if (tipoCliente === 'associado' && selectedAssociado?.plano_pax_id) {
      return planos.find(p => p.id === selectedAssociado.plano_pax_id);
    }
    return null;
  }, [tipoCliente, selectedAssociado, planos]);

  // Análise Financeira
  const financeiro = useMemo(() => {
    let totalCovered = 0;
    let totalUncovered = 0;
    
    const itemsProcessed = selectedItens.map(si => {
      const itemDef = itens.find(i => i.id === si.id);
      const preco = (itemDef?.valor_referencia || 0) * si.quantidade;
      let coberto = false;
      
      if (tipoCliente === 'associado' && currentPlano) {
        // Verifica se plano cobre este item
        const cob = currentPlano.coberturas?.find(c => c.item_id === si.id);
        if (cob && cob.tipo_cobertura === 'coberto') {
          coberto = true;
        }
      }
      
      if (coberto) totalCovered += preco;
      else totalUncovered += preco;
      
      return {
        ...si,
        nome: itemDef?.nome,
        precoUnitario: itemDef?.valor_referencia || 0,
        precoTotal: preco,
        coberto
      };
    });
    
    return {
      itemsProcessed,
      totalCovered,
      totalUncovered
    };
  }, [selectedItens, itens, tipoCliente, currentPlano]);

  const handleNext = () => {
    if (step === 1) {
      if (tipoCliente === 'associado') {
        if (!selectedAssociado) return toast.error("Selecione um associado");
        if (!falecidoId) return toast.error("Selecione quem é o falecido (titular ou dependente)");
      } else {
        if (!falecidoNome) return toast.error("Preencha o nome do falecido");
      }
    }
    if (step === 2) {
       // local validation
    }
    setStep(s => s + 1);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let fNome = falecidoNome;
      let fCpf = falecidoCpf;
      let fDataNasc = falecidoDataNascimento;
      
      if (tipoCliente === 'associado' && selectedAssociado) {
        if (falecidoId === 'associado') {
          fNome = selectedAssociado.nome;
          fCpf = selectedAssociado.cpf;
          fDataNasc = selectedAssociado.data_nascimento || '';
        } else {
          const dep = selectedAssociado.dependentes?.find(d => d.id === falecidoId);
          if (dep) {
            fNome = dep.nome;
            fCpf = dep.cpf || '';
            fDataNasc = dep.data_nascimento || '';
          }
        }
      }

      const tenantId = state.empresaSelecionada && state.empresaSelecionada !== 'all' ? state.empresaSelecionada : 'default_tenant';
      
      const newAtendimento: Atendimento = {
        id: generateUUID(),
        tenant_id: tenantId,
        tipo_cliente: tipoCliente,
        associado_id: tipoCliente === 'associado' ? selectedAssociado?.id : undefined,
        dependente_id: falecidoId !== 'associado' ? falecidoId : undefined,
        falecido_nome: (fNome || '').trim().toUpperCase(),
        falecido_cpf: fCpf ? fCpf.trim() : undefined,
        falecido_data_nascimento: fDataNasc,
        local_velorio: (localVelorio || '').trim().toUpperCase(),
        local_sepultamento: (localSepultamento || '').trim().toUpperCase(),
        data_obito: dataObito,
        data_velorio: dataVelorio,
        data_sepultamento: dataSepultamento,
        sexo_falecido: sexoFalecido || undefined,
        cor_falecido: corFalecido || undefined,
        local_obito: localObito || undefined,
        hora_obito: horaObito || undefined,
        declaracao_obito: declaracaoObito || undefined,
        medico_responsavel: medicoResponsavel || undefined,
        crm_medico: crmMedico || undefined,
        rqe_medico: rqeMedico || undefined,
        inicio_tanato: inicioTanato || undefined,
        termino_tanato: terminoTanato || undefined,
        status: 'aberto',
        valor_total: financeiro.totalUncovered,
        created_at: new Date().toISOString(),
        created_by: state.user?.id,
        itens: financeiro.itemsProcessed.map(i => ({
          id: generateUUID(),
          tenant_id: tenantId,
          atendimento_id: '',
          item_id: i.id,
          quantidade: i.quantidade,
          valor_unitario: i.precoUnitario,
          coberto: i.coberto
        }))
      };

      await saveAtendimento(newAtendimento, state.isOnline);

      // Gerar contas a receber se tiver valor descoberto
      if (financeiro.totalUncovered > 0) {
        const receitaId = generateUUID();
        const tipoDev = tipoCliente === 'associado' ? 'associado' : 'cliente_pf';
        const devNome = tipoCliente === 'associado' ? selectedAssociado?.nome : fNome;
        const devCpf = tipoCliente === 'associado' ? selectedAssociado?.cpf : fCpf;
        
        const dataHojeStr = format(new Date(), "yyyy-MM-dd");
        const dataVencimento = new Date();
        dataVencimento.setDate(dataVencimento.getDate() + 2);
        const dataVencimentoStr = format(dataVencimento, "yyyy-MM-dd");
        
        await salvarReceita(state.isOnline, {
          id: receitaId,
          tenant_id: tenantId,
          tipo_devedor: tipoDev,
          associado_id: tipoCliente === 'associado' ? selectedAssociado?.id : undefined,
          associado_nome: tipoCliente === 'associado' ? selectedAssociado?.nome : undefined,
          cliente_tipo: 'pf',
          cliente_nome: fNome,
          cliente_cpf_cnpj: fCpf,
          descricao: `Serviços Adicionais - Atendimento: ${fNome}`,
          categoria: 'Serviço Extra',
          data_emissao: dataHojeStr,
          data_inicio_cobranca: dataHojeStr,
          valor_total: financeiro.totalUncovered,
          qtd_parcelas: 1,
          forma_pagamento_padrao: 'Dinheiro',
          status: 'ativo',
          atendimento_id: newAtendimento.id
        }, [{
          id: generateUUID(),
          tenant_id: tenantId,
          receita_id: receitaId,
          numero_parcela: 1,
          descricao: `Parcela Única - Serviços Adicionais: ${fNome}`,
          valor: financeiro.totalUncovered,
          data_vencimento: dataVencimentoStr,
          status: 'pendente',
          tipo_devedor: tipoDev,
          devedor_nome: devNome,
          devedor_cpf_cnpj: devCpf,
          forma_pagamento: 'Dinheiro'
        }]);
      }

      toast.success("Atendimento registrado com sucesso!");

      // Regra Global: Questionamento sobre status do associado ou dependente atendido
      if (tipoCliente === 'associado' && selectedAssociado) {
        const isTitular = falecidoId === 'associado';
        const dep = !isTitular ? selectedAssociado.dependentes?.find(d => d.id === falecidoId) : undefined;
        setStatusQuestionData({
          associado: selectedAssociado,
          isTitular,
          dependente: dep
        });
      } else {
        onSuccess();
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao registrar atendimento");
    } finally {
      setLoading(false);
    }
  };

  // Função para inativar Titular
  const handleInativarTitular = async () => {
    if (!statusQuestionData?.associado) return;
    setInactivating(true);
    try {
      const assoc = statusQuestionData.associado;
      const updatedAssociado: Associado = {
        ...assoc,
        status: 'inativo'
      };
      await saveAssociado(updatedAssociado, state.isOnline);
      await registrarAuditoria('INATIVACAO_ASSOCIADO_OBITO', {
        associado_id: assoc.id,
        associado_nome: assoc.nome,
        status_anterior: assoc.status,
        status_novo: 'inativo',
        motivo: 'Inativação por falecimento / Atendimento funerário finalizado'
      });
      toast.success(`Titular "${assoc.nome}" foi inativado com sucesso.`);
      setStatusQuestionData(null);
      onSuccess();
    } catch (err) {
      console.error('Erro ao inativar titular:', err);
      toast.error('Falha ao inativar associado.');
    } finally {
      setInactivating(false);
    }
  };

  // Função para inativar / remover Dependente
  const handleInativarDependente = async () => {
    if (!statusQuestionData?.associado || !statusQuestionData.dependente) return;
    setInactivating(true);
    try {
      const assoc = statusQuestionData.associado;
      const dep = statusQuestionData.dependente;
      const novosDeps = (assoc.dependentes || []).filter(d => d.id !== dep.id);
      const novasVidas = Math.max(1, (assoc.n_vidas || (assoc.dependentes?.length || 0) + 1) - 1);

      const updatedAssociado: Associado = {
        ...assoc,
        dependentes: novosDeps,
        n_vidas: novasVidas
      };
      await saveAssociado(updatedAssociado, state.isOnline);
      await registrarAuditoria('INATIVACAO_DEPENDENTE_OBITO', {
        dependente_id: dep.id,
        dependente_nome: dep.nome,
        titular_id: assoc.id,
        titular_nome: assoc.nome,
        motivo: 'Inativação/exclusão por falecimento / Atendimento funerário finalizado'
      });
      toast.success(`Dependente "${dep.nome}" inativado do cadastro com sucesso.`);
      setStatusQuestionData(null);
      onSuccess();
    } catch (err) {
      console.error('Erro ao inativar dependente:', err);
      toast.error('Falha ao inativar dependente.');
    } finally {
      setInactivating(false);
    }
  };

  // Pular alteração de status e manter como está
  const handleManterStatus = () => {
    setStatusQuestionData(null);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm p-4">
      <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-border-default overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-border-default flex justify-between items-center bg-bg-surface">
          <div>
            <h2 className="text-xl font-bold text-text-base">Novo Atendimento</h2>
            <p className="text-sm text-text-subtle">Siga as etapas para criar um novo registro</p>
          </div>
          <button onClick={onClose} className="text-text-subtle hover:text-text-base transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* PROGRESS TABS */}
        <div className="flex border-b border-border-default bg-bg-surface/50 overflow-x-auto">
          {['Dados do Falecido', 'Locais e Datas', 'Itens Funerários', 'Registros Financeiros'].map((t, i) => {
            const stepNum = i + 1;
            const active = step === stepNum;
            const past = step > stepNum;
            return (
              <div key={t} className={`flex-1 py-3 px-4 text-center border-b-2 text-sm font-semibold transition-colors ${active ? 'border-primary text-primary' : past ? 'border-transparent text-text-base' : 'border-transparent text-text-muted'}`}>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${active ? 'bg-primary text-white' : past ? 'bg-emerald-500 text-white' : 'bg-bg-hover text-text-subtle'}`}>
                    {past ? <CheckCircle2 className="w-3 h-3" /> : stepNum}
                  </div>
                  <span className="whitespace-nowrap">{t}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-bg-base space-y-6">
          {step > 1 && (
            <AlertaAlteracoesPendentes
              visivel={step > 1}
              posicao="compact"
              mensagem="Atendimento em preenchimento. Avance as etapas e conclua o salvamento para registrar os dados no banco de dados."
            />
          )}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => { setTipoCliente('associado'); setSelectedAssociado(null); }}
                  className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${tipoCliente === 'associado' ? 'border-primary bg-primary/5 text-primary' : 'border-border-default bg-bg-surface text-text-subtle'}`}
                >
                  <User className="w-6 h-6 mx-auto mb-2" />
                  <span className="font-semibold">Associado</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTipoCliente('externo')}
                  className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${tipoCliente === 'externo' ? 'border-primary bg-primary/5 text-primary' : 'border-border-default bg-bg-surface text-text-subtle'}`}
                >
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                  <span className="font-semibold">Cliente Externo</span>
                </button>
              </div>

              {tipoCliente === 'associado' && (
                <div className="space-y-4">
                  {!selectedAssociado ? (
                    <div>
                      <label className="block text-sm font-semibold text-text-subtle mb-1">Buscar Associado</label>
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-2.5 w-5 h-5 text-text-muted" />
                        <input
                          type="text"
                          value={associadoSearch}
                          onChange={(e) => setAssociadoSearch(e.target.value)}
                          placeholder="Buscar por nome ou CPF..."
                          className="w-full pl-10 pr-4 py-2 bg-bg-surface border border-border-default rounded-xl focus:ring-2 focus:ring-primary/50 text-text-base"
                        />
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {filteredAssociados.map(a => (
                          <div
                            key={a.id}
                            onClick={() => setSelectedAssociado(a)}
                            className="p-3 bg-bg-surface border border-border-default rounded-xl cursor-pointer hover:border-primary/50 transition-colors"
                          >
                            <p className="font-semibold text-text-base">{a.nome}</p>
                            <p className="text-xs text-text-subtle">CPF: {a.cpf} | Plano: {a.plano_nome || 'Nenhum'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Associado Vinculado</p>
                          <p className="font-bold text-text-base">{selectedAssociado.nome}</p>
                          <p className="text-sm text-text-subtle">Plano: {selectedAssociado.plano_nome || 'Não possui'}</p>
                        </div>
                        <button onClick={() => setSelectedAssociado(null)} className="text-xs text-primary hover:underline">
                          Alterar
                        </button>
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-text-base border-b border-primary/10 pb-2">Selecione o Falecido</p>
                        <label className="flex items-center gap-3 p-2 hover:bg-bg-surface rounded-lg cursor-pointer">
                          <input type="radio" name="falecido" value="associado" checked={falecidoId === 'associado'} onChange={() => setFalecidoId('associado')} className="text-primary" />
                          <div>
                            <p className="font-medium text-text-base">{selectedAssociado.nome} (Titular)</p>
                            <p className="text-xs text-text-subtle">CPF: {selectedAssociado.cpf} | Nasc: {formatLocalDate(selectedAssociado.data_nascimento, 'dd/MM/yyyy', 'N/I')}</p>
                          </div>
                        </label>
                        {selectedAssociado.dependentes?.map(d => (
                          <label key={d.id} className="flex items-center gap-3 p-2 hover:bg-bg-surface rounded-lg cursor-pointer">
                            <input type="radio" name="falecido" value={d.id} checked={falecidoId === d.id} onChange={() => setFalecidoId(d.id)} className="text-primary" />
                            <div>
                              <p className="font-medium text-text-base">{d.nome} (Dependente)</p>
                              <p className="text-xs text-text-subtle">CPF: {d.cpf || 'N/I'} | Nasc: {formatLocalDate(d.data_nascimento, 'dd/MM/yyyy', 'N/I')}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tipoCliente === 'externo' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-text-subtle mb-1">Nome Completo do Falecido *</label>
                    <input 
                      type="text" 
                      required
                      value={falecidoNome} 
                      onChange={(e) => setFalecidoNome(e.target.value.toUpperCase())} 
                      placeholder="Digite o nome completo"
                      className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base uppercase focus:ring-2 focus:ring-primary/50" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-text-subtle mb-1">CPF</label>
                    <input 
                      type="text" 
                      value={falecidoCpf} 
                      onChange={(e) => setFalecidoCpf(maskCPFOrCNPJ(e.target.value, false))} 
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-text-subtle mb-1">Data de Nascimento</label>
                    <input type="date" value={falecidoDataNascimento} onChange={(e) => setFalecidoDataNascimento(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Data do Óbito</label>
                 <input type="datetime-local" value={dataObito} onChange={(e) => setDataObito(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Data do Velório</label>
                 <input type="datetime-local" value={dataVelorio} onChange={(e) => setDataVelorio(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Data do Sepultamento</label>
                 <input type="datetime-local" value={dataSepultamento} onChange={(e) => setDataSepultamento(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Local do Velório</label>
                 <input 
                   type="text" 
                   value={localVelorio} 
                   onChange={(e) => setLocalVelorio(e.target.value.toUpperCase())} 
                   placeholder="Ex: Capela Municipal / Residência"
                   className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base uppercase focus:ring-2 focus:ring-primary/50" 
                 />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Local do Sepultamento</label>
                 <input
                   type="text"
                   value={localSepultamento}
                   onChange={(e) => setLocalSepultamento(e.target.value.toUpperCase())}
                   placeholder="Ex: Cemitério Municipal"
                   className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base uppercase focus:ring-2 focus:ring-primary/50"
                 />
               </div>

               <div className="md:col-span-2 pt-4 mt-2 border-t border-border-default">
                 <p className="text-sm font-semibold text-text-base mb-3">Dados Médicos e Declaração de Óbito <span className="text-text-muted font-normal">(opcional, pode ser completado depois)</span></p>
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Sexo</label>
                 <select value={sexoFalecido} onChange={(e) => setSexoFalecido(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50">
                   <option value="">Não informado</option>
                   <option value="Masculino">Masculino</option>
                   <option value="Feminino">Feminino</option>
                 </select>
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Cor / Raça</label>
                 <input type="text" value={corFalecido} onChange={(e) => setCorFalecido(e.target.value)} placeholder="Ex: Parda" className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Local do Óbito</label>
                 <input type="text" value={localObito} onChange={(e) => setLocalObito(e.target.value)} placeholder="Ex: Hospital Municipal" className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Hora do Óbito</label>
                 <input type="time" value={horaObito} onChange={(e) => setHoraObito(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Nº Declaração de Óbito</label>
                 <input type="text" value={declaracaoObito} onChange={(e) => setDeclaracaoObito(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Médico Responsável</label>
                 <input type="text" value={medicoResponsavel} onChange={(e) => setMedicoResponsavel(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">CRM</label>
                 <input type="text" value={crmMedico} onChange={(e) => setCrmMedico(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">RQE</label>
                 <input type="text" value={rqeMedico} onChange={(e) => setRqeMedico(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Início Tanatopraxia</label>
                 <input type="time" value={inicioTanato} onChange={(e) => setInicioTanato(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
               <div className="space-y-1">
                 <label className="block text-sm font-semibold text-text-subtle mb-1">Término Tanatopraxia</label>
                 <input type="time" value={terminoTanato} onChange={(e) => setTerminoTanato(e.target.value)} className="w-full px-4 py-2 bg-bg-surface border border-border-default rounded-xl text-text-base focus:ring-2 focus:ring-primary/50" />
               </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-bg-surface p-4 rounded-xl border border-border-default max-h-64 overflow-y-auto">
                <p className="text-sm font-semibold text-text-base mb-3">Selecione os Itens Funerários</p>
                <div className="space-y-2">
                  {itens.filter(i => i.ativo).map(item => {
                    const isSelected = selectedItens.find(s => s.id === item.id);
                    return (
                      <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isSelected ? 'bg-primary/5 border-primary/50' : 'bg-bg-base border-border-default'}`}>
                        <div className="flex items-center gap-3">
                           <input type="checkbox" checked={!!isSelected} onChange={() => toggleItem(item.id)} className="w-4 h-4 text-primary rounded" />
                           <div>
                             <p className="font-medium text-text-base">{item.nome}</p>
                             <p className="text-xs text-text-subtle">Ref: R$ {item.valor_referencia?.toFixed(2) || '0.00'}</p>
                           </div>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-subtle">Qtd:</span>
                            <input 
                              type="number" 
                              min="1" 
                              value={isSelected.quantidade} 
                              onChange={(e) => updateItemQuantidade(item.id, parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 bg-bg-surface border border-border-default rounded text-sm text-center"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden">
                <div className="p-4 border-b border-border-default bg-bg-subtle">
                  <h3 className="font-bold text-text-base">Resumo Financeiro</h3>
                  {tipoCliente === 'associado' ? (
                     <p className="text-xs text-text-subtle mt-1">Analisando cobertura do plano: <span className="font-semibold text-primary">{currentPlano?.nome}</span></p>
                  ) : (
                     <p className="text-xs text-text-subtle mt-1">Cliente Externo - Cobrança integral</p>
                  )}
                </div>
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-text-subtle border-b border-border-default">
                        <th className="pb-2 font-medium">Item</th>
                        <th className="pb-2 font-medium">Qtd</th>
                        <th className="pb-2 font-medium text-right">Valor Tabela</th>
                        <th className="pb-2 font-medium text-center">Cobertura</th>
                        <th className="pb-2 font-medium text-right">A Cobrar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default/50">
                      {financeiro.itemsProcessed.map((i, idx) => (
                        <tr key={idx}>
                          <td className="py-3 text-text-base">{i.nome}</td>
                          <td className="py-3 text-text-base">{i.quantidade}</td>
                          <td className="py-3 text-text-base text-right">R$ {i.precoTotal.toFixed(2)}</td>
                          <td className="py-3 text-center">
                            {i.coberto ? (
                               <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">COBERTO</span>
                            ) : (
                               <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">NÃO COBERTO</span>
                            )}
                          </td>
                          <td className="py-3 text-text-base text-right font-medium">
                            R$ {i.coberto ? '0.00' : i.precoTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {financeiro.itemsProcessed.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-text-subtle">Nenhum item selecionado.</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="border-t-2 border-border-default">
                      <tr>
                        <td colSpan={4} className="py-4 text-right text-text-subtle font-medium">Total do Atendimento</td>
                        <td className="py-4 text-right text-text-base font-bold">R$ {(financeiro.totalCovered + financeiro.totalUncovered).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-2 text-right text-text-subtle font-medium">Total Coberto pelo Plano</td>
                        <td className="py-2 text-right text-emerald-500 font-bold">R$ {financeiro.totalCovered.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="py-2 text-right text-text-base font-bold">Valor a Cobrar (Gerar Receita)</td>
                        <td className="py-2 text-right text-rose-500 font-black text-lg">R$ {financeiro.totalUncovered.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-border-default bg-bg-surface flex justify-between items-center shrink-0">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="px-5 py-2.5 bg-bg-hover text-text-base rounded-xl font-semibold border border-[#64748B] hover:bg-[#64748B] transition-colors"
          >
            {step > 1 ? 'Voltar' : 'Cancelar'}
          </button>
          
          {step < 4 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-blue-400 text-white rounded-xl font-bold shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity"
            >
              Próxima Etapa
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <BotaoSalvar
              type="button"
              onClick={handleSave}
              salvando={loading}
              texto="Finalizar Atendimento"
              textoSalvando="Gravando Atendimento..."
              textoSalvo="Atendimento Concluído!"
              variante="emerald"
            />
          )}
        </div>
      </div>

      {/* MODAL DE QUESTIONAMENTO DE STATUS DO ASSOCIADO / DEPENDENTE */}
      {statusQuestionData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-bg-surface border border-border-default rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col p-6 space-y-6">
            
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl shrink-0 border border-amber-500/20">
                {statusQuestionData.isTitular ? (
                  <UserX className="w-8 h-8" />
                ) : (
                  <UserMinus className="w-8 h-8" />
                )}
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  {statusQuestionData.isTitular ? 'Associado Titular' : 'Dependente do Plano'}
                </span>
                <h3 className="text-xl font-bold text-text-base tracking-tight">
                  {statusQuestionData.isTitular
                    ? 'Inativar Cadastro do Titular?'
                    : 'Inativar / Remover Dependente?'}
                </h3>
                <p className="text-xs text-text-subtle">
                  Regra Global de Atendimento Funerário
                </p>
              </div>
            </div>

            <div className="bg-bg-subtle/70 rounded-2xl p-4 border border-border-default/60 space-y-3">
              <p className="text-sm text-text-base leading-relaxed">
                {statusQuestionData.isTitular ? (
                  <>
                    O atendimento funerário foi finalizado com sucesso para o associado titular{' '}
                    <strong className="text-primary font-bold">{statusQuestionData.associado.nome}</strong>{' '}
                    (CPF: {statusQuestionData.associado.cpf || 'Não informado'}).
                  </>
                ) : (
                  <>
                    O atendimento funerário foi finalizado com sucesso para o dependente{' '}
                    <strong className="text-primary font-bold">{statusQuestionData.dependente?.nome}</strong>{' '}
                    {statusQuestionData.dependente?.parentesco && `(${statusQuestionData.dependente.parentesco})`}{' '}
                    vinculado ao titular{' '}
                    <strong className="text-text-base font-semibold">{statusQuestionData.associado.nome}</strong>.
                  </>
                )}
              </p>

              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400/90 leading-relaxed flex items-start gap-2">
                <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  {statusQuestionData.isTitular
                    ? 'Deseja inativar o cadastro deste associado (Status: INATIVO) no banco de dados para refletir o encerramento por óbito?'
                    : 'Deseja inativar/remover este dependente do cadastro e recalcular a contagem de vidas do contrato?'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={statusQuestionData.isTitular ? handleInativarTitular : handleInativarDependente}
                disabled={inactivating}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl font-bold shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {inactivating ? (
                  'Atualizando...'
                ) : (
                  <>
                    <UserX className="w-4 h-4" />
                    {statusQuestionData.isTitular ? 'Sim, Inativar Titular' : 'Sim, Inativar Dependente'}
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleManterStatus}
                disabled={inactivating}
                className="px-4 py-3 bg-bg-hover hover:bg-[#64748B] text-text-muted hover:text-text-base border border-border-default rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                Manter Como Está
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
