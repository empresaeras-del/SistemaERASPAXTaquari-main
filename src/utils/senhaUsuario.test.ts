import { describe, it, expect } from 'vitest';
import {
  validarTrocaDeSenha,
  forcaDaSenha,
  classesDaSenha,
  dicaDeForca,
  TAMANHO_MINIMO_SENHA,
  MENSAGEM_SENHA_ATUAL_VAZIA,
  MENSAGEM_SENHA_CURTA,
  MENSAGEM_SENHA_IGUAL_A_ATUAL,
  MENSAGEM_CONFIRMACAO_DIFERENTE
} from './senhaUsuario';

describe('validarTrocaDeSenha', () => {
  it('aceita uma troca completa e coerente', () => {
    expect(
      validarTrocaDeSenha({
        senhaAtual: 'antiga123',
        novaSenha: 'NovaSenha!2026',
        confirmacao: 'NovaSenha!2026'
      })
    ).toEqual({ ok: true });
  });

  it('cobra a senha atual antes de qualquer outra coisa', () => {
    expect(
      validarTrocaDeSenha({ senhaAtual: '', novaSenha: 'abc', confirmacao: 'xyz' })
    ).toEqual({ ok: false, mensagem: MENSAGEM_SENHA_ATUAL_VAZIA });
  });

  it('recusa nova senha abaixo do mínimo do sistema', () => {
    expect(
      validarTrocaDeSenha({
        senhaAtual: 'antiga123',
        novaSenha: 'abc12',
        confirmacao: 'abc12'
      })
    ).toEqual({ ok: false, mensagem: MENSAGEM_SENHA_CURTA });
  });

  it('aceita exatamente o tamanho mínimo', () => {
    const minima = 'a'.repeat(TAMANHO_MINIMO_SENHA);
    expect(
      validarTrocaDeSenha({
        senhaAtual: 'antiga123',
        novaSenha: minima,
        confirmacao: minima
      })
    ).toEqual({ ok: true });
  });

  it('recusa repetir a senha atual', () => {
    expect(
      validarTrocaDeSenha({
        senhaAtual: 'mesmaSenha1',
        novaSenha: 'mesmaSenha1',
        confirmacao: 'mesmaSenha1'
      })
    ).toEqual({ ok: false, mensagem: MENSAGEM_SENHA_IGUAL_A_ATUAL });
  });

  it('recusa confirmação diferente', () => {
    expect(
      validarTrocaDeSenha({
        senhaAtual: 'antiga123',
        novaSenha: 'NovaSenha!2026',
        confirmacao: 'NovaSenha!2025'
      })
    ).toEqual({ ok: false, mensagem: MENSAGEM_CONFIRMACAO_DIFERENTE });
  });

  it('NÃO apara espaços: senha com espaço na ponta é outra senha', () => {
    // O login manda o que foi digitado, sem trim. Se a validação aparasse aqui,
    // o usuário gravaria uma senha e digitaria outra no próximo acesso.
    expect(
      validarTrocaDeSenha({
        senhaAtual: 'antiga123',
        novaSenha: 'comEspaco ',
        confirmacao: 'comEspaco'
      })
    ).toEqual({ ok: false, mensagem: MENSAGEM_CONFIRMACAO_DIFERENTE });

    expect(
      validarTrocaDeSenha({
        senhaAtual: 'antiga123',
        novaSenha: '  senha com espaco  ',
        confirmacao: '  senha com espaco  '
      })
    ).toEqual({ ok: true });
  });

  it('só espaços ainda vale como senha atual informada', () => {
    const r = validarTrocaDeSenha({
      senhaAtual: '   ',
      novaSenha: 'NovaSenha!2026',
      confirmacao: 'NovaSenha!2026'
    });
    expect(r).toEqual({ ok: true });
  });
});

describe('classesDaSenha', () => {
  it('conta minúscula, maiúscula, dígito e símbolo', () => {
    expect(classesDaSenha('abcdef')).toBe(1);
    expect(classesDaSenha('abcDEF')).toBe(2);
    expect(classesDaSenha('abcDEF12')).toBe(3);
    expect(classesDaSenha('abcDEF12!')).toBe(4);
  });

  it('acentos e espaço contam como símbolo, não como letra ASCII', () => {
    expect(classesDaSenha('ção')).toBe(2);
  });
});

describe('forcaDaSenha', () => {
  it('abaixo do mínimo é sempre fraca, por mais variada que seja', () => {
    expect(forcaDaSenha('aB1!')).toBe('fraca');
  });

  it('longa mas de um tipo só continua fraca', () => {
    expect(forcaDaSenha('aaaaaaaaaaaaaaaaaaaa')).toBe('fraca');
  });

  it('oito caracteres com dois tipos é média', () => {
    expect(forcaDaSenha('senha123')).toBe('media');
  });

  it('oito caracteres com os quatro tipos é forte', () => {
    expect(forcaDaSenha('Se1!nha_')).toBe('forte');
  });

  it('doze caracteres com três tipos é forte', () => {
    expect(forcaDaSenha('SenhaLonga12')).toBe('forte');
  });

  it('sete caracteres não alcançam média, mesmo variados', () => {
    expect(forcaDaSenha('Se1!nha')).toBe('fraca');
  });
});

describe('dicaDeForca', () => {
  it('dá um texto próprio para cada nível', () => {
    const textos = new Set([
      dicaDeForca('fraca'),
      dicaDeForca('media'),
      dicaDeForca('forte')
    ]);
    expect(textos.size).toBe(3);
  });
});
