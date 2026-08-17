import re

with open('src/pages/Associados.tsx', 'r') as f:
    content = f.read()

# Add hooks
if "useColumnVisibility" not in content:
    content = content.replace("import { usePlanosPax } from \"../hooks/usePlanosPax\";", "import { usePlanosPax } from \"../hooks/usePlanosPax\";\nimport { useColumnVisibility } from \"../hooks/useColumnVisibility\";\nimport { ColumnVisibilityToggle } from \"../components/ColumnVisibilityToggle\";")

if "const { visibleColumns, isVisible, setVisibleColumns } = useColumnVisibility" not in content:
    content = content.replace("const [searchTerm, setSearchTerm] = useState(\"\");", "const [searchTerm, setSearchTerm] = useState(\"\");\n  const { visibleColumns, isVisible, setVisibleColumns } = useColumnVisibility(['nome', 'cpf', 'plano', 'status', 'adesao', 'acoes']);\n  const columns = [\n    { id: 'nome', label: 'Nome' },\n    { id: 'cpf', label: 'CPF' },\n    { id: 'plano', label: 'Plano' },\n    { id: 'status', label: 'Status' },\n    { id: 'adesao', label: 'Adesão' },\n    { id: 'acoes', label: 'Ações' }\n  ];")

# Add toggle button near search and filter
if "<ColumnVisibilityToggle" not in content:
    view_toggle = """<button \n                onClick={() => setViewMode(viewMode === 'list' ? 'table' : 'list')}\n                className="px-4 py-2 bg-bg-surface border border-border-default hover:bg-bg-hover text-text-base rounded-xl text-sm font-medium transition-colors flex items-center justify-center shadow-sm shrink-0"\n                title={viewMode === 'list' ? 'Ver Tabela' : 'Ver Cards'}\n              >"""
    
    if view_toggle in content:
        content = content.replace(view_toggle, """<ColumnVisibilityToggle columns={columns} visibleColumns={visibleColumns} onChange={setVisibleColumns} />\n              """ + view_toggle)

# Fix th
content = content.replace("<th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">Nome</th>", "{isVisible('nome') && <th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">Nome</th>}")
content = content.replace("<th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">CPF</th>", "{isVisible('cpf') && <th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">CPF</th>}")
content = content.replace("<th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">Plano</th>", "{isVisible('plano') && <th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">Plano</th>}")
content = content.replace("<th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">Status</th>", "{isVisible('status') && <th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">Status</th>}")
content = content.replace("<th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">Adesão</th>", "{isVisible('adesao') && <th className=\"px-6 py-3 text-xs font-semibold text-text-subtle uppercase tracking-wider\">Adesão</th>}")
content = content.replace("<th className=\"px-6 py-3 text-right text-xs font-semibold text-text-subtle uppercase tracking-wider\">Ações</th>", "{isVisible('acoes') && <th className=\"px-6 py-3 text-right text-xs font-semibold text-text-subtle uppercase tracking-wider\">Ações</th>}")

# Nome td
content = content.replace("""<td className="px-6 py-4 font-medium text-text-base">
                      {associado.nome}
                    </td>""", """{isVisible('nome') && <td className="px-6 py-4 font-medium text-text-base">
                      {associado.nome}
                    </td>}""")

# CPF td
content = content.replace("""<td className="px-6 py-4">
                      {formatCPF(associado.cpf)}
                    </td>""", """{isVisible('cpf') && <td className="px-6 py-4">
                      {formatCPF(associado.cpf)}
                    </td>}""")

# Plano td
content = content.replace("""<td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#3B82F6]/10 text-[#3B82F6]">
                        {getPlanoBadge(associado.plano_pax_id || associado.plano_nome || '')}
                      </span>
                    </td>""", """{isVisible('plano') && <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#3B82F6]/10 text-[#3B82F6]">
                        {getPlanoBadge(associado.plano_pax_id || associado.plano_nome || '')}
                      </span>
                    </td>}""")

# Status td
content = content.replace("""<td className="px-6 py-4">
                      {associado.status === "ativo" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          Inativo
                        </span>
                      )}
                    </td>""", """{isVisible('status') && <td className="px-6 py-4">
                      {associado.status === "ativo" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          Inativo
                        </span>
                      )}
                    </td>}""")

# Adesao td
content = content.replace("""<td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-text-subtle">
                        <Calendar className="w-4 h-4" />
                        {associado.data_adesao ? format(new Date(associado.data_adesao), 'dd/MM/yyyy') : 'N/A'}
                      </div>
                    </td>""", """{isVisible('adesao') && <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-text-subtle">
                        <Calendar className="w-4 h-4" />
                        {associado.data_adesao ? format(new Date(associado.data_adesao), 'dd/MM/yyyy') : 'N/A'}
                      </div>
                    </td>}""")

# Acoes td
content = content.replace("""<td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setAssociadoEditando(associado);
                            setIsFormOpen(true);
                          }}
                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                          title="Editar associado"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAssociado(associado)}
                          className="p-2 text-text-subtle hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                          title="Excluir associado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>""", """{isVisible('acoes') && <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setAssociadoEditando(associado);
                            setIsFormOpen(true);
                          }}
                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                          title="Editar associado"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAssociado(associado)}
                          className="p-2 text-text-subtle hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                          title="Excluir associado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>}""")

with open('src/pages/Associados.tsx', 'w') as f:
    f.write(content)
