import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

find_block = """                  {activeTab === "principal" ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {/* Section: Informações Básicas */}
                      <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">"""

replace_block = """                  {activeTab === "principal" ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-full">
                      {/* Sub-tabs para Dados Principais (Fichários) */}
                      <div className="flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-border-default/50 custom-scrollbar shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("basicas")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "basicas" ? "bg-[#3B82F6]/10 text-[#3B82F6]" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Informações Básicas
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("filiacao")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "filiacao" ? "bg-indigo-500/10 text-indigo-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Filiação
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("contato")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "contato" ? "bg-emerald-500/10 text-emerald-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Contato
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("endereco")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "endereco" ? "bg-amber-500/10 text-amber-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Endereço
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubTab("sistema")}
                          className={`px-4 py-2 text-sm font-semibold whitespace-nowrap rounded-lg transition-colors ${activeSubTab === "sistema" ? "bg-purple-500/10 text-purple-400" : "text-text-subtle hover:text-text-base hover:bg-bg-hover"}`}
                        >
                          Informações do Sistema
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
                      {/* Section: Informações Básicas */}
                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "basicas" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>"""

content = content.replace(find_block, replace_block)


# Section: Filiação
content = content.replace(
    '{/* Section: Filiação */}\n                      <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">',
    '{/* Section: Filiação */}\n                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "filiacao" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>'
)

# Section: Contato
content = content.replace(
    '{/* Section: Contato */}\n                      <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">',
    '{/* Section: Contato */}\n                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "contato" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>'
)

# Section: Endereço
content = content.replace(
    '{/* Section: Endereço */}\n                      <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">',
    '{/* Section: Endereço */}\n                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "endereco" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>'
)

# Section: Sistema
content = content.replace(
    '{/* Section: Sistema */}\n                      <div className="bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6">',
    '{/* Section: Sistema */}\n                      <div className={`bg-bg-subtle/50 p-6 rounded-2xl border border-border-default/50 space-y-6 ${activeSubTab === "sistema" ? "block animate-in fade-in slide-in-from-bottom-2" : "hidden"}`}>'
)

# Close the new div
content = content.replace(
    '                      </div>\n                    </div>\n                  ) : activeTab === "dependentes" ? (',
    '                      </div>\n                      </div>\n                    </div>\n                  ) : activeTab === "dependentes" ? ('
)


with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

