import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

find_buttons = """        <div className="flex items-center gap-3">
          <button"""

replace_buttons = """        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors"
            title="Exportar listagem para PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
          <button"""

content = content.replace(find_buttons, replace_buttons)

if 'Printer' not in content:
    content = content.replace('import { Phone, ClipboardList', 'import { Printer, Phone, ClipboardList')

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)
