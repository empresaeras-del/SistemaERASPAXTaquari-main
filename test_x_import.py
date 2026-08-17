import sys

with open('src/pages/CredenciadosPage.tsx', 'r') as f:
    content = f.read()

print("X in content:", 'X' in content)
