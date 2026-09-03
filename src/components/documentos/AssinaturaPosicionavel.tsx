import React, { useCallback, useRef, useState } from 'react';

export interface AssinaturaPosicionavelProps {
  /** Container de referência (a folha A4) — a posição é relativa a ele. */
  containerRef: React.RefObject<HTMLElement | null>;
  assinaturaUrl?: string | null;
  nomeEmpresa?: string;
  cnpjEmpresa?: string;
  /** Posição em % da largura/altura do container. null = ainda não posicionado. */
  x: number | null | undefined;
  y: number | null | undefined;
  editable: boolean;
  onPositionChange?: (x: number, y: number) => void;
}

const DEFAULT_X = 50;
const DEFAULT_Y = 88;
const SNAP_THRESHOLD = 1.5;

/**
 * Converte a posição do ponteiro (em pixels, relativa ao retângulo da folha)
 * para % da largura/altura, com a assinatura sempre a pelo menos 2% de
 * qualquer borda e "imantada" ao centro (linha guia) quando perto dele.
 */
export const calcularPosicaoArrastada = (
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): { x: number; y: number; snapX: boolean; snapY: boolean } => {
  let x = ((clientX - rect.left) / rect.width) * 100;
  let y = ((clientY - rect.top) / rect.height) * 100;
  x = Math.min(98, Math.max(2, x));
  y = Math.min(98, Math.max(2, y));

  const snapX = Math.abs(x - 50) < SNAP_THRESHOLD;
  const snapY = Math.abs(y - 50) < SNAP_THRESHOLD;
  if (snapX) x = 50;
  if (snapY) y = 50;

  return { x, y, snapX, snapY };
};

/**
 * Bloco de assinatura da empresa posicionável por drag-and-drop sobre a
 * folha A4 do editor de documentos padrão. Em modo não editável (impressão
 * e pré-visualização final), só desenha na posição salva — sem handlers de
 * mouse.
 */
export const AssinaturaPosicionavel: React.FC<AssinaturaPosicionavelProps> = ({
  containerRef,
  assinaturaUrl,
  nomeEmpresa,
  cnpjEmpresa,
  x,
  y,
  editable,
  onPositionChange,
}) => {
  const [dragging, setDragging] = useState(false);
  const [showGuideX, setShowGuideX] = useState(false);
  const [showGuideY, setShowGuideY] = useState(false);
  const posRef = useRef({ x: x ?? DEFAULT_X, y: y ?? DEFAULT_Y });

  const posX = x ?? DEFAULT_X;
  const posY = y ?? DEFAULT_Y;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    posRef.current = { x: posX, y: posY };

    const rect = container.getBoundingClientRect();

    const handleMove = (moveEvent: PointerEvent) => {
      const { x: nx, y: ny, snapX, snapY } = calcularPosicaoArrastada(moveEvent.clientX, moveEvent.clientY, rect);
      setShowGuideX(snapX);
      setShowGuideY(snapY);
      posRef.current = { x: nx, y: ny };
      onPositionChange?.(nx, ny);
    };

    const handleUp = () => {
      setDragging(false);
      setShowGuideX(false);
      setShowGuideY(false);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [editable, containerRef, posX, posY, onPositionChange]);

  return (
    <>
      {editable && showGuideX && (
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-blue-500/70 pointer-events-none z-40" />
      )}
      {editable && showGuideY && (
        <div className="absolute left-0 right-0 top-1/2 h-px bg-blue-500/70 pointer-events-none z-40" />
      )}
      <div
        role={editable ? 'button' : undefined}
        aria-label={editable ? 'Arraste para posicionar a assinatura' : undefined}
        onPointerDown={handlePointerDown}
        className={`absolute flex flex-col items-center text-center select-none ${
          editable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
        } ${dragging ? 'z-50 opacity-90' : 'z-10'}`}
        style={{
          left: `${posX}%`,
          top: `${posY}%`,
          transform: 'translate(-50%, -50%)',
          transition: dragging ? 'none' : 'box-shadow 0.15s ease',
        }}
      >
        <div
          className={editable ? `rounded-lg ${dragging ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-blue-400/60 hover:ring-offset-2'} transition-shadow` : ''}
        >
          {assinaturaUrl && (
            <div className="mb-2 flex justify-center">
              <img
                src={assinaturaUrl}
                alt="Assinatura da empresa"
                draggable={false}
                style={{ maxHeight: '70px', maxWidth: '260px', objectFit: 'contain' }}
              />
            </div>
          )}
          <div className="w-72 border-t border-slate-900 my-1" />
          <p className="text-xs font-bold text-slate-900 uppercase">
            {nomeEmpresa || 'Assinatura Autorizada'}
          </p>
          {cnpjEmpresa && <p className="text-[10px] text-slate-600">CNPJ: {cnpjEmpresa}</p>}
        </div>
      </div>
    </>
  );
};
