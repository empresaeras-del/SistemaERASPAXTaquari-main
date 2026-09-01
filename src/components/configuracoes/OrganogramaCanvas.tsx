import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { RotateCcw, ZoomIn, ZoomOut, Users, GitBranch } from 'lucide-react';

interface UsuarioCadastro {
  id: string;
  nome?: string;
  email?: string;
  nivel?: string;
  tenant_id?: string;
  status?: string;
}

interface NodePos {
  x: number;
  y: number;
}

interface OrganogramaCanvasProps {
  usuarios: UsuarioCadastro[];
  tenantId: string | null;
  isSuperAdmin?: boolean;
}

const NIVEL_ORDER = ['super_admin', 'admin', 'gerente', 'funcionario'] as const;

const NIVEL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; ring: string }> = {
  super_admin: { label: 'Super Admin', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: '#7C3AED', ring: '#7C3AED' },
  admin:       { label: 'Admin',       color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  border: '#2563EB', ring: '#3B82F6' },
  gerente:     { label: 'Gerente',     color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: '#D97706', ring: '#F59E0B' },
  funcionario: { label: 'Funcionário', color: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: '#059669', ring: '#10B981' },
};

const NODE_W = 180;
const NODE_H = 90;
const H_GAP = 40;
const V_GAP = 80;

function getInitials(nome?: string): string {
  if (!nome) return '?';
  const parts = nome.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function computeAutoLayout(grupos: Record<string, UsuarioCadastro[]>): Record<string, NodePos> {
  const positions: Record<string, NodePos> = {};
  let yOffset = 60;

  for (const nivel of NIVEL_ORDER) {
    const usrs = grupos[nivel] || [];
    if (usrs.length === 0) continue;
    const rowW = usrs.length * NODE_W + (usrs.length - 1) * H_GAP;
    const startX = Math.max(60, (1200 - rowW) / 2);
    usrs.forEach((u, i) => {
      positions[u.id] = { x: startX + i * (NODE_W + H_GAP), y: yOffset };
    });
    yOffset += NODE_H + V_GAP;
  }
  return positions;
}

function buildEdges(grupos: Record<string, UsuarioCadastro[]>): Array<{ fromId: string; toId: string }> {
  const edges: Array<{ fromId: string; toId: string }> = [];
  for (let li = 0; li < NIVEL_ORDER.length - 1; li++) {
    const parents = grupos[NIVEL_ORDER[li]] || [];
    const children = grupos[NIVEL_ORDER[li + 1]] || [];
    if (parents.length === 0 || children.length === 0) continue;
    children.forEach(child => {
      const parent = parents[0];
      edges.push({ fromId: parent.id, toId: child.id });
    });
  }
  return edges;
}

export const OrganogramaCanvas: React.FC<OrganogramaCanvasProps> = ({
  usuarios,
  tenantId,
  isSuperAdmin = false,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);

  const filteredUsuarios = useMemo(() => {
    return usuarios.filter(u => {
      if (!u) return false;
      if (isSuperAdmin && (!tenantId || tenantId === 'all')) return true;
      return u.tenant_id === tenantId;
    });
  }, [usuarios, tenantId, isSuperAdmin]);

  const grupos = useMemo(() => {
    return NIVEL_ORDER.reduce((acc, nivel) => {
      acc[nivel] = filteredUsuarios.filter(u => u.nivel === nivel);
      return acc;
    }, {} as Record<string, UsuarioCadastro[]>);
  }, [filteredUsuarios]);

  const edges = useMemo(() => buildEdges(grupos), [grupos]);

  const [positions, setPositions] = useState<Record<string, NodePos>>(() => computeAutoLayout(grupos));

  useEffect(() => {
    setPositions(computeAutoLayout(grupos));
  }, [filteredUsuarios.length]);

  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const draggingNode = useRef<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
    e.preventDefault();
  }, [viewport]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const pos = positions[id];
    if (!pos) return;
    const svgX = (e.clientX - viewport.x) / viewport.scale;
    const svgY = (e.clientY - viewport.y) / viewport.scale;
    draggingNode.current = id;
    dragOffset.current = { dx: svgX - pos.x, dy: svgY - pos.y };
  }, [positions, viewport]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      setViewport(v => ({ ...v, x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }));
      return;
    }
    if (draggingNode.current) {
      const id = draggingNode.current;
      const svgX = (e.clientX - viewport.x) / viewport.scale;
      const svgY = (e.clientY - viewport.y) / viewport.scale;
      setPositions(prev => ({
        ...prev,
        [id]: { x: svgX - dragOffset.current.dx, y: svgY - dragOffset.current.dy },
      }));
    }
  }, [viewport]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    draggingNode.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setViewport(v => ({
      ...v,
      scale: Math.min(2.5, Math.max(0.3, v.scale + delta * v.scale)),
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setPositions(computeAutoLayout(grupos));
    setViewport({ x: 0, y: 0, scale: 1 });
  }, [grupos]);

  const zoom = useCallback((factor: number) => {
    setViewport(v => ({
      ...v,
      scale: Math.min(2.5, Math.max(0.3, v.scale * factor)),
    }));
  }, []);

  const allPosValues = Object.values(positions);
  const canvasH = allPosValues.length ? Math.max(...allPosValues.map(p => p.y + NODE_H + V_GAP), 500) : 500;
  const canvasW = allPosValues.length ? Math.max(...allPosValues.map(p => p.x + NODE_W + H_GAP), 1200) : 1200;

  if (filteredUsuarios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-text-subtle gap-3">
        <Users className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">Nenhum usuário encontrado para esta empresa.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {NIVEL_ORDER.map(nivel => {
            const cfg = NIVEL_CONFIG[nivel];
            const count = (grupos[nivel] || []).length;
            if (count === 0) return null;
            return (
              <span
                key={nivel}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
                style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
              >
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: cfg.color }} />
                {cfg.label} ({count})
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => zoom(1.2)}
            className="p-1.5 rounded-lg bg-bg-subtle border border-border-default text-text-subtle hover:text-text-base transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => zoom(0.8)}
            className="p-1.5 rounded-lg bg-bg-subtle border border-border-default text-text-subtle hover:text-text-base transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-subtle border border-border-default text-text-subtle hover:text-text-base text-xs font-medium transition-colors"
            title="Resetar Layout"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resetar Layout
          </button>
          <span className="text-xs text-text-subtle bg-bg-subtle px-2 py-1 rounded-lg border border-border-default">
            {Math.round(viewport.scale * 100)}%
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative overflow-hidden rounded-2xl border border-border-default bg-[#06080F]"
        style={{ minHeight: 460, userSelect: 'none', cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Dot grid background */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <defs>
            <pattern
              id="org-dots"
              width={24}
              height={24}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${viewport.x % 24},${viewport.y % 24})`}
            >
              <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#org-dots)" />
        </svg>

        {/* Transformed world */}
        <div
          style={{
            transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: '0 0',
            position: 'absolute',
            width: canvasW,
            height: canvasH,
          }}
        >
          {/* SVG connectors */}
          <svg
            style={{ position: 'absolute', inset: 0, width: canvasW, height: canvasH, overflow: 'visible', pointerEvents: 'none' }}
          >
            <defs>
              <marker id="org-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="rgba(99,102,241,0.55)" />
              </marker>
            </defs>
            {edges.map(({ fromId, toId }, i) => {
              const from = positions[fromId];
              const to = positions[toId];
              if (!from || !to) return null;
              const x1 = from.x + NODE_W / 2;
              const y1 = from.y + NODE_H;
              const x2 = to.x + NODE_W / 2;
              const y2 = to.y;
              const mid = (y1 + y2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                  fill="none"
                  stroke="rgba(99,102,241,0.4)"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  markerEnd="url(#org-arrow)"
                />
              );
            })}
          </svg>

          {/* User nodes */}
          {filteredUsuarios.map(usuario => {
            const pos = positions[usuario.id];
            if (!pos) return null;
            const cfg = NIVEL_CONFIG[usuario.nivel || 'funcionario'] || NIVEL_CONFIG.funcionario;
            const initials = getInitials(usuario.nome);
            const isDragging = draggingNode.current === usuario.id;

            return (
              <div
                key={usuario.id}
                data-node="true"
                onMouseDown={(e) => handleNodeMouseDown(e, usuario.id)}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y,
                  width: NODE_W,
                  height: NODE_H,
                  cursor: 'grab',
                  zIndex: isDragging ? 100 : 1,
                  transition: isDragging ? 'none' : 'box-shadow 0.2s',
                }}
              >
                <div
                  className="w-full h-full rounded-2xl border flex items-center gap-3 px-3 py-2.5"
                  style={{
                    background: cfg.bg,
                    borderColor: isDragging ? cfg.ring : cfg.border,
                    boxShadow: isDragging
                      ? `0 0 0 2px ${cfg.ring}, 0 12px 40px rgba(0,0,0,0.6)`
                      : `0 2px 16px rgba(0,0,0,0.4)`,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-md"
                    style={{ background: `linear-gradient(135deg, ${cfg.border}, ${cfg.ring})`, color: '#fff', letterSpacing: '0.05em' }}
                  >
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="text-xs font-bold truncate leading-tight"
                      style={{ color: '#F1F5F9' }}
                      title={usuario.nome}
                    >
                      {usuario.nome || '—'}
                    </span>
                    <span
                      className="text-[10px] truncate leading-snug mt-0.5"
                      style={{ color: 'rgba(241,245,249,0.45)' }}
                      title={usuario.email}
                    >
                      {usuario.email || '—'}
                    </span>
                    <span
                      className="mt-1.5 self-start text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                      style={{
                        color: cfg.color,
                        background: 'rgba(0,0,0,0.35)',
                        borderColor: cfg.border,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom hint */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] text-text-subtle bg-[#06080F]/80 px-2.5 py-1.5 rounded-lg backdrop-blur-sm border border-border-default pointer-events-none">
          <GitBranch className="w-3 h-3 shrink-0" />
          Arraste nós • Scroll = zoom • Arraste o fundo = mover
        </div>

        {/* Count badge */}
        <div className="absolute top-3 right-3 text-[10px] text-text-subtle bg-[#06080F]/80 px-2.5 py-1.5 rounded-lg backdrop-blur-sm border border-border-default pointer-events-none">
          {filteredUsuarios.length} usuário{filteredUsuarios.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};
