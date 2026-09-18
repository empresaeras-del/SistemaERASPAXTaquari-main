import { describe, expect, it } from 'vitest';
import type { Associado } from '../services/associadosService';
import {
  LIMITE_PARCELAS_VENCIDAS,
  TITULO_AVISO_INADIMPLENCIA,
  associadosComParcelasVencidas,
  montarAvisoInadimplencia,
} from './inadimplencia';
import { ParcelaParaMapa } from './mapaCalorReceber';

const HOJE = '2026-09-18';

const associado = (over: Partial<Associado> = {}): Associado =>
  ({
    id: 'a1',
    nome: 'EDSON RENIS',
    cpf: '017.989.211-89',
    status: 'ativo',
    tenant_id: 't1',
    ...over,
  }) as Associado;

const parcela = (over: Partial<ParcelaParaMapa> = {}): ParcelaParaMapa => ({
  id: crypto.randomUUID(),
  receita_id: 'r1',
  status: 'pendente',
  valor: 100,
  data_vencimento: '2026-08-01',
  devedor_cpf_cnpj: '017.989.211-89',
  ...over,
});

describe('associadosComParcelasVencidas', () => {
  it('não acusa quem está abaixo do limite', () => {
    const res = associadosComParcelasVencidas({
      associados: [associado()],
      parcelas: [parcela(), parcela()],
      hoje: HOJE,
    });
    expect(res).toEqual([]);
  });

  it('acusa ao atingir o limite, somando valor e guardando o vencimento mais antigo', () => {
    const res = associadosComParcelasVencidas({
      associados: [associado()],
      parcelas: [
        parcela({ data_vencimento: '2026-07-01', valor: 50 }),
        parcela({ data_vencimento: '2026-06-01', valor: 50 }),
        parcela({ data_vencimento: '2026-08-01', valor: 100 }),
      ],
      hoje: HOJE,
    });
    expect(res).toHaveLength(1);
    expect(res[0].parcelasVencidas).toBe(3);
    expect(res[0].valorVencido).toBe(200);
    expect(res[0].vencimentoMaisAntigo).toBe('2026-06-01');
  });

  it('conta o status "atrasado", que a rotina antiga deixava de fora', () => {
    // A rotina antiga filtrava só 'pendente' e 'vencido'. Uma carteira toda em 'atrasado'
    // — justamente o status que significa atraso — não acusava ninguém.
    const res = associadosComParcelasVencidas({
      associados: [associado()],
      parcelas: [
        parcela({ status: 'atrasado' }),
        parcela({ status: 'atrasado' }),
        parcela({ status: 'atrasado' }),
      ],
      hoje: HOJE,
    });
    expect(res).toHaveLength(1);
    expect(res[0].parcelasVencidas).toBe(3);
  });

  it('ignora parcela liquidada e cancelada', () => {
    const res = associadosComParcelasVencidas({
      associados: [associado()],
      parcelas: [
        parcela({ status: 'recebido' }),
        parcela({ status: 'pago' }),
        parcela({ status: 'cancelado' }),
        parcela(),
      ],
      hoje: HOJE,
    });
    expect(res).toEqual([]);
  });

  it('não conta a parcela que vence hoje — o associado ainda tem o dia', () => {
    const res = associadosComParcelasVencidas({
      associados: [associado()],
      parcelas: [
        parcela({ data_vencimento: HOJE }),
        parcela({ data_vencimento: HOJE }),
        parcela({ data_vencimento: HOJE }),
      ],
      hoje: HOJE,
    });
    expect(res).toEqual([]);
  });

  it('não vira o dia por fuso: 1º de janeiro compara como texto', () => {
    // `new Date('2026-01-01')` é meia-noite UTC — em UTC-3, 31/12/2025. Comparando texto,
    // a parcela que vence em 1º de janeiro não conta como vencida nesse mesmo dia.
    const res = associadosComParcelasVencidas({
      associados: [associado()],
      parcelas: [
        parcela({ data_vencimento: '2026-01-01' }),
        parcela({ data_vencimento: '2026-01-01' }),
        parcela({ data_vencimento: '2026-01-01' }),
      ],
      hoje: '2026-01-01',
    });
    expect(res).toEqual([]);
  });

  it('resolve o dono pelo associado_id da receita, mesmo com o CPF em outro formato', () => {
    // É o caso que a rotina antiga perdia: casando só por CPF, um lado sem pontuação
    // zerava a contagem e o associado sumia do aviso.
    const res = associadosComParcelasVencidas({
      associados: [associado({ cpf: '017.989.211-89' })],
      parcelas: [
        parcela({ devedor_cpf_cnpj: '01798921189' }),
        parcela({ devedor_cpf_cnpj: '01798921189' }),
        parcela({ devedor_cpf_cnpj: '01798921189' }),
      ],
      receitas: [{ id: 'r1', associado_id: 'a1' }],
      hoje: HOJE,
    });
    expect(res).toHaveLength(1);
    expect(res[0].associado.id).toBe('a1');
  });

  it('só considera associado ativo', () => {
    for (const status of ['inativo', 'inadimplente', 'encerrado'] as const) {
      const res = associadosComParcelasVencidas({
        associados: [associado({ status })],
        parcelas: [parcela(), parcela(), parcela()],
        hoje: HOJE,
      });
      expect(res, `status ${status}`).toEqual([]);
    }
  });

  it('não acusa quando a parcela não tem dono localizável', () => {
    const res = associadosComParcelasVencidas({
      associados: [associado()],
      parcelas: [
        parcela({ devedor_cpf_cnpj: '999.999.999-99', devedor_nome: undefined, receita_id: undefined }),
        parcela({ devedor_cpf_cnpj: '999.999.999-99', devedor_nome: undefined, receita_id: undefined }),
        parcela({ devedor_cpf_cnpj: '999.999.999-99', devedor_nome: undefined, receita_id: undefined }),
      ],
      hoje: HOJE,
    });
    expect(res).toEqual([]);
  });

  it('data quebrada não acusa ninguém', () => {
    const res = associadosComParcelasVencidas({
      associados: [associado()],
      parcelas: [
        parcela({ data_vencimento: '' }),
        parcela({ data_vencimento: 'ontem' }),
        parcela({ data_vencimento: undefined }),
      ],
      hoje: HOJE,
    });
    expect(res).toEqual([]);
  });

  it('ordena por parcelas vencidas, desempatando pelo valor', () => {
    const res = associadosComParcelasVencidas({
      associados: [
        associado({ id: 'a1', nome: 'TRES PARCELAS CARAS', cpf: '111' }),
        associado({ id: 'a2', nome: 'QUATRO PARCELAS', cpf: '222' }),
        associado({ id: 'a3', nome: 'TRES PARCELAS BARATAS', cpf: '333' }),
      ],
      parcelas: [
        ...Array.from({ length: 3 }, () => parcela({ receita_id: 'r1', valor: 400 })),
        ...Array.from({ length: 4 }, () => parcela({ receita_id: 'r2', valor: 10 })),
        ...Array.from({ length: 3 }, () => parcela({ receita_id: 'r3', valor: 10 })),
      ],
      receitas: [
        { id: 'r1', associado_id: 'a1' },
        { id: 'r2', associado_id: 'a2' },
        { id: 'r3', associado_id: 'a3' },
      ],
      hoje: HOJE,
    });
    expect(res.map((c) => c.associado.nome)).toEqual([
      'QUATRO PARCELAS',
      'TRES PARCELAS CARAS',
      'TRES PARCELAS BARATAS',
    ]);
  });

  it('respeita um limite diferente do padrão', () => {
    const entrada = {
      associados: [associado()],
      parcelas: [parcela(), parcela()],
      hoje: HOJE,
    };
    expect(associadosComParcelasVencidas(entrada)).toEqual([]);
    expect(associadosComParcelasVencidas({ ...entrada, limite: 2 })).toHaveLength(1);
  });

  it('o padrão continua sendo 3, como na rotina antiga (> 2)', () => {
    expect(LIMITE_PARCELAS_VENCIDAS).toBe(3);
  });
});

describe('montarAvisoInadimplencia', () => {
  const candidato = (nome: string, parcelasVencidas = 3, valorVencido = 300) => ({
    associado: associado({ id: nome, nome }),
    parcelasVencidas,
    valorVencido,
    vencimentoMaisAntigo: '2026-06-01',
  });

  it('devolve null sem candidatos', () => {
    expect(montarAvisoInadimplencia([])).toBeNull();
  });

  it('o título é constante e a contagem fica na mensagem', () => {
    const um = montarAvisoInadimplencia([candidato('A')]);
    const dois = montarAvisoInadimplencia([candidato('A'), candidato('B')]);
    // Se a contagem subisse ao título, cada mudança na lista viraria um assunto novo e o
    // aviso renasceria do zero a cada carregamento.
    expect(um!.titulo).toBe(TITULO_AVISO_INADIMPLENCIA);
    expect(dois!.titulo).toBe(TITULO_AVISO_INADIMPLENCIA);
    expect(um!.mensagem).not.toBe(dois!.mensagem);
  });

  it('concorda em número com um candidato só', () => {
    const aviso = montarAvisoInadimplencia([candidato('EDSON')]);
    expect(aviso!.mensagem).toContain('1 associado ativo acumulou');
    expect(aviso!.mensagem).toContain('EDSON');
  });

  it('cita no máximo três nomes e resume o resto', () => {
    const aviso = montarAvisoInadimplencia([
      candidato('A'),
      candidato('B'),
      candidato('C'),
      candidato('D'),
      candidato('E'),
    ]);
    expect(aviso!.mensagem).toContain('A, B, C e mais 2 associados');
    expect(aviso!.mensagem).not.toContain('D');
  });

  it('usa o singular quando sobra exatamente um', () => {
    const aviso = montarAvisoInadimplencia([
      candidato('A'),
      candidato('B'),
      candidato('C'),
      candidato('D'),
    ]);
    expect(aviso!.mensagem).toContain('e mais 1 associado.');
  });

  it('soma o valor de todos, inclusive os não citados', () => {
    const aviso = montarAvisoInadimplencia([
      candidato('A', 3, 100),
      candidato('B', 3, 100),
      candidato('C', 3, 100),
      candidato('D', 3, 100),
    ]);
    // Intl usa espaço não separável depois de "R$" — derivar do formatador, não digitar.
    const esperado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(400);
    expect(aviso!.mensagem).toContain(esperado);
  });

  it('a mensagem é estável para a mesma lista — é o que impede o aviso de renascer', () => {
    const lista = [candidato('A'), candidato('B')];
    expect(montarAvisoInadimplencia(lista)!.mensagem).toBe(montarAvisoInadimplencia(lista)!.mensagem);
  });
});
