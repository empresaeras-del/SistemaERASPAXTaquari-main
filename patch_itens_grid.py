import re

with open('src/pages/ItensFunerariosPage.tsx', 'r') as f:
    content = f.read()

table_cond = """
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-4">
              {itens.map((item) => {
                const badgeClass = categoriaCores[item.categoria] || categoriaCores.default;
                return (
                  <div
                    key={item.id}
                    className="bg-bg-surface border border-border-default rounded-2xl p-5 hover:border-[#3B82F6]/50 transition-all shadow-sm hover:shadow-md flex flex-col justify-between group cursor-pointer"
                    onClick={() => setPreviewItem(item)}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            item.ativo 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.ativo ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                            {item.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                          <h3 className="text-base font-bold text-text-base mt-2 group-hover:text-[#3B82F6] transition-colors line-clamp-1">
                            {item.nome}
                          </h3>
                          <p className="font-mono text-xs text-text-muted mt-0.5">{item.codigo}</p>
                        </div>
                        
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 border ${badgeClass}`}>
                          {item.categoria.replace('_', ' ')}
                        </span>
                      </div>
                      
                      {item.descricao && (
                        <p className="text-sm text-text-subtle line-clamp-2 mt-2 mb-4">
                          {item.descricao}
                        </p>
                      )}
                    </div>
                    
                    <div className="pt-4 mt-auto border-t border-border-default flex items-center justify-between">
                      <div>
                        <p className="text-xs text-text-muted mb-0.5">Valor de Referência</p>
                        <p className="text-sm font-semibold text-text-base">
                          {item.valor_referencia ? Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_referencia) : 'Sob Consulta'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenForm(item); }}
                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(item); }}
                          className={`p-2 rounded-lg transition-colors ${
                            item.ativo 
                              ? 'text-text-subtle hover:text-red-400 hover:bg-red-500/10' 
                              : 'text-text-subtle hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                          title={item.ativo ? "Desativar" : "Ativar"}
                        >
                          {item.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
"""

content = content.replace("          ) : (\n            <table className=\"w-full text-left border-collapse min-w-[800px]\">", table_cond + "\n            <table className=\"w-full text-left border-collapse min-w-[800px]\">")

with open('src/pages/ItensFunerariosPage.tsx', 'w') as f:
    f.write(content)

