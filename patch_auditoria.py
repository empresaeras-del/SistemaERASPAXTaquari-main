import re

with open('src/pages/Auditoria.tsx', 'r') as f:
    content = f.read()

# Add import for usePrintPreview
if "usePrintPreview" not in content:
    content = content.replace("import { useAppContext }", "import { useAppContext } from '../context/AppContext';\nimport { usePrintPreview } from '../hooks/usePrintPreview';")
    content = content.replace("import { useAppContext } from '../context/AppContext';\nimport { useAppContext } from '../context/AppContext';", "import { useAppContext } from '../context/AppContext';")

# Add state
if "const [isPreviewPrint, setIsPreviewPrint] = useState(false);" not in content:
    content = content.replace("const [searchTerm, setSearchTerm] = useState('');", "const [searchTerm, setSearchTerm] = useState('');\n  const [isPreviewPrint, setIsPreviewPrint] = useState(false);\n  usePrintPreview(isPreviewPrint);")

# Add toggle button
button_code = """        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPreviewPrint(!isPreviewPrint)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors shadow-sm preview-toggle ${isPreviewPrint ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default'}`}
            title={isPreviewPrint ? 'Sair da Visualização' : 'Visualizar Impressão'}
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{isPreviewPrint ? 'Sair Visualização' : 'Ver Impressão'}</span>
          </button>
          
          <button 
            onClick={handleExportReaberturasPDF}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-sm transition-colors shadow-sm no-print"
          >
            <Printer className="w-4 h-4" />
            Exportar Reaberturas
          </button>
        </div>"""

old_button = """        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportReaberturasPDF}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl font-medium text-sm transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Exportar Reaberturas
          </button>
        </div>"""

if "setIsPreviewPrint(!isPreviewPrint)" not in content:
    content = content.replace(old_button, button_code)

with open('src/pages/Auditoria.tsx', 'w') as f:
    f.write(content)
