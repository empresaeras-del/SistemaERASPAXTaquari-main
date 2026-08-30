import React, { useState } from 'react';
import { X, Table, Eye, EyeOff, Plus, Check, Sparkles, Sliders } from 'lucide-react';

export type EstiloTabela = 'grade-visivel' | 'grade-oculta' | 'grade-zebrada' | 'cabecalho-destacado';

export interface DocumentoTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertTable: (html: string) => void;
}

export const DocumentoTableModal: React.FC<DocumentoTableModalProps> = ({
  isOpen,
  onClose,
  onInsertTable
}) => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(2);
  const [estilo, setEstilo] = useState<EstiloTabela>('grade-visivel');
  const [temCabecalho, setTemCabecalho] = useState(true);
  const [largura100, setLargura100] = useState(true);

  if (!isOpen) return null;

  // Presets rápidos para documentos
  const handleInsertPreset = (tipo: 'assinaturas' | 'dados-duas-colunas' | 'financeiro') => {
    let html = '';
    if (tipo === 'assinaturas') {
      html = `
        <table class="tabela-sem-grade" style="width: 100%; border-collapse: collapse; border: none; margin: 35px 0 20px 0;">
          <tbody>
            <tr style="border: none;">
              <td style="width: 48%; border: none; padding: 10px; text-align: center; vertical-align: top;">
                <div style="border-top: 1px solid #1e293b; width: 85%; margin: 0 auto 6px auto;"></div>
                <strong style="font-size: 11pt; text-transform: uppercase;">{{empresa_nome}}</strong><br/>
                <span style="font-size: 9pt; color: #64748b;">CONTRATADA</span>
              </td>
              <td style="width: 4%;"></td>
              <td style="width: 48%; border: none; padding: 10px; text-align: center; vertical-align: top;">
                <div style="border-top: 1px solid #1e293b; width: 85%; margin: 0 auto 6px auto;"></div>
                <strong style="font-size: 11pt; text-transform: uppercase;">{{associado_nome}}</strong><br/>
                <span style="font-size: 9pt; color: #64748b;">CONTRATANTE / ASSOCIADO</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p><br/></p>
      `;
    } else if (tipo === 'dados-duas-colunas') {
      html = `
        <table class="tabela-sem-grade" style="width: 100%; border-collapse: collapse; border: none; margin: 15px 0;">
          <tbody>
            <tr style="border: none;">
              <td style="width: 50%; border: none; padding: 6px 10px; vertical-align: top;">
                <strong>Associado:</strong> {{associado_nome}}<br/>
                <strong>CPF:</strong> {{associado_cpf}}<br/>
                <strong>Telefone:</strong> {{associado_telefone}}
              </td>
              <td style="width: 50%; border: none; padding: 6px 10px; vertical-align: top;">
                <strong>Contrato Nº:</strong> {{numero_contrato}}<br/>
                <strong>Plano:</strong> {{plano_nome}}<br/>
                <strong>Data de Adesão:</strong> {{data_adesao}}
              </td>
            </tr>
          </tbody>
        </table>
        <p><br/></p>
      `;
    } else if (tipo === 'financeiro') {
      html = `
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left;">Parcela</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left;">Vencimento</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right;">Valor</th>
              <th style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">{{parcela_numero}}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">{{parcela_vencimento}}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: right;">{{parcela_valor}}</td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 10px; text-align: center;">A Vencer</td>
            </tr>
          </tbody>
        </table>
        <p><br/></p>
      `;
    }

    onInsertTable(html);
    onClose();
  };

  const handleGenerateCustomTable = () => {
    const numRows = Math.max(1, Math.min(20, rows));
    const numCols = Math.max(1, Math.min(8, cols));

    const isGradeOculta = estilo === 'grade-oculta';
    const isZebrada = estilo === 'grade-zebrada';
    const isCabecalhoDestacado = estilo === 'cabecalho-destacado';

    const tableClass = isGradeOculta
      ? 'tabela-sem-grade'
      : isZebrada
      ? 'tabela-zebrada'
      : 'tabela-padrao';

    const tableStyle = isGradeOculta
      ? `width: ${largura100 ? '100%' : 'auto'}; border-collapse: collapse; border: none; margin: 15px 0;`
      : `width: ${largura100 ? '100%' : 'auto'}; border-collapse: collapse; border: 1px solid #cbd5e1; margin: 15px 0;`;

    const cellBorder = isGradeOculta ? 'border: none;' : 'border: 1px solid #cbd5e1;';
    const cellPadding = 'padding: 8px 12px;';

    let html = `<table class="${tableClass}" style="${tableStyle}">\n`;

    // Cabeçalho opcional
    if (temCabecalho) {
      const headerBg = isCabecalhoDestacado
        ? 'background-color: #1e293b; color: #ffffff;'
        : 'background-color: #f1f5f9; color: #0f172a;';

      html += `  <thead>\n    <tr style="${headerBg}">\n`;
      for (let c = 1; c <= numCols; c++) {
        html += `      <th style="${cellBorder} ${cellPadding} text-align: left; font-weight: bold;">Coluna ${c}</th>\n`;
      }
      html += `    </tr>\n  </thead>\n`;
    }

    // Corpo da tabela
    html += `  <tbody>\n`;
    for (let r = 1; r <= numRows; r++) {
      const rowBg = isZebrada && r % 2 === 0 ? 'background-color: #f8fafc;' : '';
      html += `    <tr style="${rowBg}">\n`;
      for (let c = 1; c <= numCols; c++) {
        html += `      <td style="${cellBorder} ${cellPadding} vertical-align: top;">Texto ${r}.${c}</td>\n`;
      }
      html += `    </tr>\n`;
    }
    html += `  </tbody>\n</table>\n<p><br/></p>`;

    onInsertTable(html);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181d27] border border-[#2d3544] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-[#2d3544] flex items-center justify-between bg-[#13171f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Controle Profissional de Tabelas</h3>
              <p className="text-xs text-slate-400 mt-0.5">Insira tabelas com controle total de grades e estilos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#232936] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar text-white flex-1">
          
          {/* Presets Rápidos */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Modelos Rápidos de Documento
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleInsertPreset('assinaturas')}
                className="p-3 bg-[#13171f] hover:bg-[#202736] border border-[#2d3544] hover:border-indigo-500/50 rounded-2xl text-left transition-all group"
              >
                <span className="text-xs font-bold text-white block group-hover:text-indigo-400 transition-colors">
                  ✍️ Assinaturas
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Duas colunas sem grades para assinaturas lado a lado
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleInsertPreset('dados-duas-colunas')}
                className="p-3 bg-[#13171f] hover:bg-[#202736] border border-[#2d3544] hover:border-indigo-500/50 rounded-2xl text-left transition-all group"
              >
                <span className="text-xs font-bold text-white block group-hover:text-indigo-400 transition-colors">
                  📄 Dados em 2 Colunas
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Layout de informações do associado e contrato sem bordas
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleInsertPreset('financeiro')}
                className="p-3 bg-[#13171f] hover:bg-[#202736] border border-[#2d3544] hover:border-indigo-500/50 rounded-2xl text-left transition-all group"
              >
                <span className="text-xs font-bold text-white block group-hover:text-indigo-400 transition-colors">
                  💰 Tabela Financeira
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Grade completa de parcelas, vencimento e valores
                </span>
              </button>
            </div>
          </div>

          <div className="border-t border-[#2d3544] pt-4">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Construir Tabela Personalizada
            </label>

            {/* Linhas e Colunas */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400">Linhas (registros)</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rows}
                  onChange={(e) => setRows(Number(e.target.value))}
                  className="w-full bg-[#13171f] border border-[#2d3544] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 text-center font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-400">Colunas</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={cols}
                  onChange={(e) => setCols(Number(e.target.value))}
                  className="w-full bg-[#13171f] border border-[#2d3544] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 text-center font-bold"
                />
              </div>
            </div>

            {/* Estilo de Visibilidade das Grades */}
            <div className="space-y-2 mb-4">
              <label className="block text-xs font-semibold text-slate-300">
                Visibilidade e Estilo das Grades da Tabela
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setEstilo('grade-visivel')}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                    estilo === 'grade-visivel'
                      ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                      : 'bg-[#13171f] border-[#2d3544] text-slate-300'
                  }`}
                >
                  <Eye className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">Grades Visíveis</span>
                    <span className="text-[10px] text-slate-400">Linhas divisórias sutis padrão</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEstilo('grade-oculta')}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                    estilo === 'grade-oculta'
                      ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                      : 'bg-[#13171f] border-[#2d3544] text-slate-300'
                  }`}
                >
                  <EyeOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">Grades Ocultas (Sem Bordas)</span>
                    <span className="text-[10px] text-slate-400">Invisível, perfeita para layout e alinhamento</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEstilo('grade-zebrada')}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                    estilo === 'grade-zebrada'
                      ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                      : 'bg-[#13171f] border-[#2d3544] text-slate-300'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">Linhas Zebradas</span>
                    <span className="text-[10px] text-slate-400">Alternância suave de cores nas linhas</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEstilo('cabecalho-destacado')}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 ${
                    estilo === 'cabecalho-destacado'
                      ? 'bg-indigo-500/15 border-indigo-500 text-indigo-300'
                      : 'bg-[#13171f] border-[#2d3544] text-slate-300'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-white block">Cabeçalho Destacado</span>
                    <span className="text-[10px] text-slate-400">Linha superior com alto contraste</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Opções extras */}
            <div className="flex flex-wrap items-center gap-4 bg-[#13171f] p-3 rounded-2xl border border-[#2d3544]">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={temCabecalho}
                  onChange={(e) => setTemCabecalho(e.target.checked)}
                  className="rounded text-indigo-500 focus:ring-0"
                />
                Incluir Linha de Cabeçalho
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={largura100}
                  onChange={(e) => setLargura100(e.target.checked)}
                  className="rounded text-indigo-500 focus:ring-0"
                />
                Ocupar 100% da Largura da Página
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2d3544] flex items-center justify-end gap-3 bg-[#13171f]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#232936] hover:bg-[#2e3748] text-slate-300 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGenerateCustomTable}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Inserir Tabela no Documento
          </button>
        </div>
      </div>
    </div>
  );
};
