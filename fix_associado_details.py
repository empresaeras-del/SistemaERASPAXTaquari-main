import os

file_path = "src/pages/Associados.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add import
import_stmt = "import { AssociadoDetailsModal } from '../components/associados/AssociadoDetailsModal';\n"
if "import { AssociadoDetailsModal }" not in content:
    content = content.replace("import { AssociadoFormModal }", import_stmt + "import { AssociadoFormModal }")

# Add component render
render_stmt = """
      {previewAssociado && (
        <AssociadoDetailsModal
          associado={previewAssociado}
          onClose={() => setPreviewAssociado(null)}
          onEdit={handleOpenModal}
        />
      )}
"""
if "<AssociadoDetailsModal" not in content:
    content = content.replace("<AssociadoFormModal {...associadosState} />", "<AssociadoFormModal {...associadosState} />\n" + render_stmt)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Modal added.")
