import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

old_code = """          const parsed = JSON.parse(saved);
          const missing = defaultWidgets.filter(dw => !parsed.find((cw: WidgetConfig) => cw.id === dw.id));
          setLayout([...parsed, ...missing]);"""

new_code = """          const parsed = JSON.parse(saved);
          const missing = defaultWidgets.filter(dw => !parsed.find((cw: WidgetConfig) => cw.id === dw.id));
          // Se o atalhos rápidos for recém-adicionado (está em missing), coloca no topo
          const atalhos = missing.filter(m => m.id === 'atalhos_rapidos');
          const others = missing.filter(m => m.id !== 'atalhos_rapidos');
          setLayout([...atalhos, ...parsed, ...others]);"""

if old_code in content:
    content = content.replace(old_code, new_code)
else:
    print("Code not found")

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)
