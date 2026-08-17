import re

with open('src/services/associadosService.ts', 'r') as f:
    content = f.read()

content = re.sub(r'plano_id\?: string;\n', r"plano_id?: string;\n  tipo_pessoa?: 'PF' | 'PJ';\n  fornecedor_id?: string;\n", content)

with open('src/services/associadosService.ts', 'w') as f:
    f.write(content)
