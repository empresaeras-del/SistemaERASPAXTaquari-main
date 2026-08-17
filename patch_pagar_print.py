import re

with open('src/pages/ContasPagarPage.tsx', 'r') as f:
    content = f.read()

find_buttons = """        <button onClick={() => navigate('/financeiro/contas-a-pagar/nova')} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20">"""

replace_buttons = """        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Exportar listagem para PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
          <button onClick={() => navigate('/financeiro/contas-a-pagar/nova')} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20">"""

content = content.replace(find_buttons, replace_buttons)

find_button_end = """          <Plus className="w-5 h-5" />
          Nova Despesa
        </button>"""

replace_button_end = """          <Plus className="w-5 h-5" />
          Nova Despesa
        </button>
        </div>"""

content = content.replace(find_button_end, replace_button_end)

if 'Printer' not in content:
    content = content.replace('import { ', 'import { Printer, ')

with open('src/pages/ContasPagarPage.tsx', 'w') as f:
    f.write(content)
