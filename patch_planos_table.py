import re

with open('src/pages/PlanosPaxPage.tsx', 'r') as f:
    content = f.read()

grid_cond = """
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
              {planosFiltrados.map((plano) => (
                <PlanoCard key={plano.id} plano={plano} handleOpenForm={handleOpenForm} handleToggleStatus={handleToggleStatus} handleDelete={handleDelete} />
              ))}
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-bg-surface/50 border-b border-border-default">
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider">Plano</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider text-right">Valor Padrão</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-text-subtle uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#475569]">
                {planosFiltrados.map((plano) => (
                  <tr key={plano.id} className="hover:bg-bg-surface/30 transition-colors cursor-pointer" onClick={() => handleOpenForm(plano)}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-text-base">{plano.nome}</span>
                        <span className="text-xs text-text-muted font-mono">{plano.codigo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-text-subtle">
                        {plano.tipo_plano === 'individual' ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                        <span className="capitalize text-sm">{plano.tipo_plano === 'individual' ? 'Individual' : `Coletivo (${plano.limite_vidas} vidas)`}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-text-base font-semibold">
                      {plano.valor_base ? Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plano.valor_base) : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        plano.ativo 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${plano.ativo ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                        {plano.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenForm(plano); }}
                          className="p-2 text-text-subtle hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(plano); }}
                          className={`p-2 rounded-lg transition-colors ${
                            plano.ativo 
                              ? 'text-text-subtle hover:text-red-400 hover:bg-red-500/10' 
                              : 'text-text-subtle hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                          title={plano.ativo ? "Desativar" : "Ativar"}
                        >
                          {plano.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(plano); }}
                          className="p-2 text-text-subtle hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
"""

content = content.replace("          ) : (\n               \n            <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6\">\n              {planosFiltrados.map((plano) => (\n                <PlanoCard key={plano.id} plano={plano} handleOpenForm={handleOpenForm} handleToggleStatus={handleToggleStatus} handleDelete={handleDelete} />\n              ))}\n            </div>", grid_cond)

with open('src/pages/PlanosPaxPage.tsx', 'w') as f:
    f.write(content)

