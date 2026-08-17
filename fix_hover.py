import re

with open('src/components/layout/Sidebar.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'group-hover:bg-[#1A1D36]',
    'group-hover:bg-bg-hover'
)
content = content.replace(
    'bg-[#1A1D36]',
    'bg-bg-hover'
)

with open('src/components/layout/Sidebar.tsx', 'w') as f:
    f.write(content)
