import sys

with open('src/services/caixasService.ts', 'r') as f:
    content = f.read()

old_logic = """  // Atualiza totais no Lote de Caixa
  const valor = Number(mov.valor) || 0;
  const novasEntradas = mov.tipo === 'entrada' ? lote.saldo_entradas - valor : lote.saldo_entradas;
  const novasSaidas = mov.tipo === 'saida' ? lote.saldo_saidas - valor : lote.saldo_saidas;
  const novoEsperado = lote.saldo_inicial + novasEntradas - novasSaidas;

  const loteAtualizado: LoteCaixa = {
    ...lote,
    saldo_entradas: novasEntradas,
    saldo_saidas: novasSaidas,
    saldo_esperado: novoEsperado,"""

new_logic = """  // Atualiza totais no Lote de Caixa (Logica de compensacao)
  const valor = Number(mov.valor) || 0;
  
  // Se for entrada estornada, a entrada original se mantem, mas adicionamos na saida para compensar
  // Se for saida estornada, a saida original se mantem, mas adicionamos na entrada para compensar
  const novasEntradas = mov.tipo === 'saida' ? lote.saldo_entradas + valor : lote.saldo_entradas;
  const novasSaidas = mov.tipo === 'entrada' ? lote.saldo_saidas + valor : lote.saldo_saidas;
  
  const novoEsperado = lote.saldo_inicial + novasEntradas - novasSaidas;

  const loteAtualizado: LoteCaixa = {
    ...lote,
    saldo_entradas: novasEntradas,
    saldo_saidas: novasSaidas,
    saldo_esperado: novoEsperado,"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open('src/services/caixasService.ts', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Failed to find block")

