import { describe, it, expect } from 'vitest';
import { falecidoExternoSchema } from './atendimentoSchema';

describe('falecidoExternoSchema', () => {
  it('aceita nome completo sem CPF', () => {
    const res = falecidoExternoSchema.safeParse({ falecido_nome: 'José Pereira' });
    expect(res.success).toBe(true);
  });

  it('rejeita nome muito curto', () => {
    const res = falecidoExternoSchema.safeParse({ falecido_nome: 'Jo' });
    expect(res.success).toBe(false);
  });

  it('rejeita nome vazio', () => {
    const res = falecidoExternoSchema.safeParse({ falecido_nome: '' });
    expect(res.success).toBe(false);
  });

  it('aceita CPF no formato mascarado', () => {
    const res = falecidoExternoSchema.safeParse({ falecido_nome: 'José Pereira', falecido_cpf: '999.888.777-66' });
    expect(res.success).toBe(true);
  });

  it('rejeita CPF fora do formato esperado', () => {
    const res = falecidoExternoSchema.safeParse({ falecido_nome: 'José Pereira', falecido_cpf: '99988877766' });
    expect(res.success).toBe(false);
  });
});
