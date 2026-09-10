import '@testing-library/jest-dom/vitest';

/**
 * jsdom não implementa ResizeObserver, e componentes que medem a própria folha para
 * paginar (`VisualizadorDocumentoPadraoModal`) quebram no mount sem ele. O stub não
 * observa nada: os testes que dependem de medida real precisam de navegador de verdade
 * (ver "Conferindo a impressão de verdade" no CLAUDE.md), não deste ambiente.
 */
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}
