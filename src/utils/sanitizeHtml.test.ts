import { describe, it, expect } from 'vitest';
import { sanitizeDocumentoHtml } from './sanitizeHtml';

describe('sanitizeDocumentoHtml', () => {
  it('remove tags <script>', () => {
    const out = sanitizeDocumentoHtml('<p>Olá {{associado_nome}}</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('{{associado_nome}}');
  });

  it('remove handler onerror de imagens', () => {
    const out = sanitizeDocumentoHtml('<img src="x" onerror="alert(2)">');
    expect(out).not.toContain('onerror');
  });

  it('remove URIs javascript: de links', () => {
    const out = sanitizeDocumentoHtml('<a href="javascript:alert(3)">clique</a>');
    expect(out).not.toContain('javascript:');
  });

  it('remove handler onclick', () => {
    const out = sanitizeDocumentoHtml('<div onclick="malicious()">texto</div>');
    expect(out).not.toContain('onclick');
  });

  it('preserva tabelas, estilo inline e classes usadas pelo CSS de impressão', () => {
    const out = sanitizeDocumentoHtml('<table class="tabela-zebrada" style="width:100%"><tr><td style="color:red">Valor</td></tr></table>');
    expect(out).toContain('<table');
    expect(out).toContain('class="tabela-zebrada"');
    expect(out).toMatch(/style="color:\s?red"/);
  });

  it('preserva imagens em data: URI (upload de logo/assinatura)', () => {
    const out = sanitizeDocumentoHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="assinatura">');
    expect(out).toContain('data:image/png');
  });
});
