import re

with open('src/services/financeiroService.ts', 'r') as f:
    content = f.read()

func = """
export const cancelarDespesa = async (isOnline: boolean, despesaId: string): Promise<void> => {
  if (isOnline) {
    try {
      const { error: err1 } = await supabase.from('despesas').update({ status: 'cancelado' }).eq('id', despesaId);
      if (err1) throw err1;
      const { error: err2 } = await supabase.from('parcelas_pagar').update({ status: 'cancelado' }).eq('despesa_id', despesaId);
      if (err2) throw err2;
    } catch (e) {
      console.error("Erro ao cancelar despesa no Supabase:", e);
      throw e;
    }
  }

  // Update in IDB
  const despesa = await getFromIDB<Despesa>('despesas', despesaId);
  if (despesa) {
    despesa.status = 'cancelado';
    await saveToIDB('despesas', despesa);
  }

  const todasParcelas = await getAllFromIDB<ParcelaPagar>('parcelas_pagar');
  const parcelasDaDespesa = todasParcelas.filter(p => p.despesa_id === despesaId);
  for (const p of parcelasDaDespesa) {
    p.status = 'cancelado';
    await saveToIDB('parcelas_pagar', p);
  }

  if (isOnline) {
    await registrarAuditoria('Cancelamento de Despesa e Parcelas', { despesa_id: despesaId });
  } else {
    await addToSyncQueue('cancelar_despesa', { id: despesaId });
  }
};
"""

content += "\n" + func

with open('src/services/financeiroService.ts', 'w') as f:
    f.write(content)

