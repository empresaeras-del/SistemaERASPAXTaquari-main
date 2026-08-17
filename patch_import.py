import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

# add useFornecedores
if 'useFornecedores' not in content:
    content = re.sub(r'(import \{ usePlanosPax \} from "../hooks/usePlanosPax";)', r'\1\nimport { useFornecedores } from "../hooks/useFornecedores";', content)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)
