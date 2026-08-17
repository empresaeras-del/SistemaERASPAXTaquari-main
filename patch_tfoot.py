import re
with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

target = """                    {itensGuia.length > 0 && (
                      <tfoot className="bg-bg-surface font-bold text-sm border-t border-border-default">
                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-right text-text-subtle">Valor Total da Guia:</td>
                          <td className="px-4 py-2.5 text-right text-[#3B82F6]">
                            {formatCurrency(itensGuia.reduce((acc, i) => acc + i.valor_total, 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}"""

repl = """                    {itensGuia.length > 0 && (
                      <tfoot className="bg-bg-surface font-bold text-sm border-t border-border-default">
                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-right text-text-subtle">Valor Total da Guia:</td>
                          <td className="px-4 py-2.5 text-right"></td>
                          <td className="px-4 py-2.5 text-right text-text-base">
                            {formatCurrency(itensGuia.reduce((acc, i) => acc + i.valor_total, 0))}
                          </td>
                          <td></td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-right text-text-subtle">Valor Total Associado (Co-part):</td>
                          <td className="px-4 py-2.5 text-right text-[#3B82F6]">
                            {formatCurrency(itensGuia.reduce((acc, i) => acc + (i.valor_coparticipacao || 0), 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right"></td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}"""

if target in content:
    content = content.replace(target, repl)
else:
    print("Target not found for tfoot replacement")

with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
