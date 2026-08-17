import re

with open('src/services/faturamentoService.ts', 'r') as f:
    content = f.read()

# Add cancelarDespesa to the imports from financeiroService
content = content.replace(
    "salvarDespesa, Despesa, ParcelaPagar, FormaPagamento } from './financeiroService';",
    "salvarDespesa, cancelarDespesa, Despesa, ParcelaPagar, FormaPagamento } from './financeiroService';"
)

func = """
export const reabrirRemessa = async (
  isOnline: boolean,
  tenantId: string,
  remessaId: string,
  justificativa: string,
  usuarioNome: string
): Promise<RemessaFaturamento> => {
  const remessa = await getFromIDB<RemessaFaturamento>('remessas_faturamento', remessaId);
  if (!remessa) {
    throw new Error('Remessa não encontrada.');
  }

  if (remessa.status !== 'fechada') {
    throw new Error('Apenas remessas fechadas podem ser reabertas.');
  }

  // Cancelar Contas a Pagar geradas
  if (remessa.despesa_id) {
    await cancelarDespesa(isOnline, remessa.despesa_id);
  }

  const dataHoje = new Date().toISOString();
  
  const remessaReaberta: RemessaFaturamento = {
    ...remessa,
    status: 'em_aberto',
    data_fechamento: undefined,
    data_vencimento_pagamento: undefined,
    despesa_id: undefined,
    parcela_pagar_id: undefined,
    fechado_por: undefined,
    updated_at: dataHoje,
    observacoes: (remessa.observacoes || '') + `\n[${format(new Date(), 'dd/MM/yyyy HH:mm')} - ${usuarioNome}] Reabertura: ${justificativa}`
  };

  await atualizarRemessa(isOnline, remessaReaberta);

  await registrarAuditoria('Reabertura de Remessa de Faturamento', {
    remessa_id: remessa.id,
    codigo_remessa: remessa.codigo_remessa,
    despesa_cancelada_id: remessa.despesa_id,
    justificativa,
    reaberto_por: usuarioNome
  });

  return remessaReaberta;
};
"""

content += "\n" + func

with open('src/services/faturamentoService.ts', 'w') as f:
    f.write(content)

