import re

with open('src/pages/ItensFunerariosPage.tsx', 'r') as f:
    content = f.read()

# ADD IMPORTS
if 'import { Building2, Plus, Search, Pencil, Power, PowerOff, Package, CheckCircle, XCircle, LayoutGrid, List, Filter }' not in content:
    content = content.replace("import { Plus, Search, Pencil, Power, PowerOff, Package, CheckCircle, XCircle, LayoutGrid } from 'lucide-react';", "import { Building2, Plus, Search, Pencil, Power, PowerOff, Package, CheckCircle, XCircle, LayoutGrid, List, Filter } from 'lucide-react';")

# ADD viewMode state
if 'const [viewMode, setViewMode] = useState<' not in content:
    content = content.replace('const [previewItem, setPreviewItem] = useState<ItemFunerario | null>(null);', 'const [previewItem, setPreviewItem] = useState<ItemFunerario | null>(null);\n  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");')

with open('src/pages/ItensFunerariosPage.tsx', 'w') as f:
    f.write(content)

