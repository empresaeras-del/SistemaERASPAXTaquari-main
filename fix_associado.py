import os

file_path = "src/components/associados/AssociadoFormModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace missing explicit anys
replacements = [
    ("const duplicateUser = associados.find(a =>", "const duplicateUser = associados.find((a: any) =>"),
    ("editingAssociado.dependentes.filter((dep) =>", "editingAssociado.dependentes.filter((dep: any) =>"),
    ("editingAssociado.dependentes.map((dep, index) =>", "editingAssociado.dependentes.map((dep: any, index: number) =>"),
    (".map((p) => p[0])", ".map((p: any) => p[0])"),
    ("editingAssociado.historico_contratos.map((hist) =>", "editingAssociado.historico_contratos.map((hist: any) =>"),
    ("existingCpfs={(editingAssociado.dependentes || []).map((d) => d.cpf ||", "existingCpfs={(editingAssociado.dependentes || []).map((d: any) => d.cpf ||"),
]

for old, new_ in replacements:
    content = content.replace(old, new_)

# Add Associado type import
import_stmt = "import { Associado } from '../../services/associadosService';\n"
if "import { Associado }" not in content:
    content = content.replace("import { uploadDocumentoAssociado }", import_stmt + "import { uploadDocumentoAssociado }")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Remaining fixes applied.")
