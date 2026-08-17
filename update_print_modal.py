import re

with open('src/pages/DocumentosPadroesPage.tsx', 'r') as f:
    content = f.read()

# Add placeholderValues state
if "const [placeholderValues, setPlaceholderValues] = useState" not in content:
    content = content.replace(
        "const [docToPrint, setDocToPrint] = useState<DocumentoPadrao | null>(null);",
        "const [docToPrint, setDocToPrint] = useState<DocumentoPadrao | null>(null);\n  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});"
    )

# Add useEffect for extracting placeholders
effect = """
  React.useEffect(() => {
    if (docToPrint?.conteudo) {
      const regex = /\{\{([^}]+)\}\}/g;
      const matches = [...docToPrint.conteudo.matchAll(regex)];
      const initialValues: Record<string, string> = {};
      matches.forEach(match => {
        initialValues[match[0]] = '';
      });
      setPlaceholderValues(initialValues);
    }
  }, [docToPrint]);
"""
if "React.useEffect(() => {" not in content.split('const [docToPrint')[1][:500]:
    content = content.replace(
        "const textareaRef = useRef<HTMLTextAreaElement>(null);",
        "const textareaRef = useRef<HTMLTextAreaElement>(null);\n" + effect
    )

# Replace Print Modal
old_modal_start = "{/* Print Modal */}"
old_modal_end = "      {/* Form Modal */}"
old_modal_regex = re.compile(r"\{\/\* Print Modal \*\/\}.*?(?=\{\/\* Form Modal \*\/\})", re.DOTALL)

new_modal = """{/* Print Modal */}
      {docToPrint && (
        <div className="fixed inset-0 z-[60] bg-white flex overflow-hidden print:static print:block print:overflow-visible">
          {/* Sidebar for variables */}
          <div className="w-80 bg-bg-surface border-r border-border-default flex flex-col print:hidden h-full">
             <div className="p-6 border-b border-border-default bg-[#1A1D36]">
                <h3 className="font-bold text-lg text-text-base mb-1">{docToPrint.nome}</h3>
                <p className="text-sm text-[#3B82F6]">Preencha as variáveis do documento</p>
             </div>
             <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar bg-bg-base">
                {Object.keys(placeholderValues).length > 0 ? (
                  Object.keys(placeholderValues).map(variable => (
                    <div key={variable}>
                      <label className="block text-xs font-semibold text-text-subtle mb-1.5 uppercase tracking-wider">{variable.replace(/[{}]/g, '').replace(/_/g, ' ')}</label>
                      <input 
                        type="text"
                        value={placeholderValues[variable]}
                        onChange={(e) => setPlaceholderValues(prev => ({ ...prev, [variable]: e.target.value }))}
                        className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base text-sm focus:border-[#3B82F6] outline-none transition-colors"
                        placeholder="Valor..."
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <FileCheck className="w-8 h-8 text-emerald-500 mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-text-muted">Nenhuma variável encontrada neste documento.</p>
                  </div>
                )}
             </div>
             <div className="p-6 border-t border-border-default bg-bg-surface space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
               <button 
                  onClick={() => window.print()}
                  className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                >
                  <Printer className="w-5 h-5" />
                  Imprimir Documento
                </button>
                <button 
                  onClick={() => setDocToPrint(null)}
                  className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-bg-hover hover:bg-[#323654] text-text-base rounded-xl transition-colors font-medium active:scale-[0.98]"
                >
                  <X className="w-5 h-5" />
                  Cancelar
                </button>
             </div>
          </div>
          
          {/* Document Preview */}
          <div className="flex-1 overflow-y-auto bg-[#0F1123] flex justify-center p-8 print:p-0 print:bg-white custom-scrollbar">
            <div id="print-area" className="w-full max-w-4xl bg-white text-black p-12 lg:p-16 min-h-[1056px] shadow-2xl print:max-w-none print:w-full print:min-h-0 print:my-0 print:shadow-none print:p-0">
              <div 
                className="prose max-w-none print:prose-p:m-0 print:prose-p:leading-normal"
                style={{ fontSize: '12pt', lineHeight: '1.5', fontFamily: 'Arial, sans-serif' }}
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    let html = docToPrint.conteudo ? docToPrint.conteudo.replace(/\\n/g, '<br/>') : '<p class="text-center italic text-gray-500">Documento vazio</p>';
                    Object.entries(placeholderValues).forEach(([key, value]) => {
                      const regex = new RegExp(key, 'g');
                      const displayValue = value ? `<strong>${value}</strong>` : `<span class="text-rose-500 font-bold bg-rose-50 px-1 rounded print:bg-transparent print:text-black">${key}</span>`;
                      html = html.replace(regex, displayValue);
                    });
                    return html;
                  })()
                }} 
              />
            </div>
          </div>
        </div>
      )}
"""

content = old_modal_regex.sub(new_modal, content)

with open('src/pages/DocumentosPadroesPage.tsx', 'w') as f:
    f.write(content)

