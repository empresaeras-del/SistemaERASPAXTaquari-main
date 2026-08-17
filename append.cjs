const fs = require('fs');
let content = fs.readFileSync('src/pages/CredenciadosPage.tsx', 'utf8');

const targetStr = `        </div>
      )}
    </div>
  );
};`;

const newStr = `        </div>
      )}

      {/* Link Planos Modal */}
      {isLinkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#181B34] border border-[#262A45] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#262A45] flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Link className="w-5 h-5 text-[#7E4CF3]" />
                Vincular Planos - {selectedCredenciado?.razao_social}
              </h3>
              <button 
                onClick={() => setIsLinkOpen(false)}
                className="p-2 text-slate-400 hover:text-white bg-[#101223] rounded-lg border border-[#262A45]"
              >
                X
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              {/* Form to link new plan */}
              <form id="linkForm" onSubmit={handleLinkSubmit} className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Adicionar Novo Vínculo</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Selecione o Plano Pax</label>
                    <select
                      required
                      value={linkData.plano_pax_id}
                      onChange={e => setLinkData({...linkData, plano_pax_id: e.target.value})}
                      className="w-full bg-[#101223] border border-[#262A45] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#7E4CF3]"
                    >
                      <option value="" disabled>Selecione um plano...</option>
                      {planos.map(p => (
                        <option key={p.id} value={p.id}>{p.nome} ({p.codigo})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">% de Desconto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={linkData.percentual_desconto}
                      onChange={e => setLinkData({...linkData, percentual_desconto: Number(e.target.value)})}
                      className="w-full bg-[#101223] border border-[#262A45] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#7E4CF3]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Coparticipação (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={linkData.valor_coparticipacao}
                      onChange={e => setLinkData({...linkData, valor_coparticipacao: Number(e.target.value)})}
                      className="w-full bg-[#101223] border border-[#262A45] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-[#7E4CF3]"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button 
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#7E4CF3] hover:bg-[#6A3DE8] text-white font-medium transition-colors"
                  >
                    Vincular Plano
                  </button>
                </div>
              </form>

              {/* List of currently linked plans */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 border-b border-[#262A45] pb-2">Planos Já Vinculados</h4>
                {planosVinculados.length === 0 ? (
                  <p className="text-slate-400 text-sm">Nenhum plano vinculado a este credenciado.</p>
                ) : (
                  <div className="space-y-3">
                    {planosVinculados.map((vinculo) => (
                      <div key={vinculo.id} className="bg-[#101223]/50 border border-[#262A45] rounded-xl p-4 flex justify-between items-center">
                        <div>
                          <div className="font-medium text-white">{vinculo?.planos_pax?.nome || 'Plano'}</div>
                          <div className="text-xs text-slate-400 mt-1 flex gap-4">
                            <span>Desconto: {vinculo.percentual_desconto}%</span>
                            <span>Coparticipação: R$ {vinculo.valor_coparticipacao}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};`;

content = content.replace(targetStr, newStr);
fs.writeFileSync('src/pages/CredenciadosPage.tsx', content);
