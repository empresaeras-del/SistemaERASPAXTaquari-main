import re

with open('src/pages/FaturamentosPage.tsx', 'r') as f:
    content = f.read()

# Add import for usePrintPreview
if "usePrintPreview" not in content:
    content = content.replace("import { useAppContext }", "import { useAppContext } from '../context/AppContext';\nimport { usePrintPreview } from '../hooks/usePrintPreview';")
    content = content.replace("import { useAppContext } from '../context/AppContext';\nimport { useAppContext } from '../context/AppContext';", "import { useAppContext } from '../context/AppContext';")

# Add state
if "const [isPreviewPrint, setIsPreviewPrint] = useState(false);" not in content:
    content = content.replace("const [modalNovaRemessa, setModalNovaRemessa] = useState(false);", "const [modalNovaRemessa, setModalNovaRemessa] = useState(false);\n  const [isPreviewPrint, setIsPreviewPrint] = useState(false);\n  usePrintPreview(isPreviewPrint);")

# Add toggle button in header
button_code = """        <div className="flex gap-2">
          <button
            onClick={() => setIsPreviewPrint(!isPreviewPrint)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-sm shrink-0 preview-toggle ${isPreviewPrint ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-bg-surface border border-border-default hover:bg-bg-hover text-text-base'}`}
            title={isPreviewPrint ? 'Sair da Visualização' : 'Visualizar Impressão'}
          >
            <PrinterIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{isPreviewPrint ? 'Sair Visualização' : 'Ver Impressão'}</span>
          </button>
          
          <button
            onClick={() => {
              resetNovaRemessaForm();
              setModalNovaRemessa(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors shadow-sm shrink-0 no-print"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Nova Remessa</span>
          </button>
        </div>"""

# Replace existing button
old_button = """        <button
          onClick={() => {
            resetNovaRemessaForm();
            setModalNovaRemessa(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-colors shadow-sm shrink-0"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Nova Remessa de Faturamento</span>
        </button>"""

if "setIsPreviewPrint(!isPreviewPrint)" not in content:
    content = content.replace(old_button, button_code)

with open('src/pages/FaturamentosPage.tsx', 'w') as f:
    f.write(content)
