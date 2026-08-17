import re
with open('src/components/associados/AssociadoRequisicoesTab.tsx', 'r') as f:
    content = f.read()

# Add imports
content = content.replace("import { getRequisicoes } from '../../services/requisicoesService';", "import { getRequisicoes, gerarPDFGuiaRequisicao } from '../../services/requisicoesService';\nimport { getEmpresaById } from '../../services/empresasService';")
content = content.replace("import { FileText, Search, ClipboardList, Filter } from 'lucide-react';", "import { FileText, Search, ClipboardList, Filter, Printer } from 'lucide-react';")

# Change the Valor Total display
target_valor = r"""                  <div className="text-right">
                    <span className="text-xs text-text-subtle block">Valor Total</span>
                    <span className="font-bold text-emerald-500">R\$ \{req.valor_total.toFixed\(2\)\}</span>
                  </div>"""

repl_valor = """                  <div className="text-right">
                    <span className="text-xs text-text-subtle block">Valor Total Assoc (Co-part)</span>
                    <span className="font-bold text-[#3B82F6]">
                      R$ {req.itens ? req.itens.reduce((acc, i) => acc + i.valor_total + (i.valor_coparticipacao || 0), 0).toFixed(2) : req.valor_total.toFixed(2)}
                    </span>
                  </div>"""

content = re.sub(target_valor, repl_valor, content)

# Add the printer button to the right side
target_action = r"""                  <div className="text-right">
                    <span className="text-xs text-text-subtle block">Valor Total Assoc \(Co-part\)</span>"""

repl_action = """                  <button
                    onClick={async () => {
                      const tenantId = state.empresaSelecionada || 'default_tenant';
                      const empresa = await getEmpresaById(tenantId, state.isOnline);
                      await gerarPDFGuiaRequisicao(req, empresa);
                    }}
                    className="p-2 text-text-subtle hover:text-primary hover:bg-primary/10 rounded-lg transition-colors self-end mb-2"
                    title="Imprimir Guia"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <div className="text-right">
                    <span className="text-xs text-text-subtle block">Valor Total Assoc (Co-part)</span>"""

content = re.sub(target_action, repl_action, content)

with open('src/components/associados/AssociadoRequisicoesTab.tsx', 'w') as f:
    f.write(content)
