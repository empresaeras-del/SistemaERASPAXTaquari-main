import { describe, it, expect } from 'vitest';
import { mascararDocumento, ehCampoDeDocumento, mascararValorDeCampo } from './mascaraDocumento';

describe('mascararDocumento', () => {
  it('mascara CPF formatado, escondendo prefixo e dígitos verificadores', () => {
    expect(mascararDocumento('046.537.031-40')).toBe('***.537.031-**');
  });

  it('mascara CPF vindo só como dígitos', () => {
    expect(mascararDocumento('04653703140')).toBe('***.537.031-**');
  });

  it('mascara CNPJ formatado', () => {
    expect(mascararDocumento('33.520.000/0001-71')).toBe('**.***.000/0001-**');
  });

  it('mascara CNPJ vindo só como dígitos', () => {
    expect(mascararDocumento('33520000000171')).toBe('**.***.000/0001-**');
  });

  it('não deixa passar nenhum dígito verificador', () => {
    // O DV é o que permite validar um palpite — é o que precisa sumir.
    const saida = mascararDocumento('046.537.031-40');
    expect(saida.endsWith('-**')).toBe(true);
    expect(saida).not.toContain('40');
  });

  it('dois documentos com o mesmo miolo e DV diferente saem iguais', () => {
    // Consequência aceita: a máscara não é identificador. Serve para conferir contra um
    // documento em mãos, não para distinguir dois números quase idênticos.
    expect(mascararDocumento('046.537.031-40')).toBe(mascararDocumento('046.537.031-59'));
  });

  it('deixa texto livre intacto — o campo às vezes guarda um nome', () => {
    expect(mascararDocumento('ASSESSORIA JURIDICA PAX')).toBe('ASSESSORIA JURIDICA PAX');
    expect(mascararDocumento('Não informado')).toBe('Não informado');
  });

  it('deixa intacto o que tem dígitos mas não é CPF nem CNPJ', () => {
    expect(mascararDocumento('123')).toBe('123');
    expect(mascararDocumento('0465370314')).toBe('0465370314'); // 10 dígitos
    expect(mascararDocumento('046537031401')).toBe('046537031401'); // 12 dígitos
  });

  it('trata vazio, nulo e indefinido sem lançar', () => {
    expect(mascararDocumento('')).toBe('');
    expect(mascararDocumento(null)).toBe('');
    expect(mascararDocumento(undefined)).toBe('');
  });

  it('é idempotente: mascarar o já mascarado não muda nada', () => {
    const uma = mascararDocumento('046.537.031-40');
    expect(mascararDocumento(uma)).toBe(uma);
  });
});

describe('ehCampoDeDocumento', () => {
  it('reconhece os nomes de campo que o schema usa', () => {
    for (const campo of [
      'cpf',
      'cnpj',
      'cpf_cnpj',
      'cnpj_cpf',
      'associado_cpf',
      'fornecedor_cnpj_cpf',
      'credor_cpf_cnpj',
      'funcionario_cpf',
      'cliente_cpf_cnpj',
      'CPF',
    ]) {
      expect(ehCampoDeDocumento(campo)).toBe(true);
    }
  });

  it('não reconhece campo que não é documento', () => {
    for (const campo of ['nome', 'valor_total', 'descricao', 'telefone', 'email', '', null, undefined]) {
      expect(ehCampoDeDocumento(campo as string)).toBe(false);
    }
  });
});

describe('mascararValorDeCampo', () => {
  it('mascara quando o nome do campo indica documento', () => {
    expect(mascararValorDeCampo('cpf', '046.537.031-40')).toBe('***.537.031-**');
    expect(mascararValorDeCampo('fornecedor_cnpj_cpf', '33.520.000/0001-71')).toBe('**.***.000/0001-**');
  });

  it('não mascara um número de aparência parecida em campo que não é documento', () => {
    // 11 dígitos num telefone não vira CPF só por ter 11 dígitos.
    expect(mascararValorDeCampo('telefone', '67999552480')).toBe('67999552480');
  });

  it('preserva o tipo: número, objeto, null e undefined passam intactos', () => {
    expect(mascararValorDeCampo('cpf', 4653703140)).toBe(4653703140);
    expect(mascararValorDeCampo('cpf', null)).toBeNull();
    expect(mascararValorDeCampo('cpf', undefined)).toBeUndefined();
    const obj = { a: 1 };
    expect(mascararValorDeCampo('cpf', obj)).toBe(obj);
  });
});
