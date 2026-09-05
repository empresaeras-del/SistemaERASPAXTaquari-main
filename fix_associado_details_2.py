import os

file_path = "src/pages/Associados.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Add previewAssociado to destructuring
if "previewAssociado," not in content and "setPreviewAssociado," in content:
    content = content.replace("setPreviewAssociado,", "previewAssociado,\n    setPreviewAssociado,")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("previewAssociado destructured.")
