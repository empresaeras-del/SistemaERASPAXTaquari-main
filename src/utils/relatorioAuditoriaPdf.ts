/**
 * As duas exportações em PDF da Ata de Ocorrências.
 *
 * **`jspdf` e `jspdf-autotable` entram por import dinâmico**, dentro da função que os usa.
 * É a regra que o CLAUDE.md fixa: um `import` estático no topo entra no grafo de dependências
 * de qualquer coisa que importe qualquer função do arquivo — e aqui isso custava ~1 MB no
 * chunk da rota, carregado mesmo para quem só abre a tela para conferir um log.
 *
 * O conteúdo (rótulos de filtro, linhas da tabela) vem de `relatorioAuditoria.ts`, a mesma
 * fonte da folha em tela e do CSV. Este módulo decide só **como** o papel fica.
 */
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchImageWithDimensions } from './imageUtils';
import {
  CABECALHO_PDF,
  operadorEmTresLinhas,
  type LinhaDoRelatorio,
  type RotulosDeFiltro,
} from './relatorioAuditoria';
import type { LogAuditoria } from '../services/auditoriaService';
import type { Empresa } from '../services/empresasService';

/** A ação que marca uma reabertura de lote — é a chave do segundo relatório. */
export const ACAO_REABERTURA_CAIXA = 'Reabertura Lote Caixa';

export const gerarPdfDaAtaDeOcorrencias = async (params: {
  empresa: Empresa | null;
  rotulos: RotulosDeFiltro;
  linhas: LinhaDoRelatorio[];
}): Promise<void> => {
  const { empresa, rotulos, linhas } = params;
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
      let currentY = 14;

      // 1. Logo / Cabeçalho Empresa
      const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'PAX e Funerária Taquari';
      const docEmpresa = empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : '';
      const contatoEmpresa = [empresa?.telefone, empresa?.email].filter(Boolean).join(' | ');

      if (empresa?.logo_url) {
        try {
          const imgData = await fetchImageWithDimensions(empresa.logo_url);
          if (imgData && imgData.base64) {
            const maxWidth = 50;
            const maxHeight = 20;
            let imgWidth = maxWidth;
            let imgHeight = (imgData.height * maxWidth) / imgData.width;
            if (imgHeight > maxHeight) {
              imgHeight = maxHeight;
              imgWidth = (imgData.width * maxHeight) / imgData.height;
            }
            doc.addImage(imgData.base64, 'PNG', 14, currentY, imgWidth, imgHeight, '', 'FAST');
          }
        } catch (e) {
          console.warn('Erro ao carregar logo para PDF', e);
        }
      }

      // Dados da Empresa (Texto à direita/centro)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(nomeEmpresa, 14, currentY + 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      if (docEmpresa) {
        doc.text(docEmpresa, 14, currentY + 11);
      }
      if (contatoEmpresa) {
        doc.text(contatoEmpresa, 14, currentY + 15);
      }

      // Título do Relatório
      currentY += 22;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, currentY, pageWidth - 28, 14, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('RELATÓRIO DE ATA DE OCORRÊNCIAS (AUDITORIA DO SISTEMA)', 18, currentY + 6.5);

      // Metadados do Relatório (Filtros aplicados)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);

      // Os rótulos e as linhas vêm prontos da função pura — a mesma que alimenta a folha em
      // tela e o CSV. Remontá-los aqui é como as três saídas passavam a discordar.
      doc.text(
        `Período: ${rotulos.periodo}  |  Módulo: ${rotulos.modulo}  |  Operador: ${rotulos.operador}`,
        18,
        currentY + 11,
      );
      doc.text(
        `Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}  |  Total: ${linhas.length} registros`,
        pageWidth - 18,
        currentY + 11,
        { align: 'right' },
      );

      currentY += 18;

      // Tabela com autoTable
      const tableData = linhas.map((linha) => [
        String(linha.indice),
        linha.dataHora,
        linha.modulo,
        linha.acao,
        operadorEmTresLinhas(linha),
        linha.detalhes,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [[...CABECALHO_PDF]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left'
        },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.5,
          valign: 'middle',
          overflow: 'linebreak'
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 32 },
          2: { cellWidth: 38 },
          3: { cellWidth: 50, fontStyle: 'bold' },
          4: { cellWidth: 46 },
          5: { cellWidth: 'auto' }
        },
        margin: { left: 14, right: 14, bottom: 16 },
        didDrawPage: (data) => {
          const totalPages = doc.getNumberOfPages();
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Página ${data.pageNumber} de ${totalPages}  •  Sistema ERAS - Rastreabilidade e Auditoria`,
            pageWidth - 14,
            202,
            { align: 'right' }
          );
        }
      });

      const filename = `Relatorio_Ata_Ocorrencias_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      doc.save(filename);
};

export const gerarPdfDeReaberturasDeCaixa = async (logs: LogAuditoria[]): Promise<number> => {
  const reaberturas = (logs || []).filter((log) => log.acao === ACAO_REABERTURA_CAIXA);
  if (reaberturas.length === 0) return 0;

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

      const doc = new jsPDF('landscape');
      
      doc.setFontSize(16);
      doc.text('Relatório de Reaberturas de Caixas', 14, 20);
      
      doc.setFontSize(10);
      doc.text(`Data da Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
      
      const tableData = reaberturas.map(log => {
        const dataStr = format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR });
        const codigoLote = log.detalhes?.codigo || log.detalhes?.id || 'N/A';
        const usuarioAutorizador = log.usuarios?.nome || log.detalhes?.usuario || 'N/A';
        const justificativa = log.detalhes?.justificativa || 'N/A';
        
        return [
          dataStr,
          codigoLote,
          usuarioAutorizador,
          justificativa
        ];
      });

      autoTable(doc, {
        startY: 35,
        head: [['Data / Hora', 'Lote / Sessão', 'Autorizado Por', 'Justificativa']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 40 },
          2: { cellWidth: 45 },
          3: { cellWidth: 'auto' }
        }
      });

      doc.save(`Relatorio_Reaberturas_Caixa_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  return reaberturas.length;
};
