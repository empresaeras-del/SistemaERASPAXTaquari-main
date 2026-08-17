/**
 * Gera um UUID v4 compatível com contextos seguros (HTTPS) e não-seguros (HTTP).
 * `crypto.randomUUID()` só funciona em `window.isSecureContext` (HTTPS).
 * Este utilitário usa `crypto.getRandomValues()` como fallback, que funciona em HTTP.
 */
export function generateUUID(): string {
  // Tenta usar crypto.randomUUID() em contextos seguros (HTTPS)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback para contextos HTTP
    }
  }

  // Fallback usando crypto.getRandomValues() – funciona em HTTP também
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Ajusta versão (v4) e variante (RFC 4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Último fallback (Math.random) – apenas se crypto não estiver disponível
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
