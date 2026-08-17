import re

with open('src/pages/ContasReceberPage.tsx', 'r') as f:
    content = f.read()

find_sync = """  const handleWhatsAppCobrança = (parcela: ParcelaReceber) => {
    const msg = generateCobrançaTemplate("""

replace_async = """  const handleWhatsAppCobrança = async (parcela: ParcelaReceber) => {
    const msg = await generateCobrançaTemplate("""

content = content.replace(find_sync, replace_async)

with open('src/pages/ContasReceberPage.tsx', 'w') as f:
    f.write(content)

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

find_sync_menu = """  const handleWhatsAppMenu = (associado: Associado) => {"""
replace_async_menu = """  const handleWhatsAppMenu = async (associado: Associado) => {"""

content = content.replace(find_sync_menu, replace_async_menu)

content = content.replace("msg = generateBoasVindasTemplate(associado.nome);", "msg = await generateBoasVindasTemplate(associado.nome);")
content = content.replace("msg = generateRenovacaoTemplate(associado.nome, (associado as any).plano || \"\");", "msg = await generateRenovacaoTemplate(associado.nome, (associado as any).plano || \"\");")

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

