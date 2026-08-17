import re
with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

target1 = r"""      // Gerar Conta a Receber se houver Co-participação
      const valorTotalAssociado = itensGuia.reduce\(\(acc, i\) => acc \+ \(i.valor_coparticipacao \|\| 0\), 0\);"""

repl1 = """      // Gerar Conta a Receber se houver Co-participação
      const valorTotalAssociado = itensGuia.reduce((acc, i) => acc + i.valor_total + (i.valor_coparticipacao || 0), 0);"""

content = re.sub(target1, repl1, content)


target2 = r"""                        <tr>
                          <td colSpan=\{4\} className="px-4 py-2.5 text-right text-text-subtle">Valor Total Associado \(Co-part\):</td>
                          <td className="px-4 py-2.5 text-right text-\[\#3B82F6\]">
                            \{formatCurrency\(itensGuia.reduce\(\(acc, i\) => acc \+ \(i.valor_coparticipacao \|\| 0\), 0\)\)\}
                          </td>
                          <td className="px-4 py-2.5 text-right"></td>
                          <td></td>
                        </tr>"""

repl2 = """                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-right text-text-subtle">Valor Total Associado (Co-part):</td>
                          <td className="px-4 py-2.5 text-right text-[#3B82F6]">
                            {formatCurrency(itensGuia.reduce((acc, i) => acc + i.valor_total + (i.valor_coparticipacao || 0), 0))}
                          </td>
                          <td className="px-4 py-2.5 text-right"></td>
                          <td></td>
                        </tr>"""

content = re.sub(target2, repl2, content)


with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
