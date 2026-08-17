import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

find_state = """  const [isEditingMode, setIsEditingMode] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"basicas" | "filiacao" | "contato" | "endereco" | "sistema">("basicas");
  const [showDependentesModal, setShowDependentesModal] = useState(false);"""

replace_state = """  const [isEditingMode, setIsEditingMode] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"basicas" | "filiacao" | "contato" | "endereco" | "sistema">("basicas");
  const [showDependentesModal, setShowDependentesModal] = useState(false);
  const [buscaDependenteInterno, setBuscaDependenteInterno] = useState("");"""

content = content.replace(find_state, replace_state)

find_tab = """                  ) : activeTab === "dependentes" ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-text-base font-medium">Dependentes</h4>
                        {!selectedDependenteId && (
                        <button
                          type="button"
                          onClick={() => {
                            const newId = Math.random().toString(36).substring(7);
                            setEditingAssociado({
                              ...editingAssociado,
                              dependentes: [
                                ...(editingAssociado.dependentes || []),
                                {
                                  id: newId,
                                  nome: "",
                                  cpf: "",
                                  data_nascimento: "",
                                  parentesco: "",
                                },
                              ],
                            });
                            setSelectedDependenteId(newId);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-hover border border-[#64748B] text-text-base rounded-lg text-sm font-medium hover:bg-[#64748B] transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar
                        </button>
                        )}
                      </div>

                      {!selectedDependenteId ? (
                        <>
                          {!editingAssociado.dependentes ||
                          editingAssociado.dependentes.length === 0 ? (
                            <div className="text-center py-12 border border-dashed border-border-default rounded-xl">
                              <p className="text-text-subtle text-sm">
                                Nenhum dependente cadastrado.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {editingAssociado.dependentes.map((dep, index) => ("""

replace_tab = """                  ) : activeTab === "dependentes" ? (
                    <div className="space-y-6 flex flex-col h-full">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <h4 className="text-xl font-bold text-text-base flex items-center gap-2">
                            <Users className="w-6 h-6 text-[#3B82F6]" />
                            Dependentes
                          </h4>
                          {!selectedDependenteId && (
                            <span className="px-3 py-1 bg-[#3B82F6]/10 text-[#3B82F6] rounded-full text-sm font-bold border border-[#3B82F6]/20">
                              {editingAssociado.dependentes?.length || 0} cadastrados
                            </span>
                          )}
                        </div>

                        {!selectedDependenteId && (
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              type="text"
                              placeholder="Buscar dependente..."
                              value={buscaDependenteInterno}
                              onChange={(e) => setBuscaDependenteInterno(e.target.value)}
                              className="w-full sm:w-64 bg-bg-subtle border border-border-default rounded-xl pl-9 pr-4 py-2 text-text-base focus:outline-none focus:border-[#3B82F6] text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newId = Math.random().toString(36).substring(7);
                              setEditingAssociado({
                                ...editingAssociado,
                                dependentes: [
                                  ...(editingAssociado.dependentes || []),
                                  {
                                    id: newId,
                                    nome: "",
                                    cpf: "",
                                    data_nascimento: "",
                                    parentesco: "",
                                  },
                                ],
                              });
                              setSelectedDependenteId(newId);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                          >
                            <Plus className="w-4 h-4" />
                            Novo Dependente
                          </button>
                        </div>
                        )}
                      </div>

                      {!selectedDependenteId ? (
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                          {!editingAssociado.dependentes ||
                          editingAssociado.dependentes.length === 0 ? (
                            <div className="text-center py-20 bg-bg-subtle border border-dashed border-border-default rounded-2xl">
                              <Users className="w-12 h-12 mx-auto text-text-subtle mb-3 opacity-50" />
                              <p className="text-text-base font-semibold mb-1">Nenhum dependente</p>
                              <p className="text-text-subtle text-sm">
                                Este associado ainda não possui dependentes cadastrados.
                              </p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {editingAssociado.dependentes
                                .filter(dep => !buscaDependenteInterno || dep.nome.toLowerCase().includes(buscaDependenteInterno.toLowerCase()))
                                .map((dep, index) => ("""

content = content.replace(find_tab, replace_tab)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

