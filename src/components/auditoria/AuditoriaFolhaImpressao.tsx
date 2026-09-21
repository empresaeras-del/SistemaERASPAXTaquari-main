import React from 'react';
import { format } from 'date-fns';
import type { Empresa } from '../../services/empresasService';
import type { LinhaDoRelatorio, RotulosDeFiltro } from '../../utils/relatorioAuditoria';

interface Props {
  empresa: Empresa | null;
  rotulos: RotulosDeFiltro;
  linhas: LinhaDoRelatorio[];
}

/**
 * A folha A4 da pré-visualização.
 *
 * Ela **não decide nada**: os rótulos do cabeçalho e as linhas da tabela vêm prontos de
 * `utils/relatorioAuditoria.ts`, que é a mesma fonte do CSV e do PDF. Antes da extração cada
 * uma das três montava o próprio cabeçalho, e elas já discordavam — a folha dizia "Todos os
 * Usuários" onde o PDF dizia "Todos os Operadores".
 *
 * O emitente cai para o nome padrão do sistema quando a empresa não carregou: menos
 * informação é melhor que um documento afirmando ter sido emitido por quem não o emitiu.
 */
export const AuditoriaFolhaImpressao: React.FC<Props> = ({ empresa, rotulos, linhas }) => (
  <div className="bg-white text-slate-900 border border-slate-300 rounded-2xl p-6 sm:p-10 shadow-lg space-y-6">
    {/* Printable Header */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b-2 border-slate-800">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
          {empresa?.nome_fantasia || empresa?.razao_social || 'PAX e Funerária Taquari'}
        </h1>
        <p className="text-xs text-slate-600 font-medium mt-0.5">
          {empresa?.cnpj ? `CNPJ: ${empresa.cnpj} ` : ''}
          {empresa?.telefone ? ` • Tel: ${empresa.telefone}` : ''}
        </p>
      </div>
      <div className="text-left sm:text-right">
        <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded">
          Relatório de Auditoria
        </span>
        <p className="text-[11px] text-slate-500 font-mono mt-1">
          Emissão: {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
        </p>
      </div>
    </div>

    {/* Printable Filter Badges */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
      <div>
        <span className="text-[10px] font-bold uppercase text-slate-500 block">Período</span>
        <span className="font-semibold text-slate-800">
          {rotulos.periodo}
        </span>
      </div>
      <div>
        <span className="text-[10px] font-bold uppercase text-slate-500 block">Módulo</span>
        <span className="font-semibold text-slate-800">
          {rotulos.modulo}
        </span>
      </div>
      <div>
        <span className="text-[10px] font-bold uppercase text-slate-500 block">Operador / Usuário</span>
        <span className="font-semibold text-slate-800">
          {rotulos.operador}
        </span>
      </div>
      <div>
        <span className="text-[10px] font-bold uppercase text-slate-500 block">Total de Ocorrências</span>
        <span className="font-bold text-slate-900">{linhas.length} eventos listados</span>
      </div>
    </div>

    {/* Printable Table */}
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse border border-slate-300">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="p-2.5 border border-slate-400 font-bold w-8 text-center">#</th>
            <th className="p-2.5 border border-slate-400 font-bold w-28">Data / Hora</th>
            <th className="p-2.5 border border-slate-400 font-bold w-36">Módulo / Categoria</th>
            <th className="p-2.5 border border-slate-400 font-bold w-48">Ação / Evento</th>
            <th className="p-2.5 border border-slate-400 font-bold w-44">Responsável</th>
            <th className="p-2.5 border border-slate-400 font-bold">Detalhes / Dados</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, idx) => (
            <tr key={linha.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="p-2 border border-slate-300 text-center font-mono text-slate-500">{linha.indice}</td>
              <td className="p-2 border border-slate-300 font-mono whitespace-nowrap text-slate-700">
                {linha.dataHora}
              </td>
              <td className="p-2 border border-slate-300 font-medium text-slate-700">
                {linha.categoria}
              </td>
              <td className="p-2 border border-slate-300 font-bold text-slate-900">
                {linha.acao}
              </td>
              <td className="p-2 border border-slate-300 text-slate-700">
                <div className="font-semibold">{linha.operadorNome}</div>
                <div className="text-[10px] text-slate-500">{linha.operadorPapel} • {linha.operadorEmail}</div>
              </td>
              <td className="p-2 border border-slate-300 text-slate-700 text-[11px] leading-relaxed">
                {linha.detalhes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="pt-6 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
      <span>Sistema ERAS - Software de Gestão Funerária e Planos PAX</span>
      <span>Documento emitido eletronicamente para fins de auditoria interna</span>
    </div>
  </div>
);
