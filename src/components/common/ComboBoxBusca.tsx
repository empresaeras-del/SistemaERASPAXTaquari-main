import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';
import { contemTermo, normalizarTermo } from '../../utils/normalizarTexto';

export interface ComboBoxBuscaProps {
  /** Valor atualmente selecionado (o próprio rótulo, não um código). */
  value?: string;
  onChange: (valor: string) => void;
  /** Opções completas; a filtragem por termo é feita aqui dentro. */
  options: readonly string[];
  placeholder?: string;
  /** Texto de ajuda mostrado quando a busca não encontra nada. */
  emptyLabel?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Combobox com busca: um `<select>` nativo com 55 opções é impraticável de
 * percorrer, então este componente abre uma lista filtrável por digitação.
 *
 * Suporta teclado (setas, Enter, Escape), fecha ao clicar fora e permite
 * limpar a escolha — o campo que o usa é opcional.
 */
export const ComboBoxBusca: React.FC<ComboBoxBuscaProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  emptyLabel = 'Nenhum resultado',
  id,
  disabled,
  className = '',
}) => {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [destaque, setDestaque] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);
  const idGerado = useId();
  const listaId = `${id || idGerado}-lista`;

  const filtradas = useMemo(() => {
    if (!normalizarTermo(termo)) return [...options];
    return options.filter((o) => contemTermo(o, termo));
  }, [termo, options]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto]);

  // Ao abrir, foca a busca e posiciona o destaque no item já escolhido.
  useEffect(() => {
    if (!aberto) {
      setTermo('');
      return;
    }
    buscaRef.current?.focus();
    const atual = options.findIndex((o) => o === value);
    setDestaque(atual >= 0 ? atual : 0);
  }, [aberto, options, value]);

  // Mantém o item destacado visível ao navegar pelo teclado.
  useEffect(() => {
    if (!aberto) return;
    const el = listaRef.current?.children[destaque] as HTMLElement | undefined;
    // `scrollIntoView` não existe no jsdom nem em todo ambiente embarcado; a
    // rolagem é conveniência, não pode derrubar o componente onde faltar.
    if (typeof el?.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [destaque, aberto]);

  const escolher = (valor: string) => {
    onChange(valor);
    setAberto(false);
  };

  const aoTeclar = (e: React.KeyboardEvent) => {
    if (!aberto) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setAberto(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDestaque((d) => Math.min(d + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtradas[destaque]) escolher(filtradas[destaque]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAberto(false);
    }
  };

  const campoBase =
    'w-full px-4 py-3 bg-bg-surface border rounded-xl text-left transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:border-[#3B82F6]';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={aoTeclar}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        className={`${campoBase} ${
          aberto ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/50' : 'border-border-default'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-[#3B82F6]/40'}`}
      >
        <span className={`flex-1 truncate ${value ? 'text-text-base' : 'text-text-muted'}`}>
          {value || placeholder}
        </span>
        {value && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Limpar seleção"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="p-0.5 rounded-md text-text-subtle hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-text-subtle shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`}
        />
      </button>

      {aberto && (
        <div className="absolute z-50 mt-2 w-full bg-bg-surface border border-border-default rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-border-default">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle pointer-events-none" />
              <input
                ref={buscaRef}
                value={termo}
                onChange={(e) => {
                  setTermo(e.target.value);
                  setDestaque(0);
                }}
                onKeyDown={aoTeclar}
                placeholder="Buscar..."
                className="w-full pl-9 pr-3 py-2 bg-bg-base border border-border-default rounded-lg text-sm text-text-base placeholder:text-text-muted focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
          </div>

          <ul
            ref={listaRef}
            id={listaId}
            role="listbox"
            className="max-h-64 overflow-y-auto custom-scrollbar py-1"
          >
            {filtradas.length === 0 && (
              <li className="px-4 py-3 text-sm text-text-muted">{emptyLabel}</li>
            )}
            {filtradas.map((opcao, i) => {
              const selecionada = opcao === value;
              return (
                <li
                  key={opcao}
                  role="option"
                  aria-selected={selecionada}
                  onMouseEnter={() => setDestaque(i)}
                  onClick={() => escolher(opcao)}
                  className={`px-4 py-2 text-sm cursor-pointer flex items-center gap-2 transition-colors ${
                    i === destaque ? 'bg-[#3B82F6]/15 text-text-base' : 'text-text-subtle'
                  }`}
                >
                  <Check
                    className={`w-4 h-4 shrink-0 ${selecionada ? 'text-[#3B82F6]' : 'opacity-0'}`}
                  />
                  <span className="truncate">{opcao}</span>
                </li>
              );
            })}
          </ul>

          <div className="px-4 py-2 border-t border-border-default text-[11px] text-text-muted">
            {filtradas.length} de {options.length}
          </div>
        </div>
      )}
    </div>
  );
};
