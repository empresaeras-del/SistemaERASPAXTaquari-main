import { describe, it, expect } from 'vitest';
import {
  CadastroDeUsuario,
  DESCRICAO_PENDENCIA,
  LIMITE_DE_LINHAS_NO_AVISO,
  assinaturaDoAviso,
  cadastroEstaPelaMetade,
  identificacaoDoCadastro,
  montarAvisoCadastrosIncompletos,
  ordenarPorGravidade,
  pendenciaPrincipal,
  pendenciasDoCadastro,
  TITULO_AVISO_CADASTROS_INCOMPLETOS,
} from './cadastrosIncompletos';

const cadastro = (over: Partial<CadastroDeUsuario> = {}): CadastroDeUsuario => ({
  usuario_id: 'u1',
  email: 'fulano@exemplo.com',
  nome: 'FULANO DE TAL',
  tenant_id: 'empresa-1',
  nivel: 'funcionario',
  criado_em: '2026-09-11T11:59:02.000Z',
  tem_perfil: true,
  email_confirmado: true,
  ja_acessou: true,
  convite_enviado_em: '2026-09-11T11:59:02.000Z',
  ...over,
});

describe('pendenciasDoCadastro', () => {
  it('cadastro completo não tem pendência', () => {
    expect(pendenciasDoCadastro(cadastro())).toEqual([]);
    expect(cadastroEstaPelaMetade(cadastro())).toBe(false);
  });

  it('sem perfil: autentica e o app não o reconhece', () => {
    expect(pendenciasDoCadastro(cadastro({ tem_perfil: false }))).toEqual(['perfil_ausente']);
  });

  it('e-mail não confirmado: ainda não consegue entrar', () => {
    expect(pendenciasDoCadastro(cadastro({ email_confirmado: false }))).toEqual([
      'email_nao_confirmado',
    ]);
  });

  it('os dois ao mesmo tempo aparecem juntos', () => {
    expect(pendenciasDoCadastro(cadastro({ tem_perfil: false, email_confirmado: false }))).toEqual([
      'perfil_ausente',
      'email_nao_confirmado',
    ]);
  });

  it('"nunca acessou" NÃO é pendência — não há o que o admin faça a respeito', () => {
    // Perfil criado, convite confirmado, e a pessoa simplesmente não entrou ainda. Tratar
    // isso como pendência encheria o aviso de linhas sem ação, que é como um aviso vira ruído.
    expect(pendenciasDoCadastro(cadastro({ ja_acessou: false }))).toEqual([]);
    expect(cadastroEstaPelaMetade(cadastro({ ja_acessou: false }))).toBe(false);
  });

  it('não quebra com entrada nula', () => {
    expect(pendenciasDoCadastro(null)).toEqual([]);
    expect(pendenciaPrincipal(undefined)).toBeNull();
  });
});

describe('ordenarPorGravidade', () => {
  it('perfil ausente vem antes de convite não confirmado', () => {
    const lista = [
      cadastro({ usuario_id: 'b', email: 'b@x.com', email_confirmado: false }),
      cadastro({ usuario_id: 'a', email: 'a@x.com', tem_perfil: false }),
    ];
    expect(ordenarPorGravidade(lista).map((c) => c.usuario_id)).toEqual(['a', 'b']);
  });

  it('empatada a gravidade, o mais antigo vem primeiro', () => {
    const lista = [
      cadastro({ usuario_id: 'novo', email_confirmado: false, criado_em: '2026-09-11T00:00:00Z' }),
      cadastro({ usuario_id: 'velho', email_confirmado: false, criado_em: '2026-08-01T00:00:00Z' }),
    ];
    expect(ordenarPorGravidade(lista).map((c) => c.usuario_id)).toEqual(['velho', 'novo']);
  });

  it('descarta os cadastros completos', () => {
    const lista = [cadastro({ usuario_id: 'ok' }), cadastro({ usuario_id: 'x', tem_perfil: false })];
    expect(ordenarPorGravidade(lista).map((c) => c.usuario_id)).toEqual(['x']);
  });
});

describe('identificacaoDoCadastro', () => {
  it('usa o nome quando existe', () => {
    expect(identificacaoDoCadastro(cadastro())).toBe('FULANO DE TAL');
  });

  it('cai para o e-mail quando o cadastro órfão não tem nome no convite', () => {
    expect(identificacaoDoCadastro(cadastro({ nome: null }))).toBe('fulano@exemplo.com');
    expect(identificacaoDoCadastro(cadastro({ nome: '   ' }))).toBe('fulano@exemplo.com');
  });
});

describe('montarAvisoCadastrosIncompletos', () => {
  it('sem pendência, não há aviso', () => {
    expect(montarAvisoCadastrosIncompletos([cadastro()])).toBeNull();
    expect(montarAvisoCadastrosIncompletos([])).toBeNull();
  });

  it('nomeia cada usuário e o que falta nele', () => {
    const aviso = montarAvisoCadastrosIncompletos([
      cadastro({ usuario_id: 'w', nome: 'WELLITON', email: 'welliton@x.com', email_confirmado: false }),
      cadastro({ usuario_id: 'g', nome: 'GIZELLE', email: 'gizelle@x.com', email_confirmado: false }),
    ])!;

    expect(aviso.titulo).toBe(TITULO_AVISO_CADASTROS_INCOMPLETOS);
    expect(aviso.mensagem).toContain('2 cadastros de usuário não estão completos');
    expect(aviso.mensagem).toContain('WELLITON (welliton@x.com)');
    expect(aviso.mensagem).toContain('GIZELLE (gizelle@x.com)');
    expect(aviso.mensagem).toContain(DESCRICAO_PENDENCIA.email_nao_confirmado.oQueFalta);
    expect(aviso.mensagem).toContain('Configurações → Usuários');
  });

  it('no singular, a abertura não diz "1 cadastros"', () => {
    const aviso = montarAvisoCadastrosIncompletos([cadastro({ tem_perfil: false })])!;
    expect(aviso.mensagem).toContain('1 cadastro de usuário não está completo');
  });

  it('o título é o mesmo qualquer que seja a contagem — é por ele que a rotina se reconhece', () => {
    // Com a contagem no título, resolver um cadastro criaria um assunto novo e a rotina
    // perderia o rastro do aviso anterior, voltando a avisar do zero a cada mudança.
    const um = montarAvisoCadastrosIncompletos([cadastro({ usuario_id: 'a', tem_perfil: false })])!;
    const dois = montarAvisoCadastrosIncompletos([
      cadastro({ usuario_id: 'a', tem_perfil: false }),
      cadastro({ usuario_id: 'b', email: 'b@x.com', email_confirmado: false }),
    ])!;
    expect(um.titulo).toBe(dois.titulo);
    expect(um.mensagem).not.toBe(dois.mensagem);
  });

  it('acima do limite, resume o excedente em vez de listar tudo', () => {
    const muitos = Array.from({ length: LIMITE_DE_LINHAS_NO_AVISO + 3 }, (_, i) =>
      cadastro({ usuario_id: `u${i}`, email: `u${i}@x.com`, email_confirmado: false }),
    );
    const aviso = montarAvisoCadastrosIncompletos(muitos)!;
    const linhas = aviso.mensagem.split('\n').filter((l) => l.startsWith('•'));
    expect(linhas).toHaveLength(LIMITE_DE_LINHAS_NO_AVISO + 1);
    expect(linhas[linhas.length - 1]).toContain('e mais 3 cadastro(s)');
  });
});

describe('assinaturaDoAviso', () => {
  it('não muda com a ordem da lista', () => {
    const a = cadastro({ usuario_id: 'a', tem_perfil: false });
    const b = cadastro({ usuario_id: 'b', email_confirmado: false });
    expect(assinaturaDoAviso([a, b])).toBe(assinaturaDoAviso([b, a]));
  });

  it('muda quando uma pendência é resolvida, mesmo com os mesmos usuários', () => {
    // O cadastro ganhou perfil e segue sem confirmar o e-mail: é outra situação, e o admin
    // precisa ser avisado de novo. Uma assinatura só de ids esconderia isso.
    const antes = [cadastro({ usuario_id: 'a', tem_perfil: false, email_confirmado: false })];
    const depois = [cadastro({ usuario_id: 'a', tem_perfil: true, email_confirmado: false })];
    expect(assinaturaDoAviso(antes)).not.toBe(assinaturaDoAviso(depois));
  });

  it('ignora os cadastros completos', () => {
    expect(assinaturaDoAviso([cadastro({ usuario_id: 'ok' })])).toBe('');
  });
});
