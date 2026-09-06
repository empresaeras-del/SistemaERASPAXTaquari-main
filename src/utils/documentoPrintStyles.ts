import type { MargensConfig } from '../types/documentos';
import { margensOu } from './assinaturaPosicao';

/**
 * CSS de impressão dos Documentos Padrões — fonte única.
 *
 * A página de modelos e o visualizador/impressão abriam cada um sua própria
 * janela de impressão com uma cópia quase idêntica deste bloco de estilos
 * (classes `.doc-header`, `.doc-content`, `.doc-footer`, `.signature-line`,
 * tabelas, quebras de página). Esta função centraliza o CSS para as duas
 * janelas de impressão ficarem sempre visualmente idênticas.
 */
export function gerarCssImpressaoDocumento(
  orientacao: 'portrait' | 'landscape' = 'portrait',
  margens?: MargensConfig | null,
): string {
  const m = margensOu(margens);
  return `
    @page {
      size: A4 ${orientacao};
      margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm;
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
      /* Âncora da assinatura de posição livre. A impressão recebe o conteúdo de
         DENTRO da folha do visualizador, não a folha (que é 'position: relative');
         sem este 'relative' aqui, o 'position: absolute' da assinatura passava a
         ser resolvido contra a caixa da página e caía em outro lugar e tamanho. */
      position: relative;
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
    /* ── Assinatura de posição livre (drag-and-drop) ──────────────────────────
       A janela de impressão não carrega Tailwind, então nada do 'max-h-full
       max-w-full object-contain' / 'flex items-center' que existe no
       visualizador chega até aqui. Sem estas regras a imagem era desenhada no
       tamanho natural do arquivo (um carimbo digitalizado passa de 25cm) e
       transbordava a caixa. Tudo o que a assinatura precisa para se comportar
       tem que estar nomeado neste bloco. */
    .doc-assinatura-area {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      pointer-events: none;
    }
    .doc-assinatura-livre {
      position: absolute;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      text-align: center;
      overflow: hidden;
    }
    .doc-assinatura-livre img {
      flex: 1 1 auto;
      min-height: 0;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .doc-assinatura-livre .signature-line {
      width: 80%;
      margin: 4px auto 3px;
      flex: 0 0 auto;
    }
    .doc-assinatura-livre p {
      margin: 0;
      font-size: 8pt;
      line-height: 1.25;
      font-weight: bold;
      text-transform: uppercase;
      flex: 0 0 auto;
    }
    /* Guias de página do visualizador: existem só para orientar o arrasto. */
    .doc-guia-pagina {
      display: none !important;
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
  orientacao: 'portrait' | 'landscape' = 'portrait',
  margens?: MargensConfig | null,
): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${titulo}</title>
        <style>${gerarCssImpressaoDocumento(orientacao, margens)}</style>
      </head>
      <body>
        <div class="doc-container">
          ${bodyHtml}
        </div>
      </body>
    </html>
  `;
}
