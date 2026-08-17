import re

filepath = 'src/pages/Atendimentos.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# Add import
import_code = "import { AtendimentoDetailsModal } from '../components/atendimentos/AtendimentoDetailsModal';\n"
if "AtendimentoDetailsModal" not in content:
    content = content.replace(
        "import { NovoAtendimentoWizard }",
        import_code + "import { NovoAtendimentoWizard }"
    )

# Add state for viewing atendimento
state_code = "  const [viewAtendimento, setViewAtendimento] = useState<Atendimento | null>(null);\n"
if "viewAtendimento" not in content:
    content = content.replace(
        "const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);",
        "const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);\n" + state_code
    )

# Add onClick to card
card_div = 'className="bg-bg-surface border border-border-default rounded-2xl overflow-hidden hover:border-primary/30 transition-colors shadow-sm group flex flex-col"'
new_card_div = 'onClick={() => setViewAtendimento(a)} className="bg-bg-surface border border-border-default rounded-2xl overflow-hidden hover:border-primary/30 transition-colors shadow-sm group flex flex-col cursor-pointer"'
content = content.replace(card_div, new_card_div)

# Add modal render
modal_code = """
      {viewAtendimento && (
        <AtendimentoDetailsModal 
          atendimento={viewAtendimento}
          onClose={() => setViewAtendimento(null)}
          onSaved={() => {
            setViewAtendimento(null);
            loadData();
          }}
        />
      )}
"""
if "viewAtendimento &&" not in content:
    content = content.replace(
        "{isWizardOpen && (",
        modal_code + "\n      {isWizardOpen && ("
    )

with open(filepath, 'w') as f:
    f.write(content)
