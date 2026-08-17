import re
with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

target = """    const novoItem: RequisicaoItem = {
      id: crypto.randomUUID(),
      procedimento_id: procObj.id,
      codigo_tuss: procObj.codigo_tuss,
      descricao: procObj.descricao,
      quantidade: qtd,
      valor_unitario: valorUnitario,
      valor_coparticipacao: valorCoparticipacao,
      valor_total: valorUnitario * qtd
    };"""

repl = """    const novoItem: RequisicaoItem = {
      id: crypto.randomUUID(),
      procedimento_id: procObj.id,
      codigo_tuss: procObj.codigo_tuss,
      descricao: procObj.descricao,
      quantidade: qtd,
      valor_unitario: valorUnitario,
      valor_coparticipacao: valorCoparticipacao * qtd,
      valor_total: valorUnitario * qtd
    };"""

content = content.replace(target, repl)
with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
