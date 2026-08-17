import re

with open('src/pages/ContasPagarPage.tsx', 'r') as f:
    content = f.read()

# Add hooks
if "useColumnVisibility" not in content:
    content = content.replace("import { Receipt, Search, Filter, Plus, Calendar, ArrowDownRight, DollarSign, Clock, CheckCircle2, ChevronRight, XCircle, FileDown, MoreHorizontal, ArrowRight, Printer } from 'lucide-react';", "import { Receipt, Search, Filter, Plus, Calendar, ArrowDownRight, DollarSign, Clock, CheckCircle2, ChevronRight, XCircle, FileDown, MoreHorizontal, ArrowRight, Printer } from 'lucide-react';\nimport { useColumnVisibility } from \"../hooks/useColumnVisibility\";\nimport { ColumnVisibilityToggle } from \"../components/ColumnVisibilityToggle\";")

if "const { visibleColumns, isVisible, setVisibleColumns } = useColumnVisibility" not in content:
    content = content.replace("const [searchTerm, setSearchTerm] = useState('');", "const [searchTerm, setSearchTerm] = useState('');\n  const { visibleColumns, isVisible, setVisibleColumns } = useColumnVisibility(['credor', 'descricao', 'vencimento', 'valor', 'status', 'acoes']);\n  const columns = [\n    { id: 'credor', label: 'Credor / Fornecedor' },\n    { id: 'descricao', label: 'Descrição' },\n    { id: 'vencimento', label: 'Vencimento' },\n    { id: 'valor', label: 'Valor' },\n    { id: 'status', label: 'Status' },\n    { id: 'acoes', label: 'Ações' }\n  ];")

# Add toggle button near nova parcela
if "<ColumnVisibilityToggle" not in content:
    nova_button = """<button 
            onClick={() => navigate('/financeiro/contas-pagar/nova')}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-medium text-sm transition-colors shadow-sm shrink-0"
          >"""
    
    if nova_button in content:
        content = content.replace(nova_button, """<ColumnVisibilityToggle columns={columns} visibleColumns={visibleColumns} onChange={setVisibleColumns} />\n          """ + nova_button)


# Fix th
content = content.replace("""<th 
                  className="px-6 py-4 cursor-pointer hover:bg-bg-hover transition-colors"
                  onClick={() => {
                    if (sortField === 'credor') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('credor');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Credor / Fornecedor
                    {sortField === 'credor' && (
                      <span className="text-rose-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>""", """{isVisible('credor') && <th 
                  className="px-6 py-4 cursor-pointer hover:bg-bg-hover transition-colors"
                  onClick={() => {
                    if (sortField === 'credor') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('credor');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Credor / Fornecedor
                    {sortField === 'credor' && (
                      <span className="text-rose-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>}""")

content = content.replace("<th className=\"px-6 py-4\">Descrição</th>", "{isVisible('descricao') && <th className=\"px-6 py-4\">Descrição</th>}")

content = content.replace("""<th 
                  className="px-6 py-4 cursor-pointer hover:bg-bg-hover transition-colors"
                  onClick={() => {
                    if (sortField === 'vencimento') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('vencimento');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Vencimento
                    {sortField === 'vencimento' && (
                      <span className="text-rose-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>""", """{isVisible('vencimento') && <th 
                  className="px-6 py-4 cursor-pointer hover:bg-bg-hover transition-colors"
                  onClick={() => {
                    if (sortField === 'vencimento') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField('vencimento');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Vencimento
                    {sortField === 'vencimento' && (
                      <span className="text-rose-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>}""")

content = content.replace("<th className=\"px-6 py-4 text-right\">Valor</th>", "{isVisible('valor') && <th className=\"px-6 py-4 text-right\">Valor</th>}")
content = content.replace("<th className=\"px-6 py-4\">Status</th>", "{isVisible('status') && <th className=\"px-6 py-4\">Status</th>}")
content = content.replace("<th className=\"px-6 py-4 text-center\">Ações</th>", "{isVisible('acoes') && <th className=\"px-6 py-4 text-center\">Ações</th>}")


# Fix td
content = content.replace("""<td className="px-6 py-4">
                      <div className="font-medium text-text-base">
                        {p.credor_nome}
                      </div>
                      <div className="text-xs text-text-subtle mt-0.5 capitalize">
                        {p.tipo_referencia ? p.tipo_referencia.replace('_', ' ') : 'avulso'}
                      </div>
                    </td>""", """{isVisible('credor') && <td className="px-6 py-4">
                      <div className="font-medium text-text-base">
                        {p.credor_nome}
                      </div>
                      <div className="text-xs text-text-subtle mt-0.5 capitalize">
                        {p.tipo_referencia ? p.tipo_referencia.replace('_', ' ') : 'avulso'}
                      </div>
                    </td>}""")

content = content.replace("""<td className="px-6 py-4">
                      <div className="text-sm text-text-base max-w-[200px] truncate" title={p.descricao}>
                        {p.descricao}
                      </div>
                    </td>""", """{isVisible('descricao') && <td className="px-6 py-4">
                      <div className="text-sm text-text-base max-w-[200px] truncate" title={p.descricao}>
                        {p.descricao}
                      </div>
                    </td>}""")

content = content.replace("""<td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-text-base font-medium">
                          {format(new Date(p.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy')}
                        </span>
                        {p.status === 'pendente' && (
                          <span className={`text-xs ${
                            isLate ? 'text-rose-400 font-bold' : 'text-text-subtle'
                          }`}>
                            {isLate ? `${daysLate} dias de atraso` : `${daysUntil} dias restantes`}
                          </span>
                        )}
                        {p.status === 'pago' && p.data_pagamento && (
                          <span className="text-xs text-emerald-400">
                            Pago em {format(new Date(p.data_pagamento + 'T12:00:00'), 'dd/MM')}
                          </span>
                        )}
                      </div>
                    </td>""", """{isVisible('vencimento') && <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-text-base font-medium">
                          {format(new Date(p.data_vencimento + 'T12:00:00'), 'dd/MM/yyyy')}
                        </span>
                        {p.status === 'pendente' && (
                          <span className={`text-xs ${
                            isLate ? 'text-rose-400 font-bold' : 'text-text-subtle'
                          }`}>
                            {isLate ? `${daysLate} dias de atraso` : `${daysUntil} dias restantes`}
                          </span>
                        )}
                        {p.status === 'pago' && p.data_pagamento && (
                          <span className="text-xs text-emerald-400">
                            Pago em {format(new Date(p.data_pagamento + 'T12:00:00'), 'dd/MM')}
                          </span>
                        )}
                      </div>
                    </td>}""")

content = content.replace("""<td className="px-6 py-4 text-right">
                      <div className="font-bold text-text-base">
                        R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      {p.status === 'pago' && p.valor_pago && p.valor_pago !== p.valor && (
                        <div className="text-xs text-emerald-400 mt-0.5">
                          Pago R$ {p.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </td>""", """{isVisible('valor') && <td className="px-6 py-4 text-right">
                      <div className="font-bold text-text-base">
                        R$ {p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      {p.status === 'pago' && p.valor_pago && p.valor_pago !== p.valor && (
                        <div className="text-xs text-emerald-400 mt-0.5">
                          Pago R$ {p.valor_pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </td>}""")

content = content.replace("""<td className="px-6 py-4">
                      {p.status === 'pago' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Pago
                        </span>
                      )}
                      {p.status === 'pendente' && !isLate && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3.5 h-3.5" />
                          Pendente
                        </span>
                      )}
                      {p.status === 'pendente' && isLate && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          Vencido
                        </span>
                      )}
                      {p.status === 'cancelado' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          Cancelado
                        </span>
                      )}
                    </td>""", """{isVisible('status') && <td className="px-6 py-4">
                      {p.status === 'pago' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Pago
                        </span>
                      )}
                      {p.status === 'pendente' && !isLate && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3.5 h-3.5" />
                          Pendente
                        </span>
                      )}
                      {p.status === 'pendente' && isLate && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          Vencido
                        </span>
                      )}
                      {p.status === 'cancelado' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                          <XCircle className="w-3.5 h-3.5" />
                          Cancelado
                        </span>
                      )}
                    </td>}""")

content = content.replace("""<td className="px-6 py-4 text-center">
                      <button
                        onClick={() => navigate(`/financeiro/contas-pagar/${p.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface hover:bg-bg-hover border border-border-default rounded-lg text-sm font-medium transition-colors text-text-base"
                      >
                        Visualizar
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>""", """{isVisible('acoes') && <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => navigate(`/financeiro/contas-pagar/${p.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface hover:bg-bg-hover border border-border-default rounded-lg text-sm font-medium transition-colors text-text-base"
                      >
                        Visualizar
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>}""")


with open('src/pages/ContasPagarPage.tsx', 'w') as f:
    f.write(content)
