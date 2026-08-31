import React, { useState, useEffect } from 'react';
import { generateUUID } from '../../utils/uuid';
import { X, Save, Edit2, Calendar, MapPin, User, FileText, CheckCircle, Clock, Trash2, Plus, DollarSign } from 'lucide-react';
import { Atendimento, AtendimentoItem } from '../../types/atendimentos';
import { saveAtendimento } from '../../services/atendimentosService';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { cancelarReceitasPorAtendimento, getParcelasReceberPorAtendimento, ParcelaReceber } from '../../services/financeiroService';
import { useItensFunerarios } from '../../hooks/useItensFunerarios';
import { AtendimentoDocumentosGenerator } from './AtendimentoDocumentosGenerator';
import { formatLocalDate } from '../../utils/dateUtils';
import { maskCPFOrCNPJ } from '../../utils/validators';
import { BotaoSalvar } from '../common/BotaoSalvar';
import { AlertaAlteracoesPendentes } from '../common/AlertaAlteracoesPendentes';
import { canEditAtendimentos, alertPermissionRestriction } from '../../utils/permissions';

interface Props {
  atendimento: Atendimento;
  onClose: () => void;
  onSaved: () => void;
}

export const AtendimentoDetailsModal: React.FC<Props> = ({ atendimento, onClose, onSaved }) => {
  const { state } = useAppContext();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { itens } = useItensFunerarios();

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Atendimento>({ ...atendimento });

  // Load items with details
  const [itemsList, setItemsList] = useState<AtendimentoItem[]>(atendimento.itens || []);

  const isDirty = React.useMemo(() => {
    if (!isEditing) return false;
    return (
      JSON.stringify(formData) !== JSON.stringify(atendimento) ||
      JSON.stringify(itemsList) !== JSON.stringify(atendimento.itens || [])
    );
  }, [isEditing, formData, atendimento, itemsList]);
  const [parcelas, setParcelas] = useState<ParcelaReceber[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(true);
  const [activeTab, setActiveTab] = useState<'detalhes' | 'documentos'>('detalhes');

  useEffect(() => {
    const fetchParcelas = async () => {
      setLoadingParcelas(true);
      try {
        const data = await getParcelasReceberPorAtendimento(atendimento.id, state.isOnline);
        setParcelas(data);
      } catch (e) {
        console.error('Erro ao buscar parcelas:', e);
      } finally {
        setLoadingParcelas(false);
      }
    };
    fetchParcelas();
  }, [atendimento.id, state.isOnline]);

  
  const handleItemChange = (idx: number, field: keyof AtendimentoItem, value: any) => {
    const newItems = [...itemsList];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setItemsList(newItems);
  };

  const removeItem = (idx: number) => {
    const newItems = [...itemsList];
    newItems.splice(idx, 1);
    setItemsList(newItems);
  };

  const addItem = () => {
    setItemsList([...itemsList, {
      id: generateUUID(),
      atendimento_id: atendimento.id,
      item_id: '',
      quantidade: 1,
      valor_unitario: 0,
      coberto: true,
      item_nome: ''
    }]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'falecido_cpf') {
      finalValue = maskCPFOrCNPJ(value, false);
    } else if (name === 'falecido_nome' || name === 'local_velorio' || name === 'local_sepultamento') {
      finalValue = value.toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
  };

  const executeSave = async () => {
    setLoading(true);
    try {
      // Recalculate total value based on not-covered items
      const newValorTotal = itemsList.reduce((acc, curr) => curr.coberto ? acc : acc + (curr.quantidade * curr.valor_unitario), 0);
      
      const newAtendimento = { 
        ...formData, 
        falecido_nome: (formData.falecido_nome || '').trim().toUpperCase(),
        falecido_cpf: formData.falecido_cpf ? formData.falecido_cpf.trim() : undefined,
        local_velorio: (formData.local_velorio || '').trim().toUpperCase(),
        local_sepultamento: (formData.local_sepultamento || '').trim().toUpperCase(),
        valor_total: newValorTotal,
        itens: itemsList 
      };

      await saveAtendimento(newAtendimento, state.isOnline);
      
      if (formData.status === 'cancelado' && atendimento.status !== 'cancelado') {
          await cancelarReceitasPorAtendimento(atendimento.id, state.isOnline);
      }
      
      toast.success('Atendimento atualizado com sucesso!');
      setIsEditing(false);
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar atendimento.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (formData.status === 'cancelado' && atendimento.status !== 'cancelado') {
       confirm({
         title: "Confirmar Cancelamento",
         message: "Ao cancelar este atendimento, todas as parcelas financeiras pendentes (contas a receber) vinculadas a ele serão automaticamente canceladas. Deseja prosseguir?",
         confirmText: "Sim, Cancelar Tudo",
         cancelText: "Voltar",
         danger: true,
         onConfirm: async () => {
           await executeSave();
         }
       });
    } else {
       await executeSave();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-border-default overflow-hidden">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-border-default flex justify-between items-center bg-bg-surface shrink-0">
          <div>
            <h2 className="text-xl font-bold text-text-base">Detalhes do Atendimento</h2>
            <p className="text-sm text-text-subtle">
              {formData.tipo_cliente === 'associado' ? 'Associado' : 'Cliente Externo'} • {new Date(formData.created_at || '').toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <button 
                type="button"
                onClick={() => {
                  if (!canEditAtendimentos(state.user, state.isOnline)) {
                    alertPermissionRestriction('Atendimentos', 'editar ou alterar dados de atendimentos cadastrados');
                    return;
                  }
                  setIsEditing(true);
                }} 
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs transition-all shadow-md shadow-blue-500/20"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ ...atendimento });
                    setIsEditing(false);
                  }}
                  className="px-3 py-1.5 text-xs text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl font-medium transition-colors"
                >
                  Descartar
                </button>
                <BotaoSalvar 
                  salvando={loading} 
                  onClick={handleSave} 
                  texto="Salvar" 
                  textoSalvando="Salvando..." 
                  tamanho="sm" 
                  variante="primary" 
                />
              </div>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 text-text-subtle hover:text-text-base transition-colors rounded-xl hover:bg-bg-hover"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        
        {/* TABS */}
        <div className="flex border-b border-border-default px-6 bg-bg-surface shrink-0">
          <button 
            onClick={() => setActiveTab('detalhes')} 
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${activeTab === 'detalhes' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-base'}`}
          >
            Detalhes do Atendimento
          </button>
          <button 
            onClick={() => setActiveTab('documentos')} 
            className={`px-4 py-3 font-semibold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'documentos' ? 'border-primary text-primary' : 'border-transparent text-text-subtle hover:text-text-base'}`}
          >
            <FileText className="w-4 h-4" /> Documentos
          </button>
        </div>

        {isDirty && (
          <div className="px-6 pt-4 shrink-0">
            <AlertaAlteracoesPendentes
              visivel={isDirty}
              onSalvar={handleSave}
              salvando={loading}
              posicao="compact"
              mensagem="Existem alterações pendentes neste atendimento. Salve para registrar no banco de dados."
            />
          </div>
        )}
        
        {/* BODY */}

        <div className="flex-1 overflow-y-auto p-6 bg-bg-base space-y-6">
          
          {activeTab === 'detalhes' ? (
            <>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* INFORMACOES DO FALECIDO */}
            <div className="bg-bg-surface rounded-xl border border-border-default p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-bold text-text-base mb-4 uppercase tracking-wider border-b border-border-default pb-2">
                <User className="w-4 h-4 text-primary" /> Dados do Falecido
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-subtle mb-1">Nome Completo</label>
                  {isEditing ? (
                    <input 
                      name="falecido_nome" 
                      value={formData.falecido_nome || ''} 
                      onChange={handleChange} 
                      placeholder="Nome completo"
                      className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm uppercase focus:ring-2 focus:ring-primary/50" 
                    />
                  ) : (
                    <p className="text-sm text-text-base font-medium">{formData.falecido_nome || '-'}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-subtle mb-1">CPF</label>
                    {isEditing ? (
                      <input 
                        name="falecido_cpf" 
                        value={formData.falecido_cpf || ''} 
                        onChange={handleChange} 
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm focus:ring-2 focus:ring-primary/50" 
                      />
                    ) : (
                      <p className="text-sm text-text-base font-medium">{formData.falecido_cpf || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-subtle mb-1">Data Nascimento</label>
                    {isEditing ? (
                      <input type="date" name="falecido_data_nascimento" value={formData.falecido_data_nascimento || ''} onChange={handleChange} className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm" />
                    ) : (
                      <p className="text-sm text-text-base font-medium">{formatLocalDate(formData.falecido_data_nascimento)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* STATUS E LOCAIS */}
            <div className="bg-bg-surface rounded-xl border border-border-default p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-bold text-text-base mb-4 uppercase tracking-wider border-b border-border-default pb-2">
                <MapPin className="w-4 h-4 text-primary" /> Logística
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-subtle mb-1">Status do Atendimento</label>
                  {isEditing ? (
                    <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm">
                      <option value="aberto">Aberto</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  ) : (
                    <div className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border bg-blue-500/10 text-blue-500 border-blue-500/20">
                      {formData.status.replace('_', ' ')}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-subtle mb-1">Local Velório</label>
                    {isEditing ? (
                      <input 
                        name="local_velorio" 
                        value={formData.local_velorio || ''} 
                        onChange={handleChange} 
                        placeholder="Local do velório"
                        className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm uppercase focus:ring-2 focus:ring-primary/50" 
                      />
                    ) : (
                      <p className="text-sm text-text-base font-medium">{formData.local_velorio || '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-subtle mb-1">Local Sepultamento</label>
                    {isEditing ? (
                      <input 
                        name="local_sepultamento" 
                        value={formData.local_sepultamento || ''} 
                        onChange={handleChange} 
                        placeholder="Local do sepultamento"
                        className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm uppercase focus:ring-2 focus:ring-primary/50" 
                      />
                    ) : (
                      <p className="text-sm text-text-base font-medium">{formData.local_sepultamento || '-'}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-subtle mb-1">Data Óbito</label>
                    {isEditing ? (
                      <input type="datetime-local" name="data_obito" value={formData.data_obito || ''} onChange={handleChange} className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm" />
                    ) : (
                      <p className="text-sm text-text-base font-medium">{formData.data_obito ? new Date(formData.data_obito).toLocaleString() : '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-subtle mb-1">Data Velório</label>
                    {isEditing ? (
                      <input type="datetime-local" name="data_velorio" value={formData.data_velorio || ''} onChange={handleChange} className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm" />
                    ) : (
                      <p className="text-sm text-text-base font-medium">{formData.data_velorio ? new Date(formData.data_velorio).toLocaleString() : '-'}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-subtle mb-1">Data Sepultamento</label>
                    {isEditing ? (
                      <input type="datetime-local" name="data_sepultamento" value={formData.data_sepultamento || ''} onChange={handleChange} className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm" />
                    ) : (
                      <p className="text-sm text-text-base font-medium">{formData.data_sepultamento ? new Date(formData.data_sepultamento).toLocaleString() : '-'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ITENS FUNERARIOS */}
          <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border-default flex items-center justify-between bg-bg-subtle">
              <h3 className="flex items-center gap-2 text-sm font-bold text-text-base uppercase tracking-wider">
                <FileText className="w-4 h-4 text-primary" /> Itens do Atendimento
              </h3>
              {isEditing && (
                <button type="button" onClick={addItem} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-semibold transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Item
                </button>
              )}
            </div>
            
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-subtle border-b border-border-default">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium text-center">Qtd</th>
                    <th className="pb-2 font-medium text-right">Valor Unitário</th>
                    <th className="pb-2 font-medium text-center">Cobertura</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    {isEditing && <th className="pb-2 font-medium text-center w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default/50">
                  {itemsList.map((item, idx) => {
                    const itemDef = itens.find(i => i.id === item.item_id);
                    const nomeItem = itemDef ? itemDef.nome : (item.item_nome || 'Item Desconhecido');
                    const total = (item.quantidade || 0) * (item.valor_unitario || 0);
                    return (
                      <tr key={item.id || idx}>
                        <td className="py-3 text-text-base">
                          {isEditing ? (
                            <select 
                              value={item.item_id} 
                              onChange={(e) => {
                                const selected = itens.find(i => i.id === e.target.value);
                                handleItemChange(idx, 'item_id', e.target.value);
                                if (selected) {
                                  handleItemChange(idx, 'valor_unitario', selected.valor_referencia || 0);
                                  handleItemChange(idx, 'item_nome', selected.nome);
                                }
                              }}
                              className="w-full px-2 py-1.5 bg-bg-subtle border border-border-default rounded text-sm min-w-[150px]"
                            >
                              <option value="">Selecione...</option>
                              {itens.map(i => (
                                <option key={i.id} value={i.id}>{i.nome}</option>
                              ))}
                            </select>
                          ) : (
                            nomeItem
                          )}
                        </td>
                        <td className="py-3 text-text-base text-center">
                          {isEditing ? (
                            <input 
                              type="number" 
                              min="1" 
                              value={item.quantidade} 
                              onChange={(e) => handleItemChange(idx, 'quantidade', Number(e.target.value))} 
                              className="w-16 px-2 py-1.5 bg-bg-subtle border border-border-default rounded text-sm text-center mx-auto block" 
                            />
                          ) : (
                            item.quantidade
                          )}
                        </td>
                        <td className="py-3 text-text-base text-right">
                          {isEditing ? (
                            <div className="flex justify-end">
                              <input 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                value={item.valor_unitario} 
                                onChange={(e) => handleItemChange(idx, 'valor_unitario', Number(e.target.value))} 
                                className="w-24 px-2 py-1.5 bg-bg-subtle border border-border-default rounded text-sm text-right" 
                              />
                            </div>
                          ) : (
                            `R$ ${item.valor_unitario?.toFixed(2)}`
                          )}
                        </td>
                        <td className="py-3 text-center">
                           {isEditing ? (
                             <select
                               value={item.coberto ? 'true' : 'false'}
                               onChange={(e) => handleItemChange(idx, 'coberto', e.target.value === 'true')}
                               className="w-full max-w-[120px] px-2 py-1.5 bg-bg-subtle border border-border-default rounded text-sm mx-auto block"
                             >
                               <option value="true">Coberto</option>
                               <option value="false">Não Coberto</option>
                             </select>
                           ) : (
                             item.coberto ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">COBERTO</span>
                             ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">NÃO COBERTO</span>
                             )
                           )}
                        </td>
                        <td className="py-3 text-text-base text-right font-medium">
                          R$ {total.toFixed(2)}
                        </td>
                        {isEditing && (
                          <td className="py-3 text-center">
                            <button onClick={() => removeItem(idx)} type="button" className="p-1.5 text-text-subtle hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors" title="Remover Item">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {itemsList.length === 0 && (
                    <tr>
                      <td colSpan={isEditing ? 6 : 5} className="py-6 text-center text-text-subtle">Nenhum item adicionado a este atendimento.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* FINANCEIRO / PARCELAS */}
          <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden shadow-sm mt-6">
            <div className="p-4 border-b border-border-default flex items-center justify-between bg-bg-subtle">
              <h3 className="flex items-center gap-2 text-sm font-bold text-text-base uppercase tracking-wider">
                <DollarSign className="w-4 h-4 text-emerald-500" /> Histórico Financeiro
              </h3>
            </div>
            <div className="p-4 overflow-x-auto">
              {loadingParcelas ? (
                <div className="text-center text-text-subtle text-sm py-4">Carregando parcelas...</div>
              ) : parcelas.length === 0 ? (
                <div className="text-center text-text-subtle text-sm py-4">Nenhuma parcela vinculada a este atendimento.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-text-subtle border-b border-border-default">
                      <th className="pb-2 font-medium">Parcela</th>
                      <th className="pb-2 font-medium">Vencimento</th>
                      <th className="pb-2 font-medium">Valor</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelas.map((p, idx) => (
                      <tr key={p.id} className="border-b border-border-default/50 last:border-0 hover:bg-bg-subtle/50 transition-colors">
                        <td className="py-3 font-medium text-text-base">{p.numero_parcela}</td>
                        <td className="py-3 text-text-subtle">
                          {p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 text-text-base font-semibold">
                          R$ {p.valor.toFixed(2)}
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase border
                            ${p.status === 'pago' || p.status === 'recebido' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                              p.status === 'pendente' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                              p.status === 'cancelado' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                              'bg-bg-hover text-text-subtle border-border-default'
                            }
                          `}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          
            </>
          ) : (
            <AtendimentoDocumentosGenerator atendimento={atendimento} parcelas={parcelas} />
          )}
        </div>

        {/* FOOTER */}
        {activeTab === 'detalhes' && (
          <div className="px-6 py-4 bg-bg-surface border-t border-border-default flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-text-subtle">
              {isEditing ? (
                <span className="flex items-center gap-1.5 text-amber-500 font-medium bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                  <Edit2 className="w-3.5 h-3.5" /> Modo de edição ativo: faça as alterações e clique em Salvar.
                </span>
              ) : (
                <span className="text-text-muted">
                  Visualizando dados cadastrais e itens do atendimento.
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => {
                  if (isEditing) {
                    setFormData({ ...atendimento });
                    setIsEditing(false);
                  } else {
                    onClose();
                  }
                }}
                className="px-4 py-2 rounded-xl text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors text-sm font-medium"
              >
                {isEditing ? 'Cancelar Edição' : 'Fechar'}
              </button>

              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar Atendimento
                </button>
              ) : (
                <BotaoSalvar
                  salvando={loading}
                  onClick={handleSave}
                  texto="Salvar Alterações"
                  textoSalvando="Salvando Alterações..."
                  textoSalvo="Alterações Salvas!"
                  variante="primary"
                  tamanho="md"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
