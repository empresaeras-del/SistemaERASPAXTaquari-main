import { describe, it, expect } from 'vitest';
import {
  enxugarDetalhesAuditoria,
  descreverAnexo,
  ehDataUri,
  impressaoDigital,
  formatarTamanho,
  LIMITE_STRING_DETALHE,
  LIMITE_TOTAL_DETALHES,
} from './detalhesAuditoria';
import { calcularCamposAlterados } from './auditoriaHelpers';

const pdfFalso = (conteudo: string, tamanho: number) =>
  'data:application/pdf;base64,' + conteudo.repeat(Math.ceil(tamanho / conteudo.length)).slice(0, tamanho);

describe('ehDataUri', () => {
  it('reconhece anexo embutido', () => {
    expect(ehDataUri('data:application/pdf;base64,JVBERi0=')).toBe(true);
    expect(ehDataUri('data:image/png;base64,iVBOR')).toBe(true);
  });

  it('não confunde URL nem texto comum', () => {
    expect(ehDataUri('https://exemplo.com/contrato.pdf')).toBe(false);
    expect(ehDataUri('RUA CAMPO GRANDE, 53')).toBe(false);
    expect(ehDataUri(123)).toBe(false);
    expect(ehDataUri(null)).toBe(false);
  });
});

describe('descreverAnexo', () => {
  it('preserva o tipo e o tamanho, some com o conteúdo', () => {
    const d = descreverAnexo(pdfFalso('JVBERi0xLjQK', 352 * 1024));
    expect(d).toContain('application/pdf');
    expect(d).toContain('KB');
    expect(d).not.toContain('JVBERi0xLjQK');
    expect(d.length).toBeLessThan(80);
  });

  it('aguenta data URI sem mime declarado', () => {
    expect(descreverAnexo('data:,texto')).toContain('desconhecido');
  });
});

describe('impressão digital', () => {
  it('é determinística', () => {
    expect(impressaoDigital('abc')).toBe(impressaoDigital('abc'));
  });

  it('muda quando o conteúdo muda — é o que mantém o diff honesto', () => {
    expect(impressaoDigital('abc')).not.toBe(impressaoDigital('abd'));
  });

  it('distingue anexos DE MESMO TAMANHO', () => {
    // Sem o hash, dois PDFs diferentes do mesmo tamanho gerariam descritores idênticos
    // e `calcularCamposAlterados` concluiria "não mudou" — o diff mentiria.
    const a = descreverAnexo(pdfFalso('AAAA', 10000));
    const b = descreverAnexo(pdfFalso('BBBB', 10000));
    expect(a).not.toBe(b);
  });
});

describe('formatarTamanho', () => {
  it('escolhe a unidade legível', () => {
    expect(formatarTamanho(512)).toBe('512 B');
    expect(formatarTamanho(2048)).toBe('2 KB');
    expect(formatarTamanho(3 * 1024 * 1024)).toBe('3,0 MB');
  });
});

describe('enxugarDetalhesAuditoria', () => {
  it('troca o anexo do associado pelo descritor e derruba o peso', () => {
    const associado = {
      id: 'abc', nome: 'JUSSARA LUIZ DA SILVA',
      documentos: [{ id: 'd1', nome: 'Contrato.pdf', tipo: 'application/pdf', tamanho: 352190,
                     url: pdfFalso('JVBERi0xLjQK', 469618) }],
      dependentes: [{ id: 'x', nome: 'FILHO' }],
    };
    const antes = JSON.stringify({ dados_novos: associado }).length;
    const enxuto = enxugarDetalhesAuditoria({ dados_novos: associado });
    const depois = JSON.stringify(enxuto).length;

    expect(antes).toBeGreaterThan(400_000);
    expect(depois).toBeLessThan(2_000);
    const doc = (enxuto.dados_novos as any).documentos[0];
    expect(doc.url).toContain('application/pdf');
    expect(doc.nome).toBe('Contrato.pdf');   // o metadado do anexo fica
    expect(doc.tamanho).toBe(352190);
  });

  it('preserva os campos comuns intactos — o diff continua legível', () => {
    const enxuto = enxugarDetalhesAuditoria({
      id: 'abc', nome: 'MARIA', dados_anteriores: { cidade: 'COXIM - MS', valor_plano: 100 },
      dados_novos: { cidade: 'CAMPO GRANDE', valor_plano: 150 },
    });
    expect(enxuto.dados_anteriores).toEqual({ cidade: 'COXIM - MS', valor_plano: 100 });
    expect(enxuto.dados_novos).toEqual({ cidade: 'CAMPO GRANDE', valor_plano: 150 });
  });

  it('o diff ainda acusa a troca de um anexo por outro', () => {
    const antes = enxugarDetalhesAuditoria({ dados_novos: { url: pdfFalso('AAAA', 9000) } });
    const depois = enxugarDetalhesAuditoria({ dados_novos: { url: pdfFalso('ZZZZ', 9000) } });
    const mudou = calcularCamposAlterados(
      antes.dados_novos as Record<string, unknown>,
      depois.dados_novos as Record<string, unknown>,
    );
    expect(mudou.map(c => c.key)).toEqual(['url']);
  });

  it('o diff NÃO acusa mudança quando o anexo é o mesmo', () => {
    const mesmo = pdfFalso('AAAA', 9000);
    const a = enxugarDetalhesAuditoria({ dados_novos: { url: mesmo } });
    const b = enxugarDetalhesAuditoria({ dados_novos: { url: mesmo } });
    expect(calcularCamposAlterados(a.dados_novos as any, b.dados_novos as any)).toEqual([]);
  });

  it('corta string longa que não é anexo, dizendo quanto sobrou de fora', () => {
    const texto = 'x'.repeat(LIMITE_STRING_DETALHE + 1234);
    const enxuto = enxugarDetalhesAuditoria({ observacao: texto });
    expect(String(enxuto.observacao)).toContain('+1234 caracteres');
    expect(String(enxuto.observacao).length).toBeLessThan(LIMITE_STRING_DETALHE + 100);
  });

  it('não mexe em string dentro do limite', () => {
    const enxuto = enxugarDetalhesAuditoria({ motivo: 'Correção de endereço' });
    expect(enxuto.motivo).toBe('Correção de endereço');
  });

  it('é idempotente — rodar de novo não re-encurta o descritor', () => {
    const uma = enxugarDetalhesAuditoria({ dados_novos: { url: pdfFalso('AAAA', 50000) } });
    const duas = enxugarDetalhesAuditoria(uma);
    expect(duas).toEqual(uma);
  });

  it('aguenta null, número, booleano e array aninhado', () => {
    const enxuto = enxugarDetalhesAuditoria({
      a: null, b: 42, c: true, d: [[{ e: 'ok' }]],
    });
    expect(enxuto).toEqual({ a: null, b: 42, c: true, d: [[{ e: 'ok' }]] });
  });

  it('teto total: remove o mais pesado e REGISTRA o que saiu', () => {
    // Nenhum anexo aqui: são muitos campos de texto dentro do limite individual, que
    // somados estouram o teto. É a rede final.
    const gordo: Record<string, unknown> = { id: 'abc', usuario: 'Edson', usuario_email: 'e@x.com' };
    for (let i = 0; i < 300; i++) gordo[`campo_${i}`] = 'y'.repeat(LIMITE_STRING_DETALHE);
    const enxuto = enxugarDetalhesAuditoria(gordo);

    expect(JSON.stringify(enxuto).length).toBeLessThanOrEqual(LIMITE_TOTAL_DETALHES);
    expect(String(enxuto._omitido)).toContain('Campos removidos por tamanho');
    // quem agiu nunca é sacrificado
    expect(enxuto.usuario).toBe('Edson');
    expect(enxuto.usuario_email).toBe('e@x.com');
    expect(enxuto.id).toBe('abc');
  });

  it('payload pequeno não ganha a chave _omitido', () => {
    const enxuto = enxugarDetalhesAuditoria({ id: 'abc', nome: 'MARIA' });
    expect(enxuto).not.toHaveProperty('_omitido');
  });
});
