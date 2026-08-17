import re

with open('src/services/caixasService.ts', 'r') as f:
    content = f.read()

def get_block():
    return """export const reabrirLoteCaixa = async (
  isOnline: boolean,
  loteId: string,
  justificativa: string,
  usuarioNome: string
): Promise<LoteCaixa> => {
  const lote = await getFromIDB<LoteCaixa>('lotes_caixa', loteId);
  if (!lote) throw new Error('Lote não encontrado');
  if (lote.status === 'aberto') throw new Error('O lote já está aberto');

  const lotes = await getLotesCaixa(isOnline, lote.tenant_id);
  const loteAbertoAtual = lotes.find(l => l.status === 'aberto');
  if (loteAbertoAtual) {
    throw new Error('Não é possível reabrir este lote, pois já existe um lote aberto (' + loteAbertoAtual.codigo_lote + '). Feche o lote atual antes de reabrir um anterior.');
  }

  const loteAtualizado: LoteCaixa = {
    ...lote,
    status: 'aberto',
    data_fechamento: null as any,
    saldo_fechamento_informado: null as any,
    diferenca_quebra_sobra: null as any,
    observacao_fechamento: (lote.observacao_fechamento ? lote.observacao_fechamento + ' | ' : '') + `REABERTO por ${usuarioNome}: ${justificativa}`,
    atualizado_em: new Date().toISOString()
  };

  if (isOnline) {
    const { error } = await supabase.from('lotes_caixa').update(loteAtualizado).eq('id', loteAtualizado.id);
    if (error) {
      console.error('Supabase update lote error:', error);
      throw new Error("Erro no banco de dados ao atualizar lote: " + error.message);
    }
  } else {
    await addToSyncQueue({ storeName: 'lotes_caixa', action: 'update', data: loteAtualizado as any });
  }

  await saveToIDB('lotes_caixa', loteAtualizado);
  await registrarAuditoria('Reabertura Lote Caixa', { id: loteId, codigo: lote.codigo_lote, justificativa, usuario: usuarioNome });
  
  return loteAtualizado;
};"""

pattern = r"export const reabrirLoteCaixa = async \(.*?\)\: Promise<LoteCaixa> => \{.*?\n\};"
new_content = re.sub(pattern, get_block(), content, flags=re.DOTALL)

with open('src/services/caixasService.ts', 'w') as f:
    f.write(new_content)

