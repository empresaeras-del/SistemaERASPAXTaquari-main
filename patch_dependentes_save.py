import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

find_save = """                          <div className="flex justify-between items-center mb-4">
                             <button
                                type="button"
                                onClick={() => setSelectedDependenteId(null)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle border border-border-default text-text-muted rounded-lg text-sm font-medium hover:bg-[#64748B] transition-colors"
                             >
                                Voltar
                             </button>
                          </div>"""

replace_save = """                          <div className="flex justify-between items-center mb-4">
                             <button
                                type="button"
                                onClick={() => {
                                  // Find current index
                                  const idx = editingAssociado.dependentes?.findIndex(d => d.id === selectedDependenteId);
                                  if (idx !== undefined && idx !== -1) {
                                      const dep = editingAssociado.dependentes![idx];
                                      // If user clicks Voltar and the record is virtually empty, auto-remove it to clean up
                                      if (!dep.nome && !dep.cpf && !dep.data_nascimento && !dep.parentesco) {
                                          const novosDeps = [...editingAssociado.dependentes!];
                                          novosDeps.splice(idx, 1);
                                          setEditingAssociado({ ...editingAssociado, dependentes: novosDeps });
                                      }
                                  }
                                  setSelectedDependenteId(null)
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-subtle border border-border-default text-text-muted rounded-lg text-sm font-medium hover:bg-bg-hover transition-colors"
                             >
                                Voltar e Cancelar
                             </button>
                             
                             <button
                                type="button"
                                onClick={() => setSelectedDependenteId(null)}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-colors"
                             >
                                <CheckCircle className="w-4 h-4" />
                                Confirmar Dependente
                             </button>
                          </div>"""

content = content.replace(find_save, replace_save)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

