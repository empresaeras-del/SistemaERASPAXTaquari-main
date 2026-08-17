import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

despesas_regex = r"case 'stat_despesas':\s+return \(\s+<div key=\"stat_despesas\"([^>]+)>\s+<div className=\"absolute -right-8 -top-8([^\"]+)\" />\s+<div className=\"flex items-start justify-between mb-4 relative z-10\">\s+<div className=\"p-3 rounded-2xl bg-gradient-to-tr([^\"]+)\">\s+<DollarSign className=\"w-6 h-6\" />\s+</div>\s+<span className=\"flex items-center text-xs font-bold text-text-muted bg-bg-surface px-2\.5 py-1 rounded-full border border-slate-700\">\s+Mês Atual \(Contas a Pagar\)\s+</span>\s+</div>\s+<div className=\"relative z-10 grid grid-cols-2 gap-4 mt-2\">\s+<div>\s+<p className=\"text-sm font-medium text-text-subtle mb-1\">Projetado</p>\s+<h3 className=\"text-2xl font-bold text-text-base tracking-tight\">R\$ \{\(stats\?\.despesaProjetadaMes \|\| 0\)\.toLocaleString\('pt-BR', \{minimumFractionDigits: 2\}\)\}</h3>\s+</div>\s+<div>\s+<p className=\"text-sm font-medium text-text-subtle mb-1\">Pago</p>\s+<h3 className=\"text-2xl font-bold text-rose-400 tracking-tight\">R\$ \{\(stats\?\.despesaPagaMes \|\| 0\)\.toLocaleString\('pt-BR', \{minimumFractionDigits: 2\}\)\}</h3>\s+</div>\s+</div>\s+<div className=\"w-full bg-bg-hover rounded-full h-1\.5 mt-4 overflow-hidden\">\s+<div className=\"bg-rose-500 h-1\.5 rounded-full\" style=\{\{ width: `\$\{Math\.min\(\(\(stats\?\.despesaPagaMes \|\| 0\) / \(stats\?\.despesaProjetadaMes \|\| 1\)\) \* 100, 100\)\}%` \}\} />\s+</div>\s+</div>\s+\);"

def replace_despesas(match):
    return """case 'stat_despesas': {
              const valores = getValoresFinanceiros(stats?.parcelasPagarRaw || [], filtroDespesas, 'pagar');
              return (
                <div key="stat_despesas" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-rose-500/50 transition-colors relative overflow-hidden group col-span-1 lg:col-span-2">
                  <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-rose-500 to-rose-600 group-hover:opacity-40 transition-opacity" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 text-white shadow-lg">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-text-base">Despesas</h3>
                    </div>
                    <select 
                      value={filtroDespesas}
                      onChange={(e) => setFiltroDespesas(e.target.value)}
                      className="text-xs font-bold text-text-muted bg-bg-surface px-2.5 py-1 rounded-full border border-border-default focus:outline-none cursor-pointer hover:bg-bg-hover"
                    >
                      <option value="todos">Todos os registros</option>
                      <option value="mensal">Mês Atual</option>
                      <option value="trimestral">Trimestre Atual</option>
                      <option value="anual">Ano Atual</option>
                    </select>
                  </div>
                  <div className="relative z-10 grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-sm font-medium text-text-subtle mb-1">Projetado</p>
                      <h3 className="text-2xl font-bold text-text-base tracking-tight">R$ {(valores.projetado || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-subtle mb-1">Pago</p>
                      <h3 className="text-2xl font-bold text-rose-400 tracking-tight">R$ {(valores.realizado || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    </div>
                  </div>
                  <div className="w-full bg-bg-hover rounded-full h-1.5 mt-4 overflow-hidden">
                    <div 
                      className="bg-rose-500 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(((valores.realizado || 0) / (valores.projetado || 1)) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            }"""

content = re.sub(despesas_regex, replace_despesas, content, flags=re.DOTALL)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)
