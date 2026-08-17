import re

with open('src/pages/FaturamentosPage.tsx', 'r') as f:
    content = f.read()

# Imports
content = content.replace("fecharRemessaEGerarContaPagar,", "fecharRemessaEGerarContaPagar,\n  reabrirRemessa,")

# States
state_code = """
  const [modalReabrirRemessa, setModalReabrirRemessa] = useState<RemessaFaturamento | null>(null);
  const [justificativaReabertura, setJustificativaReabertura] = useState('');
"""
content = content.replace("const [modalFecharRemessa, setModalFecharRemessa] = useState<RemessaFaturamento | null>(null);", "const [modalFecharRemessa, setModalFecharRemessa] = useState<RemessaFaturamento | null>(null);\n" + state_code)

# Handle function
func = """
  const handleConfirmarReabertura = async () => {
    if (!modalReabrirRemessa) return;
    if (!justificativaReabertura.trim()) {
      toast.error('Informe uma justificativa para a reabertura.');
      return;
    }

    setSubmitting(true);
    try {
      await reabrirRemessa(
        state.isOnline,
        tenantId,
        modalReabrirRemessa.id,
        justificativaReabertura,
        state.user?.nome || 'Operador'
      );
      toast.success('Remessa reaberta e parcelas financeiras canceladas.');
      setModalReabrirRemessa(null);
      setJustificativaReabertura('');
      loadData();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao reabrir remessa: ' + (e?.message || ''));
    } finally {
      setSubmitting(false);
    }
  };
"""
content = content.replace("const handleConfirmarFechamentoRemessa = async () => {", func + "\n  const handleConfirmarFechamentoRemessa = async () => {")

# Modal XML
modal_xml = """
      {modalReabrirRemessa && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-default rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 space-y-4">
            <h2 className="text-xl font-bold text-text-base flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              Reabrir Remessa
            </h2>
            
            <p className="text-sm text-text-subtle">
              Deseja reabrir a remessa <strong>{modalReabrirRemessa.codigo_remessa}</strong>?
              As parcelas no Contas a Pagar serão <strong>canceladas</strong>.
            </p>

            <div>
              <label className="block text-sm font-medium text-text-subtle mb-1">Justificativa *</label>
              <textarea 
                value={justificativaReabertura}
                onChange={(e) => setJustificativaReabertura(e.target.value)}
                placeholder="Informe o motivo da reabertura..."
                className="w-full bg-bg-subtle border border-border-default rounded-xl px-4 py-3 text-text-base focus:border-[#3B82F6] outline-none min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
              <button 
                onClick={() => setModalReabrirRemessa(null)}
                className="px-4 py-2 bg-bg-subtle text-text-subtle hover:text-text-base rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmarReabertura}
                disabled={submitting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? 'Aguarde...' : 'Confirmar Reabertura'}
              </button>
            </div>
          </div>
        </div>
      )}
"""
content = content.replace("{/* MODAL: FECHAR REMESSA & GERAR FINANCEIRO */}", modal_xml + "\n      {/* MODAL: FECHAR REMESSA & GERAR FINANCEIRO */}")


# Actions Button
# Finding where buttons are rendered in the actions table column
btn_reabrir = """
                      {remessa.status === 'fechada' && (
                        <button
                          onClick={() => setModalReabrirRemessa(remessa)}
                          title="Reabrir Remessa"
                          className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
"""
content = content.replace("""
                      <button 
                        onClick={() => setModalDetalhes(remessa)}
""", btn_reabrir + """
                      <button 
                        onClick={() => setModalDetalhes(remessa)}
""")

content = content.replace("import { Search, Plus, Trash2, CheckCircle, FileText, X as XIcon, Printer as PrinterIcon } from 'lucide-react';", "import { Search, Plus, Trash2, CheckCircle, FileText, X as XIcon, Printer as PrinterIcon, RefreshCw } from 'lucide-react';")

with open('src/pages/FaturamentosPage.tsx', 'w') as f:
    f.write(content)

