import sys

with open('src/components/layout/Sidebar.tsx', 'r') as f:
    content = f.read()

print("open-welcome-modal in content:", 'open-welcome-modal' in content)
