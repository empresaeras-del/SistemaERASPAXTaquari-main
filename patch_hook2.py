import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

content = content.replace('const { planosAtivos: planos, planos: planosCompletos, calcularValor } = usePlanosPax();', 'const { planosAtivos: planos, planos: planosCompletos, calcularValor } = usePlanosPax();\n  const { fornecedores } = useFornecedores();')

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)
