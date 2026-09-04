/**
 * CSS de impressão dos Documentos Padrões — fonte única.
 *
 * A página de modelos e o visualizador/impressão abriam cada um sua própria
 * janela de impressão com uma cópia quase idêntica deste bloco de estilos
 * (classes `.doc-header`, `.doc-content`, `.doc-footer`, `.signature-line`,
 * tabelas, quebras de página). Esta função centraliza o CSS para as duas
 * janelas de impressão ficarem sempre visualmente idênticas.
 */
export function gerarCssImpressaoDocumento(orientacao: 'portrait' | 'landscape' = 'portrait'): string {
  return `
    @page {
      size: A4 ${orientacao};
      margin: 15mm 15mm 15mm 15mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .doc-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      background: #ffffff;
    }
    .doc-header {
      width: 100%;
      text-align: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 14px;
      margin-bottom: 22px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .doc-header img {
      max-height: 90px;
      width: 100%;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .doc-content {
      width: 100%;
      page-break-inside: auto;
      break-inside: auto;
    }
    .doc-content p,
    .doc-content div,
    .doc-content h1,
    .doc-content h2,
    .doc-content h3,
    .doc-content h4,
    .doc-content table,
    .doc-content ul,
    .doc-content ol {
      page-break-inside: auto;
      break-inside: auto;
      margin-bottom: 12px;
    }
    .doc-footer {
      width: 100%;
      margin-top: 40px;
      padding-top: 18px;
      border-top: 1px solid #cbd5e1;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .doc-footer img {
      max-height: 75px;
      max-width: 280px;
      object-fit: contain;
      margin-bottom: 6px;
    }
    .signature-line {
      width: 280px;
      border-top: 1px solid #0f172a;
      margin: 6px auto;
    }
    h1, h2, h3, h4 {
      color: #0f172a;
      margin-top: 14px;
      margin-bottom: 8px;
    }
    strong {
      font-weight: bold;
      color: #000000;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    table th, table td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      font-size: 10pt;
    }
    table th {
      background-color: #f1f5f9;
      font-weight: bold;
    }
    table.tabela-sem-grade,
    table.tabela-sem-grade td,
    table.tabela-sem-grade th,
    table[style*="border: none"],
    table[style*="border: 0"] {
      border: none !important;
    }
    table.tabela-zebrada tr:nth-child(even) td {
      background-color: #f8fafc !important;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
      border: none !important;
    }
    .page-break span {
      display: none !important;
    }
  `;
}

/** Monta o documento HTML completo para a janela de impressão de um Documento Padrão. */
export function montarHtmlImpressaoDocumento(
  titulo: string,
  bodyHtml: string,
  orientacao: 'portrait' | 'landscape' = 'portrait'
): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${titulo}</title>
        <style>${gerarCssImpressaoDocumento(orientacao)}</style>
      </head>
      <body>
        <div class="doc-container">
          ${bodyHtml}
        </div>
      </body>
    </html>
  `;
}
