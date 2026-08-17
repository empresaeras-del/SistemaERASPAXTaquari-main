import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

find_confirm = """                                      // Se tudo OK, abre modal/confirmação
                                      confirm({
                                          title: "Atenção - Inclusão de Dependente",
                                          message: "A inclusão de novos dependentes deve ser validada entre o gestor e o respectivo associado através de Termo Aditivo, pois podem incorrer em reajuste Contratual.",
                                          confirmText: "Sim, gerar termo aditivo",
                                          cancelText: "Apenas confirmar",
                                          onConfirm: () => {
                                              toast.success("Dependente confirmado. Você poderá gerar o termo aditivo na aba Documentos.");
                                              setSelectedDependenteId(null);
                                          },
                                          onCancel: () => {
                                              toast.success("Dependente confirmado no sistema.");
                                              setSelectedDependenteId(null);
                                          }
                                      });"""

replace_confirm = """                                      // Se tudo OK, abre modal/confirmação
                                      confirm({
                                          title: "Atenção - Inclusão de Dependente",
                                          message: "A inclusão de novos dependentes deve ser validada entre o gestor e o respectivo associado através de Termo Aditivo, pois podem incorrer em reajuste Contratual.\\n\\nAo confirmar, você poderá gerar o aditivo posteriormente na aba Documentos.",
                                          confirmText: "Estou ciente, confirmar",
                                          cancelText: "Cancelar",
                                          onConfirm: () => {
                                              toast.success("Dependente confirmado. Você pode gerar o Termo Aditivo na aba Documentos.");
                                              setSelectedDependenteId(null);
                                          }
                                      });"""

content = content.replace(find_confirm, replace_confirm)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

