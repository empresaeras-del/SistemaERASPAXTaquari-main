import re

with open('src/pages/CaixasPage.tsx', 'r') as f:
    content = f.read()

# Add state
target_state = r"  const \[modalMovimentacaoAvulsa, setModalMovimentacaoAvulsa\] = useState\(false\);"
repl_state = """  const [modalMovimentacaoAvulsa, setModalMovimentacaoAvulsa] = useState(false);
  const [modalReabrirLote, setModalReabrirLote] = useState<{ isOpen: boolean, lote: any }>({ isOpen: false, lote: null });
  const [justificativaReabertura, setJustificativaReabertura] = useState("");"""
content = re.sub(target_state, repl_state, content)

# Modify handleReabrirLote
target_handle = r"""    const handleReabrirLote = \(lote: LoteCaixa\) => \{
    const justificativa = window\.prompt\("Por favor, informe o motivo da reabertura do lote:"\);
    if \(!justificativa\) \{
      if \(justificativa !== null\) toast\.error\("A justificativa é obrigatória para reabrir o lote\."\);
      return;
    \}
    
    confirm\(\{
      title: "Reabrir Lote de Caixa",
      message: `Deseja realmente reabrir o lote \$\{lote\.codigo_lote\}\?

Esta ação será registrada nos logs de auditoria\.`,
      confirmText: "Sim, reabrir lote",
      cancelText: "Cancelar",
      danger: true,
      onConfirm: async \(\) => \{
        try \{
          setLoading\(true\);
          const operadorNome = state\.user\?\.nome || 'Admin';
          await reabrirLoteCaixa\(state\.isOnline, lote\.id, justificativa, operadorNome\);
          toast\.success\("Lote reaberto com sucesso!"\);
          await loadData\(\);
        \} catch \(e: any\) \{
          toast\.error\(e\.message || "Erro ao reabrir lote"\);
        \} finally \{
          setLoading\(false\);
        \}
      \}
    \}\);
  \};"""

repl_handle = """  const handleReabrirLote = (lote: LoteCaixa) => {
    setJustificativaReabertura("");
    setModalReabrirLote({ isOpen: true, lote });
  };

  const handleConfirmReabrirLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justificativaReabertura.trim()) {
      toast.error("A justificativa é obrigatória para reabrir o lote.");
      return;
    }
    const lote = modalReabrirLote.lote;
    if (!lote) return;

    setModalReabrirLote({ isOpen: false, lote: null });

    confirm({
      title: "Reabrir Lote de Caixa",
      message: `Deseja realmente reabrir o lote ${lote.codigo_lote}?

Esta ação será registrada nos logs de auditoria.`,
      confirmText: "Sim, reabrir lote",
      cancelText: "Cancelar",
      danger: true,
      onConfirm: async () => {
        try {
          setLoading(true);
          const operadorNome = state.user?.nome || 'Admin';
          await reabrirLoteCaixa(state.isOnline, lote.id, justificativaReabertura, operadorNome);
          toast.success("Lote reaberto com sucesso!");
          await loadData();
        } catch (e: any) {
          toast.error(e.message || "Erro ao reabrir lote");
        } finally {
          setLoading(false);
        }
      }
    });
  };"""

content = re.sub(target_handle, repl_handle, content)

# Add Modal JSX before the closing tag (before final </div>);
target_modal_jsx = r"    </div>\n  \);\n\};\n$"
repl_modal_jsx = """      {/* Modal Reabrir Lote */}
      {modalReabrirLote.isOpen && modalReabrirLote.lote && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border-default overflow-hidden">
            <div className="p-6 border-b border-border-default flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-text-base flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-rose-500" />
                  Reabrir Lote
                </h3>
                <p className="text-sm text-text-subtle">
                  Lote: {modalReabrirLote.lote.codigo_lote}
                </p>
              </div>
              <button
                onClick={() => setModalReabrirLote({ isOpen: false, lote: null })}
                className="text-text-muted hover:text-text-base transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReabrirLote} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-base mb-1">
                  Motivo da reabertura <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  value={justificativaReabertura}
                  onChange={(e) => setJustificativaReabertura(e.target.value)}
                  className="w-full px-4 py-2 bg-bg-subtle border border-border-default rounded-xl focus:border-primary transition-colors text-sm min-h-[100px] resize-none"
                  placeholder="Informe detalhadamente por que este lote está sendo reaberto (Ex: Fechado por engano, necessidade de lançar movimentação esquecida, etc)."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setModalReabrirLote({ isOpen: false, lote: null })}
                  className="px-4 py-2 bg-bg-subtle hover:bg-bg-hover text-text-base rounded-xl font-medium transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!justificativaReabertura.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
"""

content = re.sub(target_modal_jsx, repl_modal_jsx, content)

with open('src/pages/CaixasPage.tsx', 'w') as f:
    f.write(content)

