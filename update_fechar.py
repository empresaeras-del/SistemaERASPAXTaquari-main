import sys

with open('src/services/caixasService.ts', 'r') as f:
    content = f.read()

old_logic = """  const entradas = movs.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + Number(m.valor), 0);
  const saidas = movs.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + Number(m.valor), 0);"""

new_logic = """  // Calcula as entradas e saídas considerando a lógica de compensação para estornos
  const entradas = movs.reduce((acc, m) => {
    let valor = 0;
    if (m.tipo === 'entrada') valor += Number(m.valor);
    if (m.tipo === 'saida' && m.estornado) valor += Number(m.valor); // Compensação
    return acc + valor;
  }, 0);
  
  const saidas = movs.reduce((acc, m) => {
    let valor = 0;
    if (m.tipo === 'saida') valor += Number(m.valor);
    if (m.tipo === 'entrada' && m.estornado) valor += Number(m.valor); // Compensação
    return acc + valor;
  }, 0);"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open('src/services/caixasService.ts', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Failed to find block")

