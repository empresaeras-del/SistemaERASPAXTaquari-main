import jsPDF from 'jspdf';
import { fetchImageAsBase64, fetchImageWithDimensions } from '../utils/imageUtils';
import autoTable from 'jspdf-autotable';

export const exportToPDF = async (title: string, columns: string[], data: any[][], filename: string, logoUrl?: string) => {
  const doc = new jsPDF();
  

  let currentY = 14;
  if (logoUrl) {
    const imgData = await fetchImageWithDimensions(logoUrl);
    if (imgData && imgData.base64) {
      const maxWidth = 182;
      const maxHeight = 40;
      let imgWidth = maxWidth;
      let imgHeight = (imgData.height * maxWidth) / imgData.width;
      
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = (imgData.width * maxHeight) / imgData.height;
      }
      
      const x = 14 + (maxWidth - imgWidth) / 2;
      doc.addImage(imgData.base64, 'PNG', x, currentY, imgWidth, imgHeight, '', 'FAST');
      currentY += imgHeight + 10;
    }
  }

  // Title
  doc.setFontSize(18);
  doc.text(title, 14, currentY);
  currentY += 8;
  
  // Date
  doc.setFontSize(11);
  const dateStr = new Date().toLocaleString('pt-BR');
  doc.text(`Gerado em: ${dateStr}`, 14, currentY);
  currentY += 10;

  // Table
  autoTable(doc, {
    startY: currentY,

    head: [columns],
    body: data,
    theme: 'grid',
    headStyles: { fillColor: [126, 76, 243] }, // #3B82F6
    styles: { fontSize: 9 }
  });
  
  doc.save(`${filename}.pdf`);
};

export const exportFichasToPDF = async (title: string, credenciados: any[], filename: string, logoUrl?: string) => {
  const doc = new jsPDF();
  
  for (let i = 0; i < credenciados.length; i++) {
    if (i > 0) {
      doc.addPage();
    }
    
    let currentY = 14;
    if (logoUrl) {
      const imgData = await fetchImageWithDimensions(logoUrl);
      if (imgData && imgData.base64) {
        const maxWidth = 182;
        const maxHeight = 40;
        let imgWidth = maxWidth;
        let imgHeight = (imgData.height * maxWidth) / imgData.width;
        
        if (imgHeight > maxHeight) {
          imgHeight = maxHeight;
          imgWidth = (imgData.width * maxHeight) / imgData.height;
        }
        
        const x = 14 + (maxWidth - imgWidth) / 2;
        doc.addImage(imgData.base64, 'PNG', x, currentY, imgWidth, imgHeight, '', 'FAST');
        currentY += imgHeight + 10;
      }
    }
    
    const c = credenciados[i];
    
    // Header
    doc.setFontSize(16);
    doc.setTextColor(59, 130, 246); // Primary blue
    doc.text("FICHA CADASTRAL DE CREDENCIADO", 105, currentY, { align: 'center' });
    currentY += 12;
    
    // Reset Color
    doc.setTextColor(0, 0, 0);

    const drawSection = (title: string, fields: {label: string, value: any}[]) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(14, currentY, 182, 8, 'F');
      doc.text(title, 16, currentY + 6);
      currentY += 14;
      
      doc.setFontSize(10);
      let col = 14;
      let startY = currentY;
      
      for (const field of fields) {
        if (!field.value) continue;
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${field.label}:`, col, currentY);
        doc.setFont('helvetica', 'normal');
        
        const textWidth = doc.getTextWidth(`${field.label}: `);
        const textValue = String(field.value);
        
        // Handling long values
        if (col + textWidth + doc.getTextWidth(textValue) > 190) {
           doc.text(textValue, col, currentY + 5);
           currentY += 10;
        } else {
           doc.text(textValue, col + textWidth, currentY);
           currentY += 6;
        }
      }
      currentY += 6; // Spacing between sections
    };

    drawSection("IDENTIFICAÇÃO PRINCIPAL", [
      { label: "Razão Social", value: c.razao_social },
      { label: "Nome Fantasia", value: c.nome_fantasia },
      { label: "CNPJ / CPF", value: c.cnpj_cpf },
      { label: "Ramo de Atividade", value: c.ramo_atividade?.replace('_', ' ').toUpperCase() },
      { label: "E-mail", value: c.email },
      { label: "Telefone Principal", value: c.telefone },
      { label: "Status", value: c.status?.toUpperCase() }
    ]);
    
    drawSection("ENDEREÇO", [
      { label: "CEP", value: c.cep },
      { label: "Endereço", value: c.endereco },
      { label: "Número", value: c.numero },
      { label: "Complemento", value: c.complemento },
      { label: "Bairro", value: c.bairro },
      { label: "Cidade / UF", value: `${c.cidade || ''} / ${c.estado || ''}` }
    ]);

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${dateStr}`, 14, 285);
  }

  if (credenciados.length === 0) {
      doc.setFontSize(14);
      doc.text("Nenhum credenciado encontrado para gerar ficha.", 14, 20);
  }

  doc.save(`${filename}.pdf`);
};
