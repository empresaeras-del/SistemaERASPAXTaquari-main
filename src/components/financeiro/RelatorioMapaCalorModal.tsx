import React, { useMemo, useRef, useState } from 'react';
import { X, Printer, Download, MapPin, Flame, AlertCircle, Users, Route } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { ParcelaReceber, Receita } from '../../services/financeiroService';
import { Empresa } from '../../services/empresasService';
import { Associado } from '../../services/associadosService';
import { formatCurrency } from '../../utils/formatters';
import { formatLocalDate } from '../../utils/dateUtils';
import {
  DESCRICAO_FAIXA,
  MapaDeCalorReceber,
  montarMapaDeCalor,
  roteiroSugerido,
} from '../../utils/mapaCalorReceber';

interface RelatorioMapaCalorModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcelas: ParcelaReceber[];
  empresaData: Empresa | null;
  associados: Associado[];
  receitas?: Receita[];
  currentFilters: {
    searchTerm?: string;
    statusFilter?: string;
    formaPagamentoFilter?: string;
    dataInicial?: string;
    dataFinal?: string;
  };
  userName?: string;
}

/** Quantos bairros o roteiro sugere. Além disso a folha deixa de caber no bolso. */
const LIMITE_DO_ROTEIRO = 12;

const percentual = (fracao: number) => `${(fracao * 100).toFixed(1)}%`;

/**
 * Relatório de zonas e setores de cobrança.
 *
 * O relatório tradicional lista parcelas em ordem de vencimento — útil para o
 * financeiro, inútil para quem vai à rua. Este responde a outra pergunta: **onde está
 * concentrado o dinheiro a receber**, por município e, dentro dele, por bairro, para o
 * cobrador escolher a zona antes de escolher o cliente.
 *
 * A divisão é a da Ficha de Cadastro: `utils/mapaCalorReceber.ts` decide **o quê**
 * (agrupamento, faixas, roteiro) e cada saída daqui decide só **como** — prévia em tela,
 * janela de impressão com CSS próprio e PDF.
 */
export const RelatorioMapaCalorModal: React.FC<RelatorioMapaCalorModalProps> = ({
  isOpen,
  onClose,
  parcelas,
  empresaData,
  associados,
  receitas = [],
  currentFilters,
  userName = 'Operador do Sistema',
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const mapa: MapaDeCalorReceber = useMemo(
    () => montarMapaDeCalor(parcelas, { associados, receitas }),
    [parcelas, associados, receitas],
  );
  const roteiro = useMemo(() => roteiroSugerido(mapa, LIMITE_DO_ROTEIRO), [mapa]);

  const empresaNome =
    empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX';

  const descricaoDosFiltros = useMemo(() => {
    const partes: string[] = [];
    if (currentFilters.dataInicial || currentFilters.dataFinal) {
      // O filtro guarda a data em ISO; o papel mostra dd/MM/yyyy, que é como o operador
      // a digitou na tela.
      partes.push(
        `Vencimento: ${currentFilters.dataInicial ? formatLocalDate(currentFilters.dataInicial) : 'início'} a ${currentFilters.dataFinal ? formatLocalDate(currentFilters.dataFinal) : 'hoje'}`,
      );
    }
    if (currentFilters.statusFilter && currentFilters.statusFilter !== 'todos') {
      partes.push(`Situação: ${currentFilters.statusFilter}`);
    }
    if (currentFilters.formaPagamentoFilter && currentFilters.formaPagamentoFilter !== 'todas') {
      partes.push(`Forma: ${currentFilters.formaPagamentoFilter}`);
    }
    if (currentFilters.searchTerm) partes.push(`Busca: "${currentFilters.searchTerm}"`);
    return partes.length > 0 ? partes.join('  •  ') : 'Nenhum filtro aplicado';
  }, [currentFilters]);

  /**
   * O HTML da janela de impressão.
   *
   * Escrito à mão e com CSS próprio porque **não existe Tailwind dentro de
   * `window.open('')`** — regra que este projeto já documenta e já quebrou uma vez. Toda
   * cor de faixa vem do módulo puro, e vem **acompanhada do rótulo**: fotocopiado em
   * preto e branco, o relatório continua legível.
   */
  const montarHtmlImpressao = () => {
    const emissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

    const linhasRoteiro = roteiro
      .map((linha) => {
        const faixa = DESCRICAO_FAIXA[linha.faixa];
        return `
          <tr>
            <td class="rank">${linha.ordem}</td>
            <td><strong>${linha.bairro}</strong><div class="sub">${linha.municipio}</div></td>
            <td><span class="faixa" style="background:${faixa.cor};color:${faixa.corTexto}">${faixa.rotulo}</span></td>
            <td class="num">${percentual(linha.participacao)}</td>
            <td class="num">${linha.devedores}</td>
            <td class="num">${linha.qtdAReceber}</td>
            <td class="num vencido">${linha.valorVencido > 0 ? formatCurrency(linha.valorVencido) : '—'}</td>
            <td class="num total">${formatCurrency(linha.valorAReceber)}</td>
          </tr>`;
      })
      .join('');

    const blocosMunicipio = mapa.municipios
      .map((municipio) => {
        const faixaMun = DESCRICAO_FAIXA[municipio.faixa];
        const bairros = municipio.bairros
          .map((bairro) => {
            const faixa = DESCRICAO_FAIXA[bairro.faixa];
            // A barra é a intensidade: a zona líder enche a barra, e as outras se leem
            // por comparação com ela. A fatia do total vai na coluna ao lado, em número.
            const largura = Math.max(2, Math.round(bairro.intensidade * 100));
            return `
              <tr>
                <td>
                  <strong>${bairro.rotulo}</strong>
                  <div class="barra"><span style="width:${largura}%;background:${faixa.cor}"></span></div>
                </td>
                <td><span class="faixa" style="background:${faixa.cor};color:${faixa.corTexto}">${faixa.rotulo}</span></td>
                <td class="num">${percentual(bairro.participacao)}</td>
                <td class="num">${bairro.devedores}</td>
                <td class="num">${bairro.qtdAReceber}${bairro.qtdVencida > 0 ? ` <span class="vencido">(${bairro.qtdVencida} venc.)</span>` : ''}</td>
                <td class="num vencido">${bairro.valorVencido > 0 ? formatCurrency(bairro.valorVencido) : '—'}</td>
                <td class="num total">${formatCurrency(bairro.valorAReceber)}</td>
              </tr>`;
          })
          .join('');

        return `
          <div class="municipio">
            <div class="municipio-head">
              <div>
                <span class="municipio-nome">${municipio.rotulo}</span>
                <span class="faixa" style="background:${faixaMun.cor};color:${faixaMun.corTexto}">${faixaMun.rotulo}</span>
              </div>
              <div class="municipio-total">
                ${formatCurrency(municipio.valorAReceber)} • ${percentual(municipio.participacao)} do total • ${municipio.devedores} devedor(es)
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:32%">Bairro / Setor</th>
                  <th style="width:10%">Calor</th>
                  <th style="width:10%" class="num">Participação</th>
                  <th style="width:10%" class="num">Devedores</th>
                  <th style="width:12%" class="num">Parcelas</th>
                  <th style="width:13%" class="num">Vencido</th>
                  <th style="width:13%" class="num">A receber</th>
                </tr>
              </thead>
              <tbody>${bairros}</tbody>
            </table>
          </div>`;
      })
      .join('');

    const notas: string[] = [];
    if (mapa.semLocalizacao.quantidade > 0) {
      notas.push(
        `${mapa.semLocalizacao.quantidade} parcela(s), somando ${formatCurrency(mapa.semLocalizacao.valor)}, estão no total mas não em nenhuma zona: o devedor não foi localizado no cadastro ou está sem endereço. Não há como roteirizá-las.`,
      );
    }
    if (mapa.foraDaCobranca.quantidade > 0) {
      notas.push(
        `${mapa.foraDaCobranca.quantidade} parcela(s) do filtro, somando ${formatCurrency(mapa.foraDaCobranca.valor)}, ficaram fora do mapa por já estarem recebidas ou canceladas — não são cobrança em aberto.`,
      );
    }

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Mapa de Zonas de Cobrança - ${empresaNome}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            *, *::before, *::after { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a; margin: 0; background: #fff; font-size: 10px;
              -webkit-print-color-adjust: exact; print-color-adjust: exact;
            }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
            .title-main { font-size: 16px; font-weight: 900; text-transform: uppercase; margin: 0 0 2px; }
            .subtitle { font-size: 10px; color: #475569; margin: 0; }
            .filters-bar {
              background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
              padding: 6px 10px; margin-bottom: 10px; font-size: 9.5px; color: #475569;
              display: flex; justify-content: space-between; gap: 12px;
            }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
            .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #f8fafc; }
            .kpi-label { font-size: 8.5px; text-transform: uppercase; font-weight: 700; color: #64748b; }
            .kpi-val { font-size: 13px; font-weight: 900; margin-top: 2px; }
            h2.secao {
              font-size: 11px; text-transform: uppercase; letter-spacing: .4px;
              margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #cbd5e1;
            }
            table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            table.data-table th {
              background: #0f172a !important; color: #fff !important; font-weight: 800;
              font-size: 9px; text-transform: uppercase; padding: 5px 6px;
              border: 1px solid #0f172a; text-align: left;
            }
            table.data-table td { border: 1px solid #e2e8f0; padding: 5px 6px; vertical-align: middle; }
            table.data-table tbody tr:nth-child(even) { background: #f8fafc; }
            .num { text-align: right; font-variant-numeric: tabular-nums; }
            .total { font-weight: 800; }
            .vencido { color: #b91c1c; font-weight: 700; }
            .rank {
              text-align: center; font-weight: 900; font-size: 12px; color: #0f172a; width: 26px;
            }
            .sub { font-size: 8.5px; color: #64748b; }
            .faixa {
              display: inline-block; padding: 1px 6px; border-radius: 999px;
              font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px;
            }
            .barra { height: 4px; background: #e2e8f0; border-radius: 999px; margin-top: 3px; overflow: hidden; }
            .barra span { display: block; height: 100%; border-radius: 999px; }
            .municipio { margin-bottom: 12px; page-break-inside: avoid; }
            .municipio-head {
              display: flex; justify-content: space-between; align-items: baseline;
              background: #eef2f7; border: 1px solid #cbd5e1; border-bottom: none;
              padding: 5px 8px; border-radius: 6px 6px 0 0;
            }
            .municipio-nome { font-size: 12px; font-weight: 900; margin-right: 8px; }
            .municipio-total { font-size: 9px; color: #475569; font-weight: 600; }
            .notas { border: 1px solid #fcd34d; background: #fffbeb; border-radius: 6px; padding: 7px 10px; }
            .notas li { margin-bottom: 3px; }
            .vazio { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 14px; text-align: center; color: #64748b; }
            footer {
              margin-top: 14px; border-top: 1px solid #cbd5e1; padding-top: 6px;
              font-size: 8.5px; color: #64748b; display: flex; justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="title-main">Mapa de Zonas e Setores de Cobrança</p>
            <p class="subtitle">${empresaNome}${empresaData?.cnpj ? ` — CNPJ ${empresaData.cnpj}` : ''}</p>
          </div>

          <div class="filters-bar">
            <span><strong>Filtros:</strong> ${descricaoDosFiltros}</span>
            <span>Emitido em ${emissao} por ${userName}</span>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card"><div class="kpi-label">Total a receber</div><div class="kpi-val">${formatCurrency(mapa.totalAReceber)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Vencido</div><div class="kpi-val vencido">${formatCurrency(mapa.totalVencido)}</div></div>
            <div class="kpi-card"><div class="kpi-label">Devedores</div><div class="kpi-val">${mapa.devedores}</div></div>
            <div class="kpi-card"><div class="kpi-label">Zonas mapeadas</div><div class="kpi-val">${mapa.municipios.length} mun. / ${mapa.municipios.reduce((t, m) => t + m.bairros.length, 0)} bairros</div></div>
          </div>

          ${
            roteiro.length > 0
              ? `<h2 class="secao">Roteiro sugerido — onde ir primeiro</h2>
                 <table class="data-table">
                   <thead>
                     <tr>
                       <th style="width:26px">#</th>
                       <th>Bairro / Setor</th>
                       <th style="width:10%">Calor</th>
                       <th style="width:10%" class="num">Participação</th>
                       <th style="width:10%" class="num">Devedores</th>
                       <th style="width:9%" class="num">Parcelas</th>
                       <th style="width:13%" class="num">Vencido</th>
                       <th style="width:13%" class="num">A receber</th>
                     </tr>
                   </thead>
                   <tbody>${linhasRoteiro}</tbody>
                 </table>`
              : ''
          }

          <h2 class="secao">Detalhamento por município</h2>
          ${blocosMunicipio || '<div class="vazio">Nenhuma parcela em aberto com endereço nos filtros aplicados.</div>'}

          ${
            notas.length > 0
              ? `<h2 class="secao">Notas</h2><div class="notas"><ul>${notas.map((n) => `<li>${n}</li>`).join('')}</ul></div>`
              : ''
          }

          <footer>
            <span>${empresaNome} — Mapa de Zonas de Cobrança</span>
            <span>Gerado pelo Sistema ERAS PAX em ${emissao}</span>
          </footer>
        </body>
      </html>`;
  };

  const handleImprimir = () => {
    const janela = window.open('', '_blank');
    if (!janela) {
      toast.error('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.');
      return;
    }
    janela.document.write(montarHtmlImpressao());
    janela.document.close();
    setTimeout(() => {
      janela.focus();
      janela.print();
    }, 400);
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      toast.loading('Gerando arquivo PDF...', { id: 'export-mapa-pdf' });

      // Import dinâmico, como manda a seção de performance do CLAUDE.md: o `jspdf` só é
      // baixado por quem de fato exporta o relatório.
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const emissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
      const largura = doc.internal.pageSize.getWidth();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, largura, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(empresaNome.toUpperCase(), 14, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Mapa de Zonas e Setores de Cobrança', 14, 16);

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      doc.text(`Filtros: ${descricaoDosFiltros}`, 14, 28);
      doc.text(`Emitido em ${emissao} por ${userName}`, 14, 32.5);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Total a receber: ${formatCurrency(mapa.totalAReceber)}   |   Vencido: ${formatCurrency(mapa.totalVencido)}   |   Devedores: ${mapa.devedores}`,
        14,
        40,
      );

      let y = 46;

      if (roteiro.length > 0) {
        doc.setFontSize(10);
        doc.text('Roteiro sugerido — onde ir primeiro', 14, y);
        autoTable(doc, {
          startY: y + 2,
          head: [['#', 'Bairro / Setor', 'Município', 'Calor', 'Part.', 'Devs.', 'Vencido', 'A receber']],
          body: roteiro.map((l) => [
            String(l.ordem),
            l.bairro,
            l.municipio,
            DESCRICAO_FAIXA[l.faixa].rotulo,
            percentual(l.participacao),
            String(l.devedores),
            l.valorVencido > 0 ? formatCurrency(l.valorVencido) : '—',
            formatCurrency(l.valorAReceber),
          ]),
          styles: { fontSize: 7.5, cellPadding: 1.8 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
          columnStyles: { 0: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      for (const municipio of mapa.municipios) {
        if (y > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          y = 18;
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(
          `${municipio.rotulo} — ${formatCurrency(municipio.valorAReceber)} (${percentual(municipio.participacao)})`,
          14,
          y,
        );
        autoTable(doc, {
          startY: y + 2,
          head: [['Bairro / Setor', 'Calor', 'Part.', 'Devs.', 'Parcelas', 'Vencido', 'A receber']],
          body: municipio.bairros.map((b) => [
            b.rotulo,
            DESCRICAO_FAIXA[b.faixa].rotulo,
            percentual(b.participacao),
            String(b.devedores),
            String(b.qtdAReceber),
            b.valorVencido > 0 ? formatCurrency(b.valorVencido) : '—',
            formatCurrency(b.valorAReceber),
          ]),
          styles: { fontSize: 7.5, cellPadding: 1.8 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
          columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      if (mapa.semLocalizacao.quantidade > 0 || mapa.foraDaCobranca.quantidade > 0) {
        if (y > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage();
          y = 18;
        }
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Notas', 14, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        let linhaY = y + 5;
        if (mapa.semLocalizacao.quantidade > 0) {
          doc.text(
            `• ${mapa.semLocalizacao.quantidade} parcela(s) (${formatCurrency(mapa.semLocalizacao.valor)}) sem endereço ou sem devedor localizado — não roteirizáveis.`,
            14,
            linhaY,
          );
          linhaY += 4.5;
        }
        if (mapa.foraDaCobranca.quantidade > 0) {
          doc.text(
            `• ${mapa.foraDaCobranca.quantidade} parcela(s) (${formatCurrency(mapa.foraDaCobranca.valor)}) do filtro ficaram fora: já recebidas ou canceladas.`,
            14,
            linhaY,
          );
        }
      }

      doc.save(`Mapa_Zonas_Cobranca_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
      toast.success('PDF gerado com sucesso!', { id: 'export-mapa-pdf' });
    } catch (e: any) {
      console.error('Erro ao gerar PDF do mapa de zonas:', e);
      toast.error(e?.message || 'Não foi possível gerar o PDF.', { id: 'export-mapa-pdf' });
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (!isOpen) return null;

  const totalBairros = mapa.municipios.reduce((t, m) => t + m.bairros.length, 0);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-subtle border border-border-default rounded-3xl w-full max-w-5xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border-default shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#2a78d6]/15 border border-[#2a78d6]/30 flex items-center justify-center text-[#5598e7] shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-text-base truncate">Mapa de Zonas de Cobrança</h3>
              <p className="text-xs text-text-subtle truncate">
                Onde está concentrado o valor a receber, por município e bairro
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleImprimir}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-default text-xs font-semibold text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2a78d6] hover:opacity-90 text-white text-xs font-bold transition-opacity disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExportingPDF ? 'Gerando...' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-text-subtle hover:text-text-base rounded-xl hover:bg-bg-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div ref={printAreaRef} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          <div className="text-[11px] text-text-subtle bg-bg-surface border border-border-default rounded-xl px-3 py-2">
            <strong className="text-text-base">Filtros aplicados:</strong> {descricaoDosFiltros}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { rotulo: 'Total a receber', valor: formatCurrency(mapa.totalAReceber), icone: <Flame className="w-4 h-4" />, destaque: 'text-text-base' },
              { rotulo: 'Vencido', valor: formatCurrency(mapa.totalVencido), icone: <AlertCircle className="w-4 h-4" />, destaque: 'text-rose-400' },
              { rotulo: 'Devedores', valor: String(mapa.devedores), icone: <Users className="w-4 h-4" />, destaque: 'text-text-base' },
              { rotulo: 'Zonas', valor: `${mapa.municipios.length} mun. / ${totalBairros} bairros`, icone: <Route className="w-4 h-4" />, destaque: 'text-text-base' },
            ].map((kpi) => (
              <div key={kpi.rotulo} className="bg-bg-surface border border-border-default rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-text-subtle">
                  {kpi.icone}
                  {kpi.rotulo}
                </div>
                <p className={`mt-1 text-base font-extrabold tabular-nums ${kpi.destaque}`}>{kpi.valor}</p>
              </div>
            ))}
          </div>

          {roteiro.length > 0 && (
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-text-subtle mb-2">
                Roteiro sugerido — onde ir primeiro
              </h4>
              <ol className="space-y-1.5">
                {roteiro.map((linha) => {
                  const faixa = DESCRICAO_FAIXA[linha.faixa];
                  return (
                    <li
                      key={`${linha.municipio}-${linha.bairro}`}
                      className="flex items-center gap-3 bg-bg-surface border border-border-default rounded-xl px-3 py-2"
                    >
                      <span className="w-6 text-center text-sm font-extrabold text-text-subtle tabular-nums shrink-0">
                        {linha.ordem}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-base truncate">{linha.bairro}</p>
                        <p className="text-[11px] text-text-subtle truncate">
                          {linha.municipio} · {linha.devedores} devedor(es) · {linha.qtdAReceber} parcela(s)
                        </p>
                      </div>
                      {/* A cor nunca vai sozinha: o rótulo da faixa acompanha sempre. */}
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide shrink-0"
                        style={{ backgroundColor: faixa.cor, color: faixa.corTexto }}
                      >
                        {faixa.rotulo}
                      </span>
                      <div className="text-right shrink-0 w-32">
                        <p className="text-sm font-extrabold text-text-base tabular-nums">
                          {formatCurrency(linha.valorAReceber)}
                        </p>
                        {linha.valorVencido > 0 && (
                          <p className="text-[11px] font-bold text-rose-400 tabular-nums">
                            {formatCurrency(linha.valorVencido)} vencido
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wide text-text-subtle mb-2">
              Detalhamento por município
            </h4>
            {mapa.municipios.length === 0 ? (
              <p className="text-sm text-text-subtle border border-dashed border-border-default rounded-xl p-6 text-center">
                Nenhuma parcela em aberto com endereço nos filtros aplicados.
              </p>
            ) : (
              <div className="space-y-3">
                {mapa.municipios.map((municipio) => (
                  <div key={municipio.chave} className="border border-border-default rounded-xl overflow-hidden">
                    <div className="flex items-baseline justify-between gap-3 bg-bg-surface px-3 py-2 border-b border-border-default">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-text-base truncate">{municipio.rotulo}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0"
                          style={{
                            backgroundColor: DESCRICAO_FAIXA[municipio.faixa].cor,
                            color: DESCRICAO_FAIXA[municipio.faixa].corTexto,
                          }}
                        >
                          {DESCRICAO_FAIXA[municipio.faixa].rotulo}
                        </span>
                      </div>
                      <span className="text-xs text-text-subtle shrink-0 tabular-nums">
                        {formatCurrency(municipio.valorAReceber)} · {percentual(municipio.participacao)}
                      </span>
                    </div>
                    <ul className="divide-y divide-border-default">
                      {municipio.bairros.map((bairro) => (
                        <li key={bairro.chave} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-text-base truncate">{bairro.rotulo}</span>
                            <span className="text-sm font-bold text-text-base tabular-nums shrink-0">
                              {formatCurrency(bairro.valorAReceber)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-border-default/60 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(2, Math.round(bairro.intensidade * 100))}%`,
                                  backgroundColor: DESCRICAO_FAIXA[bairro.faixa].cor,
                                }}
                              />
                            </div>
                            <span className="text-[11px] text-text-subtle tabular-nums shrink-0">
                              {percentual(bairro.participacao)} · {bairro.devedores} dev.
                              {bairro.qtdVencida > 0 && (
                                <span className="text-rose-400 font-bold"> · {bairro.qtdVencida} venc.</span>
                              )}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(mapa.semLocalizacao.quantidade > 0 || mapa.foraDaCobranca.quantidade > 0) && (
            <section className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3 space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wide text-amber-200">Notas</h4>
              {mapa.semLocalizacao.quantidade > 0 && (
                <p className="text-[11px] text-amber-200/80">
                  {mapa.semLocalizacao.quantidade} parcela(s), somando{' '}
                  {formatCurrency(mapa.semLocalizacao.valor)}, entram no total mas não em nenhuma zona:
                  o devedor não foi localizado no cadastro ou está sem endereço.
                </p>
              )}
              {mapa.foraDaCobranca.quantidade > 0 && (
                <p className="text-[11px] text-amber-200/80">
                  {mapa.foraDaCobranca.quantidade} parcela(s) do filtro, somando{' '}
                  {formatCurrency(mapa.foraDaCobranca.valor)}, ficaram fora do mapa por já estarem
                  recebidas ou canceladas — não são cobrança em aberto.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
