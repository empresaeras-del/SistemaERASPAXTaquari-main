import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

# Add activeSubTab state
if 'const [activeSubTab, setActiveSubTab] = useState<' not in content:
    content = content.replace('  const [isEditingMode, setIsEditingMode] = useState(false);', '  const [isEditingMode, setIsEditingMode] = useState(false);\n  const [activeSubTab, setActiveSubTab] = useState<"basicas" | "filiacao" | "contato" | "endereco" | "sistema">("basicas");')

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

