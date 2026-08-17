import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

find_scroll = """                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">"""
replace_scroll = """                      <div className="space-y-8">"""

content = content.replace(find_scroll, replace_scroll)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

