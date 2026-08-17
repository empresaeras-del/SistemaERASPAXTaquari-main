import re

with open('src/pages/ContratosPage.tsx', 'r') as f:
    content = f.read()

find_buttons = """          <button
            onClick={exportarCSV}"""

replace_buttons = """          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-base border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            title="Exportar listagem para PDF"
          >
            <Printer className="w-4 h-4 text-text-subtle" />
            <span>Exportar PDF</span>
          </button>
          <button
            onClick={exportarCSV}"""

content = content.replace(find_buttons, replace_buttons)

with open('src/pages/ContratosPage.tsx', 'w') as f:
    f.write(content)
