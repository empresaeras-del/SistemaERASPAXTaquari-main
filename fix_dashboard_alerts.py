import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { ContasAPagarAlert } from '../components/ContasAPagarAlert';", "import { AlertasFinanceiros } from '../components/AlertasFinanceiros';")
content = content.replace("<ContasAPagarAlert />", "<AlertasFinanceiros />")

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)
