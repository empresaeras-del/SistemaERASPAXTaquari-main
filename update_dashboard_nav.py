import re

with open('src/components/AlertasFinanceiros.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "navigate(`/financeiro/contas-a-pagar/${conta.despesa_id}/editar`)",
    "navigate('/financeiro/contas-a-pagar', { state: { openDetails: conta.id } })"
)

content = content.replace(
    "navigate(`/financeiro/contas-a-receber/${conta.receita_id}/editar`)",
    "navigate('/financeiro/contas-a-receber', { state: { openDetails: conta.id } })"
)

with open('src/components/AlertasFinanceiros.tsx', 'w') as f:
    f.write(content)
