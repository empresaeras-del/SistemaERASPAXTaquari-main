import { describe, it, expect } from 'vitest';
import { Associado, Dependente } from '../services/associadosService';
import {
  acrescentarDependente,
  aplicarSelecaoDeDependentes,
  dependentesMarcadosPorPadrao,
  dependentesParaReativacao,
  gerarNumeroContratoReativacao,
  montarAssociadoReativado,
  podeRemoverDependente,
  removerDependenteNovo,
  vidasDaReativacao,
} from './reativacaoAssociado';

const hoje = new Date(2026, 8, 14); // 14/09/2026

const dep = (over: Partial<Dependente> & { id: string }): Dependente => ({
  nome: 'DEPENDENTE',
  parentesco: 'FILHO',
  ...over,
});

const associadoBase: Associado = {
  id: 'a1',
  tenant_id: 't1',
  nome: 'MARIA DA SILVA',
  cpf: '04653703140',
  status: 'inativo',
  data_adesao: '2020-03-01',
  plano_nome: 'Plano Prata',
  valor_plano: 80,
  plano_pax_id: 'p-antigo',
  dependentes: [
    dep({ id: 'd1', nome: 'JOÃO', data_nascimento: '2000-01-10', status: 'inativo' }),
    dep({ id: 'd2', nome: 'ANA', data_nascimento: '1990-12-31', status: 'inativo' }),
    dep({ id: 'd3', nome: 'PEDRO', status: 'inativo' }), // sem data de nascimento
  ],
};

describe('dependentesParaReativacao', () => {
  it('lista todos, com idade calculada e o estado anterior', () => {
    const lista = dependentesParaReativacao(associadoBase, hoje);
    expect(lista.map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
    expect(lista[0].idade).toBe(26);
    expect(lista[1].idade).toBe(35); // aniversário de 31/12 ainda não chegou
    expect(lista[2].idade).toBeNull();
    expect(lista.every((d) => d.jaAtivo === false)).toBe(true);
  });

  it('dependente sem status é tratado como ativo — é o estado de todo cadastro antigo', () => {
    const lista = dependentesParaReativacao({ dependentes: [dep({ id: 'x' })] }, hoje);
    expect(lista[0].jaAtivo).toBe(true);
  });

  it('associado sem dependentes não quebra', () => {
    expect(dependentesParaReativacao(null, hoje)).toEqual([]);
    expect(dependentesParaReativacao({ dependentes: [] }, hoje)).toEqual([]);
  });

  it('marca como novo quem não estava na lista de ids do banco', () => {
    const comNovo = {
      dependentes: [...associadoBase.dependentes, dep({ id: 'novo-1', nome: 'NETO' })],
    };
    const lista = dependentesParaReativacao(comNovo, hoje, ['d1', 'd2', 'd3']);
    expect(lista.map((d) => d.novo)).toEqual([false, false, false, true]);
  });

  it('sem a lista de ids, ninguém é novo — é o estado de quem só confere', () => {
    expect(dependentesParaReativacao(associadoBase, hoje).every((d) => d.novo === false)).toBe(true);
  });
});

describe('acrescentarDependente', () => {
  const novoDep = dep({ id: 'n1', nome: 'NETO', parentesco: 'NETO(A)' });

  it('acrescenta ao fim, sem tocar nos que já estavam', () => {
    const r = acrescentarDependente(associadoBase, novoDep);
    expect(r.dependentes.map((d) => d.id)).toEqual(['d1', 'd2', 'd3', 'n1']);
    expect(r.dependentes[0]).toEqual(associadoBase.dependentes[0]);
  });

  it('mesmo id substitui em vez de duplicar — é o caminho de corrigir o que foi digitado', () => {
    const comNovo = acrescentarDependente(associadoBase, novoDep);
    const corrigido = acrescentarDependente(comNovo, { ...novoDep, nome: 'NETO CORRIGIDO' });
    expect(corrigido.dependentes).toHaveLength(4);
    expect(corrigido.dependentes[3].nome).toBe('NETO CORRIGIDO');
  });

  it('cadastro sem lista de dependentes aceita o primeiro', () => {
    expect(acrescentarDependente({ dependentes: undefined }, novoDep).dependentes).toEqual([novoDep]);
  });
});

describe('podeRemoverDependente', () => {
  it('só o acrescentado nesta tela sai da lista', () => {
    // O já cadastrado pode ter atendimento apontando para a linha dele: removê-lo faria
    // `saveAssociado` apagá-lo do Postgres. Para esse, o caminho é desmarcar.
    expect(podeRemoverDependente({ novo: true })).toBe(true);
    expect(podeRemoverDependente({ novo: false })).toBe(false);
    expect(podeRemoverDependente(null)).toBe(false);
    expect(podeRemoverDependente(undefined)).toBe(false);
  });
});

describe('removerDependenteNovo', () => {
  it('tira só o id pedido', () => {
    const comNovo = acrescentarDependente(associadoBase, dep({ id: 'n1', nome: 'NETO' }));
    const r = removerDependenteNovo(comNovo, 'n1');
    expect(r.dependentes.map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('id inexistente não mexe na lista', () => {
    expect(removerDependenteNovo(associadoBase, 'nao-existe').dependentes).toHaveLength(3);
  });
});

describe('dependentesMarcadosPorPadrao', () => {
  it('marca todos — a inativação foi em cascata, a reativação também é', () => {
    const lista = dependentesParaReativacao(associadoBase, hoje);
    expect(dependentesMarcadosPorPadrao(lista)).toEqual(['d1', 'd2', 'd3']);
  });
});

describe('vidasDaReativacao', () => {
  const lista = dependentesParaReativacao(associadoBase, hoje);

  it('conta o titular mais os marcados', () => {
    expect(vidasDaReativacao(lista, ['d1', 'd2', 'd3'])).toEqual({
      nVidas: 4,
      idadesDependentes: [26, 35, 0],
    });
  });

  it('desmarcar um dependente tira a vida dele da conta do plano', () => {
    // É o que faz a escolha valer dinheiro: sem isso o contrato cobraria por quem não
    // vai ser coberto.
    expect(vidasDaReativacao(lista, ['d1'])).toEqual({ nVidas: 2, idadesDependentes: [26] });
  });

  it('titular sozinho é uma vida', () => {
    expect(vidasDaReativacao(lista, [])).toEqual({ nVidas: 1, idadesDependentes: [] });
  });

  it('id desconhecido não inventa vida', () => {
    expect(vidasDaReativacao(lista, ['nao-existe']).nVidas).toBe(1);
  });

  it('dependente acrescentado na tela conta como vida igual aos outros', () => {
    const comNovo = acrescentarDependente(associadoBase, dep({
      id: 'n1',
      nome: 'NETO',
      data_nascimento: '2020-05-05',
    }));
    const listaComNovo = dependentesParaReativacao(comNovo, hoje, ['d1', 'd2', 'd3']);
    expect(vidasDaReativacao(listaComNovo, ['d1', 'n1'])).toEqual({
      nVidas: 3,
      idadesDependentes: [26, 6],
    });
  });
});

describe('aplicarSelecaoDeDependentes', () => {
  it('marcado vira ativo, não marcado vira inativo', () => {
    const deps = aplicarSelecaoDeDependentes(associadoBase.dependentes, ['d1', 'd3']);
    expect(deps.map((d) => [d.id, d.status])).toEqual([
      ['d1', 'ativo'],
      ['d2', 'inativo'],
      ['d3', 'ativo'],
    ]);
  });

  it('nenhum dependente é removido — o atendimento do falecido aponta para a linha', () => {
    const deps = aplicarSelecaoDeDependentes(associadoBase.dependentes, []);
    expect(deps).toHaveLength(3);
    expect(deps.every((d) => d.status === 'inativo')).toBe(true);
  });

  it('preserva os demais campos do dependente', () => {
    const [primeiro] = aplicarSelecaoDeDependentes(associadoBase.dependentes, ['d1']);
    expect(primeiro.nome).toBe('JOÃO');
    expect(primeiro.data_nascimento).toBe('2000-01-10');
  });
});

describe('montarAssociadoReativado', () => {
  const dados = {
    planoId: 'p-novo',
    planoNome: 'Plano Ouro',
    valorPlano: 120,
    numeroContrato: 'CTR-NOVO1234',
    dataAdesao: '2026-09-14',
    idsDependentesReativados: ['d1', 'd2'],
    idHistorico: 'h1',
  };

  it('volta a ativo com o plano e o contrato novos', () => {
    const r = montarAssociadoReativado(associadoBase, dados);
    expect(r.status).toBe('ativo');
    expect(r.plano_pax_id).toBe('p-novo');
    expect(r.plano_nome).toBe('Plano Ouro');
    expect(r.valor_plano).toBe(120);
    expect(r.numero_contrato).toBe('CTR-NOVO1234');
    expect(r.data_adesao).toBe('2026-09-14');
  });

  it('arquiva o contrato anterior no histórico', () => {
    const r = montarAssociadoReativado(associadoBase, dados);
    expect(r.historico_contratos).toEqual([
      { id: 'h1', plano: 'Plano Prata', valor: 80, data_inicio: '2020-03-01', data_fim: '2026-09-14' },
    ]);
  });

  it('o contrato anterior termina no dia em que o novo começa, mesmo com adesão retroativa', () => {
    // Com a data de hoje no lugar desta, uma adesão retroagida abriria um intervalo entre o
    // contrato arquivado e o vigente — e `contratos.data_fim` diria outra coisa.
    const r = montarAssociadoReativado(associadoBase, { ...dados, dataAdesao: '2026-08-01' });
    expect(r.historico_contratos?.[0].data_fim).toBe('2026-08-01');
    expect(r.data_adesao).toBe('2026-08-01');
  });

  it('arquiva mesmo quando o plano escolhido é o mesmo de antes', () => {
    // O wizard de contrato só arquiva quando o plano muda. Aqui a adesão anterior terminou
    // de fato na inativação, então readerir ao mesmo plano ainda é um contrato novo.
    const r = montarAssociadoReativado(
      associadoBase,
      { ...dados, planoId: 'p-antigo', planoNome: 'Plano Prata' },
    );
    expect(r.historico_contratos).toHaveLength(1);
    expect(r.historico_contratos?.[0].plano).toBe('Plano Prata');
  });

  it('preserva o histórico que já existia', () => {
    const comHistorico = {
      ...associadoBase,
      historico_contratos: [
        { id: 'h0', plano: 'Plano Bronze', valor: 50, data_inicio: '2015-01-01', data_fim: '2020-02-28' },
      ],
    };
    const r = montarAssociadoReativado(comHistorico, dados);
    expect(r.historico_contratos?.map((h) => h.id)).toEqual(['h0', 'h1']);
  });

  it('cadastro sem contrato anterior não cria entrada em branco', () => {
    const semContrato = {
      ...associadoBase,
      plano_nome: undefined,
      valor_plano: undefined,
      data_adesao: '',
    } as Associado;
    expect(montarAssociadoReativado(semContrato, dados).historico_contratos).toEqual([]);
  });

  it('n_vidas acompanha a escolha, senão a próxima geração cobraria por quem ficou de fora', () => {
    expect(montarAssociadoReativado(associadoBase, dados).n_vidas).toBe(3);
    expect(
      montarAssociadoReativado(
        associadoBase,
        { ...dados, idsDependentesReativados: [] },
      ).n_vidas,
    ).toBe(1);
  });

  it('aplica a seleção aos dependentes gravados', () => {
    const r = montarAssociadoReativado(associadoBase, dados);
    expect(r.dependentes.map((d) => d.status)).toEqual(['ativo', 'ativo', 'inativo']);
  });

  it('o dependente acrescentado é gravado ativo e entra na contagem de vidas', () => {
    const comNovo = acrescentarDependente(associadoBase, dep({ id: 'n1', nome: 'NETO' }));
    const r = montarAssociadoReativado(comNovo, {
      ...dados,
      idsDependentesReativados: ['d1', 'n1'],
    });
    expect(r.dependentes.map((d) => [d.id, d.status])).toEqual([
      ['d1', 'ativo'],
      ['d2', 'inativo'],
      ['d3', 'inativo'],
      ['n1', 'ativo'],
    ]);
    expect(r.n_vidas).toBe(3);
  });
});

describe('gerarNumeroContratoReativacao', () => {
  it('usa o mesmo formato do wizard de contrato', () => {
    expect(gerarNumeroContratoReativacao('ab12cd34')).toBe('CTR-AB12CD34');
    expect(gerarNumeroContratoReativacao()).toMatch(/^CTR-[0-9A-Z]+$/);
  });
});
