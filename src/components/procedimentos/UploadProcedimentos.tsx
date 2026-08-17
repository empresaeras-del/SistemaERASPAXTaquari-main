import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle2, AlertCircle, Trash2, Save, Download, ArrowRight, Settings2 } from 'lucide-react';
import { useProcedimentos } from '../../hooks/useProcedimentos';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';

interface CsvRow {
  codigo_tuss: string;
  descricao: string;
  tipo_procedimento: string;
  valor_padrao: string;
  coparticipacao?: string;
}

interface ParsedData extends CsvRow {
  _status: 'valid' | 'invalid';
  _errors: string[];
}

interface ColumnMapping {
  codigo_tuss: string;
  descricao: string;
  tipo_procedimento: string;
  valor_padrao: string;
  coparticipacao: string;
}

export const UploadProcedimentos = () => {
  const [data, setData] = useState<ParsedData[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [isMapping, setIsMapping] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>({
    codigo_tuss: '',
    descricao: '',
    tipo_procedimento: '',
    valor_padrao: '',
    coparticipacao: ''
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { criar } = useProcedimentos();
  const { state: { empresaSelecionada, isOnline } } = useAppContext();
  const toast = useToast();

  const handleFileUpload = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields && results.meta.fields.length > 0) {
          const headers = results.meta.fields;
          setRawHeaders(headers);
          setRawData(results.data);
          
          // Auto-map if possible
          setMapping({
            codigo_tuss: headers.find(h => /codigo|tuss|cod/i.test(h)) || '',
            descricao: headers.find(h => /descri|nome|procedimento/i.test(h)) || '',
            tipo_procedimento: headers.find(h => /tipo|categoria|grupo/i.test(h)) || '',
            valor_padrao: headers.find(h => /valor|preco|custo/i.test(h)) || '',
            coparticipacao: headers.find(h => /copart/i.test(h)) || ''
          });
          
          setIsMapping(true);
          setData([]);
        } else {
          toast.error('Arquivo CSV inválido ou sem cabeçalhos.');
        }
      },
      error: (error: any) => {
        toast.error(`Erro ao ler arquivo: ${error.message}`);
      }
    });
  };

  const processMappedData = () => {
    // Validate mapping
    if (!mapping.codigo_tuss || !mapping.descricao || !mapping.tipo_procedimento || !mapping.valor_padrao) {
      toast.error("Por favor, mapeie todos os campos obrigatórios.");
      return;
    }

    const parsedRows: ParsedData[] = rawData.map((row: any) => {
      const errors: string[] = [];
      
      const codigo_tuss = String(row[mapping.codigo_tuss] || '');
      const descricao = String(row[mapping.descricao] || '');
      const tipo_procedimento = String(row[mapping.tipo_procedimento] || '');
      const rawValor = String(row[mapping.valor_padrao] || '');

      if (!codigo_tuss.trim()) errors.push('Código TUSS ausente');
      if (!descricao.trim()) errors.push('Descrição ausente');
      if (!tipo_procedimento.trim()) errors.push('Tipo ausente');
      
      let valor = 0;
      if (rawValor.trim()) {
        const parsed = parseFloat(rawValor.replace(/[R$\s]/g, '').replace(',', '.'));
        if (isNaN(parsed)) errors.push('Valor padrão inválido');
        else valor = parsed;
      } else {
        errors.push('Valor padrão ausente');
      }

      return {
        codigo_tuss: codigo_tuss.trim(),
        descricao: descricao.trim(),
        tipo_procedimento: tipo_procedimento.trim(),
        valor_padrao: rawValor,
        _status: errors.length === 0 ? 'valid' : 'invalid',
        _errors: errors
      };
    });
    
    setData(parsedRows);
    setIsMapping(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleSalvar = async () => {
    if (!empresaSelecionada) {
      toast.error('Nenhuma empresa selecionada.');
      return;
    }
    
    const validRows = data.filter(r => r._status === 'valid');
    if (validRows.length === 0) {
      toast.error('Nenhum dado válido para salvar.');
      return;
    }

    setIsProcessing(true);
    try {
      for (const row of validRows) {
        let valorPadraoFormatado = parseFloat(row.valor_padrao.replace(/[R$\s]/g, '').replace(',', '.'));
        await criar({
          codigo_tuss: row.codigo_tuss,
          descricao: row.descricao,
          tipo_procedimento: row.tipo_procedimento,
          valor_padrao: valorPadraoFormatado,
          ativo: true,
          empresa_id: empresaSelecionada
        });
      }
      toast.success(`${validRows.length} procedimentos cadastrados com sucesso!`);
      setData([]);
      setRawData([]);
      setRawHeaders([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar procedimentos.');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "codigo_tuss,descricao,tipo_procedimento,valor_padrao,coparticipacao\n10101012,Consulta em consultório,Consulta,150.00,0.00\n20101015,Curativo simples,Procedimento,45.50,10.00\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_procedimentos.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validCount = data.filter(r => r._status === 'valid').length;
  const invalidCount = data.filter(r => r._status === 'invalid').length;

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="bg-bg-subtle border border-border-default rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-text-base">Importação em Massa</h3>
            <p className="text-text-subtle text-sm mt-1">
              Faça upload de um arquivo CSV contendo os procedimentos a serem cadastrados.
            </p>
          </div>
          <button 
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-bg-hover border border-[#64748B] text-text-muted hover:text-text-base hover:bg-[#64748B] rounded-xl font-medium transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            Baixar Modelo CSV
          </button>
        </div>

        {!isMapping && data.length === 0 && (
          <div 
            className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
              isDragging 
                ? 'border-[#3B82F6] bg-[#3B82F6]/10' 
                : 'border-border-default hover:border-[#60A5FA] hover:bg-bg-surface/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept=".csv"
              onChange={handleFileSelect}
            />
            <div className="w-16 h-16 rounded-full bg-bg-surface border border-border-default flex items-center justify-center mb-4 text-[#3B82F6]">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-text-base font-medium mb-1">
              Clique para selecionar ou arraste um arquivo CSV
            </p>
            <p className="text-text-subtle text-sm">
              Mapeamento de colunas será feito na próxima etapa.
            </p>
          </div>
        )}
      </div>

      {isMapping && (
        <div className="bg-bg-subtle border border-border-default rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-border-default pb-4">
            <Settings2 className="w-5 h-5 text-[#3B82F6]" />
            <div>
              <h3 className="font-semibold text-text-base">Mapeamento de Colunas</h3>
              <p className="text-sm text-text-subtle">Vincule as colunas do seu arquivo aos campos do sistema.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-muted">Código TUSS <span className="text-rose-400">*</span></label>
              <select 
                value={mapping.codigo_tuss}
                onChange={e => setMapping({...mapping, codigo_tuss: e.target.value})}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] outline-none"
              >
                <option value="">Selecione a coluna...</option>
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-muted">Descrição <span className="text-rose-400">*</span></label>
              <select 
                value={mapping.descricao}
                onChange={e => setMapping({...mapping, descricao: e.target.value})}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] outline-none"
              >
                <option value="">Selecione a coluna...</option>
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-muted">Tipo Procedimento <span className="text-rose-400">*</span></label>
              <select 
                value={mapping.tipo_procedimento}
                onChange={e => setMapping({...mapping, tipo_procedimento: e.target.value})}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] outline-none"
              >
                <option value="">Selecione a coluna...</option>
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-muted">Valor Padrão <span className="text-rose-400">*</span></label>
              <select 
                value={mapping.valor_padrao}
                onChange={e => setMapping({...mapping, valor_padrao: e.target.value})}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] outline-none"
              >
                <option value="">Selecione a coluna...</option>
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-muted">Co-participação</label>
              <select 
                value={mapping.coparticipacao || ''}
                onChange={e => setMapping({...mapping, coparticipacao: e.target.value})}
                className="w-full bg-bg-surface border border-border-default rounded-xl px-4 py-2.5 text-text-base focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6] outline-none"
              >
                <option value="">(Opcional) Selecione a coluna...</option>
                {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
             <button 
                onClick={() => {
                  setIsMapping(false);
                  setRawData([]);
                  setRawHeaders([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 bg-bg-hover text-text-muted hover:text-text-base hover:bg-[#64748B] rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={processMappedData}
                disabled={!mapping.codigo_tuss || !mapping.descricao || !mapping.tipo_procedimento || !mapping.valor_padrao}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Processar Arquivo
                <ArrowRight className="w-4 h-4" />
              </button>
          </div>
        </div>
      )}

      {data.length > 0 && !isMapping && (
        <div className="bg-bg-subtle border border-border-default rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-border-default bg-bg-surface/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold text-text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-text-subtle" />
                Pré-visualização dos Dados
              </h3>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> {validCount} Válidos
                </span>
                <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                  <AlertCircle className="w-4 h-4" /> {invalidCount} Inválidos
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setIsMapping(true);
                  setData([]);
                }}
                className="px-4 py-2 text-sm bg-bg-hover hover:bg-[#64748B] text-text-muted hover:text-text-base rounded-xl transition-colors border border-[#64748B]"
              >
                Ajustar Mapeamento
              </button>
              <button 
                onClick={() => {
                  setData([]);
                  setRawData([]);
                  setRawHeaders([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-2 text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Limpar Arquivo"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleSalvar}
                disabled={!isOnline || validCount === 0 || isProcessing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-[#3B82F6]/25"
              >
                {isProcessing ? (
                  <span className="animate-pulse">Salvando...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar {validCount} Registros
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar relative">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-bg-surface sticky top-0 z-10 border-b border-border-default">
                <tr>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider whitespace-nowrap">Código TUSS</th>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider whitespace-nowrap">Descrição</th>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider whitespace-nowrap">Tipo</th>
                  <th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider whitespace-nowrap">Valor Padrão</th>
<th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider whitespace-nowrap">Co-part.</th>
<th className="px-4 py-3 font-semibold text-text-subtle uppercase tracking-wider whitespace-nowrap">Total Assoc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#475569]">
                {data.map((row, idx) => (
                  <tr key={idx} className={`hover:bg-bg-surface/50 transition-colors ${row._status === 'invalid' ? 'bg-rose-950/20' : ''}`}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row._status === 'valid' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Válido
                        </span>
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 cursor-help"
                          title={row._errors.join(', ')}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          Inválido
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono">{row.codigo_tuss}</td>
                    <td className="px-4 py-3 min-w-[200px]">{row.descricao}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-bg-hover text-text-muted rounded-lg text-xs font-medium border border-[#64748B]">
                        {row.tipo_procedimento}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      R$ {row.valor_padrao}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-amber-500">
                      R$ {row.coparticipacao || '0.00'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-emerald-400 font-medium">
                      R$ {(parseFloat(row.valor_padrao?.replace(',', '.') || '0') + parseFloat(row.coparticipacao?.replace(',', '.') || '0')).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
