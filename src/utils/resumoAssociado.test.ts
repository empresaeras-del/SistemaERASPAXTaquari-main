import { describe, it, expect } from 'vitest';
import { formatarDocumento, idadeEmAnos, montarResumoAssociado } from './resumoAssociado';

describe('idadeEmAnos', () => {
  it('desconta o aniversário que ainda não chegou', () => {
    // O `getFullYear() - getFullYear()` que o projeto repete daria 36 aqui.
    expect(idadeEmAnos('1990-12-31', new Date(2026, 0, 1))).toBe(35);
  });

  it('conta o ano quando o aniversário já passou', () => {
    expect(idadeEmAnos('1990-01-01', new Date(2026, 5, 10))).toBe(36);
  });

  it('no próprio aniversário a idade já vale', () => {
    expect(idadeEmAnos('1990-06-10', new Date(2026, 5, 10))).toBe(36);
  });

  it('um dia antes do aniversário ainda não', () => {
    expect(idadeEmAnos('1990-06-10', new Date(2026, 5, 9))).toBe(35);
  });

  it('lê o texto da data, sem passar por new Date(texto)', () => {
    // `new Date('1990-06-10')` é meia-noite UTC: em UTC-3 vira 09/06, e no aniversário a
    // idade sairia um ano menor.
    expect(idadeEmAnos('1990-06-10T00:00:00Z', new Date(2026, 5, 10))).toBe(36);
  });

  it('sem data, ou com data quebrada, devolve null', () => {
    expect(idadeEmAnos(undefined)).toBeNull();
    expect(idadeEmAnos(null)).toBeNull();
    expect(idadeEmAnos('')).toBeNull();
    expect(idadeEmAnos('10/06/1990')).toBeNull();
  });

  it('data futura não vira idade negativa', () => {
    expect(idadeEmAnos('2030-01-01', new Date(2026, 0, 1))).toBeNull();
  });
});

describe('formatarDocumento', () => {
  it('formata CPF e CNPJ', () => {
    expect(formatarDocumento('04653703140')).toBe('046.537.031-40');
    expect(formatarDocumento('11222333000199')).toBe('11.222.333/0001-99');
  });

  it('aceita valor já formatado', () => {
    expect(formatarDocumento('046.537.031-40')).toBe('046.537.031-40');
  });

  it('valor que não é documento volta como está', () => {
    expect(formatarDocumento('SEM CPF')).toBe('SEM CPF');
    expect(formatarDocumento('')).toBe('');
    expect(formatarDocumento(null)).toBe('');
  });
});

describe('montarResumoAssociado', () => {
  const hoje = new Date(2026, 8, 14);

  it('monta os campos do cabeçalho', () => {
    const r = montarResumoAssociado(
      {
        nome: 'MARIA DA SILVA',
        cpf: '04653703140',
        data_nascimento: '1990-01-05',
        plano_nome: 'Plano A - Individual',
        status: 'ativo',
      },
      hoje,
    );
    expect(r.nome).toBe('MARIA DA SILVA');
    expect(r.idade).toBe(36);
    expect(r.documento).toBe('046.537.031-40');
    expect(r.plano).toBe('Plano A - Individual');
    expect(r.inativo).toBe(false);
  });

  it('marca inativo e encerrado, os dois estados fora de circulação', () => {
    expect(montarResumoAssociado({ status: 'inativo' }, hoje).inativo).toBe(true);
    expect(montarResumoAssociado({ status: 'encerrado' }, hoje).inativo).toBe(true);
    expect(montarResumoAssociado({ status: 'inadimplente' }, hoje).inativo).toBe(false);
  });

  it('campo ausente vira vazio, para o componente poder omitir a linha', () => {
    const r = montarResumoAssociado({ nome: 'FULANO' }, hoje);
    expect(r.documento).toBe('');
    expect(r.plano).toBe('');
    expect(r.idade).toBeNull();
  });

  it('associado ausente não quebra — é o estado de um cadastro novo', () => {
    const r = montarResumoAssociado(null, hoje);
    expect(r.nome).toBe('');
    expect(r.inativo).toBe(false);
  });
});
