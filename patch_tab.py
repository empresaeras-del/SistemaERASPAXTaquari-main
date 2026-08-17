import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

new_ui = """
                      <div className="bg-bg-surface p-5 rounded-xl border border-border-default space-y-4 mb-4">
                        <h5 className="text-sm font-semibold text-text-subtle">
                          Tipo de Contrato / Pessoa
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-text-subtle mb-1">Tipo de Pessoa *</label>
                            <select 
                              value={editingAssociado.tipo_pessoa || 'PF'}
                              onChange={(e) => setEditingAssociado({ ...editingAssociado, tipo_pessoa: e.target.value as 'PF' | 'PJ' })}
                              className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none transition-all"
                            >
                              <option value="PF">Pessoa Física (PF)</option>
                              <option value="PJ">Pessoa Jurídica (PJ)</option>
                            </select>
                          </div>
                          {editingAssociado.tipo_pessoa === 'PJ' && (
                            <div>
                              <label className="block text-xs font-medium text-text-subtle mb-1">Empresa / Convenio (Fornecedor) *</label>
                              <select 
                                value={editingAssociado.fornecedor_id || ''}
                                onChange={(e) => setEditingAssociado({ ...editingAssociado, fornecedor_id: e.target.value })}
                                required
                                className="w-full bg-bg-base border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-base focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none transition-all"
                              >
                                <option value="">Selecione a empresa conveniada</option>
                                {fornecedores.filter(f => f.categoria === 'Convenios Associados' && f.status === 'ativo').map(f => (
                                  <option key={f.id} value={f.id}>{f.razao_social || f.nome_fantasia}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      {!selectedContratoId ? ("""

content = content.replace('{!selectedContratoId ? (', new_ui)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)
