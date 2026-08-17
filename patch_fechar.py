import re

with open('src/services/caixasService.ts', 'r') as f:
    content = f.read()

target = r"""  const lotes = await getLotesCaixa\(isOnline, lote\.tenant_id\);
  const loteAbertoAtual = lotes\.find\(l => l\.status === 'aberto'\);
  if \(loteAbertoAtual\) \{
    throw new Error\('Não é possível reabrir este lote, pois já existe um lote aberto \(' \+ loteAbertoAtual\.codigo_lote \+ '\)\. Feche o lote atual antes de reabrir um anterior\.'\);
  \}"""

repl = """  // Fechamento allowed
"""

content = re.sub(target, repl, content)

with open('src/services/caixasService.ts', 'w') as f:
    f.write(content)
