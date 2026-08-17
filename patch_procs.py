import sys

with open('src/components/credenciados/ProcedimentosCredenciado.tsx', 'r') as f:
    content = f.read()

content = content.replace('disabled={!isOnline}', '')
content = content.replace('disabled={selectedProcIds.size === 0 || !isOnline}', 'disabled={selectedProcIds.size === 0}')

with open('src/components/credenciados/ProcedimentosCredenciado.tsx', 'w') as f:
    f.write(content)
