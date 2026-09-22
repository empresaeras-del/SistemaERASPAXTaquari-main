import React from 'react';

import { ChevronDown, FileText, MapPin, Plus, Printer } from 'lucide-react';
import type { useContasReceber } from '../../hooks/useContasReceber';

type EstadoContasReceber = ReturnType<typeof useContasReceber>;

type Props = Pick<EstadoContasReceber, 'navigate' | 'setShowEscolhaRelatorio' | 'setShowMapaCalorModal' | 'setShowRelatorioModal' | 'showEscolhaRelatorio' | 'state'>;

/**
 * Título da tela, o menu de Relatórios e o botão de Nova Receita.
 *
 * O menu oferece os DOIS relatórios de propósito: eles respondem a perguntas diferentes sobre
 * os mesmos filtros — a relação de parcelas em ordem de vencimento, que o financeiro confere,
 * e o mapa de zonas, que o cobrador usa para montar a rota. Trocar um pelo outro tiraria de
 * alguém o relatório que ele já usa.
 */
export const ContasReceberCabecalho: React.FC<Props> = ({ navigate, setShowEscolhaRelatorio, setShowMapaCalorModal, setShowRelatorioModal, showEscolhaRelatorio, state }) => {
  return (
    <>
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
      <div>
        <h1 className="text-2xl font-bold text-text-base">Contas a Receber</h1>
        <p className="text-text-subtle mt-1">Gestão de recebimentos e mensalidades</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEscolhaRelatorio((aberto) => !aberto)}
            className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-default text-text-subtle text-sm font-semibold rounded-xl hover:text-text-base hover:bg-bg-hover transition-colors shadow-sm cursor-pointer"
            title="Escolher e gerar um relatório com os filtros aplicados"
          >
            <Printer className="w-4 h-4 text-blue-500" />
            <span>Relatórios</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showEscolhaRelatorio ? 'rotate-180' : ''}`} />
          </button>

          {showEscolhaRelatorio && (
            <>
              {/* Fecha ao clicar fora, sem prender o menu na tela. */}
              <button
                type="button"
                aria-label="Fechar seleção de relatório"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setShowEscolhaRelatorio(false)}
              />
              <div className="absolute right-0 mt-2 w-80 z-50 bg-bg-subtle border border-border-default rounded-2xl shadow-2xl overflow-hidden">
                <p className="px-4 pt-3 pb-2 text-[10px] font-bold uppercase tracking-wide text-text-subtle">
                  Gerar com os filtros aplicados
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowEscolhaRelatorio(false);
                    setShowRelatorioModal(true);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors flex gap-3 items-start"
                >
                  <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold text-text-base">Relação de parcelas</span>
                    <span className="block text-[11px] text-text-subtle">
                      Lista detalhada por vencimento, com devedor, endereço e situação.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEscolhaRelatorio(false);
                    setShowMapaCalorModal(true);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-bg-hover transition-colors flex gap-3 items-start border-t border-border-default"
                >
                  <MapPin className="w-4 h-4 text-[#5598e7] mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold text-text-base">Mapa de zonas de cobrança</span>
                    <span className="block text-[11px] text-text-subtle">
                      Municípios e bairros por concentração de valor a receber, com roteiro sugerido.
                    </span>
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
        <button 
          type="button"
          disabled={!state.isOnline}
          onClick={() => navigate('/financeiro/contas-a-receber/nova')} 
          title={!state.isOnline ? "Inclusão bloqueada no Modo Offline" : "Nova Receita"}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          Nova Receita
        </button>
      </div>
    </div>
    </>
  );
};
