import re

with open('src/services/dashboardService.ts', 'r') as f:
    content = f.read()

# Add to interface DashboardStats
content = content.replace("vidasPorPlano: { plano: string; vidas: number }[];", "vidasPorPlano: { plano: string; vidas: number }[];\n  parcelasReceberRaw: any[];\n  parcelasPagarRaw: any[];")

# Add to stats initialization
content = content.replace("vidasPorPlano: []\n  };", "vidasPorPlano: [],\n    parcelasReceberRaw: [],\n    parcelasPagarRaw: []\n  };")

# Assign to stats before returning
content = content.replace("return stats;\n};", "stats.parcelasReceberRaw = parcelas;\n  stats.parcelasPagarRaw = parcelasPagar;\n  return stats;\n};")

with open('src/services/dashboardService.ts', 'w') as f:
    f.write(content)
