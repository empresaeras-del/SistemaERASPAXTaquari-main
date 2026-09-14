import React from 'react';
import { motion } from 'motion/react';
import { Archive, ShieldAlert, X } from 'lucide-react';
import { HistoricoImpeditivo, LIMITE_POR_GRUPO } from '../../utils/historicoAssociado';
import { Associado } from '../../services/associadosService';

interface Props {
  associado: Associado;
  historico: HistoricoImpeditivo;
  inativando: boolean;
  onInativar: () => void;
  onFechar: () => void;
}

/**
 * A recusa da exclusão, com o histórico que a causou e a saída.
 *
 * Um `toast` de erro não serviria aqui: o operador pediu para excluir e precisa entender
 * **o que existe** antes de decidir o que fazer — e a alternativa (inativar) tem de estar
 * ao alcance da mão, senão ele tenta de novo achando que errou o clique.
 */
export const ExclusaoBloqueadaModal: React.FC<Props> = ({
  associado,
  historico,
  inativando,
  onInativar,
  onFechar,
}) => (
  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-bg-base/80 backdrop-blur-md">
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-bg-subtle rounded-3xl shadow-2xl w-full max-w-lg flex flex-col border border-border-default overflow-hidden max-h-[90vh]"
    >
      <div className="p-6 pb-4 flex items-start gap-4 border-b border-border-default">
        <div className="w-11 h-11 shrink-0 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-text-base">Exclusão não permitida</h3>
          <p className="text-sm text-text-subtle mt-1">
            <span className="font-semibold text-text-base">{associado.nome}</span> tem histórico
            no sistema. Excluir apagaria esses registros junto.
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="ml-auto p-1.5 rounded-lg text-text-subtle hover:text-text-base hover:bg-bg-hover transition-colors"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 py-4 overflow-y-auto space-y-4">
        {historico.grupos.map((grupo) => (
          <div key={grupo.titulo}>
            <div className="flex items-baseline justify-between mb-1.5">
              <h4 className="text-[11px] uppercase tracking-wider font-bold text-text-subtle">
                {grupo.titulo}
              </h4>
              <span className="text-[11px] font-mono text-text-subtle">
                {grupo.total} {grupo.total === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <ul className="rounded-2xl border border-border-default divide-y divide-border-default overflow-hidden">
              {grupo.registros.map((registro, i) => (
                <li key={`${registro.titulo}-${i}`} className="px-3.5 py-2.5 bg-bg-surface">
                  <p className="text-sm font-medium text-text-base">{registro.titulo}</p>
                  {registro.detalhe && (
                    <p className="text-[11px] text-text-subtle mt-0.5">{registro.detalhe}</p>
                  )}
                </li>
              ))}
            </ul>
            {grupo.total > LIMITE_POR_GRUPO && (
              <p className="text-[11px] text-text-subtle mt-1.5">
                e mais {grupo.total - LIMITE_POR_GRUPO} não listados.
              </p>
            )}
          </div>
        ))}

        <div className="rounded-2xl border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-4 py-3">
          <p className="text-sm text-text-base font-semibold flex items-center gap-2">
            <Archive className="w-4 h-4 shrink-0 text-[#3B82F6]" />
            Inativar preserva o histórico
          </p>
          <p className="text-[12px] text-text-subtle mt-1.5 leading-relaxed">
            O associado e seus dependentes deixam de aparecer em atendimentos, requisições e
            contratos novos. O contrato é inativado e as parcelas <strong>em aberto</strong> são
            canceladas — as já recebidas ficam intactas. Reativar depois é possível.
          </p>
        </div>
      </div>

      <div className="px-6 py-4 bg-bg-surface/50 border-t border-border-default flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onFechar}
          disabled={inativando}
          className="px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted rounded-xl font-medium hover:bg-[#64748B] hover:text-text-base transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onInativar}
          disabled={inativando}
          className="px-4 py-2 rounded-xl font-medium text-white bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] hover:opacity-90 shadow-lg shadow-[#3B82F6]/25 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <Archive className="w-4 h-4" />
          {inativando ? 'Inativando...' : 'Inativar associado'}
        </button>
      </div>
    </motion.div>
  </div>
);
