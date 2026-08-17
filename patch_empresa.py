import re

with open('src/services/empresasService.ts', 'r') as f:
    content = f.read()

content = content.replace("status: 'ativo' | 'inativo';", "status: 'ativo' | 'inativo';\n  chave_pix?: string;\n  cidade_pix?: string;")

with open('src/services/empresasService.ts', 'w') as f:
    f.write(content)

with open('src/pages/Configuracoes.tsx', 'r') as f:
    content = f.read()

find_input = """                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Endereço
                    </label>
                    <input
                      type="text"
                      value={editingEmpresa.endereco || ""}
                      onChange={(e) =>
                        setEditingEmpresa({
                          ...editingEmpresa,
                          endereco: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-slate-300 focus:outline-none focus:border-[#7E4CF3] transition-colors"
                    />
                  </div>"""

replace_input = """                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Endereço
                    </label>
                    <input
                      type="text"
                      value={editingEmpresa.endereco || ""}
                      onChange={(e) =>
                        setEditingEmpresa({
                          ...editingEmpresa,
                          endereco: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-slate-300 focus:outline-none focus:border-[#7E4CF3] transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Chave PIX
                    </label>
                    <input
                      type="text"
                      value={editingEmpresa.chave_pix || ""}
                      onChange={(e) =>
                        setEditingEmpresa({
                          ...editingEmpresa,
                          chave_pix: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-slate-300 focus:outline-none focus:border-[#7E4CF3] transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="block text-sm font-semibold text-slate-300 mb-1">
                      Cidade PIX
                    </label>
                    <input
                      type="text"
                      value={editingEmpresa.cidade_pix || ""}
                      onChange={(e) =>
                        setEditingEmpresa({
                          ...editingEmpresa,
                          cidade_pix: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 bg-[#101223] border border-[#262A45] rounded-xl text-slate-300 focus:outline-none focus:border-[#7E4CF3] transition-colors"
                    />
                  </div>"""

content = content.replace(find_input, replace_input)

with open('src/pages/Configuracoes.tsx', 'w') as f:
    f.write(content)
