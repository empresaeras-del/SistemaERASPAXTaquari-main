import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

if 'const { fornecedores } = useFornecedores();' not in content:
    content = re.sub(r'(const \{ state \} = useAppContext\(\);\n  const \{ confirm \} = useConfirm\(\);\n  const \{ planosAtivos: planos \} = usePlanosPax\(\);)', r'\1\n  const { fornecedores } = useFornecedores();', content)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)
