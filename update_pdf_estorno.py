import sys

with open('src/pages/CaixasPage.tsx', 'r') as f:
    content = f.read()

old_logic = """    const paymentSummary: Record<string, { entradas: number, saidas: number, saldo: number }> = {};
    movsLote.forEach(m => {
      // Ignore estornados in summary to match net balance? 
      // Wait, if an entry is estornado, usually there's an opposite entry or it just shouldn't be counted in net? 
      // Let's just group all ENTRADA and SAIDA where estornado is false, OR include everything because the estorno itself is a SAIDA/ENTRADA?
      // Actually, let's just group them based on `m.tipo` and `m.estornado`. If it's estornado, it might have been zeroed out.
      // Let's check how estornos work. Usually estorno creates a counter-entry.
      // Assuming m.valor and m.tipo are the raw values.
      const fp = (m.forma_pagamento || 'NÃO INFORMADO').toUpperCase();
      if (!paymentSummary[fp]) paymentSummary[fp] = { entradas: 0, saidas: 0, saldo: 0 };
      
      if (!m.estornado) {
         if (m.tipo === 'entrada') {
           paymentSummary[fp].entradas += m.valor;
           paymentSummary[fp].saldo += m.valor;
         } else if (m.tipo === 'saida') {
           paymentSummary[fp].saidas += m.valor;
           paymentSummary[fp].saldo -= m.valor;
         }
      }
    });"""

new_logic = """    const paymentSummary: Record<string, { entradas: number, saidas: number, saldo: number }> = {};
    movsLote.forEach(m => {
      const fp = (m.forma_pagamento || 'NÃO INFORMADO').toUpperCase();
      if (!paymentSummary[fp]) paymentSummary[fp] = { entradas: 0, saidas: 0, saldo: 0 };
      
      if (m.tipo === 'entrada') {
        paymentSummary[fp].entradas += m.valor;
        paymentSummary[fp].saldo += m.valor;
        if (m.estornado) {
          // Compensação do estorno
          paymentSummary[fp].saidas += m.valor;
          paymentSummary[fp].saldo -= m.valor;
        }
      } else if (m.tipo === 'saida') {
        paymentSummary[fp].saidas += m.valor;
        paymentSummary[fp].saldo -= m.valor;
        if (m.estornado) {
          // Compensação do estorno
          paymentSummary[fp].entradas += m.valor;
          paymentSummary[fp].saldo += m.valor;
        }
      }
    });"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open('src/pages/CaixasPage.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Failed to find block")

