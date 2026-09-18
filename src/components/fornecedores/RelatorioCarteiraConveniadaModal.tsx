import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Printer,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Building2,
  CalendarRange,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Empresa } from '../../services/empresasService';
import { CarteiraEmpresaConveniada } from '../../utils/carteiraEmpresaConveniada';
import {
  RelatorioCarteiraConveniada,
  ROTULOS_TIPO_RELATORIO,
  TipoRelatorioCarteira,
  colunasDoRelatorio,
  ParteCelula,
  celulasDaLinha,
  celulasDoRodape,
  larguraColuna,
  linhaParaTexto,
  montarRelatorioCarteira,
  rodapeParaTexto,
} from '../../utils/relatorioCarteiraConveniada';

/**
 * Relatório da carteira de uma empresa conveniada — o que a aba **Associados & Mensalidades**
 * mostra, no papel.
 *
 * Segue o desenho dos relatórios de Associados e de Atendimentos: prévia em tela com zoom,
 * janela de impressão própria e exportação em PDF por `jsPDF` + `jspdf-autotable`. As três
 * saídas leem o **mesmo** `RelatorioCarteiraConveniada`, montado por uma função pura — cada
 * renderizador decide só **como**.
 *
 * Duas regras deste projeto valem especialmente aqui:
 *
 * - **Não existe Tailwind dentro da janela de impressão.** O CSS dela é escrito à mão abaixo;
 *   nenhuma classe utilitária do `innerHTML` corresponde a regra alguma lá.
 * - **`jspdf` entra por import dinâmico**, dentro do handler, e não no topo: este arquivo é
 *   importado pelo formulário de fornecedor, que por sua vez está no caminho de telas comuns.
 *
 * Vai ao `document.body` por `createPortal`, como o gerenciador de categorias: é aberto de
 * dentro do `<form>` do formulário de fornecedor, que está dentro de um overlay com
 * `backdrop-blur` — e `backdrop-filter` transforma o ancestral em bloco de contenção de
 * descendentes `fixed`. O portal resolve o aninhamento e o botão-sem-`type` de uma vez.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
  carteira: CarteiraEmpresaConveniada;
  /** Nome da conveniada — é o assunto do relatório, e vai no título. */
  nomeConveniada: string;
  /** Documento da conveniada, para identificar a empresa no cabeçalho. */
  documentoConveniada?: string;
  /** Empresa emitente (a do tenant do fornecedor, não a do seletor do topo). */
  empresaData: Empresa | null;
  userName?: string;
}

const COR_RECEBIDO = '#047857';
const COR_ABERTO = '#b45309';
const COR_VAZIO = '#cbd5e1';

/**
 * A cor de uma linha de célula sai do **tipo da parte**, nunca da posição dela.
 * Colorindo por índice, um mês que só tem parcela em aberto saía verde — afirmando que o
 * dinheiro entrou. Foi o que a foto pegou.
 */
const corDaParte = (parte: ParteCelula): string | undefined => {
  if (parte.tipo === 'recebido') return COR_RECEBIDO;
  if (parte.tipo === 'aberto') return COR_ABERTO;
  if (parte.tipo === 'vazio') return COR_VAZIO;
  return undefined;
};

export const RelatorioCarteiraConveniadaModal: React.FC<Props> = ({
  isOpen,
  onClose,
  carteira,
  nomeConveniada,
  documentoConveniada,
  empresaData,
  userName = 'Operador do Sistema',
}) => {
  const [tipo, setTipo] = useState<TipoRelatorioCarteira>('mensal');
  // A grade de 12 meses só fecha em paisagem; o resumo cabe em retrato. O padrão acompanha o
  // tipo escolhido em vez de deixar o operador descobrir isso pela prévia cortada.
  const [orientacao, setOrientacao] = useState<'landscape' | 'portrait'>('landscape');
  const [zoom, setZoom] = useState(100);
  const [exportando, setExportando] = useState(false);

  const relatorio: RelatorioCarteiraConveniada = useMemo(
    () => montarRelatorioCarteira(carteira, nomeConveniada),
    [carteira, nomeConveniada]
  );

  const colunas = colunasDoRelatorio(tipo);

  if (!isOpen) return null;

  const trocarTipo = (novo: TipoRelatorioCarteira) => {
    setTipo(novo);
    setOrientacao(novo === 'mensal' ? 'landscape' : 'portrait');
  };

  const emissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
  const tituloRelatorio = `Carteira de Convênio — ${ROTULOS_TIPO_RELATORIO[tipo]}`;
  const nomeEmitente =
    empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX';

  const handleImprimir = () => {
    const janela = window.open('', '_blank');
    if (!janela) {
      toast.error('O navegador bloqueou a janela de impressão. Permita pop-ups.');
      return;
    }

    const logoHtml = empresaData?.logo_url
      ? `<img src="${empresaData.logo_url}" alt="Logo" style="max-height: 52px; max-width: 220px; object-fit: contain;" />`
      : `<h1 style="margin:0;font-size:17px;font-weight:800;text-transform:uppercase;color:#0f172a;">${nomeEmitente}</h1>`;

    // Sem largura declarada o navegador dimensiona por conteúdo e os meses saem desiguais.
    const colgroupHtml = colunas
      .map((_, i) => `<col style="width:${larguraColuna(tipo, i)};" />`)
      .join('');

    const thHtml = colunas
      .map((c, i) => {
        const alinha = i <= 1 ? 'left' : 'center';
        return `<th style="text-align:${alinha};">${c}</th>`;
      })
      .join('');

    const partesParaHtml = (partes: ParteCelula[]): string =>
      partes
        .map((parte) => {
          const cor = corDaParte(parte);
          const peso = parte.tipo === 'recebido' || parte.tipo === 'aberto' ? 'font-weight:600;' : '';
          return `<div style="${cor ? `color:${cor};` : ''}${peso}">${parte.texto}</div>`;
        })
        .join('');

    const corpoHtml = relatorio.linhas
      .map((linha) => {
        const celulas = celulasDaLinha(linha, tipo).map((partes, i) => {
          if (i === 0) {
            return `<td style="text-align:center;color:#475569;font-weight:600;">${partes[0].texto}</td>`;
          }
          if (i === 1) {
            return `<td>
              <div style="font-weight:700;color:#0f172a;font-size:9.5px;">${linha.nome}</div>
              ${linha.documento ? `<div style="color:#64748b;font-size:8px;">${linha.documento}</div>` : ''}
            </td>`;
          }
          return `<td style="text-align:center;font-size:8.5px;">${partesParaHtml(partes)}</td>`;
        });
        return `<tr>${celulas.join('')}</tr>`;
      })
      .join('');

    const rodapeHtml = celulasDoRodape(relatorio, tipo)
      .map((partes, i) => {
        const alinha = i <= 1 ? 'left' : 'center';
        return `<td style="text-align:${alinha};font-size:8.5px;">${partesParaHtml(partes)}</td>`;
      })
      .join('');

    const kpisHtml = relatorio.kpis
      .map(
        (k) => `
        <div class="kpi-card">
          <div class="kpi-label">${k.rotulo}</div>
          <div class="kpi-val">${k.valor}</div>
          <div class="kpi-det">${k.detalhe}</div>
        </div>`
      )
      .join('');

    const notasHtml = relatorio.notas.length
      ? `<div class="notas">
           <div class="notas-titulo">Fora dos totais acima</div>
           ${relatorio.notas.map((n) => `<div>${n}</div>`).join('')}
         </div>`
      : '';

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Carteira de Convênio - ${nomeConveniada}</title>
          <style>
            @page { size: A4 ${orientacao}; margin: 8mm 10mm; }
            *, *::before, *::after { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a; margin: 0; padding: 0; background: #fff;
              -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10px;
            }
            .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
            .title-main { font-size: 15px; font-weight: 900; text-transform: uppercase; margin: 0 0 3px 0; }
            .conveniada {
              background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px;
              padding: 7px 10px; margin-bottom: 10px;
            }
            .conveniada-nome { font-size: 12px; font-weight: 800; color: #1e3a8a; }
            .conveniada-meta { font-size: 9px; color: #475569; margin-top: 1px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; margin-bottom: 11px; }
            .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #f8fafc; }
            .kpi-label { font-size: 8px; text-transform: uppercase; font-weight: 700; color: #64748b; }
            .kpi-val { font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 2px; }
            .kpi-det { font-size: 7.5px; color: #94a3b8; margin-top: 1px; }
            table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
            table.data-table th {
              background-color: #0f172a !important; color: #fff !important;
              font-weight: 800; font-size: 8.5px; text-transform: uppercase;
              padding: 5px 4px; border: 1px solid #0f172a;
            }
            table.data-table td { border: 1px solid #cbd5e1; padding: 4px 4px; vertical-align: top; }
            table.data-table tr:nth-child(even) { background-color: #f8fafc; }
            table.data-table tfoot td { background-color: #f1f5f9 !important; font-weight: 800; }
            .legenda { font-size: 8.5px; color: #64748b; margin-bottom: 8px; }
            .notas {
              border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px;
              padding: 7px 10px; font-size: 8.5px; color: #475569; margin-bottom: 10px;
            }
            .notas-titulo { font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 3px; font-size: 8.5px; }
            .footer-info {
              border-top: 1px solid #cbd5e1; padding-top: 7px; margin-top: 12px;
              display: flex; justify-content: space-between; font-size: 8px; color: #64748b;
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td style="vertical-align: top; width: 50%;">
                ${logoHtml}
                <div style="font-size:9px;color:#475569;margin-top:3px;line-height:1.3;">
                  ${empresaData?.cnpj ? `<strong>CNPJ:</strong> ${empresaData.cnpj}` : ''}
                  ${empresaData?.telefone ? ` | <strong>Tel:</strong> ${empresaData.telefone}` : ''}
                  ${empresaData?.endereco ? `<br/>${empresaData.endereco}` : ''}
                </div>
              </td>
              <td style="vertical-align: top; width: 50%; text-align: right;">
                <div class="title-main">${tituloRelatorio}</div>
                <div style="font-size:9.5px;font-weight:600;color:#2563eb;">Exercício ${relatorio.exercicio}</div>
                <div style="font-size:8.5px;color:#64748b;margin-top:3px;">
                  <strong>Emissão:</strong> ${emissao}<br/>
                  <strong>Emitido por:</strong> ${userName}
                </div>
              </td>
            </tr>
          </table>

          <div class="conveniada">
            <div class="conveniada-nome">${nomeConveniada}</div>
            <div class="conveniada-meta">
              ${documentoConveniada ? `CNPJ/CPF: ${documentoConveniada} | ` : ''}
              ${relatorio.qtdAssociados} associado(s) vinculado(s) | Exercício ${relatorio.exercicio}
            </div>
          </div>

          <div class="kpi-grid">${kpisHtml}</div>

          <div class="legenda">
            Valores em <strong>reais (R$)</strong>. Em cada célula o <strong>recebido</strong> vem primeiro e o
            <strong>em aberto</strong> logo abaixo. A mensalidade aparece no mês em que <strong>vence</strong>,
            mesmo se paga depois.
          </div>

          <table class="data-table">
            <colgroup>${colgroupHtml}</colgroup>
            <thead><tr>${thHtml}</tr></thead>
            <tbody>${corpoHtml}</tbody>
            <tfoot><tr>${rodapeHtml}</tr></tfoot>
          </table>

          ${notasHtml}

          <div class="footer-info">
            <div>Sistema ERAS PAX Taquari — Carteira de Empresa Conveniada</div>
            <div>Documento emitido eletronicamente em ${emissao}</div>
          </div>
        </body>
      </html>
    `;

    janela.document.write(html);
    janela.document.close();
    janela.focus();
    setTimeout(() => {
      janela.print();
      janela.close();
    }, 400);
  };

  const handleExportarPDF = async () => {
    try {
      setExportando(true);
      toast.loading('Gerando PDF...', { id: 'pdf-carteira' });

      // Import dinâmico: ver a nota no topo do arquivo.
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF({ orientation: orientacao, unit: 'mm', format: 'a4' });
      const largura = doc.internal.pageSize.getWidth();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, largura, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(nomeEmitente.toUpperCase(), 14, 9);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(tituloRelatorio.toUpperCase(), 14, 14.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${nomeConveniada} — Exercício ${relatorio.exercicio}`, 14, 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Emissão: ${emissao} | Operador: ${userName}`, largura - 14, 9, { align: 'right' });
      doc.text(
        `${relatorio.qtdAssociados} associado(s) | Recebido ${relatorio.kpis[1].valor} | Em aberto ${relatorio.kpis[2].valor}`,
        largura - 14,
        14.5,
        { align: 'right' }
      );
      doc.text(`% Recebido: ${relatorio.percentualRecebido.toFixed(1)}%`, largura - 14, 20, {
        align: 'right',
      });

      // As larguras do `columnStyles` são POSICIONAIS — e os dois tipos têm contagens de coluna
      // diferentes, então cada um tem o seu mapa. Ver CLAUDE.md, a lição da coluna de empresa.
      const estilosMensal: Record<number, { cellWidth: number; halign: 'center' | 'left' }> = {
        0: { cellWidth: 7, halign: 'center' },
        1: { cellWidth: 44, halign: 'left' },
      };
      for (let i = 2; i <= 13; i += 1) estilosMensal[i] = { cellWidth: 15.5, halign: 'center' };
      estilosMensal[14] = { cellWidth: 21, halign: 'center' };

      const estilosResumo: Record<number, { cellWidth: number; halign: 'center' | 'left' }> = {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: orientacao === 'portrait' ? 54 : 80, halign: 'left' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 26, halign: 'center' },
        6: { cellWidth: 20, halign: 'center' },
      };

      autoTable(doc, {
        startY: 29,
        head: [colunas],
        body: relatorio.linhas.map((l) => linhaParaTexto(l, tipo)),
        foot: [rodapeParaTexto(relatorio, tipo)],
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontSize: 7,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: { fontSize: 6.5, textColor: [15, 23, 42], cellPadding: 1.5 },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontSize: 6.5,
          fontStyle: 'bold',
        },
        columnStyles: tipo === 'mensal' ? estilosMensal : estilosResumo,
        margin: { left: 14, right: 14 },
      });

      // As notas entram depois da tabela — o que não soma precisa aparecer, não sumir.
      if (relatorio.notas.length) {
        const y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? 29) + 6;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('FORA DOS TOTAIS ACIMA', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        relatorio.notas.forEach((n, i) => {
          doc.text(doc.splitTextToSize(n, largura - 28), 14, y + 4.5 + i * 4.5);
        });
      }

      doc.save(
        `Carteira_${nomeConveniada.replace(/[^\w]+/g, '_').slice(0, 40)}_${relatorio.exercicio}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`
      );
      toast.success('Relatório em PDF exportado com sucesso!', { id: 'pdf-carteira' });
    } catch (err) {
      console.error('Erro ao gerar PDF da carteira:', err);
      toast.error('Erro ao gerar PDF. Use a opção Imprimir.', { id: 'pdf-carteira' });
    } finally {
      setExportando(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[140] flex flex-col bg-[#1e232a] text-slate-100 overflow-hidden">
      <header className="h-16 bg-[#13171f] border-b border-[#2d3544] px-6 flex items-center justify-between shadow-xl shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">Carteira de Convênio</h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {relatorio.qtdAssociados} associado(s)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {nomeConveniada} · Exercício {relatorio.exercicio}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#1c222e] p-1.5 rounded-xl border border-[#2d3544]">
          <div className="flex items-center bg-[#13171f] rounded-lg p-1 mr-2 border border-[#2d3544]">
            <button
              type="button"
              onClick={() => trocarTipo('mensal')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                tipo === 'mensal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Mês a mês</span>
            </button>
            <button
              type="button"
              onClick={() => trocarTipo('resumo')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                tipo === 'resumo' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Resumo</span>
            </button>
          </div>

          <div className="flex items-center bg-[#13171f] rounded-lg p-1 mr-2 border border-[#2d3544]">
            <button
              type="button"
              onClick={() => setOrientacao('landscape')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                orientacao === 'landscape' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Paisagem (Horizontal)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Paisagem</span>
            </button>
            <button
              type="button"
              onClick={() => setOrientacao('portrait')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                orientacao === 'portrait' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Modo Retrato (Vertical)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Retrato</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 10, 40))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
              title="Reduzir Zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-[#2d3544] rounded-lg min-w-[54px] text-center"
              title="Resetar para 100%"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 10, 200))}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#2d3544]"
              title="Ampliar Zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportarPDF}
            disabled={exportando}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-emerald-600/20 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Salvar PDF</span>
          </button>
          <button
            type="button"
            onClick={handleImprimir}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-600/20 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
          <div className="h-6 w-px bg-[#2d3544]" />
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2d3544]"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8 flex justify-center items-start bg-[#1a1e27] custom-scrollbar">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          className="mb-12 shadow-2xl"
        >
          <div
            style={{
              width: orientacao === 'landscape' ? '297mm' : '210mm',
              minHeight: orientacao === 'landscape' ? '210mm' : '297mm',
              padding: '12mm 14mm',
            }}
            className="bg-white text-slate-900 rounded-sm shadow-2xl font-sans leading-normal box-border"
          >
            <div className="border-b-2 border-slate-900 pb-3 mb-3 flex justify-between items-start gap-4">
              <div className="flex-1">
                {empresaData?.logo_url ? (
                  <img src={empresaData.logo_url} alt="Logo" className="max-h-14 max-w-[240px] object-contain mb-2" />
                ) : (
                  <h1 className="text-lg font-extrabold tracking-tight text-slate-900 uppercase mb-1">
                    {nomeEmitente}
                  </h1>
                )}
                <div className="text-[11px] text-slate-600 leading-tight">
                  {empresaData?.cnpj && <span className="font-semibold text-slate-800">CNPJ: {empresaData.cnpj}</span>}
                  {empresaData?.telefone && <span> | Tel: {empresaData.telefone}</span>}
                  {empresaData?.endereco && <p className="text-slate-500">{empresaData.endereco}</p>}
                </div>
              </div>
              <div className="text-right">
                <div className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-[10px] font-extrabold uppercase tracking-wide text-slate-800 mb-1">
                  Relatório Financeiro
                </div>
                <h2 className="text-sm font-black uppercase text-slate-900 tracking-wide">{tituloRelatorio}</h2>
                <div className="text-[11px] text-blue-700 font-semibold">Exercício {relatorio.exercicio}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Emissão: <strong className="text-slate-800">{emissao}</strong>
                </div>
                <div className="text-[10px] text-slate-500">
                  Emitido por: <span className="font-medium text-slate-700">{userName}</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-blue-200 bg-blue-50/60 px-3 py-2 mb-3">
              <div className="text-[13px] font-extrabold text-blue-900">{nomeConveniada}</div>
              <div className="text-[10px] text-slate-600">
                {documentoConveniada ? `CNPJ/CPF: ${documentoConveniada} · ` : ''}
                {relatorio.qtdAssociados} associado(s) vinculado(s) · Exercício {relatorio.exercicio}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-3">
              {relatorio.kpis.map((k) => (
                <div key={k.rotulo} className="p-2 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-[9px] font-bold text-slate-500 uppercase leading-tight">{k.rotulo}</div>
                  <div className="text-[13px] font-black text-slate-900 mt-0.5 tabular-nums">{k.valor}</div>
                  <div className="text-[8px] text-slate-400 leading-tight">{k.detalhe}</div>
                </div>
              ))}
            </div>

            <p className="text-[9px] text-slate-500 mb-2">
              Valores em <strong>reais (R$)</strong>. Em cada célula o <strong>recebido</strong> vem primeiro
              e o <strong>em aberto</strong> logo abaixo. A mensalidade aparece no mês em que{' '}
              <strong>vence</strong>, mesmo se paga depois.
            </p>

            <table className="w-full border-collapse mb-3 table-fixed">
              <colgroup>
                {colunas.map((c, i) => (
                  <col key={c + i} style={{ width: larguraColuna(tipo, i) }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {colunas.map((c, i) => (
                    <th
                      key={c + i}
                      className={`bg-slate-900 text-white font-extrabold text-[8.5px] uppercase px-1 py-1.5 border border-slate-900 ${
                        i <= 1 ? 'text-left' : 'text-center'
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {relatorio.linhas.map((linha) => (
                  <tr key={linha.associadoId} className="even:bg-slate-50">
                    {celulasDaLinha(linha, tipo).map((partes, i) => (
                      <td
                        key={i}
                        className={`border border-slate-300 px-1 py-1 align-top text-[9px] ${
                          i <= 1 ? 'text-left' : 'text-center tabular-nums'
                        }`}
                      >
                        {i === 1 ? (
                          <>
                            <div className="font-bold text-slate-900 text-[9.5px]">{linha.nome}</div>
                            {linha.documento && (
                              <div className="text-slate-500 text-[8px]">{linha.documento}</div>
                            )}
                          </>
                        ) : (
                          partes.map((parte, j) => (
                            <div
                              key={j}
                              style={{ color: corDaParte(parte) }}
                              className={parte.tipo === 'recebido' || parte.tipo === 'aberto' ? 'font-semibold' : ''}
                            >
                              {parte.texto}
                            </div>
                          ))
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-extrabold">
                  {celulasDoRodape(relatorio, tipo).map((partes, i) => (
                    <td
                      key={i}
                      className={`border border-slate-300 px-1 py-1.5 text-[9px] ${
                        i <= 1 ? 'text-left' : 'text-center tabular-nums'
                      }`}
                    >
                      {partes.map((parte, j) => (
                        <div key={j} style={{ color: corDaParte(parte) }}>
                          {parte.texto}
                        </div>
                      ))}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>

            {relatorio.notas.length > 0 && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[9px] text-slate-600">
                <div className="font-extrabold uppercase text-slate-900 text-[9px] mb-1">
                  Fora dos totais acima
                </div>
                {relatorio.notas.map((n) => (
                  <div key={n}>{n}</div>
                ))}
              </div>
            )}

            <div className="border-t border-slate-300 pt-2 mt-4 flex justify-between text-[8px] text-slate-500">
              <span>Sistema ERAS PAX Taquari — Carteira de Empresa Conveniada</span>
              <span>Documento emitido eletronicamente em {emissao}</span>
            </div>
          </div>
        </div>
      </main>
    </div>,
    document.body,
  );
};
