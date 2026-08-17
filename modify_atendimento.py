import re

filepath = 'src/components/atendimentos/AtendimentoDetailsModal.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# Add import for Trash2, Plus
if 'Trash2' not in content:
    content = content.replace('X, Save, Edit2, Calendar, MapPin, User, FileText, CheckCircle, Clock', 'X, Save, Edit2, Calendar, MapPin, User, FileText, CheckCircle, Clock, Trash2, Plus')
if 'Trash2' not in content:
    content = content.replace("import { X, Save, Edit2, Calendar, MapPin, User, FileText, CheckCircle, Clock } from 'lucide-react';", "import { X, Save, Edit2, Calendar, MapPin, User, FileText, CheckCircle, Clock, Trash2, Plus } from 'lucide-react';")

# 1. Update form logic
extra_funcs = """
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
      id: crypto.randomUUID(),
      atendimento_id: atendimento.id,
      item_id: '',
      quantidade: 1,
      valor_unitario: 0,
      coberto: true,
      item_nome: ''
    }]);
  };
"""
if 'handleItemChange' not in content:
    content = content.replace('const handleChange =', extra_funcs + '\n  const handleChange =')

# 2. Add logistics fields
logistics_old = """
                <div>
                   <label className="block text-xs font-semibold text-text-subtle mb-1">Data Óbito</label>
                   {isEditing ? (
                     <input type="datetime-local" name="data_obito" value={formData.data_obito || ''} onChange={handleChange} className="w-full px-3 py-2 bg-bg-subtle border border-border-default rounded-lg text-sm" />
                   ) : (
                     <p className="text-sm text-text-base font-medium">{formData.data_obito ? new Date(formData.data_obito).toLocaleString() : '-'}</p>
                   )}
                </div>
              </div>
            </div>
"""

logistics_new = """
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
"""
content = content.replace(logistics_old.strip(), logistics_new.strip())

# 3. Update items table

items_old = """
          <div className="bg-bg-surface rounded-xl border border-border-default overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border-default flex items-center justify-between bg-bg-subtle">
              <h3 className="flex items-center gap-2 text-sm font-bold text-text-base uppercase tracking-wider">
                <FileText className="w-4 h-4 text-primary" /> Itens do Atendimento
              </h3>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default/50">
                  {itemsList.map((item, idx) => {
                    const itemDef = itens.find(i => i.id === item.item_id);
                    const nomeItem = itemDef ? itemDef.nome : (item.item_nome || 'Item Desconhecido');
                    const total = (item.quantidade || 0) * (item.valor_unitario || 0);
                    return (
                      <tr key={item.id || idx}>
                        <td className="py-3 text-text-base">{nomeItem}</td>
                        <td className="py-3 text-text-base text-center">{item.quantidade}</td>
                        <td className="py-3 text-text-base text-right">R$ {item.valor_unitario?.toFixed(2)}</td>
                        <td className="py-3 text-center">
                           {item.coberto ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">COBERTO</span>
                           ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">NÃO COBERTO</span>
                           )}
                        </td>
                        <td className="py-3 text-text-base text-right font-medium">
                          R$ {total.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {itemsList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-text-subtle">Nenhum item adicionado a este atendimento.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
"""

items_new = """
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
                                  handleItemChange(idx, 'valor_unitario', selected.preco_base || 0);
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
"""

content = content.replace(items_old.strip(), items_new.strip())

with open(filepath, 'w') as f:
    f.write(content)

