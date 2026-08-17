import re
with open('src/pages/RequisicoesPage.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '<th className="px-4 py-2.5 text-right">Val. Unit.</th>\n                        <th className="px-4 py-2.5 text-right">Subtotal</th>',
    '<th className="px-4 py-2.5 text-right">Val. Unit.</th>\n                        <th className="px-4 py-2.5 text-right text-[#3B82F6]">Co-part.</th>\n                        <th className="px-4 py-2.5 text-right">Subtotal</th>'
)

content = content.replace(
    '<td className="px-4 py-2.5 text-right">{formatCurrency(item.valor_unitario)}</td>\n                            <td className="px-4 py-2.5 text-right font-bold text-text-base">',
    '<td className="px-4 py-2.5 text-right">{formatCurrency(item.valor_unitario)}</td>\n                            <td className="px-4 py-2.5 text-right text-[#3B82F6]">{formatCurrency(item.valor_coparticipacao || 0)}</td>\n                            <td className="px-4 py-2.5 text-right font-bold text-text-base">'
)

content = content.replace(
    '<td colSpan={6} className="px-4 py-6 text-center text-text-subtle">\n                            Nenhum procedimento/exame adicionado à requisição.',
    '<td colSpan={7} className="px-4 py-6 text-center text-text-subtle">\n                            Nenhum procedimento/exame adicionado à requisição.'
)

with open('src/pages/RequisicoesPage.tsx', 'w') as f:
    f.write(content)
