import os

file_path = "src/components/associados/AssociadoFormModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace missing explicit anys
replacements = [
    ("editingAssociado.dependentes.filter((dep) =>", "editingAssociado.dependentes.filter((dep: any) =>"),
    ("editingAssociado.dependentes.map((dep, index) =>", "editingAssociado.dependentes.map((dep: any, index: number) =>"),
    ("editingAssociado.historico_contratos.map((hist) =>", "editingAssociado.historico_contratos.map((hist: any) =>"),
]

for old, new_ in replacements:
    content = content.replace(old, new_)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Remaining fixes applied.")
