import re

filepath = 'src/pages/CaixasPage.tsx'
with open(filepath, 'r') as f:
    content = f.read()

handle_estorno = """
  const handleEstornar = async (mov: MovimentacaoCaixa) => {
    if (!window.confirm(`Deseja realmente estornar a movimentação "${mov.descricao}" de R$ ${mov.valor.toFixed(2)}?\\n\\nIsso removerá o registro do caixa e, se for um recebimento ou pagamento de parcela, ela voltará ao status pendente.`)) {
      return;
    }
    
    try {
      setLoading(true);
      await estornarMovimentacaoCaixa(state.isOnline, mov.id, "Estorno manual via tela de Caixa");
      toast.success("Movimentação estornada com sucesso!");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Erro ao estornar movimentação");
    } finally {
      setLoading(false);
    }
  };
"""

content = content.replace("  const handleSyncFinancials = async () => {", handle_estorno + "\n  const handleSyncFinancials = async () => {")

with open(filepath, 'w') as f:
    f.write(content)
