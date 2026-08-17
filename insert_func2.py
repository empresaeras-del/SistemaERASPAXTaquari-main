import re

filepath = 'src/pages/CredenciadosPage.tsx'
with open(filepath, 'r') as f:
    content = f.read()

func = """
  const handlePrintFichas = async () => {
    const tenantId = state.empresaSelecionada || 'default_tenant';
    const empresa = await getEmpresaById(tenantId, state.isOnline);
    
    if (filtered.length === 0) {
      toast.error('Nenhum credenciado para exportar');
      return;
    }
    
    toast.success(`Gerando fichas de ${filtered.length} credenciado(s)...`);
    await exportFichasToPDF("Fichas de Credenciados", filtered, "fichas_credenciados", empresa?.logo_url);
  };
"""

target = "    await exportToPDF(\"Relatório de Rede Credenciada\", columns, data, \"credenciados_export\", empresa?.logo_url);\n    toast.success('PDF exportado com sucesso!');\n  };"

content = content.replace(target, target + "\n" + func)

with open(filepath, 'w') as f:
    f.write(content)
