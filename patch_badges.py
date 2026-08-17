import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

# For grid view
grid_find = """
                  <div className="space-y-2 mb-4 flex-1">
"""

grid_replace = """
                  <div className="flex items-center gap-2 mb-3">
                    {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] === 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title="Contrato ativo, mas sem parcelas geradas">
                        SEM MENSALIDADES
                      </span>
                    )}
                    {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] > 0 && parcelasAbertasMap[associado.id] <= 2 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Restam apenas 1 ou 2 mensalidades em aberto">
                        RESTAM {parcelasAbertasMap[associado.id]} MENSALIDADE{parcelasAbertasMap[associado.id] > 1 ? 'S' : ''}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 mb-4 flex-1">
"""

content = content.replace(grid_find, grid_replace)

# For table view
table_find = """
                    <td className="px-6 py-4 capitalize">
                      {associado.plano_pax_id ? planos.find(p => p.id === associado.plano_pax_id)?.nome || associado.plano_nome : associado.plano_nome || "Sem Plano"}
                    </td>
"""

table_replace = """
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="capitalize">{associado.plano_pax_id ? planos.find(p => p.id === associado.plano_pax_id)?.nome || associado.plano_nome : associado.plano_nome || "Sem Plano"}</span>
                        {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] === 0 && (
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20" title="Contrato ativo, mas sem parcelas geradas">
                            SEM MENSALIDADES
                          </span>
                        )}
                        {associado.plano_pax_id && associado.status === 'ativo' && parcelasAbertasMap[associado.id] > 0 && parcelasAbertasMap[associado.id] <= 2 && (
                          <span className="inline-flex items-center w-fit px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Restam apenas 1 ou 2 mensalidades em aberto">
                            RESTAM {parcelasAbertasMap[associado.id]} MENSALIDADE{parcelasAbertasMap[associado.id] > 1 ? 'S' : ''}
                          </span>
                        )}
                      </div>
                    </td>
"""

content = content.replace(table_find, table_replace)

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)

