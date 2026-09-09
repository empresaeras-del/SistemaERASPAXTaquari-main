/**
 * Demonstração Contábil do exercício — prévia em tela, impressão e PDF.
 *
 * Segue o desenho que este repositório já usa na Ficha de Cadastro do Associado: **uma
 * função pura decide o quê mostrar** (`linhasDaDemonstracao`, em `utils/demonstracaoContabil.ts`)
 * e cada renderizador decide só o **como**. Os três — tela, papel e PDF — leem a mesma lista,
 * então não dá para um deles ficar para trás quando a regra mudar. Foi por não ter isso que a
 * Ficha imprimia "Cidade/UF" sem o UF por anos.
 *
 * `jspdf`/`jspdf-autotable` entram por **import dinâmico** dentro do handler: são ~1,3 MB que
 * não têm por que pesar no chunk desta rota só porque o botão existe (ver CLAUDE.md,
 * "Performance: bibliotecas pesadas").
 */
import React, { useMemo, useState } from 'react';
import { X, Printer, Download, FileBarChart, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { Empresa } from '../../services/empresasService';
import { PlanoContabil } from '../../types/planoContabil';
import {
  ContaComValores,
  ResumoDemonstracao,
  ValoresDaConta,
  linhasDaDemonstracao,
} from '../../utils/demonstracaoContabil';
import {
  montarHtmlImpressaoDemonstracao,
  DadosDemonstracao,
} from '../../utils/demonstracaoContabilImpressao';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  onClose: () => void;
  plano: PlanoContabil;
  arvore: ContaComValores[];
  resumo: ResumoDemonstracao;
  foraDoExercicio: ValoresDaConta;
  naoClassificado: ValoresDaConta;
  empresaData: Empresa | null;
  userName?: string;
}

const percentual = (v: number | null): string =>
  v === null ? '—' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v)}%`;

export const DemonstracaoContabilModal: React.FC<Props> = ({
  onClose,
  plano,
  arvore,
  resumo,
  foraDoExercicio,
  naoClassificado,
  empresaData,
  userName = 'Operador do Sistema',
}) => {
  const [apenasComMovimento, setApenasComMovimento] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  const linhas = useMemo(
    () => linhasDaDemonstracao(arvore, { apenasComMovimento }),
    [arvore, apenasComMovimento],
  );

  const empresaNome = empresaData?.nome_fantasia || empresaData?.razao_social || 'SISTEMA ERAS PAX';

  const dados: DadosDemonstracao = useMemo(
    () => ({
      cabecalho: {
        empresaNome,
        empresaCnpj: empresaData?.cnpj || null,
        empresaEndereco: empresaData?.endereco || null,
        logoUrl: empresaData?.logo_url || null,
        exercicio: plano.exercicio,
        planoNome: plano.nome,
        geradoPor: userName,
        geradoEm: new Date(),
      },
      linhas,
      resumo,
      foraDoExercicio,
      naoClassificado,
    }),
    [empresaNome, empresaData, plano, userName, linhas, resumo, foraDoExercicio, naoClassificado],
  );

  const imprimir = () => {
    const janela = window.open('', '_blank');
    if (!janela) {
      toast.error('O navegador bloqueou a janela de impressão. Libere os pop-ups para este site.');
      return;
    }
    janela.document.write(montarHtmlImpressaoDemonstracao(dados));
    janela.document.close();
    janela.focus();
    setTimeout(() => {
      janela.print();
      janela.close();
    }, 400);
  };

  const exportarPDF = async () => {
    setGerandoPDF(true);
    toast.loading('Gerando PDF…', { id: 'demonstracao-pdf' });
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const largura = doc.internal.pageSize.getWidth();
      const emissao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, largura, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(empresaNome.toUpperCase(), 14, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`DEMONSTRAÇÃO CONTÁBIL — EXERCÍCIO ${plano.exercicio}`, 14, 16);
      doc.setFontSize(8);
      doc.text(`Emissão: ${emissao} | Operador: ${userName}`, largura - 14, 10, { align: 'right' });
      doc.text(`Plano: ${plano.nome}`, largura - 14, 16, { align: 'right' });

      // Resumo antes da tabela: é o que responde a pergunta do relatório numa olhada.
      let y = 30;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      const cartoes: Array<[string, ValoresDaConta]> = [
        ['Receitas', resumo.receita],
        ['Despesas', resumo.despesa],
        ['Resultado do exercício', resumo.resultado],
      ];
      const larguraCartao = (largura - 28 - 8) / 3;
      cartoes.forEach(([titulo, valores], i) => {
        const x = 14 + i * (larguraCartao + 4);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(x, y, larguraCartao, 18, 1.5, 1.5, 'S');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(titulo.toUpperCase(), x + 3, y + 5);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        if (titulo === 'Despesas' || valores.realizado < 0) doc.setTextColor(185, 28, 28);
        else doc.setTextColor(4, 120, 87);
        doc.text(formatCurrency(valores.realizado), x + 3, y + 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`realizado · previsto ${formatCurrency(valores.previsto)}`, x + 3, y + 15.5);
      });
      y += 24;

      autoTable(doc, {
        startY: y,
        head: [['Código', 'Conta', 'Previsto', 'Realizado', 'Execução']],
        body: linhas.map((l) => [
          `${'   '.repeat(Math.max(0, l.nivel - 1))}${l.codigo}`,
          `${l.nome}${l.ativo ? '' : ' (desativada)'}`,
          formatCurrency(l.previsto),
          formatCurrency(l.realizado),
          percentual(l.execucao),
        ]),
        styles: { fontSize: 8, cellPadding: 1.6 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 24, font: 'courier' },
          2: { halign: 'right', cellWidth: 27 },
          3: { halign: 'right', cellWidth: 27 },
          4: { halign: 'right', cellWidth: 20 },
        },
        // A sintética é o grupo: fundo cinza e negrito, igual à impressão.
        didParseCell: (data) => {
          if (data.section !== 'body') return;
          const linha = linhas[data.row.index];
          if (linha?.tipo === 'sintetica') {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);

      const notas: string[] = [];
      if (foraDoExercicio.previsto !== 0 || foraDoExercicio.realizado !== 0) {
        notas.push(
          `Fora do exercício ${plano.exercicio}: ${formatCurrency(foraDoExercicio.realizado)} realizado e ` +
            `${formatCurrency(foraDoExercicio.previsto)} previsto em contas deste plano, com vencimento ou liquidação ` +
            `em outro ano — tipicamente as prestações seguintes de um parcelamento longo. Não somados acima.`,
        );
      }
      if (naoClassificado.previsto !== 0 || naoClassificado.realizado !== 0) {
        notas.push(
          `Sem conta deste plano: ${formatCurrency(naoClassificado.realizado)} realizado e ` +
            `${formatCurrency(naoClassificado.previsto)} previsto em lançamentos anteriores ao plano de contas ou de outro exercício. Não somados acima.`,
        );
      }
      notas.push(
        'Critérios: Previsto é a parcela lançada, pelo valor de face e pela data de vencimento. Realizado é a parcela ' +
          'liquidada, pelo valor efetivamente recebido ou pago e pela data da liquidação. Parcelas canceladas ficam de fora.',
      );

      for (const nota of notas) {
        const quebrada = doc.splitTextToSize(nota, largura - 28) as string[];
        if (y + quebrada.length * 3.4 > doc.internal.pageSize.getHeight() - 12) {
          doc.addPage();
          y = 20;
        }
        doc.text(quebrada, 14, y);
        y += quebrada.length * 3.4 + 2;
      }

      doc.save(`demonstracao-contabil-${plano.exercicio}.pdf`);
      toast.success('PDF gerado.', { id: 'demonstracao-pdf' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar o PDF.', { id: 'demonstracao-pdf' });
    } finally {
      setGerandoPDF(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-bg-surface border border-border-default rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-default shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-base flex items-center gap-2">
              <FileBarChart className="w-4 h-4 text-[#3B82F6]" />
              Demonstração Contábil
            </h2>
            <p className="text-xs text-text-subtle">
              Exercício <b>{plano.exercicio}</b> · plano <b>{plano.nome}</b> · {empresaNome}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-base hover:bg-bg-hover"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border-default shrink-0">
          <label className="flex items-center gap-2 text-xs text-text-subtle">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <input
              type="checkbox"
              checked={apenasComMovimento}
              onChange={(e) => setApenasComMovimento(e.target.checked)}
              className="accent-[#3B82F6]"
            />
            Somente contas com movimento no exercício
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={imprimir}
              className="px-3 py-1.5 rounded-lg border border-border-default text-text-subtle hover:border-[#3B82F6] hover:text-[#3B82F6] text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            <button
              onClick={exportarPDF}
              disabled={gerandoPDF}
              className="px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> {gerandoPDF ? 'Gerando…' : 'Exportar PDF'}
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              ['Receitas', resumo.receita, 'text-emerald-400'],
              ['Despesas', resumo.despesa, 'text-rose-400'],
              [
                'Resultado do exercício',
                resumo.resultado,
                resumo.resultado.realizado < 0 ? 'text-rose-400' : 'text-emerald-400',
              ],
            ] as Array<[string, ValoresDaConta, string]>).map(([titulo, valores, cor]) => (
              <div key={titulo} className="p-3 rounded-xl border border-border-default bg-bg-base">
                <p className="text-[11px] uppercase tracking-wide text-text-muted">{titulo}</p>
                <p className={`text-lg font-bold tabular-nums ${cor}`}>{formatCurrency(valores.realizado)}</p>
                <p className="text-[11px] text-text-subtle tabular-nums">
                  realizado · previsto {formatCurrency(valores.previsto)}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border-default overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-base text-[10px] uppercase tracking-wide text-text-muted">
                  <th className="text-left font-medium px-3 py-2">Código</th>
                  <th className="text-left font-medium px-3 py-2">Conta</th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Previsto</th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Realizado</th>
                  <th className="text-right font-medium px-3 py-2 whitespace-nowrap">Execução</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {linhas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-text-subtle">
                      Nenhuma conta com movimento neste exercício.
                      {apenasComMovimento && ' Desmarque o filtro acima para ver o plano inteiro.'}
                    </td>
                  </tr>
                ) : (
                  linhas.map((l) => (
                    <tr
                      key={l.id}
                      className={`${l.tipo === 'sintetica' ? 'bg-bg-base/50 font-bold text-text-base' : 'text-text-subtle'} ${
                        l.ativo ? '' : 'opacity-60'
                      }`}
                    >
                      <td
                        className="px-3 py-1.5 font-mono text-xs whitespace-nowrap"
                        style={{ paddingLeft: `${12 + (l.nivel - 1) * 16}px` }}
                      >
                        {l.codigo}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        {l.nome}
                        {!l.ativo && <span className="ml-1 text-[10px] uppercase text-amber-400">desativada</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums">{formatCurrency(l.previsto)}</td>
                      <td
                        className={`px-3 py-1.5 text-right text-xs tabular-nums ${
                          l.realizado === 0 ? '' : l.natureza === 'receita' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatCurrency(l.realizado)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-xs tabular-nums text-text-muted">
                        {percentual(l.execucao)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {(foraDoExercicio.previsto !== 0 || foraDoExercicio.realizado !== 0) && (
            <p className="text-xs text-amber-400/90">
              <b>Fora do exercício {plano.exercicio}:</b> {formatCurrency(foraDoExercicio.realizado)} realizado e{' '}
              {formatCurrency(foraDoExercicio.previsto)} previsto em contas deste plano, com vencimento ou liquidação
              em outro ano — tipicamente as prestações seguintes de um parcelamento longo. Não estão somados acima.
            </p>
          )}

          {(naoClassificado.previsto !== 0 || naoClassificado.realizado !== 0) && (
            <p className="text-xs text-text-muted">
              <b>Sem conta deste plano:</b> {formatCurrency(naoClassificado.realizado)} realizado e{' '}
              {formatCurrency(naoClassificado.previsto)} previsto em lançamentos anteriores ao plano de contas ou
              classificados em outro exercício. Não estão somados acima.
            </p>
          )}

          <p className="text-xs text-text-muted leading-relaxed">
            <b>Critérios:</b> <i>Previsto</i> é a parcela lançada, pelo valor de face e pela data de vencimento.{' '}
            <i>Realizado</i> é a parcela liquidada, pelo valor efetivamente recebido ou pago e pela data da liquidação.
            Parcelas canceladas ficam de fora das duas colunas. Uma parcela que vence num exercício e é liquidada no
            seguinte aparece como prevista em um e realizada no outro.
          </p>
        </div>
      </div>
    </div>
  );
};
