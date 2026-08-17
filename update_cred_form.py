import re

filepath = 'src/pages/CredenciadosPage.tsx'
with open(filepath, 'r') as f:
    content = f.read()

responsavel_endereco_html = """
                    {/* Responsável e Contato */}
                    <div className="space-y-4 pt-4 border-t border-border-default">
                      <h4 className="text-sm font-semibold text-[#3B82F6] uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4" /> Responsável
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-text-muted mb-1">Nome do Responsável</label>
                          <input 
                            value={formData.responsavel_nome || ''}
                            onChange={e => setFormData({...formData, responsavel_nome: e.target.value})}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-text-muted mb-1">Telefone do Responsável</label>
                          <input 
                            value={formData.responsavel_telefone || ''}
                            onChange={e => setFormData({...formData, responsavel_telefone: e.target.value})}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Endereço */}
                    <div className="space-y-4 pt-4 border-t border-border-default">
                      <h4 className="text-sm font-semibold text-[#3B82F6] uppercase tracking-wider flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Endereço Completo
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-text-muted mb-1">CEP</label>
                          <input 
                            value={formData.cep || ''}
                            onChange={e => setFormData({...formData, cep: e.target.value})}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]" 
                          />
                        </div>
                        <div className="md:col-span-7">
                          <label className="block text-sm font-medium text-text-muted mb-1">Endereço</label>
                          <input 
                            value={formData.endereco || ''}
                            onChange={e => setFormData({...formData, endereco: e.target.value})}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]" 
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-text-muted mb-1">Número</label>
                          <input 
                            value={formData.numero || ''}
                            onChange={e => setFormData({...formData, numero: e.target.value})}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]" 
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-sm font-medium text-text-muted mb-1">Complemento</label>
                          <input 
                            value={formData.complemento || ''}
                            onChange={e => setFormData({...formData, complemento: e.target.value})}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]" 
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-sm font-medium text-text-muted mb-1">Bairro</label>
                          <input 
                            value={formData.bairro || ''}
                            onChange={e => setFormData({...formData, bairro: e.target.value})}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]" 
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-text-muted mb-1">Cidade</label>
                          <input 
                            value={formData.cidade || ''}
                            onChange={e => setFormData({...formData, cidade: e.target.value})}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]" 
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-sm font-medium text-text-muted mb-1">UF</label>
                          <input 
                            value={formData.estado || ''}
                            onChange={e => setFormData({...formData, estado: e.target.value})}
                            className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6]" 
                            maxLength={2}
                          />
                        </div>
                      </div>
                    </div>
"""

content = content.replace("                    {/* Dados Bancários */}", responsavel_endereco_html + "\n                    {/* Dados Bancários */}")

# Replace import {
content = content.replace("import {\n  Plus", "import {\n  Users, Plus")

with open(filepath, 'w') as f:
    f.write(content)
