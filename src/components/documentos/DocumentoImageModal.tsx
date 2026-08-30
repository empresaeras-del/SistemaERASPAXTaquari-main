import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Upload, Link, Building2, Check, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { Empresa } from '../../services/empresasService';
import toast from 'react-hot-toast';

export interface DocumentoImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertImage: (html: string) => void;
  empresaData?: Empresa | null;
  empresas?: Empresa[];
}

export const DocumentoImageModal: React.FC<DocumentoImageModalProps> = ({
  isOpen,
  onClose,
  onInsertImage,
  empresaData,
  empresas = []
}) => {
  const [tab, setTab] = useState<'upload' | 'url' | 'empresa'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState<'80px' | '150px' | '280px' | '480px' | '100%'>('280px');
  const [maxHeightHeader, setMaxHeightHeader] = useState(false);
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [altText, setAltText] = useState('Imagem do documento');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setImageUrl(base64);
      setAltText(file.name.replace(/\.[^/.]+$/, ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSelectEmpresaLogo = (emp: Empresa) => {
    if (emp.logo_url) {
      setImagePreview(emp.logo_url);
      setImageUrl(emp.logo_url);
      setAltText(`Logomarca - ${emp.nome_fantasia || emp.razao_social}`);
    } else {
      toast.error('Esta empresa não possui logomarca cadastrada.');
    }
  };

  const handleInsert = () => {
    if (!imageUrl) {
      toast.error('Selecione ou informe uma imagem primeiro.');
      return;
    }

    let style = '';
    if (maxHeightHeader) {
      style = `max-height: 85px; max-width: 100%; object-fit: contain; display: inline-block;`;
    } else if (imageWidth === '100%') {
      style = `width: 100%; height: auto; object-fit: contain; display: block; margin: 10px 0;`;
    } else {
      style = `width: ${imageWidth}; max-width: 100%; height: auto; object-fit: contain; display: inline-block; margin: 8px 0;`;
    }

    let alignStyle = '';
    if (alignment === 'center') {
      alignStyle = 'text-align: center;';
    } else if (alignment === 'right') {
      alignStyle = 'text-align: right;';
    } else {
      alignStyle = 'text-align: left;';
    }

    const html = `
      <div style="${alignStyle} margin: 10px 0;">
        <img src="${imageUrl}" alt="${altText}" style="${style}" />
      </div>
      <p><br/></p>
    `;

    onInsertImage(html);
    toast.success('Imagem inserida com sucesso!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#181d27] border border-[#2d3544] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-[#2d3544] flex items-center justify-between bg-[#13171f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Inserir Imagem no Documento</h3>
              <p className="text-xs text-slate-400 mt-0.5">Faça upload, use link ou selecione logomarcas da empresa</p>
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

        {/* Tabs */}
        <div className="flex border-b border-[#2d3544] bg-[#13171f] px-5 gap-4">
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              tab === 'upload'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload do Computador
          </button>

          <button
            type="button"
            onClick={() => setTab('empresa')}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              tab === 'empresa'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Logomarca da Empresa
          </button>

          <button
            type="button"
            onClick={() => setTab('url')}
            className={`py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              tab === 'url'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            Link / URL da Imagem
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar text-white flex-1">
          
          {/* Tab 1: Upload */}
          {tab === 'upload' && (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#2d3544] hover:border-emerald-500/60 rounded-2xl p-6 text-center cursor-pointer transition-all bg-[#13171f] hover:bg-[#191f2b] flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-white">Clique para selecionar uma imagem do computador</p>
                <p className="text-xs text-slate-400">Suporta PNG, JPG, JPEG, WebP e SVG (máx. 5MB)</p>
              </div>
            </div>
          )}

          {/* Tab 2: Empresa Logo */}
          {tab === 'empresa' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Selecione uma logomarca cadastrada no sistema para inserir no documento:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {empresas.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectEmpresaLogo(emp)}
                    className="p-3 bg-[#13171f] hover:bg-[#1f2634] border border-[#2d3544] hover:border-emerald-500 rounded-2xl text-left transition-all flex items-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {emp.logo_url ? (
                        <img src={emp.logo_url} alt={emp.nome_fantasia} className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Building2 className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{emp.nome_fantasia || emp.razao_social}</p>
                      <p className="text-[10px] text-slate-400">{emp.logo_url ? 'Logomarca disponível' : 'Sem logo cadastrada'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: URL */}
          {tab === 'url' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">URL Direta da Imagem</label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImagePreview(e.target.value);
                }}
                placeholder="https://exemplo.com/imagem.png"
                className="w-full bg-[#13171f] border border-[#2d3544] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Preview da Imagem Selecionada */}
          {imagePreview && (
            <div className="bg-[#13171f] p-4 rounded-2xl border border-[#2d3544] space-y-4">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Pré-visualização e Ajustes de Exibição
              </span>

              <div className="max-h-40 bg-white/5 rounded-xl border border-white/10 p-3 flex items-center justify-center overflow-hidden">
                <img src={imagePreview} alt="Preview" className="max-h-36 max-w-full object-contain rounded" />
              </div>

              {/* Tamanho */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Largura da Imagem</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: '80px', label: 'Ícone (80px)' },
                    { id: '150px', label: 'Pequena (150px)' },
                    { id: '280px', label: 'Média (280px)' },
                    { id: '480px', label: 'Grande (480px)' },
                    { id: '100%', label: '100% Total' },
                  ].map((sz) => (
                    <button
                      key={sz.id}
                      type="button"
                      onClick={() => {
                        setImageWidth(sz.id as any);
                        setMaxHeightHeader(false);
                      }}
                      className={`p-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                        imageWidth === sz.id && !maxHeightHeader
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-[#181d27] border-[#2d3544] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opção para Cabeçalho */}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={maxHeightHeader}
                  onChange={(e) => setMaxHeightHeader(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                Formatar como Logomarca de Cabeçalho (altura máx. 85px proporcional)
              </label>

              {/* Alinhamento */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Alinhamento</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAlignment('left')}
                    className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      alignment === 'left'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#181d27] border-[#2d3544] text-slate-300'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" /> Esquerda
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlignment('center')}
                    className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      alignment === 'center'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#181d27] border-[#2d3544] text-slate-300'
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" /> Centro
                  </button>

                  <button
                    type="button"
                    onClick={() => setAlignment('right')}
                    className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      alignment === 'right'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-[#181d27] border-[#2d3544] text-slate-300'
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" /> Direita
                  </button>
                </div>
              </div>
            </div>
          )}
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
            disabled={!imageUrl}
            onClick={handleInsert}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Inserir Imagem
          </button>
        </div>
      </div>
    </div>
  );
};
