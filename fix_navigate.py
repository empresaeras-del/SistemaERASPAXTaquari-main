with open('src/components/AlertasFinanceiros.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'navigate(`/financeiro/contas-a-pagar/${conta.id}/editar`)',
    'navigate(`/financeiro/contas-a-pagar/${conta.despesa_id}/editar`)'
)

content = content.replace(
    'navigate(`/financeiro/contas-a-receber/${conta.id}/editar`)',
    'navigate(`/financeiro/contas-a-receber/${conta.receita_id}/editar`)'
)

with open('src/components/AlertasFinanceiros.tsx', 'w') as f:
    f.write(content)
