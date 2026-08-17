import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

find_save = """                             <button
                                type="button"
                                onClick={() => setSelectedDependenteId(null)}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-colors"
                             >
                                <CheckCircle className="w-4 h-4" />
                                Confirmar Dependente
                             </button>"""

replace_save = """                             <button
                                type="button"
                                onClick={() => {
                                  const idx = editingAssociado.dependentes?.findIndex(d => d.id === selectedDependenteId);
                                  if (idx !== undefined && idx !== -1) {
                                      const dep = editingAssociado.dependentes![idx];
                                      if (!dep.nome || !dep.cpf || !dep.data_nascimento || !dep.parentesco) {
                                          toast.error("Preencha todos os campos do dependente antes de confirmar.");
                                          return;
                                      }
                                      
                                      // Se tudo OK, abre modal/confirmação
                                      confirm({
                                          title: "Atenção - Inclusão de Dependente",
                                          description: "A inclusão de novos dependentes deve ser validada entre o gestor e o respectivo associado através de Termo Aditivo, pois podem incorrer em reajuste Contratual.",
                                          confirmText: "Sim, gerar termo aditivo e confirmar",
                                          cancelText: "Apenas confirmar no sistema",
                                          onConfirm: () => {
                                              // Implementação para gerar termo pode ir aqui, ou navegar para a aba documentos
                                              toast.success("Dependente confirmado. Você poderá gerar o termo aditivo na aba Documentos.");
                                              setSelectedDependenteId(null);
                                          },
                                          onCancel: () => {
                                              toast.success("Dependente confirmado no sistema.");
                                              setSelectedDependenteId(null);
                                          }
                                      });
                                  } else {
                                      setSelectedDependenteId(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-sm font-bold hover:bg-emerald-500/20 transition-colors"
                             >
                                <CheckCircle className="w-4 h-4" />
                                Confirmar Dependente
                             </button>"""

content = content.replace(find_save, replace_save)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

