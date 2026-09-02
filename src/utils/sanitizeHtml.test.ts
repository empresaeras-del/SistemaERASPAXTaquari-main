import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('preserva formatação comum produzida pelo editor (Jodit)', () => {
    const html = '<p style="color: red;"><strong>Associado:</strong> João da Silva</p><ul><li>Item 1</li></ul>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('remove tags <script>', () => {
    const result = sanitizeHtml('<p>Olá</p><script>alert(document.cookie)</script>');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Olá</p>');
  });

  it('remove handlers de evento inline (onerror, onclick, ...)', () => {
    const result = sanitizeHtml('<img src="x" onerror="fetch(\'https://evil.test\')" />');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('evil.test');
  });

  it('remove URLs javascript: em links', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">clique aqui</a>');
    expect(result.toLowerCase()).not.toContain('javascript:');
  });

  it('remove iframes e objetos embutidos', () => {
    const result = sanitizeHtml('<p>Texto</p><iframe src="https://evil.test"></iframe>');
    expect(result).not.toContain('<iframe');
  });

  it('mantém texto simples sem nenhuma tag perigosa intacto', () => {
    expect(sanitizeHtml('Documento sem conteúdo cadastrado.')).toBe('Documento sem conteúdo cadastrado.');
  });
});
