import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  RotateCw, 
  CreditCard, 
  ShieldCheck, 
  User, 
  Users, 
  Phone, 
  Building2, 
  Calendar, 
  Sparkles, 
  Eye, 
  CheckCircle2, 
  Share2, 
  QrCode as QrCodeIcon,
  Palette,
  Layers,
  FileText,
  Radio,
  Wifi
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import { Associado, Dependente } from '../../services/associadosService';
import { Empresa, getEmpresaById, getEmpresas } from '../../services/empresasService';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { formatLocalDate } from '../../utils/dateUtils';

export type CardTheme = 'navy' | 'royal' | 'emerald' | 'bordeaux' | 'clean';

export interface BeneficiarioCardData {
  id: string;
  tipo: 'titular' | 'dependente';
  nome: string;
  cpf: string;
  rg?: string;
  dataNascimento?: string;
  sexo?: string;
  parentesco?: string;
  titularNome?: string;
  titularCpf?: string;
  numeroContrato: string;
  planoNome: string;
  dataAdesao: string;
  status: string;
  via: number;
}

interface CarteirinhaAssociadoModalProps {
  isOpen: boolean;
  onClose: () => void;
  associado: Associado;
  initialBeneficiarioId?: string;
}

const THEMES: { id: CardTheme; label: string; bgGradient: string; textClass: string; accentColor: string; borderClass: string }[] = [
  {
    id: 'navy',
    label: 'PAX Nobre (Navy & Ouro)',
    bgGradient: 'from-slate-900 via-slate-800 to-indigo-950',
    textClass: 'text-white',
    accentColor: '#f59e0b',
    borderClass: 'border-amber-500/40 shadow-amber-500/10'
  },
  {
    id: 'royal',
    label: 'Azul Corporativo',
    bgGradient: 'from-blue-950 via-blue-900 to-sky-900',
    textClass: 'text-white',
    accentColor: '#38bdf8',
    borderClass: 'border-sky-400/40 shadow-sky-500/10'
  },
  {
    id: 'emerald',
    label: 'Esmeralda Real',
    bgGradient: 'from-emerald-950 via-teal-900 to-emerald-900',
    textClass: 'text-white',
    accentColor: '#34d399',
    borderClass: 'border-emerald-400/40 shadow-emerald-500/10'
  },
  {
    id: 'bordeaux',
    label: 'Bordeaux Imperial',
    bgGradient: 'from-rose-950 via-red-950 to-stone-900',
    textClass: 'text-white',
    accentColor: '#fb7185',
    borderClass: 'border-rose-400/40 shadow-rose-500/10'
  },
  {
    id: 'clean',
    label: 'Clean / Econômico (Claro)',
    bgGradient: 'from-slate-50 via-white to-slate-100',
    textClass: 'text-slate-900',
    accentColor: '#2563eb',
    borderClass: 'border-slate-300 shadow-slate-300/40'
  }
];

export const CarteirinhaAssociadoModal: React.FC<CarteirinhaAssociadoModalProps> = ({
  isOpen,
  onClose,
  associado,
  initialBeneficiarioId
}) => {
  const toast = useToast();
  const { state } = useAppContext();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loadingEmpresa, setLoadingEmpresa] = useState(true);
  const [selectedBeneficiario, setSelectedBeneficiario] = useState<string>(initialBeneficiarioId || 'titular');
  const [selectedTheme, setSelectedTheme] = useState<CardTheme>('navy');
  const [viewMode, setViewMode] = useState<'both' | 'flip' | 'all'>('both');
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Carregar dados da empresa vinculada
  useEffect(() => {
    const fetchEmpresa = async () => {
      setLoadingEmpresa(true);
      try {
        const tenantId = associado.tenant_id || state.empresaSelecionada || 'default_tenant';
        let emp = await getEmpresaById(tenantId, state.isOnline);
        if (!emp) {
          const emps = await getEmpresas(state.isOnline);
          emp = emps.find(e => e.id === tenantId) || emps[0] || null;
        }
        setEmpresa(emp);
      } catch (err) {
        console.error('Erro ao carregar empresa da carteirinha:', err);
      } finally {
        setLoadingEmpresa(false);
      }
    };
    if (isOpen) {
      fetchEmpresa();
    }
  }, [isOpen, associado.tenant_id, state.empresaSelecionada, state.isOnline]);

  useEffect(() => {
    if (initialBeneficiarioId) {
      setSelectedBeneficiario(initialBeneficiarioId);
    }
  }, [initialBeneficiarioId]);

  if (!isOpen) return null;

  // Montar lista com Titular + Dependentes
  const numeroContrato = associado.numero_contrato || (associado as any).numero_contrato_fisico || associado.id.substring(0, 8).toUpperCase();
  const planoNome = associado.plano_nome || 'PLANO PAX FAMILIAR';
  const dataAdesao = associado.data_adesao ? formatLocalDate(associado.data_adesao, 'dd/MM/yyyy', 'Não informada') : 'Não informada';

  const titularCardData: BeneficiarioCardData = {
    id: 'titular',
    tipo: 'titular',
    nome: associado.nome,
    cpf: associado.cpf,
    rg: associado.rg,
    dataNascimento: associado.data_nascimento ? formatLocalDate(associado.data_nascimento, 'dd/MM/yyyy', '-') : undefined,
    sexo: associado.sexo,
    numeroContrato,
    planoNome,
    dataAdesao,
    status: associado.status || 'ativo',
    via: 1
  };

  const dependentesCardsData: BeneficiarioCardData[] = (associado.dependentes || []).map(dep => ({
    id: dep.id,
    tipo: 'dependente',
    nome: dep.nome,
    cpf: dep.cpf || 'Não informado',
    dataNascimento: dep.data_nascimento ? formatLocalDate(dep.data_nascimento, 'dd/MM/yyyy', '-') : undefined,
    parentesco: dep.parentesco || 'Dependente',
    titularNome: associado.nome,
    titularCpf: associado.cpf,
    numeroContrato,
    planoNome,
    dataAdesao,
    status: associado.status || 'ativo',
    via: 1
  }));

  const allCards: BeneficiarioCardData[] = [titularCardData, ...dependentesCardsData];
  const activeCard: BeneficiarioCardData = allCards.find(c => c.id === selectedBeneficiario) || titularCardData;
  const currentThemeObj = THEMES.find(t => t.id === selectedTheme) || THEMES[0];

  // Gera payload para QR code
  const getQrValue = (card: BeneficiarioCardData) => {
    return JSON.stringify({
      app: 'ERAS_PAX_VERIFY',
      contrato: card.numeroContrato,
      tipo: card.tipo.toUpperCase(),
      beneficiario: card.nome,
      cpf: card.cpf,
      plano: card.planoNome,
      titular: card.tipo === 'dependente' ? card.titularNome : undefined,
      parentesco: card.parentesco,
      empresa: empresa?.nome_fantasia || empresa?.razao_social || 'PAX',
      cnpj: empresa?.cnpj,
      status: card.status.toUpperCase(),
      emissao: new Date().toISOString().split('T')[0]
    });
  };

  // Impressão nativa via janela de impressão
  const handlePrint = (mode: 'current' | 'all' = 'current') => {
    const cardsToPrint = mode === 'all' ? allCards : [activeCard];
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a abertura da janela de impressão. Permita pop-ups.');
      return;
    }

    const companyLogo = empresa?.logo_url ? `<img src="${empresa.logo_url}" class="card-logo" alt="Logo" />` : `<div class="card-company-name">${empresa?.nome_fantasia || empresa?.razao_social || 'SISTEMA ERAS PAX'}</div>`;
    const companySig = empresa?.assinatura_url ? `<img src="${empresa.assinatura_url}" class="card-sig-img" alt="Assinatura" />` : `<div class="sig-line"></div>`;

    const htmlCards = cardsToPrint.map((card, idx) => {
      const isDep = card.tipo === 'dependente';
      const qrData = encodeURIComponent(getQrValue(card));
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

      return `
        <div class="card-pair ${idx > 0 && idx % 3 === 0 ? 'page-break' : ''}">
          <!-- FRENTE -->
          <div class="card card-front theme-${selectedTheme}">
            <div class="card-header">
              <div class="logo-box">${companyLogo}</div>
              <div class="badge-box">
                <span class="badge badge-${card.tipo}">${isDep ? 'DEPENDENTE' : 'TITULAR'}</span>
                <span class="pax-tag">PAX FAMILIAR</span>
              </div>
            </div>

            <div class="card-body">
              <div class="chip-row">
                <div class="smart-chip">
                  <div class="chip-lines"></div>
                </div>
                <div class="contactless-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                    <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                  </svg>
                </div>
              </div>

              <div class="beneficiary-name">${card.nome}</div>

              <div class="info-grid">
                <div class="info-item">
                  <span class="label">CPF</span>
                  <span class="val">${card.cpf}</span>
                </div>
                ${card.rg ? `
                <div class="info-item">
                  <span class="label">RG</span>
                  <span class="val">${card.rg}</span>
                </div>` : ''}
                ${card.dataNascimento ? `
                <div class="info-item">
                  <span class="label">Nascimento</span>
                  <span class="val">${card.dataNascimento}</span>
                </div>` : ''}
                <div class="info-item">
                  <span class="label">Contrato / Matrícula</span>
                  <span class="val contract-val">#${card.numeroContrato}</span>
                </div>
                <div class="info-item">
                  <span class="label">Plano de Assistência</span>
                  <span class="val">${card.planoNome}</span>
                </div>
              </div>

              ${isDep ? `
                <div class="dep-box">
                  <span class="dep-label">Titular:</span> <strong>${card.titularNome}</strong> 
                  ${card.parentesco ? `(${card.parentesco})` : ''}
                </div>
              ` : ''}
            </div>

            <div class="card-footer">
              <div>Adesão: <strong>${card.dataAdesao}</strong></div>
              <div class="status-indicator">
                <span class="status-dot"></span> ATIVO
              </div>
            </div>
          </div>

          <!-- VERSO -->
          <div class="card card-back theme-${selectedTheme}">
            <div class="mag-stripe"></div>
            <div class="back-content">
              <div class="back-qr-box">
                <img src="${qrApiUrl}" class="qr-img" alt="QR Code" />
                <span class="qr-label">Validação Digital</span>
              </div>
              <div class="back-details">
                <div class="emergency-title">CENTRAL DE ATENDIMENTO 24H</div>
                ${empresa?.telefone ? `<div class="detail-row">📞 Tel / Plantão: <strong>${empresa.telefone}</strong></div>` : ''}
                ${empresa?.endereco ? `<div class="detail-row">📍 ${empresa.endereco}</div>` : ''}
                ${empresa?.cnpj ? `<div class="detail-row">CNPJ: ${empresa.cnpj}</div>` : ''}
                <div class="terms-text">
                  Apresente este cartão juntamente com documento oficial com foto. Uso pessoal e intransferível.
                </div>
                <div class="back-sig-box">
                  ${companySig}
                  <span class="sig-title">${empresa?.nome_fantasia || 'Diretoria / ERAS PAX'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const isClean = selectedTheme === 'clean';
    const bgCss = isClean 
      ? 'background: #ffffff; color: #0f172a; border: 1.5px solid #0f172a;' 
      : selectedTheme === 'royal' 
      ? 'background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); color: #ffffff; border: 1.5px solid #60a5fa;'
      : selectedTheme === 'emerald'
      ? 'background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); color: #ffffff; border: 1.5px solid #34d399;'
      : selectedTheme === 'bordeaux'
      ? 'background: linear-gradient(135deg, #4c0519 0%, #881337 100%); color: #ffffff; border: 1.5px solid #fb7185;'
      : 'background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border: 1.5px solid #f59e0b;';

    const printHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Carteirinhas - ${associado.nome}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            *, *::before, *::after { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              margin: 0;
              padding: 10px;
              background-color: #ffffff;
              color: #0f172a;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-header {
              text-align: center;
              margin-bottom: 15px;
              padding-bottom: 8px;
              border-bottom: 2px solid #e2e8f0;
            }
            .print-header h1 {
              font-size: 16px;
              margin: 0;
              text-transform: uppercase;
              color: #1e293b;
            }
            .print-header p {
              margin: 4px 0 0 0;
              font-size: 11px;
              color: #64748b;
            }
            .cards-container {
              display: flex;
              flex-direction: column;
              gap: 20px;
            }
            .card-pair {
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 20px;
              page-break-inside: avoid;
              padding: 10px;
              border: 1px dashed #cbd5e1;
              border-radius: 8px;
            }
            .page-break {
              page-break-before: always;
            }
            /* Standard CR-80 card standard: 85.6mm x 53.98mm */
            .card {
              width: 85.6mm;
              height: 53.98mm;
              border-radius: 4mm;
              padding: 3.5mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: relative;
              overflow: hidden;
              ${bgCss}
            }
            .card-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              height: 10mm;
            }
            .card-logo {
              max-height: 9mm;
              max-width: 38mm;
              object-fit: contain;
            }
            .card-company-name {
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .badge-box {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
            }
            .badge {
              font-size: 7.5px;
              font-weight: 800;
              padding: 1.5px 5px;
              border-radius: 3px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .badge-titular {
              background: #3b82f6;
              color: #ffffff;
            }
            .badge-dependente {
              background: #8b5cf6;
              color: #ffffff;
            }
            .pax-tag {
              font-size: 6.5px;
              opacity: 0.8;
              font-weight: 600;
              margin-top: 1px;
            }
            .card-body {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              margin: 1mm 0;
            }
            .chip-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1.5mm;
            }
            .smart-chip {
              width: 8mm;
              height: 6mm;
              background: linear-gradient(135deg, #fbbf24, #d97706);
              border-radius: 1.5mm;
              border: 0.5px solid #b45309;
              position: relative;
            }
            .contactless-icon {
              opacity: 0.7;
            }
            .beneficiary-name {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              line-height: 1.1;
              letter-spacing: 0.3px;
              margin-bottom: 2mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 1.5mm 3mm;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-item .label {
              font-size: 6.5px;
              opacity: 0.75;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .info-item .val {
              font-size: 8px;
              font-weight: 700;
            }
            .contract-val {
              color: ${isClean ? '#2563eb' : '#fbbf24'};
            }
            .dep-box {
              font-size: 7px;
              margin-top: 1.5mm;
              padding: 1mm 1.5mm;
              background: rgba(0,0,0,0.15);
              border-radius: 1mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .card-footer {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 7px;
              opacity: 0.85;
              border-top: 0.5px solid rgba(255,255,255,0.15);
              padding-top: 1mm;
            }
            .status-indicator {
              display: flex;
              align-items: center;
              gap: 3px;
              font-weight: 800;
              color: #4ade80;
            }
            .status-dot {
              width: 4px;
              height: 4px;
              border-radius: 50%;
              background: #4ade80;
            }
            /* Back Card */
            .mag-stripe {
              height: 7mm;
              background: #111827;
              margin: -3.5mm -3.5mm 2mm -3.5mm;
              border-bottom: 1px solid #374151;
            }
            .back-content {
              display: flex;
              gap: 3mm;
              flex: 1;
            }
            .back-qr-box {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 20mm;
            }
            .qr-img {
              width: 17mm;
              height: 17mm;
              border-radius: 1.5mm;
              background: #ffffff;
              padding: 1mm;
            }
            .qr-label {
              font-size: 5.5px;
              text-align: center;
              margin-top: 1mm;
              opacity: 0.75;
            }
            .back-details {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .emergency-title {
              font-size: 7.5px;
              font-weight: 800;
              color: ${isClean ? '#dc2626' : '#f87171'};
              letter-spacing: 0.3px;
            }
            .detail-row {
              font-size: 6.5px;
              line-height: 1.2;
              margin-top: 0.5mm;
            }
            .terms-text {
              font-size: 5.5px;
              line-height: 1.2;
              opacity: 0.7;
              margin-top: 1mm;
            }
            .back-sig-box {
              margin-top: 1.5mm;
              text-align: center;
              border-top: 0.5px solid rgba(255,255,255,0.2);
              padding-top: 0.5mm;
            }
            .card-sig-img {
              max-height: 5mm;
              max-width: 25mm;
              object-fit: contain;
              filter: brightness(0) invert(1);
            }
            .sig-line {
              height: 4mm;
            }
            .sig-title {
              font-size: 6px;
              opacity: 0.8;
              font-weight: 700;
              display: block;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
              .card-pair { border: 1px dashed #94a3b8; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>${empresa?.nome_fantasia || 'SISTEMA ERAS PAX'} - CARTEIRINHAS DE BENEFICIÁRIOS</h1>
            <p>Contrato: #${numeroContrato} | Titular: ${associado.nome} | Total: ${cardsToPrint.length} carteirinha(s) | Recorte nas linhas tracejadas</p>
          </div>
          <div class="cards-container">
            ${htmlCards}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  // Exportação para PDF via jsPDF
  const handleExportPDF = async (mode: 'current' | 'all' = 'current') => {
    try {
      setIsExporting(true);
      toast.info('Gerando arquivo PDF da carteirinha...');

      const cardsToExport = mode === 'all' ? allCards : [activeCard];
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const cardWidth = 85.6;
      const cardHeight = 53.98;
      const marginX = 14;
      let startY = 22;

      // Cabeçalho da página
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${(empresa?.nome_fantasia || 'SISTEMA ERAS PAX').toUpperCase()} - CARTEIRINHAS DE BENEFICIÁRIOS`, 14, 10);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Contrato: #${numeroContrato} | Titular: ${associado.nome}`, 196, 10, { align: 'right' });

      for (let i = 0; i < cardsToExport.length; i++) {
        const card = cardsToExport[i];
        
        // Verifica se precisa de nova página
        if (startY + cardHeight > 280) {
          doc.addPage();
          startY = 20;
        }

        // Guia de corte tracejada ao redor da dupla
        doc.setDrawColor(203, 213, 225);
        doc.setLineDashPattern([2, 2], 0);
        doc.rect(marginX - 2, startY - 2, (cardWidth * 2) + 12, cardHeight + 4);
        doc.setLineDashPattern([], 0); // reset

        // 1. FRENTE DO CARTÃO (Esquerda)
        const frontX = marginX;
        
        // Fundo do cartão
        if (selectedTheme === 'clean') {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(15, 23, 42);
        } else if (selectedTheme === 'royal') {
          doc.setFillColor(30, 58, 138);
          doc.setDrawColor(96, 165, 250);
        } else if (selectedTheme === 'emerald') {
          doc.setFillColor(6, 78, 59);
          doc.setDrawColor(52, 211, 153);
        } else if (selectedTheme === 'bordeaux') {
          doc.setFillColor(76, 5, 25);
          doc.setDrawColor(251, 113, 133);
        } else {
          // Navy default
          doc.setFillColor(15, 23, 42);
          doc.setDrawColor(245, 158, 11);
        }
        
        doc.roundedRect(frontX, startY, cardWidth, cardHeight, 3.5, 3.5, 'FD');

        // Header da Frente
        doc.setTextColor(selectedTheme === 'clean' ? 15 : 255, selectedTheme === 'clean' ? 23 : 255, selectedTheme === 'clean' ? 42 : 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text((empresa?.nome_fantasia || 'ERAS PAX').toUpperCase().substring(0, 24), frontX + 4, startY + 7);

        // Badge Tipo
        const badgeColor = card.tipo === 'titular' ? [59, 130, 246] : [139, 92, 246];
        doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.roundedRect(frontX + cardWidth - 28, startY + 3.5, 24, 4.5, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.text(card.tipo === 'titular' ? 'TITULAR' : 'DEPENDENTE', frontX + cardWidth - 16, startY + 6.7, { align: 'center' });

        // Chip Inteligente
        doc.setFillColor(245, 158, 11);
        doc.roundedRect(frontX + 4, startY + 11, 8, 6, 1, 1, 'F');

        // Nome do Beneficiário
        doc.setTextColor(selectedTheme === 'clean' ? 15 : 255, selectedTheme === 'clean' ? 23 : 255, selectedTheme === 'clean' ? 42 : 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(card.nome.toUpperCase().substring(0, 32), frontX + 4, startY + 22);

        // Grid de Dados
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(selectedTheme === 'clean' ? 100 : 203, selectedTheme === 'clean' ? 116 : 213, selectedTheme === 'clean' ? 139 : 225);
        
        doc.text('CPF', frontX + 4, startY + 26);
        doc.text('CONTRATO', frontX + 44, startY + 26);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(selectedTheme === 'clean' ? 15 : 255, selectedTheme === 'clean' ? 23 : 255, selectedTheme === 'clean' ? 42 : 255);
        doc.text(card.cpf, frontX + 4, startY + 29.5);
        
        doc.setTextColor(selectedTheme === 'clean' ? 37 : 245, selectedTheme === 'clean' ? 99 : 158, selectedTheme === 'clean' ? 235 : 11);
        doc.text(`#${card.numeroContrato}`, frontX + 44, startY + 29.5);

        // Plano & Nasc
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(selectedTheme === 'clean' ? 100 : 203, selectedTheme === 'clean' ? 116 : 213, selectedTheme === 'clean' ? 139 : 225);
        doc.text('PLANO', frontX + 4, startY + 34);
        if (card.dataNascimento) doc.text('NASCIMENTO', frontX + 44, startY + 34);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(selectedTheme === 'clean' ? 15 : 255, selectedTheme === 'clean' ? 23 : 255, selectedTheme === 'clean' ? 42 : 255);
        doc.text(card.planoNome.substring(0, 24), frontX + 4, startY + 37.5);
        if (card.dataNascimento) doc.text(card.dataNascimento, frontX + 44, startY + 37.5);

        // Se dependente, mostrar titular
        if (card.tipo === 'dependente') {
          doc.setFontSize(6);
          doc.setTextColor(selectedTheme === 'clean' ? 100 : 203, selectedTheme === 'clean' ? 116 : 213, selectedTheme === 'clean' ? 139 : 225);
          doc.text(`Titular: ${card.titularNome?.substring(0, 25)} (${card.parentesco})`, frontX + 4, startY + 43);
        }

        // Rodapé da Frente
        doc.setFontSize(6);
        doc.setTextColor(selectedTheme === 'clean' ? 100 : 203, selectedTheme === 'clean' ? 116 : 213, selectedTheme === 'clean' ? 139 : 225);
        doc.text(`Adesão: ${card.dataAdesao}`, frontX + 4, startY + 49.5);

        doc.setTextColor(74, 222, 128);
        doc.setFont('helvetica', 'bold');
        doc.text('● ATIVO', frontX + cardWidth - 16, startY + 49.5);

        // 2. VERSO DO CARTÃO (Direita)
        const backX = frontX + cardWidth + 8;
        
        doc.roundedRect(backX, startY, cardWidth, cardHeight, 3.5, 3.5, 'FD');

        // Tarja Magnética
        doc.setFillColor(17, 24, 39);
        doc.rect(backX, startY + 4, cardWidth, 7, 'F');

        // QR Code placeholder / dados
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(backX + 4, startY + 15, 20, 20, 1.5, 1.5, 'F');
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text('QR CODE', backX + 14, startY + 24, { align: 'center' });
        doc.setFontSize(5);
        doc.setFont('helvetica', 'normal');
        doc.text('VALIDAÇÃO', backX + 14, startY + 28, { align: 'center' });

        // Informações de emergência do Verso
        doc.setTextColor(selectedTheme === 'clean' ? 220 : 248, selectedTheme === 'clean' ? 38 : 113, selectedTheme === 'clean' ? 38 : 113);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('CENTRAL 24 HORAS', backX + 28, startY + 18);

        doc.setTextColor(selectedTheme === 'clean' ? 15 : 255, selectedTheme === 'clean' ? 23 : 255, selectedTheme === 'clean' ? 42 : 255);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        if (empresa?.telefone) {
          doc.text(`Tel/Plantão: ${empresa.telefone}`, backX + 28, startY + 22);
        }
        if (empresa?.cnpj) {
          doc.text(`CNPJ: ${empresa.cnpj}`, backX + 28, startY + 25.5);
        }
        if (empresa?.endereco) {
          doc.text(`${empresa.endereco.substring(0, 30)}`, backX + 28, startY + 29);
        }

        doc.setFontSize(5);
        doc.setTextColor(selectedTheme === 'clean' ? 100 : 203, selectedTheme === 'clean' ? 116 : 213, selectedTheme === 'clean' ? 139 : 225);
        doc.text('Uso pessoal e intransferível com documento oficial.', backX + 4, startY + 41);
        doc.text('Validade sujeita à regularidade das mensalidades.', backX + 4, startY + 44);

        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(`${(empresa?.nome_fantasia || 'ERAS PAX').toUpperCase()}`, backX + 4, startY + 49.5);

        // Próximo par
        startY += cardHeight + 12;
      }

      doc.save(`carteirinhas_${associado.nome.toLowerCase().replace(/\s+/g, '_')}.pdf`);
      toast.success('PDF da carteirinha gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      toast.error('Erro ao gerar PDF da carteirinha.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-bg-base border border-border-default rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-bg-surface/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-text-base">Carteirinha de Beneficiário</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-[#3B82F6] border border-blue-500/20 uppercase tracking-wider">
                  CR-80 PVC
                </span>
              </div>
              <p className="text-xs text-text-subtle">
                {associado.nome} • Contrato #{numeroContrato} • {allCards.length} cartão(ões) disponíveis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint(viewMode === 'all' ? 'all' : 'current')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl text-xs font-semibold transition-all shadow-sm"
              title="Imprimir Carteirinha"
            >
              <Printer className="w-4 h-4 text-text-subtle" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              disabled={isExporting}
              onClick={() => handleExportPDF(viewMode === 'all' ? 'all' : 'current')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              title="Exportar em PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{isExporting ? 'Gerando...' : 'Baixar PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-text-subtle hover:text-text-base hover:bg-bg-hover rounded-xl transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLS BAR */}
        <div className="px-6 py-3 border-b border-border-default/60 bg-bg-surface/40 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* SELETOR DE BENEFICIÁRIOS */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 max-w-full">
            <button
              onClick={() => {
                setSelectedBeneficiario('titular');
                if (viewMode === 'all') setViewMode('both');
              }}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                selectedBeneficiario === 'titular' && viewMode !== 'all'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-bg-subtle text-text-subtle hover:text-text-base hover:bg-bg-hover border border-border-default'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Titular ({associado.nome.split(' ')[0]})</span>
            </button>

            {dependentesCardsData.map(dep => (
              <button
                key={dep.id}
                onClick={() => {
                  setSelectedBeneficiario(dep.id);
                  if (viewMode === 'all') setViewMode('both');
                }}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedBeneficiario === dep.id && viewMode !== 'all'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-bg-subtle text-text-subtle hover:text-text-base hover:bg-bg-hover border border-border-default'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{dep.nome.split(' ')[0]} ({dep.parentesco || 'Dep'})</span>
              </button>
            ))}

            {dependentesCardsData.length > 0 && (
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                  viewMode === 'all'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20'
                    : 'bg-bg-subtle text-text-subtle hover:text-text-base hover:bg-bg-hover border border-border-default'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Todos ({allCards.length})</span>
              </button>
            )}
          </div>

          {/* VISUALIZAÇÃO & TEMAS */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Seletor de Tema */}
            <div className="flex items-center gap-1 bg-bg-subtle p-1 rounded-xl border border-border-default">
              <Palette className="w-3.5 h-3.5 text-text-subtle ml-1.5" />
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  title={theme.label}
                  className={`w-6 h-6 rounded-lg transition-transform ${
                    selectedTheme === theme.id ? 'ring-2 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    background: theme.id === 'clean' ? '#e2e8f0' : theme.id === 'royal' ? '#2563eb' : theme.id === 'emerald' ? '#059669' : theme.id === 'bordeaux' ? '#9f1239' : '#0f172a'
                  }}
                />
              ))}
            </div>

            {/* Alternar Modo de Visualização */}
            {viewMode !== 'all' && (
              <div className="flex items-center bg-bg-subtle rounded-xl p-1 border border-border-default">
                <button
                  onClick={() => setViewMode('both')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    viewMode === 'both' ? 'bg-bg-base text-text-base shadow-xs' : 'text-text-subtle hover:text-text-base'
                  }`}
                >
                  Lado a Lado
                </button>
                <button
                  onClick={() => setViewMode('flip')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                    viewMode === 'flip' ? 'bg-bg-base text-text-base shadow-xs' : 'text-text-subtle hover:text-text-base'
                  }`}
                >
                  <RotateCw className="w-3 h-3" />
                  Girar 3D
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BODY / CARDS DISPLAY AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-bg-surface/30">
          
          {/* MODO: FAMÍLIA COMPLETA (TODOS OS CARTÕES) */}
          {viewMode === 'all' ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-border-default pb-3">
                <div>
                  <h3 className="text-sm font-bold text-text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span>Grade de Carteirinhas da Família ({allCards.length} Beneficiários)</span>
                  </h3>
                  <p className="text-xs text-text-subtle">Visualização completa pronta para impressão simultânea em folha A4.</p>
                </div>
                <button
                  onClick={() => handlePrint('all')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Todos ({allCards.length})
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 justify-items-center">
                {allCards.map((card, idx) => (
                  <div key={card.id || idx} className="space-y-3 p-4 bg-bg-surface rounded-2xl border border-border-default/80 shadow-md w-full max-w-[420px]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-text-base flex items-center gap-1.5">
                        {card.tipo === 'titular' ? <User className="w-3.5 h-3.5 text-blue-500" /> : <Users className="w-3.5 h-3.5 text-indigo-500" />}
                        {card.nome}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        card.tipo === 'titular' ? 'bg-blue-500/10 text-blue-400' : 'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {card.tipo}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                      <CardFront card={card} empresa={empresa} theme={currentThemeObj} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === 'flip' ? (
            /* MODO 3D FLIP */
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div 
                className="cursor-pointer transition-transform duration-700 [perspective:1000px]"
                onClick={() => setIsFlipped(!isFlipped)}
                title="Clique para virar o cartão"
              >
                <div 
                  className={`relative transition-all duration-700 [transform-style:preserve-3d] ${
                    isFlipped ? '[transform:rotateY(180deg)]' : ''
                  }`}
                >
                  {/* FRENTE */}
                  <div className="[backface-visibility:hidden]">
                    <CardFront card={activeCard} empresa={empresa} theme={currentThemeObj} />
                  </div>
                  {/* VERSO */}
                  <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    <CardBack card={activeCard} empresa={empresa} theme={currentThemeObj} qrValue={getQrValue(activeCard)} />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-bg-surface hover:bg-bg-hover text-text-base border border-border-default rounded-xl text-xs font-semibold transition-all shadow-sm"
                >
                  <RotateCw className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Virar Cartão ({isFlipped ? 'Vendo Verso' : 'Vendo Frente'})</span>
                </button>
              </div>
            </div>
          ) : (
            /* MODO LADO A LADO (DEFAULT) */
            <div className="flex flex-col items-center justify-center py-2 space-y-6">
              
              <div className="flex flex-col lg:flex-row items-center justify-center gap-8 w-full max-w-4xl">
                {/* Frente */}
                <div className="space-y-2 flex flex-col items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-subtle flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    Frente do Cartão
                  </span>
                  <CardFront card={activeCard} empresa={empresa} theme={currentThemeObj} />
                </div>

                {/* Verso */}
                <div className="space-y-2 flex flex-col items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-subtle flex items-center gap-1.5">
                    <QrCodeIcon className="w-3.5 h-3.5 text-amber-500" />
                    Verso com QR Code
                  </span>
                  <CardBack card={activeCard} empresa={empresa} theme={currentThemeObj} qrValue={getQrValue(activeCard)} />
                </div>
              </div>

              {/* Card Meta details */}
              <div className="w-full max-w-4xl bg-bg-surface p-4 rounded-2xl border border-border-default/70 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-text-base">Carteirinha Pronta para Emissão</p>
                    <p className="text-text-subtle">Padrão CR-80 (85.6 × 53.98 mm) com proporções exatas para PVC e papel moeda.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint('current')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-hover hover:bg-bg-hover/80 text-text-base rounded-xl font-medium transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir Esta
                  </button>
                  <button
                    onClick={() => handleExportPDF('current')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar PDF
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 border-t border-border-default bg-bg-surface/70 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-text-subtle">
            <Building2 className="w-4 h-4 text-text-subtle" />
            <span>Empresa Emissora: <strong>{empresa?.nome_fantasia || empresa?.razao_social || 'SISTEMA ERAS PAX'}</strong> {empresa?.cnpj ? `(CNPJ: ${empresa.cnpj})` : ''}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-bg-hover hover:bg-bg-hover/80 text-text-base rounded-xl font-medium transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};

/* =========================================================================
   COMPONENTE: FRENTE DO CARTÃO (CR-80 PROPORTIONS)
   ========================================================================= */
interface CardFrontProps {
  card: BeneficiarioCardData;
  empresa: Empresa | null;
  theme: typeof THEMES[0];
}

const CardFront: React.FC<CardFrontProps> = ({ card, empresa, theme }) => {
  const isClean = theme.id === 'clean';
  const isDep = card.tipo === 'dependente';

  return (
    <div 
      className={`w-[360px] h-[226px] sm:w-[380px] sm:h-[238px] rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-xl border bg-gradient-to-br ${theme.bgGradient} ${theme.borderClass} ${theme.textClass} select-none transition-all duration-300`}
      style={{
        boxShadow: isClean ? '0 10px 25px -5px rgba(0, 0, 0, 0.1)' : '0 15px 30px -5px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Background Decorative Pattern / Watermark */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
      <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />

      {/* HEADER */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2 max-w-[200px]">
          {empresa?.logo_url ? (
            <img 
              src={empresa.logo_url} 
              alt={empresa.nome_fantasia || 'Logo Empresa'} 
              className="max-h-9 max-w-[140px] object-contain drop-shadow-sm" 
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-extrabold text-xs tracking-tight uppercase leading-tight line-clamp-2">
                {empresa?.nome_fantasia || empresa?.razao_social || 'SISTEMA ERAS PAX'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end">
          <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider uppercase shadow-xs ${
            isDep 
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white' 
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
          }`}>
            {isDep ? 'DEPENDENTE' : 'TITULAR'}
          </span>
          <span className="text-[8px] font-bold opacity-75 uppercase tracking-widest mt-0.5">
            PAX FAMILIAR
          </span>
        </div>
      </div>

      {/* BODY */}
      <div className="relative z-10 space-y-2 my-auto">
        
        {/* Chip & NFC row */}
        <div className="flex items-center justify-between">
          <div className="w-9 h-7 rounded-md bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 border border-amber-600/60 shadow-xs flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 border-t border-b border-amber-700/30 my-auto h-2.5" />
            <div className="absolute inset-0 border-l border-r border-amber-700/30 mx-auto w-3" />
          </div>
          <Wifi className="w-4 h-4 rotate-90 opacity-60" />
        </div>

        {/* Nome do Beneficiário */}
        <div>
          <h3 className="text-sm sm:text-[15px] font-black uppercase tracking-wide truncate leading-tight drop-shadow-xs">
            {card.nome}
          </h3>
        </div>

        {/* Grid de Informações */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <div>
            <span className="block text-[8px] opacity-70 uppercase tracking-wider font-semibold">CPF</span>
            <span className="font-bold tracking-wider">{card.cpf}</span>
          </div>
          <div>
            <span className="block text-[8px] opacity-70 uppercase tracking-wider font-semibold">Contrato</span>
            <span className="font-extrabold font-mono text-amber-400 drop-shadow-xs">#{card.numeroContrato}</span>
          </div>
          <div>
            <span className="block text-[8px] opacity-70 uppercase tracking-wider font-semibold">Plano</span>
            <span className="font-bold truncate block">{card.planoNome}</span>
          </div>
          {card.dataNascimento && (
            <div>
              <span className="block text-[8px] opacity-70 uppercase tracking-wider font-semibold">Nascimento</span>
              <span className="font-bold">{card.dataNascimento}</span>
            </div>
          )}
        </div>

        {/* Info adicional se dependente */}
        {isDep && card.titularNome && (
          <div className="bg-black/20 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] truncate">
            <span className="opacity-75">Titular: </span>
            <span className="font-bold">{card.titularNome}</span>
            {card.parentesco && <span className="opacity-80"> • {card.parentesco}</span>}
          </div>
        )}

      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between pt-1.5 border-t border-white/10 text-[9px] relative z-10">
        <div className="opacity-80">
          <span>Adesão: </span>
          <span className="font-bold">{card.dataAdesao}</span>
        </div>
        <div className="flex items-center gap-1.5 font-extrabold text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-xs" />
          <span>ATIVO</span>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   COMPONENTE: VERSO DO CARTÃO (CR-80 PROPORTIONS)
   ========================================================================= */
interface CardBackProps {
  card: BeneficiarioCardData;
  empresa: Empresa | null;
  theme: typeof THEMES[0];
  qrValue: string;
}

const CardBack: React.FC<CardBackProps> = ({ card, empresa, theme, qrValue }) => {
  const isClean = theme.id === 'clean';

  return (
    <div 
      className={`w-[360px] h-[226px] sm:w-[380px] sm:h-[238px] rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden shadow-xl border bg-gradient-to-br ${theme.bgGradient} ${theme.borderClass} ${theme.textClass} select-none transition-all duration-300`}
      style={{
        boxShadow: isClean ? '0 10px 25px -5px rgba(0, 0, 0, 0.1)' : '0 15px 30px -5px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Tarja Magnética Decorativa */}
      <div className="absolute top-3 left-0 right-0 h-8 bg-slate-950 border-y border-slate-800 flex items-center justify-end px-4">
        <span className="text-[7px] font-mono tracking-widest text-slate-500">PAX-SECURITY-MAGNETIC-BAND</span>
      </div>

      {/* Espaçador superior para a tarja */}
      <div className="h-7" />

      {/* CONTEÚDO DO VERSO */}
      <div className="flex gap-3 items-center my-auto">
        {/* QR Code */}
        <div className="flex flex-col items-center justify-center p-1.5 bg-white rounded-xl shadow-md shrink-0">
          <QRCodeSVG 
            value={qrValue} 
            size={74} 
            level="M" 
            bgColor="#ffffff" 
            fgColor="#0f172a" 
          />
          <span className="text-[7px] font-extrabold text-slate-800 uppercase mt-0.5 tracking-tighter">
            Validação PAX
          </span>
        </div>

        {/* Informações da Empresa e Atendimento */}
        <div className="space-y-1 flex-1 text-[9px]">
          <div className="flex items-center gap-1 text-rose-400 font-extrabold text-[10px] tracking-wide uppercase">
            <Phone className="w-3 h-3" />
            <span>Plantão 24h & Emergência</span>
          </div>

          {empresa?.telefone && (
            <p className="font-bold text-text-base">
              📞 {empresa.telefone}
            </p>
          )}

          {empresa?.endereco && (
            <p className="opacity-80 line-clamp-2 leading-tight">
              📍 {empresa.endereco}
            </p>
          )}

          {empresa?.cnpj && (
            <p className="opacity-70 text-[8px] font-mono">
              CNPJ: {empresa.cnpj}
            </p>
          )}

          <p className="text-[7.5px] opacity-60 leading-tight pt-0.5">
            Cartão de identificação. Uso pessoal e intransferível mediante documento oficial com foto.
          </p>
        </div>
      </div>

      {/* FOOTER DO VERSO: ASSINATURA / CARIMBO */}
      <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[8px] relative z-10">
        <div className="font-bold uppercase opacity-80">
          {empresa?.nome_fantasia || empresa?.razao_social || 'SISTEMA ERAS PAX'}
        </div>
        <div className="flex items-center gap-1 opacity-70">
          <ShieldCheck className="w-3 h-3 text-amber-400" />
          <span>Autenticidade Garantida</span>
        </div>
      </div>
    </div>
  );
};
