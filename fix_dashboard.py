import re

with open('src/pages/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add imports
if 'react-router-dom' not in content:
    content = content.replace("import React, { useEffect, useState } from 'react';", "import React, { useEffect, useState } from 'react';\nimport { Link } from 'react-router-dom';")

lucide_imports = "Users, FileText, DollarSign, Activity, TrendingUp, ShieldAlert, Settings2, Heart"
if 'Zap' not in content:
    content = content.replace(lucide_imports, lucide_imports + ", Zap, UserPlus, Stethoscope")

# Insert atalhos_rapidos case
if "case 'atalhos_rapidos':" not in content:
    atalhos_code = """
            case 'atalhos_rapidos':
              return (
                <div key="atalhos_rapidos" className="bg-bg-subtle rounded-3xl shadow-lg border border-border-default p-6 lg:col-span-4 flex flex-col justify-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 opacity-[0.03] blur-3xl rounded-full" />
                  <div className="flex items-center gap-2 mb-2 relative z-10">
                    <Zap className="w-5 h-5 text-emerald-500" />
                    <h3 className="text-lg font-bold text-text-base">Atalhos Rápidos</h3>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                    <Link
                      to="/associados"
                      state={{ openNew: true }}
                      className="flex-1 flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <UserPlus className="w-6 h-6" />
                      Novo Associado
                    </Link>
                    <Link
                      to="/atendimentos"
                      state={{ openNew: true }}
                      className="flex-1 flex items-center justify-center gap-3 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <Stethoscope className="w-6 h-6" />
                      Novo Atendimento
                    </Link>
                  </div>
                </div>
              );
"""
    content = content.replace("switch (widget.id) {", "switch (widget.id) {" + atalhos_code)

with open('src/pages/Dashboard.tsx', 'w') as f:
    f.write(content)
