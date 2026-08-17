import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

# 1. Add Resumo to activeTab state type
content = content.replace(
    '  const [activeTab, setActiveTab] = useState<\n    "principal" | "dependentes" | "contratos" | "mensalidades" | "documentos" | "requisicoes" | "atendimentos"\n  >("principal");',
    '  const [activeTab, setActiveTab] = useState<\n    "resumo" | "principal" | "dependentes" | "contratos" | "mensalidades" | "documentos" | "requisicoes" | "atendimentos"\n  >("principal");'
)

# Also handle single-line case if it was reformatted
content = content.replace(
    '  const [activeTab, setActiveTab] = useState<"principal" | "dependentes" | "contratos" | "mensalidades" | "documentos" | "requisicoes" | "atendimentos">("principal");',
    '  const [activeTab, setActiveTab] = useState<"resumo" | "principal" | "dependentes" | "contratos" | "mensalidades" | "documentos" | "requisicoes" | "atendimentos">("principal");'
)


# 2. Add button to Sidebar in editing mode
btn_resumo = """              {isEditingMode ? (
                <div className="w-64 border-r border-border-default bg-bg-surface/30 flex flex-col py-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const form = document.getElementById("associado-form") as HTMLFormElement;
                      if (form && !form.checkValidity()) {
                        form.reportValidity();
                        toast.error("Preencha todos os campos obrigatórios (*) antes de mudar de aba.");
                        return;
                      }
                      setActiveTab("resumo");
                    }}
                    className={`px-6 py-3 text-left font-medium text-sm transition-colors border-l-2 flex items-center gap-3 ${
                      activeTab === "resumo"
                        ? "border-[#3B82F6] text-[#3B82F6] bg-[#3B82F6]/10"
                        : "border-transparent text-text-subtle hover:text-text-base hover:bg-white/5"
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    Resumo Financeiro
                  </button>
                  <button"""

content = content.replace('              {isEditingMode ? (\n                <div className="w-64 border-r border-border-default bg-bg-surface/30 flex flex-col py-4 shrink-0">\n                  <button', btn_resumo)

# 3. Import the tab component
if "AssociadoResumoFinanceiroTab" not in content:
    content = content.replace('import { AssociadoRequisicoesTab } from "../components/associados/AssociadoRequisicoesTab";', 'import { AssociadoRequisicoesTab } from "../components/associados/AssociadoRequisicoesTab";\nimport { AssociadoResumoFinanceiroTab } from "../components/associados/AssociadoResumoFinanceiroTab";')

# 4. Render the tab
tab_render = """                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  {activeTab === "resumo" ? (
                    <AssociadoResumoFinanceiroTab associado={editingAssociado} />
                  ) : activeTab === "principal" ? ("""

content = content.replace('                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">\n                  {activeTab === "principal" ? (', tab_render)

content = content.replace('                <div className="flex-1 overflow-y-auto p-8">\n                  {activeTab === "principal" ? (', tab_render)


with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

