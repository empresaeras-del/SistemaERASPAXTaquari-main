import re

with open('src/pages/Configuracoes.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "import { SistemaBackupPanel } from '../components/configuracoes/SistemaBackupPanel';",
    "import { SistemaBackupPanel } from '../components/configuracoes/SistemaBackupPanel';\nimport { MensagensConfigTab } from '../components/configuracoes/MensagensConfigTab';"
)

find_sistema_panel = """      {activeTab === "sistema" && (
        <SistemaBackupPanel />
      )}"""

replace_sistema_panel = """      {activeTab === "sistema" && (
        <SistemaBackupPanel />
      )}

      {activeTab === "mensagens" && (
        <MensagensConfigTab />
      )}"""

content = content.replace(find_sistema_panel, replace_sistema_panel)

# Also fix the icon import if MessageCircle is missing in Configuracoes.tsx
if 'MessageCircle' not in content:
    content = content.replace('MessageSquare,', 'MessageSquare, MessageCircle,')
    if 'MessageCircle' not in content: # If MessageSquare wasn't there
        content = content.replace('import {', 'import { MessageCircle,', 1)

with open('src/pages/Configuracoes.tsx', 'w') as f:
    f.write(content)
