import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Users,
  Heart,
  ShieldCheck,
  AlertCircle,
  Filter,
  Layers,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { Associado, Dependente } from '../../services/associadosService';
import { Empresa } from '../../services/empresasService';
import { formatLocalDate } from '../../utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

/**
 * Máscara de CPF conforme LGPD — oculta os 6 dígitos centrais.
 * Exemplo: 046.537.031-40 → 046.***.***-40
 */
const mascaraCpfLGPD = (cpf: string): string => {
  const s = (cpf || '').replace(/\D/g, '');
  if (s.length !== 11) return cpf || 'Não informado';
  return `${s.slice(0, 3)}.***.***-${s.slice(9, 11)}`;
};

interface RelatorioAssociadosModalProps {
  isOpen: boolean;
  onClose: () => void;
  associados: Associado[];
  empresaData: Empresa | null;
  currentFilters?: {
    searchTerm?: string;
    statusFilter?: string;
    planoFilter?: string;
  };
  userName?: string;
  initialReportType?: 'titulares' | 'dependentes';
}

export const RelatorioAssociadosModal: React.FC<RelatorioAssociadosModalProps> = ({
  isOpen,
  onClose,
  associados,
  empresaData,
  currentFilters = {},
  userName = 'Operador do Sistema',
  initialReportType = 'titulares',
}) => {
  const [reportType, setReportType] = useState<'titulares' | 'dependentes'>(initialReportType);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [zoom, setZoom] = useState<number>(100);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Lista de Dependentes planificada
  const listaDependentes = useMemo(() => {
    const list: Array<{
      index: number;
      dependente: Dependente;
      titularNome: string;
      titularCpf: string;
      titularPlano: string;
      titularStatus: string;
      titularContato: string;
      titularEndereco: string;
    }> = [];

    let count = 1;
    associados.forEach((assoc) => {
      if (assoc.dependentes && assoc.dependentes.length > 0) {
        assoc.dependentes.forEach((dep) => {
          const endereco = [
            assoc.endereco_logradouro
              ? `${assoc.endereco_logradouro}${assoc.endereco_numero ? ', ' + assoc.endereco_numero : ''}`
              : '',
            assoc.endereco_bairro ? `Bairro: ${assoc.endereco_bairro}` : '',
            assoc.endereco_cidade || '',
          ]
            .filter(Boolean)
            .join(' - ');

          const contato = [assoc.telefone ? `Tel: ${assoc.telefone}` : '', assoc.email || '']
            .filter(Boolean)
            .join(' | ');

          list.push({
            index: count++,
            dependente: dep,
            titularNome: assoc.nome,
            titularCpf: assoc.cpf,
            titularPlano: assoc.plano_nome || 'Sem plano',
            titularStatus: assoc.status,
            titularContato: contato || '-',
            titularEndereco: endereco || '-',
          });
        });
      }
    });

    return list;
  }, [associados]);

  // Lista de Titulares formatada
  const listaTitulares = useMemo(() => {
    return associados.map((assoc, idx) => {
      const endereco = [
        assoc.endereco_logradouro
          ? `${assoc.endereco_logradouro}${assoc.endereco_numero ? ', ' + assoc.endereco_numero : ''}`
          : '',
        assoc.endereco_bairro ? `Bairro: ${assoc.endereco_bairro}` : '',
        assoc.endereco_cidade ? assoc.endereco_cidade : '',
        assoc.endereco_cep ? `CEP: ${assoc.endereco_cep}` : '',
      ]
        .filter(Boolean)
        .join(' - ');

      const contato = [
        assoc.telefone ? `Tel: ${assoc.telefone}` : '',
        assoc.email ? `Email: ${assoc.email}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      if (assoc.status === 'inadimplente') statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
      else if (assoc.status === 'inativo' || assoc.status === 'encerrado')
        statusColor = 'text-slate-600 bg-slate-100 border-slate-300';

      return {
        index: idx + 1,
        associado: assoc,
        nome: assoc.nome,
        cpf: assoc.cpf || 'Não informado',
        rg: assoc.rg || '-',
        dataNascimento: assoc.data_nascimento ? formatLocalDate(assoc.data_nascimento) : '-',
        dataAdesao: assoc.data_adesao ? formatLocalDate(assoc.data_adesao) : '-',
        plano: assoc.plano_nome || 'Sem plano',
        contrato: assoc.numero_contrato || '-',
        valorPlano: assoc.valor_plano
          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              assoc.valor_plano,
            )
          : '-',
        enderecoCompleto: endereco || 'Endereço não informado',
        contatoCompleto: contato || 'Contato não informado',
        qtdDependentes: assoc.dependentes?.length || 0,
        status: assoc.status,
        statusColor,
      };
    });
  }, [associados]);

  // KPIs
  const totais = useMemo(() => {
    const totalTitulares = associados.length;
    const totalDeps = listaDependentes.length;
    const vidasProtegidas = totalTitulares + totalDeps;
    const ativos = associados.filter((a) => a.status === 'ativo').length;
    const inadimplentes = associados.filter((a) => a.status === 'inadimplente').length;
    const inativos = associados.filter(
      (a) => a.status === 'inativo' || a.status === 'encerrado',
    ).length;

    return {
      totalTitulares,
      totalDeps,
      vidasProtegidas,
      ativos,
      inadimplentes,
      inativos,
    };
  }, [associados, listaDependentes]);

  if (!isOpen) return null;

  // Zoom handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 40));
  const handleZoomReset = () => setZoom(100);

  // Impressão limpa via janela dedicada
  const handleImprimir = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a janela de impressão. Permita pop-ups.');
      return;
    }

    const dataHoraEmissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss");
    const logoHtml = empresaData?.logo_url
      ? `<img src="${empresaData.logo_url}" alt="Logo" style="max-height: 55px; max-width: 220px; object-fit: contain;" />`
      : `<h1 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; color: #0f172a;">${empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX'}</h1>`;

    const filtroBusca = currentFilters.searchTerm ? `"${currentFilters.searchTerm}"` : 'Nenhum';
    const filtroStatus = currentFilters.statusFilter
      ? currentFilters.statusFilter.toUpperCase()
      : 'TODOS';

    let tableHeaderHtml = '';
    let tableRowsHtml = '';

    if (reportType === 'titulares') {
      tableHeaderHtml = `
        <tr>
          <th style="width: 3%; text-align: center;">#</th>
          <th style="width: 24%;">Associado Titular</th>
          <th style="width: 24%;">Endereço Completo</th>
          <th style="width: 16%;">Contato</th>
          <th style="width: 14%;">Plano / Contrato</th>
          <th style="width: 7%; text-align: center;">Adesão</th>
          <th style="width: 5%; text-align: center;">Deps.</th>
          <th style="width: 7%; text-align: center;">Status</th>
        </tr>
      `;

      tableRowsHtml = listaTitulares
        .map(
          (t) => `
        <tr>
          <td style="text-align: center; font-weight: 600; color: #475569;">${t.index}</td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 10.5px;">${t.nome}</div>
            <div style="color: #64748b; font-size: 9px; margin-top: 1px;">
              <span><strong>CPF:</strong> ${mascaraCpfLGPD(t.cpf)}</span>
              ${t.rg !== '-' ? ` | <span><strong>RG:</strong> ${t.rg}</span>` : ''}
              ${t.dataNascimento !== '-' ? ` | <span><strong>Nasc:</strong> ${t.dataNascimento}</span>` : ''}
            </div>
          </td>
          <td style="font-size: 9.5px; color: #334155; line-height: 1.25;">${t.enderecoCompleto}</td>
          <td style="font-size: 9.5px; color: #334155; line-height: 1.25;">${t.contatoCompleto}</td>
          <td style="font-size: 9.5px; color: #0f172a;">
            <div style="font-weight: 600; color: #047857;">${t.plano}</div>
            <div style="color: #64748b; font-size: 9px;">Contrato: ${t.contrato}</div>
          </td>
          <td style="text-align: center; font-size: 9.5px; color: #0f172a;">${t.dataAdesao}</td>
          <td style="text-align: center; font-weight: 700; font-size: 10px; color: #7c3aed;">${t.qtdDependentes}</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase;
              ${t.status === 'ativo' ? 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;' : ''}
              ${t.status === 'inadimplente' ? 'background: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3;' : ''}
              ${t.status === 'inativo' || t.status === 'encerrado' ? 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;' : ''}
            ">
              ${t.status}
            </span>
          </td>
        </tr>
      `,
        )
        .join('');
    } else {
      tableHeaderHtml = `
        <tr>
          <th style="width: 4%; text-align: center;">#</th>
          <th style="width: 28%;">Dependente</th>
          <th style="width: 14%;">Parentesco</th>
          <th style="width: 24%;">Titular Responsável</th>
          <th style="width: 20%;">Contato / Endereço</th>
          <th style="width: 10%; text-align: center;">Status Titular</th>
        </tr>
      `;

      tableRowsHtml = listaDependentes
        .map(
          (d) => `
        <tr>
          <td style="text-align: center; font-weight: 600; color: #475569;">${d.index}</td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 10.5px;">${d.dependente.nome}</div>
            <div style="color: #64748b; font-size: 9px; margin-top: 1px;">
              ${d.dependente.cpf ? `<span><strong>CPF:</strong> ${mascaraCpfLGPD(d.dependente.cpf)}</span> | ` : ''}
              <span><strong>Nasc:</strong> ${d.dependente.data_nascimento ? formatLocalDate(d.dependente.data_nascimento) : '-'}</span>
            </div>
          </td>
          <td style="font-weight: 600; font-size: 9.5px; color: #7c3aed; text-transform: capitalize;">
            ${d.dependente.parentesco || 'Dependente'}
          </td>
          <td>
            <div style="font-weight: 700; color: #0f172a; font-size: 10px;">${d.titularNome}</div>
            <div style="color: #64748b; font-size: 8.5px;">CPF: ${mascaraCpfLGPD(d.titularCpf)} | Plano: ${d.titularPlano}</div>
          </td>
          <td style="font-size: 9px; color: #334155; line-height: 1.25;">
            <div>${d.titularContato}</div>
            <div style="color: #64748b; margin-top: 2px;">${d.titularEndereco}</div>
          </td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase;
              ${d.titularStatus === 'ativo' ? 'background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;' : ''}
              ${d.titularStatus === 'inadimplente' ? 'background: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3;' : ''}
              ${d.titularStatus === 'inativo' || d.titularStatus === 'encerrado' ? 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;' : ''}
            ">
              ${d.titularStatus}
            </span>
          </td>
        </tr>
      `,
        )
        .join('');
    }

    const pageOrientationCss =
      orientation === 'landscape' ? 'size: A4 landscape;' : 'size: A4 portrait;';

    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório de ${reportType === 'titulares' ? 'Associados Titulares' : 'Dependentes'} - ERAS PAX</title>
          <style>
            @page { ${pageOrientationCss} margin: 8mm 10mm; }
            *, *::before, *::after { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a; margin: 0; padding: 0; background-color: #ffffff;
              -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px;
            }
            .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
            .title-main { font-size: 16px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0 0 4px 0; }
            .filters-bar {
              background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
              padding: 6px 10px; margin-bottom: 10px; display: flex; justify-content: space-between;
              font-size: 9.5px; color: #475569;
            }
            .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px; }
            .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #f8fafc; }
            .kpi-label { font-size: 8.5px; text-transform: uppercase; font-weight: 700; color: #64748b; }
            .kpi-val { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 2px; }
            table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            table.data-table th {
              background-color: #0f172a !important; color: #ffffff !important;
              font-weight: 800; font-size: 9.5px; text-transform: uppercase;
              padding: 6px 7px; border: 1px solid #0f172a; text-align: left;
            }
            table.data-table td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; }
            table.data-table tr:nth-child(even) { background-color: #f8fafc; }
            .footer-info {
              border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 14px;
              display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="vertical-align: top; width: 50%;">
                ${logoHtml}
                <div style="font-size: 9.5px; color: #475569; margin-top: 3px; line-height: 1.3;">
                  ${empresaData?.cnpj ? `<strong>CNPJ:</strong> ${empresaData.cnpj} | ` : ''}
                  ${empresaData?.telefone ? `<strong>Tel:</strong> ${empresaData.telefone}<br/>` : '<br/>'}
                  ${empresaData?.endereco ? `${empresaData.endereco}` : ''}
                </div>
              </td>
              <td style="vertical-align: top; width: 50%; text-align: right;">
                <div class="title-main">Relatório de ${reportType === 'titulares' ? 'Associados (Titulares)' : 'Dependentes Cadastrados'}</div>
                <div style="font-size: 10px; font-weight: 600; color: #2563eb;">Gestão Cadastral de Planos & Associados</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 4px;">
                  <strong>Emissão:</strong> ${dataHoraEmissao}<br/>
                  <strong>Emitido por:</strong> ${userName}
                </div>
              </td>
            </tr>
          </table>

          <div class="filters-bar">
            <div><strong>Tipo:</strong> ${reportType === 'titulares' ? 'Titulares' : 'Dependentes'}</div>
            <div><strong>Status:</strong> ${filtroStatus}</div>
            <div><strong>Busca:</strong> ${filtroBusca}</div>
            <div><strong>Registros:</strong> ${reportType === 'titulares' ? listaTitulares.length : listaDependentes.length}</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card" style="border-left: 3px solid #3b82f6;">
              <div class="kpi-label">Titulares</div>
              <div class="kpi-val" style="color: #2563eb;">${totais.totalTitulares}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #8b5cf6;">
              <div class="kpi-label">Dependentes</div>
              <div class="kpi-val" style="color: #7c3aed;">${totais.totalDeps}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #16a34a;">
              <div class="kpi-label">Vidas Protegidas</div>
              <div class="kpi-val" style="color: #16a34a;">${totais.vidasProtegidas}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #059669;">
              <div class="kpi-label">Titulares Ativos</div>
              <div class="kpi-val" style="color: #059669;">${totais.ativos}</div>
            </div>
            <div class="kpi-card" style="border-left: 3px solid #e11d48;">
              <div class="kpi-label">Inadimplentes</div>
              <div class="kpi-val" style="color: #e11d48;">${totais.inadimplentes}</div>
            </div>
          </div>

          <table class="data-table">
            <thead>
              ${tableHeaderHtml}
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
            <tfoot>
              <tr style="background-color: #f1f5f9; font-weight: 800;">
                <td colspan="${reportType === 'titulares' ? 8 : 6}" style="text-align: right; padding: 6px 8px; text-transform: uppercase; font-size: 10px;">
                  Total de ${reportType === 'titulares' ? 'Titulares' : 'Dependentes'}: ${reportType === 'titulares' ? listaTitulares.length : listaDependentes.length} registros listados
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="footer-info">
            <div>Sistema ERAS PAX Taquari - Gestão Integrada de Planos & Associados</div>
            <div>Documento emitido eletronicamente em ${dataHoraEmissao}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  // Exportação para PDF via jsPDF / AutoTable
  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      toast.loading('Gerando PDF...', { id: 'export-assoc-pdf' });

      const doc = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: 'a4',
      });

      const dataHoraEmissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
      const companyName =
        empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX';

      // Header Background
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');

      // Header Text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName.toUpperCase(), 14, 10);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `RELATÓRIO DE ${reportType === 'titulares' ? 'ASSOCIADOS (TITULARES)' : 'DEPENDENTES CADASTRADOS'}`,
        14,
        16,
      );

      doc.setFontSize(8);
      doc.text(
        `Emissão: ${dataHoraEmissao} | Operador: ${userName}`,
        doc.internal.pageSize.getWidth() - 14,
        10,
        { align: 'right' },
      );
      doc.text(
        `Total: ${reportType === 'titulares' ? listaTitulares.length : listaDependentes.length} registros | Orientação: ${orientation === 'landscape' ? 'Paisagem' : 'Retrato'}`,
        doc.internal.pageSize.getWidth() - 14,
        16,
        { align: 'right' },
      );

      let tableHead: string[][] = [];
      let tableBody: string[][] = [];

      if (reportType === 'titulares') {
        tableHead = [
          [
            '#',
            'Associado Titular',
            'Endereço Completo',
            'Contato',
            'Plano / Contrato',
            'Adesão',
            'Deps.',
            'Status',
          ],
        ];
        tableBody = listaTitulares.map((t) => [
          t.index.toString(),
          `${t.nome}\nCPF: ${mascaraCpfLGPD(t.cpf)}${t.rg !== '-' ? ' | RG: ' + t.rg : ''}`,
          t.enderecoCompleto,
          t.contatoCompleto,
          `${t.plano}\nContrato: ${t.contrato}`,
          t.dataAdesao,
          t.qtdDependentes.toString(),
          t.status,
        ]);
      } else {
        tableHead = [
          [
            '#',
            'Dependente',
            'Parentesco',
            'Titular Responsável',
            'Contato / Endereço',
            'Status Titular',
          ],
        ];
        tableBody = listaDependentes.map((d) => [
          d.index.toString(),
          `${d.dependente.nome}\n${d.dependente.cpf ? 'CPF: ' + mascaraCpfLGPD(d.dependente.cpf) + ' | ' : ''}Nasc: ${d.dependente.data_nascimento ? formatLocalDate(d.dependente.data_nascimento) : '-'}`,
          d.dependente.parentesco || 'Dependente',
          `${d.titularNome}\nCPF: ${mascaraCpfLGPD(d.titularCpf)} | Plano: ${d.titularPlano}`,
          `${d.titularContato}\n${d.titularEndereco}`,
          d.titularStatus,
        ]);
      }

      autoTable(doc, {
        startY: 28,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left',
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [15, 23, 42],
          cellPadding: 2,
        },
        columnStyles:
          reportType === 'titulares'
            ? {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: orientation === 'landscape' ? 55 : 40 },
                2: { cellWidth: orientation === 'landscape' ? 62 : 44 },
                3: { cellWidth: orientation === 'landscape' ? 42 : 30 },
                4: { cellWidth: orientation === 'landscape' ? 42 : 30 },
                5: { cellWidth: 18, halign: 'center' },
                6: { cellWidth: 12, halign: 'center' },
                7: { cellWidth: 20, halign: 'center' },
              }
            : {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: orientation === 'landscape' ? 65 : 45 },
                2: { cellWidth: orientation === 'landscape' ? 35 : 25 },
                3: { cellWidth: orientation === 'landscape' ? 65 : 45 },
                4: { cellWidth: orientation === 'landscape' ? 65 : 45 },
                5: { cellWidth: 22, halign: 'center' },
              },
        foot: [
          [
            {
              content: `TOTAL CONSOLIDADO: ${reportType === 'titulares' ? listaTitulares.length : listaDependentes.length} registros`,
              colSpan: reportType === 'titulares' ? 8 : 6,
              styles: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] },
            },
          ],
        ],
        margin: { left: 14, right: 14 },
      });

      const filename = `Relatorio_${reportType === 'titulares' ? 'Associados' : 'Dependentes'}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      doc.save(filename);
      toast.success('Relatório em PDF exportado com sucesso!', { id: 'export-assoc-pdf' });
    } catch (err) {
      console.error('Erro ao gerar PDF de associados:', err);
      toast.error('Erro ao gerar PDF. Use a opção Imprimir.', { id: 'export-assoc-pdf' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1e232a] text-slate-100 backdrop-blur-md overflow-hidden">
      {/* TOOLBAR */}
      <header className="h-16 bg-[#13171f] border-b border-[#2d3544] px-6 flex items-center justify-between shadow-xl shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Relatório de {reportType === 'titulares' ? 'Associados Titulares' : 'Dependentes'}
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {reportType === 'titulares' ? listaTitulares.length : listaDependentes.length}{' '}
                registros
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Visualização fiel de cadastro completo para impressão e exportação
            </p>
          </div>
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-2 bg-[#1c222e] p-1.5 rounded-xl border border-[#2d3544]">
          {/* Tipo de Relatório Toggle */}
          <div className="flex items-center bg-[#13171f] rounded-lg p-1 mr-2 border border-[#2d3544]">
            <button
              onClick={() => setReportType('titulares')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                reportType === 'titulares'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Titulares</span>
            </button>
            <button
              onClick={() => setReportType('dependentes')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                reportType === 'dependentes'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Dependentes</span>
            </button>
          </div>

          {/* Orientation Toggle */}
          <div className="flex items-center bg-[#13171f] rounded-lg p-1 mr-2 border border-[#2d3544]">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                orientation === 'landscape'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Paisagem (Horizontal)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Paisagem</span>
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                orientation === 'portrait'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Retrato (Vertical)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Retrato</span>
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
              title="Reduzir Zoom (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomReset}
              className="px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-[#2d3544] rounded-lg min-w-[54px] text-center"
              title="Resetar para 100%"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
              title="Ampliar Zoom (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            <span>Salvar PDF</span>
          </button>
          <button
            onClick={handleImprimir}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/20"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
          <div className="h-6 w-px bg-[#2d3544]" />
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2d3544]"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* CANVAS */}
      <main className="flex-1 overflow-auto p-8 flex justify-center items-start bg-[#1a1e27] custom-scrollbar">
        <div
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
          }}
          className="mb-12 shadow-2xl"
        >
          <div
            ref={printAreaRef}
            style={{
              width: orientation === 'landscape' ? '297mm' : '210mm',
              minHeight: orientation === 'landscape' ? '210mm' : '297mm',
              padding: '14mm 16mm',
            }}
            className="bg-white text-slate-900 rounded-sm shadow-2xl relative font-sans leading-normal box-border selection:bg-blue-100"
          >
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start gap-4">
              <div className="flex-1">
                {empresaData?.logo_url ? (
                  <img
                    src={empresaData.logo_url}
                    alt="Logo"
                    className="max-h-14 max-w-[240px] object-contain mb-2"
                  />
                ) : (
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase mb-1">
                    {empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX'}
                  </h1>
                )}
                <div className="text-xs text-slate-600 leading-tight space-y-0.5">
                  {empresaData?.cnpj && (
                    <p>
                      <span className="font-semibold text-slate-800">CNPJ:</span> {empresaData.cnpj}{' '}
                      {empresaData.telefone ? ` | Tel: ${empresaData.telefone}` : ''}
                    </p>
                  )}
                  {empresaData?.endereco && (
                    <p className="text-slate-500">{empresaData.endereco}</p>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-[11px] font-extrabold uppercase tracking-wide text-slate-800 mb-1">
                  Relatório Cadastral
                </div>
                <h2 className="text-base font-black uppercase text-slate-900 tracking-wide">
                  {reportType === 'titulares' ? 'Associados (Titulares)' : 'Dependentes'}
                </h2>
                <div className="text-[11px] text-slate-500 mt-1">
                  Emissão:{' '}
                  <strong className="text-slate-800">
                    {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
                  </strong>
                </div>
                <div className="text-[10px] text-slate-500">
                  Emitido por: <span className="font-medium text-slate-700">{userName}</span>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-2.5 mb-4">
              <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50">
                <div className="text-[10px] font-bold text-blue-800 uppercase">Titulares</div>
                <div className="text-sm font-black text-blue-700 mt-1">{totais.totalTitulares}</div>
                <div className="text-[9px] text-blue-600 mt-0.5">Cadastros principais</div>
              </div>
              <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50">
                <div className="text-[10px] font-bold text-purple-800 uppercase">Dependentes</div>
                <div className="text-sm font-black text-purple-700 mt-1">{totais.totalDeps}</div>
                <div className="text-[9px] text-purple-600 mt-0.5">Vínculos familiares</div>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">
                  Vidas Protegidas
                </div>
                <div className="text-sm font-black text-emerald-700 mt-1">
                  {totais.vidasProtegidas}
                </div>
                <div className="text-[9px] text-emerald-600 mt-0.5">Total de vidas</div>
              </div>
              <div className="p-2.5 rounded-lg border border-teal-200 bg-teal-50/50">
                <div className="text-[10px] font-bold text-teal-800 uppercase">
                  Titulares Ativos
                </div>
                <div className="text-sm font-black text-teal-700 mt-1">{totais.ativos}</div>
                <div className="text-[9px] text-teal-600 mt-0.5">Planos vigentes</div>
              </div>
              <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50">
                <div className="text-[10px] font-bold text-rose-800 uppercase">Inadimplentes</div>
                <div className="text-sm font-black text-rose-700 mt-1">{totais.inadimplentes}</div>
                <div className="text-[9px] text-rose-600 mt-0.5">Em atraso</div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                    {reportType === 'titulares' ? (
                      <>
                        <th className="py-2 px-2 text-center w-[3%] border-r border-slate-700">
                          #
                        </th>
                        <th className="py-2 px-3 w-[24%] border-r border-slate-700">
                          Associado Titular
                        </th>
                        <th className="py-2 px-3 w-[24%] border-r border-slate-700">
                          Endereço Completo
                        </th>
                        <th className="py-2 px-3 w-[16%] border-r border-slate-700">Contato</th>
                        <th className="py-2 px-3 w-[15%] border-r border-slate-700">
                          Plano / Contrato
                        </th>
                        <th className="py-2 px-2 text-center w-[7%] border-r border-slate-700">
                          Adesão
                        </th>
                        <th className="py-2 px-2 text-center w-[5%] border-r border-slate-700">
                          Deps.
                        </th>
                        <th className="py-2 px-2 text-center w-[6%]">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2 px-2 text-center w-[4%] border-r border-slate-700">
                          #
                        </th>
                        <th className="py-2 px-3 w-[28%] border-r border-slate-700">Dependente</th>
                        <th className="py-2 px-3 w-[14%] border-r border-slate-700">Parentesco</th>
                        <th className="py-2 px-3 w-[24%] border-r border-slate-700">
                          Titular Responsável
                        </th>
                        <th className="py-2 px-3 w-[20%] border-r border-slate-700">
                          Contato / Endereço
                        </th>
                        <th className="py-2 px-2 text-center w-[10%]">Status Titular</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {reportType === 'titulares'
                    ? listaTitulares.map((t) => (
                        <tr key={t.associado.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-200 text-[10px]">
                            {t.index}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900 text-xs">{t.nome}</div>
                            <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-1.5 items-center mt-0.5">
                              <span>
                                <strong>CPF:</strong> {mascaraCpfLGPD(t.cpf)}
                              </span>
                              {t.rg !== '-' && <span>| RG: {t.rg}</span>}
                              {t.dataNascimento !== '-' && <span>| Nasc: {t.dataNascimento}</span>}
                            </div>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-[10.5px] text-slate-700 leading-snug">
                            {t.enderecoCompleto}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-[10.5px] text-slate-700 leading-snug">
                            {t.contatoCompleto}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-semibold text-emerald-800 text-[11px]">
                              {t.plano}
                            </div>
                            <div className="text-[10px] text-slate-500">Contrato: {t.contrato}</div>
                          </td>
                          <td className="py-2 px-2 text-center font-medium text-slate-900 border-r border-slate-200 text-[11px]">
                            {t.dataAdesao}
                          </td>
                          <td className="py-2 px-2 text-center font-bold text-purple-700 border-r border-slate-200 text-[11px]">
                            {t.qtdDependentes}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${t.statusColor}`}
                            >
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    : listaDependentes.map((d) => (
                        <tr
                          key={d.dependente.id || d.index}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-200 text-[10px]">
                            {d.index}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900 text-xs">
                              {d.dependente.nome}
                            </div>
                            <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-1.5 items-center mt-0.5">
                              {d.dependente.cpf && (
                                <span>
                                  <strong>CPF:</strong> {mascaraCpfLGPD(d.dependente.cpf)}
                                </span>
                              )}
                              <span>
                                Nasc:{' '}
                                {d.dependente.data_nascimento
                                  ? formatLocalDate(d.dependente.data_nascimento)
                                  : '-'}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-semibold text-purple-700 capitalize text-xs">
                            {d.dependente.parentesco || 'Dependente'}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900 text-xs">{d.titularNome}</div>
                            <div className="text-[10px] text-slate-500">
                              CPF: {mascaraCpfLGPD(d.titularCpf)} | {d.titularPlano}
                            </div>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-[10px] text-slate-700 leading-snug">
                            <div>{d.titularContato}</div>
                            <div className="text-slate-500">{d.titularEndereco}</div>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                d.titularStatus === 'ativo'
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : 'text-rose-700 bg-rose-50 border-rose-200'
                              }`}
                            >
                              {d.titularStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-400">
                    <td
                      colSpan={reportType === 'titulares' ? 8 : 6}
                      className="py-2.5 px-3 text-right text-xs uppercase tracking-wide"
                    >
                      Total:{' '}
                      {reportType === 'titulares' ? listaTitulares.length : listaDependentes.length}{' '}
                      registros listados
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-center text-[10px] text-slate-500">
              <div>
                <strong>Sistema ERAS PAX Taquari</strong> - Gestão de Associados e Planos
              </div>
              <div>
                Documento emitido eletronicamente em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
              </div>
              <div>Página 1 de 1</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
