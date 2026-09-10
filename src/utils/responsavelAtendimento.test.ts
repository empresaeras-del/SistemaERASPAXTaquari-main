import { describe, it, expect } from 'vitest';
import {
  contatoDoAssociado,
  dadosResponsavelDoAssociado,
  enderecoDoAssociado,
  responsavelParaGravacao,
  PARENTESCO_TITULAR,
  RESPONSAVEL_VAZIO,
} from './responsavelAtendimento';

const associado = {
  nome: 'maria da silva',
  cpf: '046.537.031-40',
  rg: '1234567 SSP/MS',
  celular_whatsapp: '(67) 99999-1111',
  telefone: '(67) 3291-0000',
  email: 'maria@exemplo.com',
  endereco_logradouro: 'RUA CAMPO GRANDE',
  endereco_numero: '150',
  endereco_bairro: 'CENTRO',
  endereco_cidade: 'COXIM',
  endereco_estado: 'MS',
  endereco_cep: '79400-000',
};

describe('enderecoDoAssociado', () => {
  it('monta o endereço em uma linha a partir do par canônico', () => {
    expect(enderecoDoAssociado(associado)).toBe(
      'RUA CAMPO GRANDE, nº 150, CENTRO, COXIM - MS, CEP: 79400-000',
    );
  });

  it('cai para a coluna legada quando a canônica está ausente', () => {
    expect(enderecoDoAssociado({ logradouro: 'RUA A', numero: '10', cidade: 'COXIM', uf: 'MS' })).toBe(
      'RUA A, nº 10, COXIM - MS',
    );
  });

  it('prefere a canônica quando as duas existem e divergem', () => {
    const misto = { endereco_logradouro: 'RUA NOVA', logradouro: 'RUA ANTIGA' };
    expect(enderecoDoAssociado(misto)).toBe('RUA NOVA');
  });

  it('omite as partes ausentes em vez de deixar vírgula solta', () => {
    expect(enderecoDoAssociado({ endereco_logradouro: 'RUA A', endereco_cidade: 'COXIM' })).toBe(
      'RUA A, COXIM',
    );
  });

  it('devolve string vazia para associado sem endereço nenhum', () => {
    expect(enderecoDoAssociado({})).toBe('');
  });
});

describe('contatoDoAssociado', () => {
  it('prefere o celular/WhatsApp', () => {
    expect(contatoDoAssociado(associado)).toBe('(67) 99999-1111');
  });

  it('cai para o telefone fixo e depois para o e-mail', () => {
    expect(contatoDoAssociado({ telefone: '(67) 3291-0000', email: 'a@b.com' })).toBe('(67) 3291-0000');
    expect(contatoDoAssociado({ email: 'a@b.com' })).toBe('a@b.com');
    expect(contatoDoAssociado({})).toBe('');
  });
});

describe('dadosResponsavelDoAssociado', () => {
  it('preenche a partir do titular quando o falecido é um dependente', () => {
    const r = dadosResponsavelDoAssociado({ associado, falecidoEhTitular: false });
    expect(r.responsavel_nome).toBe('MARIA DA SILVA');
    expect(r.responsavel_cpf).toBe('046.537.031-40');
    expect(r.responsavel_rg).toBe('1234567 SSP/MS');
    expect(r.responsavel_parentesco).toBe(PARENTESCO_TITULAR);
    expect(r.responsavel_endereco).toContain('RUA CAMPO GRANDE');
    expect(r.responsavel_contato).toBe('(67) 99999-1111');
  });

  it('NÃO preenche nada quando o falecido é o próprio titular', () => {
    // O titular não pode ser responsável por si mesmo — preencher aqui produziria um
    // documento dizendo que o morto respondeu pelo próprio velório, sem nada na tela
    // sugerindo conferir.
    expect(dadosResponsavelDoAssociado({ associado, falecidoEhTitular: true })).toEqual(RESPONSAVEL_VAZIO);
  });

  it('devolve o bloco vazio quando não há associado', () => {
    expect(dadosResponsavelDoAssociado({ associado: null, falecidoEhTitular: false })).toEqual(
      RESPONSAVEL_VAZIO,
    );
    expect(dadosResponsavelDoAssociado({ falecidoEhTitular: false })).toEqual(RESPONSAVEL_VAZIO);
  });

  it('nunca preenche nacionalidade — não existe essa coluna em associados', () => {
    const r = dadosResponsavelDoAssociado({ associado, falecidoEhTitular: false });
    expect(r.responsavel_nacionalidade).toBe('');
  });

  it('não preenche observações', () => {
    const r = dadosResponsavelDoAssociado({ associado, falecidoEhTitular: false });
    expect(r.responsavel_observacoes).toBe('');
  });
});

describe('responsavelParaGravacao', () => {
  it('transforma campo vazio em null, nunca string vazia nem undefined', () => {
    const grav = responsavelParaGravacao(RESPONSAVEL_VAZIO);
    expect(Object.values(grav).every((v) => v === null)).toBe(true);
  });

  it('mantém as 8 chaves presentes — undefined sumiria no JSON e não limparia a coluna', () => {
    // É o caso da edição: apagar o campo na tela precisa apagar no banco.
    const grav = responsavelParaGravacao(RESPONSAVEL_VAZIO);
    expect(Object.keys(JSON.parse(JSON.stringify(grav)))).toHaveLength(8);
  });

  it('trata espaço em branco como ausência', () => {
    const grav = responsavelParaGravacao({ ...RESPONSAVEL_VAZIO, responsavel_rg: '   ' });
    expect(grav.responsavel_rg).toBeNull();
  });

  it('normaliza para maiúsculas o que a tela também exibe assim', () => {
    const grav = responsavelParaGravacao({
      ...RESPONSAVEL_VAZIO,
      responsavel_nome: ' joão pereira ',
      responsavel_parentesco: 'filho',
      responsavel_nacionalidade: 'brasileira',
    });
    expect(grav.responsavel_nome).toBe('JOÃO PEREIRA');
    expect(grav.responsavel_parentesco).toBe('FILHO');
    expect(grav.responsavel_nacionalidade).toBe('BRASILEIRA');
  });

  it('preserva sem alterar de caixa o que é dado literal', () => {
    const grav = responsavelParaGravacao({
      ...RESPONSAVEL_VAZIO,
      responsavel_cpf: '046.537.031-40',
      responsavel_contato: 'maria@Exemplo.com',
      responsavel_observacoes: 'Retorna após as 18h',
    });
    expect(grav.responsavel_cpf).toBe('046.537.031-40');
    expect(grav.responsavel_contato).toBe('maria@Exemplo.com');
    expect(grav.responsavel_observacoes).toBe('Retorna após as 18h');
  });
});
