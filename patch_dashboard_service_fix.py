import re

with open('src/services/dashboardService.ts', 'r') as f:
    content = f.read()

content = content.replace("  } catch (error) {\n    console.error('Erro ao buscar stats do dashboard', error);\n  }\n\n  stats.parcelasReceberRaw = parcelas;\n  stats.parcelasPagarRaw = parcelasPagar;", """    stats.parcelasReceberRaw = parcelas;
    stats.parcelasPagarRaw = parcelasPagar;
  } catch (error) {
    console.error('Erro ao buscar stats do dashboard', error);
  }""")

with open('src/services/dashboardService.ts', 'w') as f:
    f.write(content)
