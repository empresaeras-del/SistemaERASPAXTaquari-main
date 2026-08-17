import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

if "import { Plus, Search, CheckCircle" not in content:
    content = content.replace("import { Plus, Search,", "import { Plus, Search, CheckCircle,")

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

