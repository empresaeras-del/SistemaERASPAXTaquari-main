import React, { useState } from 'react';
import { ArrowRight, AlertTriangle, FileCode, Copy, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatKeyName, calcularCamposAlterados, valorDoDiffParaTexto } from '../../utils/auditoriaHelpers';
import { mascararValorDeCampo } from '../../utils/mascaraDocumento';

/**
 * O painel de detalhes de uma linha da Ata de Ocorrências: o diff de campos, os campos
 * avulsos, a justificativa e o JSON bruto.
 *
 * Extraído de `pages/Auditoria.tsx` **sem reescrita** — as três funções abaixo são as mesmas,
 * relocadas. O que muda é só o que a página precisa saber: ela monta o layout e passa dados.
 *
 * Duas regras deste arquivo, ambas já documentadas no CLAUDE.md:
 *
 * - **`formatValueDisplay` é gêmea de `valorDoDiffParaTexto`** (texto/CSV/PDF): as duas
 *   mascaram CPF/CNPJ pela mesma função, senão a tela e o relatório mostram coisas
 *   diferentes para o mesmo log — inclusive no `title` do tooltip, que é por onde o número
 *   voltaria inteiro sem ninguém notar.
 * - **O "Ver JSON bruto" e o "Copiar dados" mostram o payload SEM máscara**, de propósito: é
 *   o que eles existem para fazer, e não entram em relatório nenhum.
 */

// Format value nicely in UI
const formatValueDisplay = (key: string, val: any): React.ReactNode => {
  if (val === null || val === undefined) return <span className="text-text-subtle italic">Não informado</span>;
  // Gêmeo de `formatValorParaTexto` (texto/CSV/PDF): os dois precisam mascarar CPF/CNPJ, senão
  // a tela e o relatório mostram coisas diferentes para o mesmo log.
  val = mascararValorDeCampo(key, val);
  if (typeof val === 'boolean') {
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${val ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}`}>
        {val ? 'SIM' : 'NÃO'}
      </span>
    );
  }
  if (typeof val === 'number') {
    if (key.toLowerCase().includes('valor')) {
      return (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
        </span>
      );
    }
    return <span className="font-semibold text-text-base font-mono">{val.toLocaleString('pt-BR')}</span>;
  }
  if (typeof val === 'object') {
    return <span className="font-mono text-xs text-text-muted">{JSON.stringify(val)}</span>;
  }

  // Strings
  const str = String(val);
  if ((key.toLowerCase().includes('id') || key.toLowerCase().includes('codigo')) && str.length > 20) {
    return <span className="font-mono text-xs bg-bg-hover px-2 py-0.5 rounded border border-border-default text-text-muted">{str}</span>;
  }

  return <span className="text-text-base font-medium break-all">{str}</span>;
};

// Diff Component
const DiffViewer: React.FC<{ oldData: any; newData: any }> = ({ oldData, newData }) => {
  if (!oldData && !newData) return null;
  
  const changes = calcularCamposAlterados(oldData, newData);

  if (changes.length === 0) {
    return (
      <div className="text-xs text-text-subtle italic py-1">
        Nenhuma alteração direta nos campos detectada.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 pb-1.5 border-b border-border-default">
        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-text-subtle">Campos Modificados</span>
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 font-semibold">
          {changes.length} {changes.length === 1 ? 'campo' : 'campos'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {changes.map((change, i) => (
          <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 text-xs bg-bg-surface/80 p-2.5 rounded-xl border border-border-default/80 hover:border-blue-500/30 transition-colors">
            <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold min-w-[140px] shrink-0">
              {formatKeyName(change?.key || '')}:
            </span>
            <div className="flex items-center gap-2 flex-1 overflow-hidden flex-wrap sm:flex-nowrap">
              {/*
                O valor passa por `valorDoDiffParaTexto`, a mesma função que o texto/CSV/PDF
                usa — inclusive no `title`, senão o CPF voltaria inteiro no tooltip. Ver
                `utils/mascaraDocumento.ts`.
              */}
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg line-through truncate max-w-full sm:max-w-[45%]" title={valorDoDiffParaTexto(change?.key || '', change?.oldVal)}>
                {valorDoDiffParaTexto(change?.key || '', change?.oldVal)}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-text-subtle shrink-0" />
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium px-2.5 py-1 rounded-lg truncate max-w-full sm:max-w-[45%]" title={valorDoDiffParaTexto(change?.key || '', change?.newVal)}>
                {valorDoDiffParaTexto(change?.key || '', change?.newVal)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Details Card Component
const LogDetailsViewer: React.FC<{ detalhes: any; acao: string }> = ({ detalhes }) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!detalhes || (typeof detalhes === 'object' && Object.keys(detalhes).length === 0)) {
    return null;
  }

  const isDiff = detalhes.dados_anteriores || detalhes.dados_novos;
  const isObject = typeof detalhes === 'object' && !Array.isArray(detalhes);

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(detalhes, null, 2));
    setCopied(true);
    toast.success('Detalhes copiados em JSON!');
    setTimeout(() => setCopied(false), 2000);
  };

  const calloutText = detalhes.justificativa || detalhes.motivo || detalhes.observacao;

  const standardKeys = isObject
    ? Object.keys(detalhes).filter(
        k => !['dados_anteriores', 'dados_novos', 'justificativa', 'motivo', 'observacao', 'usuario', 'usuario_email'].includes(k)
      )
    : [];

  return (
    <div className="mt-3 bg-bg-base/70 rounded-xl p-3.5 border border-border-default/60 space-y-3">
      {isDiff ? (
        <DiffViewer oldData={detalhes.dados_anteriores} newData={detalhes.dados_novos} />
      ) : (
        <>
          {standardKeys.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {standardKeys.map(k => (
                <div 
                  key={k} 
                  className="bg-bg-surface/90 p-2.5 rounded-lg border border-border-default/60 flex flex-col justify-between hover:border-border-default transition-colors"
                >
                  <span className="text-[11px] font-semibold tracking-wider text-text-subtle uppercase truncate mb-1">
                    {formatKeyName(k)}
                  </span>
                  <div className="text-xs truncate">
                    {formatValueDisplay(k, detalhes[k])}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {calloutText && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold uppercase tracking-wider text-[10px] block text-amber-800 dark:text-amber-200 mb-0.5">
              Justificativa / Observação:
            </span>
            <p className="italic">{calloutText}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border-default/40">
        <button
          type="button"
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-text-subtle hover:text-text-base transition-colors px-2 py-1 rounded hover:bg-bg-hover"
        >
          <FileCode className="w-3.5 h-3.5 text-text-subtle" />
          <span>{showRawJson ? 'Ocultar JSON bruto' : 'Ver JSON bruto'}</span>
          {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={handleCopyJson}
          className="flex items-center gap-1.5 text-[11px] font-medium text-text-subtle hover:text-text-base transition-colors px-2 py-1 rounded hover:bg-bg-hover"
          title="Copiar JSON para a área de transferência"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-500">Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copiar dados</span>
            </>
          )}
        </button>
      </div>

      {showRawJson && (
        <div className="relative mt-2">
          <pre className="text-[11px] leading-relaxed text-emerald-500 dark:text-emerald-400 font-mono bg-bg-surface p-3 rounded-lg border border-border-default overflow-x-auto max-h-56">
            {JSON.stringify(detalhes, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export { LogDetailsViewer, DiffViewer, formatValueDisplay };
