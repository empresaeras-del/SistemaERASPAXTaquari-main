import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# For stat_receitas
receitas_regex = r"case 'stat_receitas':\s+return \(\s+<div key=\"stat_receitas\"([^>]+)>\s+<div className=\"absolute -right-8 -top-8([^\"]+)\" />\s+<div className=\"flex items-start justify-between mb-4 relative z-10\">\s+<div className=\"p-3 rounded-2xl bg-gradient-to-tr([^\"]+)\">\s+<DollarSign className=\"w-6 h-6\" />\s+</div>\s+<span className=\"flex items-center text-xs font-bold text-text-muted bg-bg-surface px-2\.5 py-1 rounded-full border border-slate-700\">\s+Mês Atual \(Contas a Receber\)\s+</span>\s+</div>\s+<div className=\"relative z-10 grid grid-cols-2 gap-4 mt-2\">\s+<div>\s+<p className=\"text-sm font-medium text-text-subtle mb-1\">Projetado</p>\s+<h3 className=\"text-2xl font-bold text-text-base tracking-tight\">R\$ \{\(stats\?\.receitaProjetadaMes \|\| 0\)\.toLocaleString\('pt-BR', \{minimumFractionDigits: 2\}\)\}</h3>\s+</div>\s+<div>\s+<p className=\"text-sm font-medium text-text-subtle mb-1\">Arrecadado</p>\s+<h3 className=\"text-2xl font-bold text-emerald-400 tracking-tight\">R\$ \{\(stats\?\.receitaArrecadadaMes \|\| 0\)\.toLocaleString\('pt-BR', \{minimumFractionDigits: 2\}\)\}</h3>\s+</div>\s+</div>\s+<div className=\"w-full bg-bg-hover rounded-full h-1\.5 mt-4 overflow-hidden\">\s+<div \s+className=\"bg-emerald-400 h-1\.5 rounded-full\" \s+style=\{\{ width: `\$\{Math\.min\(\(\(stats\?\.receitaArrecadadaMes \|\| 0\) / \(stats\?\.receitaProjetadaMes \|\| 1\)\) \* 100, 100\)\}%` \}\}\s+></div>\s+</div>\s+</div>\s+\);"

def replace_receitas(match):
    return """case 'stat_receitas': {
              const valores = getValoresFinanceiros(stats?.parcelasReceberRaw || [], filtroReceitas, 'receber');
              return (
                <div key="stat_receitas" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 flex flex-col justify-between hover:border-[#3B82F6]/50 transition-colors relative overflow-hidden group col-span-1 lg:col-span-2">
                  <div className="absolute -right-8 -top-8 w-32 h-32 opacity-20 blur-2xl rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#3B82F6] group-hover:opacity-40 transition-opacity" />
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#3B82F6] to-[#3B82F6] text-white shadow-lg">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-text-base">Receitas</h3>
                    </div>
                    <select 
                      value={filtroReceitas}
                      onChange={(e) => setFiltroReceitas(e.target.value)}
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
                      <p className="text-sm font-medium text-text-subtle mb-1">Arrecadado</p>
                      <h3 className="text-2xl font-bold text-emerald-400 tracking-tight">R$ {(valores.realizado || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
                    </div>
                  </div>
                  <div className="w-full bg-bg-hover rounded-full h-1.5 mt-4 overflow-hidden">
                    <div 
                      className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(((valores.realizado || 0) / (valores.projetado || 1)) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            }"""

content = re.sub(receitas_regex, replace_receitas, content, flags=re.DOTALL)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)
