import { describe, it, expect } from 'vitest';
import {
  TIPOS_FORNECIMENTO,
  opcoesTipoFornecimento,
  rotuloLongoTipoFornecimento,
  rotuloTipoFornecimento,
} from './tiposFornecimento.config';

describe('TIPOS_FORNECIMENTO', () => {
  it('é o domínio de três valores que o CHECK do banco impõe', () => {
    // `fornecedores_tipo_fornecedor_check` (migration 20260918185138) aceita exatamente estes.
    // Acrescentar um valor aqui sem acrescentar no CHECK produz `23514` ao salvar.
    expect(TIPOS_FORNECIMENTO.map((t) => t.valor)).toEqual(['produtos', 'servicos', 'ambos']);
  });

  it('todo valor tem os três rótulos preenchidos', () => {
    // Um valor sem rótulo apareceria em branco na tela — foi o que o "Gerenciar" permitia criar.
    TIPOS_FORNECIMENTO.forEach((t) => {
      expect(t.rotulo.length).toBeGreaterThan(0);
      expect(t.rotuloCurto.length).toBeGreaterThan(0);
      expect(t.rotuloFiltro.length).toBeGreaterThan(0);
    });
  });
});

describe('rotuloTipoFornecimento', () => {
  it('traduz os três valores do domínio', () => {
    expect(rotuloTipoFornecimento('produtos')).toBe('Produtos');
    expect(rotuloTipoFornecimento('servicos')).toBe('Serviços');
    expect(rotuloTipoFornecimento('ambos')).toBe('Produtos & Serviços');
  });

  it('valor fora do domínio volta como está, em vez de virar vazio', () => {
    // Um fornecedor gravado antes do CHECK — ou vindo do IndexedDB de um navegador que usou o
    // "Gerenciar" — continua legível na tela em vez de aparecer sem nome.
    expect(rotuloTipoFornecimento('consultoria')).toBe('consultoria');
  });

  it('vazio e nulo não viram texto nenhum', () => {
    expect(rotuloTipoFornecimento('')).toBe('');
    expect(rotuloTipoFornecimento(null)).toBe('');
    expect(rotuloTipoFornecimento(undefined)).toBe('');
  });

  it('o rótulo longo segue a mesma regra', () => {
    expect(rotuloLongoTipoFornecimento('servicos')).toBe('Prestador de Serviços');
    expect(rotuloLongoTipoFornecimento('consultoria')).toBe('consultoria');
  });
});

describe('opcoesTipoFornecimento', () => {
  it('sem valor gravado, oferece só os três', () => {
    expect(opcoesTipoFornecimento().map((t) => t.valor)).toEqual(['produtos', 'servicos', 'ambos']);
    expect(opcoesTipoFornecimento('produtos')).toHaveLength(3);
  });

  it('o valor JÁ GRAVADO fora do domínio continua na lista', () => {
    // Sem isso, abrir para editar um fornecedor legado perderia a seleção e o save gravaria
    // outro tipo em silêncio. Mesma escolha de `nomesDeCategoriaParaSelecao`.
    const opcoes = opcoesTipoFornecimento('consultoria');
    expect(opcoes.map((t) => t.valor)).toEqual(['produtos', 'servicos', 'ambos', 'consultoria']);
    expect(opcoes[3].rotulo).toBe('consultoria');
  });

  it('valor vazio ou só espaços não vira opção fantasma', () => {
    expect(opcoesTipoFornecimento('')).toHaveLength(3);
    expect(opcoesTipoFornecimento('   ')).toHaveLength(3);
    expect(opcoesTipoFornecimento(null)).toHaveLength(3);
  });

  it('não muta a constante do domínio', () => {
    opcoesTipoFornecimento('consultoria');
    expect(TIPOS_FORNECIMENTO).toHaveLength(3);
  });
});
