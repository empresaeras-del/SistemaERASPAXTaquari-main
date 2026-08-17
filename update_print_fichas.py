import re

filepath = 'src/pages/CredenciadosPage.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# Replace the import from pdfExport
content = content.replace(
    'import { exportToPDF } from "../lib/pdfExport";',
    'import { exportToPDF, exportFichasToPDF } from "../lib/pdfExport";'
)

# Add a Printer icon
content = content.replace(
    'Download,',
    'Download, Printer,'
)

# Find handleExportPDF
export_func_str = """
  const handleExportPDF = async () => {
    const tenantId = state.empresaSelecionada || 'default_tenant';
    const empresa = await getEmpresaById(tenantId, state.isOnline);
    const columns = ["Razão Social", "Documento", "Ramo", "Status"];
    const data = filtered.map(c => [
      c.razao_social,
      c.cnpj_cpf,
      c.ramo_atividade.replace('_', ' ').toUpperCase(),
      c.status.toUpperCase()
    ]);
    await exportToPDF("Relatório de Rede Credenciada", columns, data, "credenciados_export", empresa?.logo_url);
  };
"""

export_fichas_func_str = """
  const handleExportPDF = async () => {
    const tenantId = state.empresaSelecionada || 'default_tenant';
    const empresa = await getEmpresaById(tenantId, state.isOnline);
    const columns = ["Razão Social", "Documento", "Ramo", "Status"];
    const data = filtered.map(c => [
      c.razao_social,
      c.cnpj_cpf,
      c.ramo_atividade.replace('_', ' ').toUpperCase(),
      c.status.toUpperCase()
    ]);
    await exportToPDF("Relatório de Rede Credenciada", columns, data, "credenciados_export", empresa?.logo_url);
  };

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

content = content.replace(export_func_str.strip(), export_fichas_func_str.strip())


# Add the button
button_html = """
          <button
            onClick={handleExportPDF}
"""

new_button_html = """
          <button
            onClick={handlePrintFichas}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-bg-surface text-text-base border border-border-default rounded-xl text-xs font-semibold hover:bg-bg-hover transition-colors shadow-sm"
            title="Imprimir Fichas Cadastrais (PDF)"
          >
            <Printer className="w-4 h-4 text-text-subtle" />
            <span>Imprimir Fichas</span>
          </button>
          <button
            onClick={handleExportPDF}
"""

content = content.replace(button_html.strip(), new_button_html.strip())

with open(filepath, 'w') as f:
    f.write(content)
