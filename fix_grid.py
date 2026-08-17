import re
with open('src/components/AlertasFinanceiros.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'<div className="grid grid-cols-1 \$\{alertasPagar[^"]+ gap-6 mb-8">', '<div className={`grid grid-cols-1 ${alertasPagar.length > 0 && alertasReceber.length > 0 ? "xl:grid-cols-2" : ""} gap-6 mb-8`}>', content)

with open('src/components/AlertasFinanceiros.tsx', 'w') as f:
    f.write(content)
