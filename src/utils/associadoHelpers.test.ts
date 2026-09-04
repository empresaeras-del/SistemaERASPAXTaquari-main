import { describe, it, expect } from 'vitest';
import {
  filtrarEOrdenarAssociados,
  extrairTodosDependentes,
  filtrarDependentes,
  calcularEstatisticasAssociados,
  encontrarAssociadoComCpfDuplicado,
  calcularNVidasEIdades,
  construirEntradaHistoricoContrato,
  aplicarEnderecoViaCep,
  aplicarMudancaCampoAssociado,
} from './associadoHelpers';
import { Associado, Dependente } from '../services/associadosService';

const mkAssociado = (over: Partial<Associado>): Associado => ({
  id: over.id || '1',
  tenant_id: 'default_tenant',
  nome: 'Sem Nome',
  cpf: '',
  status: 'ativo',
  data_adesao: '2026-01-01',
  dependentes: [],
  ...over,
});

describe('filtrarEOrdenarAssociados', () => {
  const lista = [
    mkAssociado({ id: '1', nome: 'Carlos Souza', cpf: '111.111.111-11', status: 'ativo', plano_pax_id: 'p1', data_adesao: '2026-03-01' }),
    mkAssociado({ id: '2', nome: 'Ana Beatriz', cpf: '222.222.222-22', status: 'inadimplente', plano_pax_id: 'p2', data_adesao: '2026-01-10' }),
    mkAssociado({ id: '3', nome: 'Bruno Lima', cpf: '333.333.333-33', status: 'ativo', plano_pax_id: 'p1', data_adesao: '2026-02-15' }),
  ];

  it('filtra por nome (case-insensitive)', () => {
    const r = filtrarEOrdenarAssociados(lista, { searchTerm: 'ana', statusFilter: '', planoFilter: '', sortBy: 'nome_asc' });
    expect(r.map(a => a.id)).toEqual(['2']);
  });

  it('filtra por dígitos do CPF ignorando pontuação', () => {
    const r = filtrarEOrdenarAssociados(lista, { searchTerm: '222222222', statusFilter: '', planoFilter: '', sortBy: 'nome_asc' });
    expect(r.map(a => a.id)).toEqual(['2']);
  });

  it('filtra por status', () => {
    const r = filtrarEOrdenarAssociados(lista, { searchTerm: '', statusFilter: 'inadimplente', planoFilter: '', sortBy: 'nome_asc' });
    expect(r.map(a => a.id)).toEqual(['2']);
  });

  it('filtra por plano', () => {
    const r = filtrarEOrdenarAssociados(lista, { searchTerm: '', statusFilter: '', planoFilter: 'p1', sortBy: 'nome_asc' });
    expect(r.map(a => a.id).sort()).toEqual(['1', '3']);
  });

  it('ordena por nome A-Z', () => {
    const r = filtrarEOrdenarAssociados(lista, { searchTerm: '', statusFilter: '', planoFilter: '', sortBy: 'nome_asc' });
    expect(r.map(a => a.nome)).toEqual(['Ana Beatriz', 'Bruno Lima', 'Carlos Souza']);
  });

  it('ordena por nome Z-A', () => {
    const r = filtrarEOrdenarAssociados(lista, { searchTerm: '', statusFilter: '', planoFilter: '', sortBy: 'nome_desc' });
    expect(r.map(a => a.nome)).toEqual(['Carlos Souza', 'Bruno Lima', 'Ana Beatriz']);
  });

  it('ordena por adesão mais antiga primeiro', () => {
    const r = filtrarEOrdenarAssociados(lista, { searchTerm: '', statusFilter: '', planoFilter: '', sortBy: 'adesao_asc' });
    expect(r.map(a => a.id)).toEqual(['2', '3', '1']);
  });

  it('ordena por adesão mais recente primeiro', () => {
    const r = filtrarEOrdenarAssociados(lista, { searchTerm: '', statusFilter: '', planoFilter: '', sortBy: 'adesao_desc' });
    expect(r.map(a => a.id)).toEqual(['1', '3', '2']);
  });

  it('não muta o array original', () => {
    const original = [...lista];
    filtrarEOrdenarAssociados(lista, { searchTerm: '', statusFilter: '', planoFilter: '', sortBy: 'nome_desc' });
    expect(lista).toEqual(original);
  });
});

describe('extrairTodosDependentes / filtrarDependentes', () => {
  const dep1: Dependente = { id: 'd1', nome: 'Filho Um', parentesco: 'filho' };
  const dep2: Dependente = { id: 'd2', nome: 'Filha Dois', parentesco: 'filha' };
  const associados = [
    mkAssociado({ id: '1', nome: 'Titular A', status: 'ativo', dependentes: [dep1] }),
    mkAssociado({ id: '2', nome: 'Titular B', status: 'inativo', dependentes: [dep2] }),
  ];

  it('achata dependentes de todos os associados anotando o titular', () => {
    const todos = extrairTodosDependentes(associados);
    expect(todos).toHaveLength(2);
    expect(todos[0]).toMatchObject({ nome: 'Filho Um', titular_nome: 'Titular A', titular_status: 'ativo' });
    expect(todos[1]).toMatchObject({ nome: 'Filha Dois', titular_nome: 'Titular B', titular_status: 'inativo' });
  });

  it('filtra dependentes por nome do dependente ou do titular', () => {
    const todos = extrairTodosDependentes(associados);
    expect(filtrarDependentes(todos, 'filho').map(d => d.id)).toEqual(['d1']);
    expect(filtrarDependentes(todos, 'titular b').map(d => d.id)).toEqual(['d2']);
    expect(filtrarDependentes(todos, '')).toHaveLength(2);
  });
});

describe('calcularEstatisticasAssociados', () => {
  it('agrega titulares, dependentes, inadimplentes e associados sem parcelas', () => {
    const associados = [
      mkAssociado({ id: '1', status: 'ativo', dependentes: [{ id: 'd1', nome: 'X', parentesco: 'filho' }] }),
      mkAssociado({ id: '2', status: 'inadimplente', dependentes: [] }),
      mkAssociado({ id: '3', status: 'ativo', dependentes: [] }),
    ];
    const parcelasAbertasMap = { '1': 2, '3': 0 };
    const stats = calcularEstatisticasAssociados(associados, parcelasAbertasMap);
    expect(stats).toEqual({
      totalTitulares: 3,
      totalDependentes: 1,
      vidasProtegidas: 4,
      inadimplentes: 1,
      qtdAssociadosAtivosSemParcelas: 1, // só o '3': ativo e 0 parcelas
    });
  });
});

describe('encontrarAssociadoComCpfDuplicado', () => {
  const associados = [
    mkAssociado({ id: '1', cpf: '111.111.111-11', status: 'ativo' }),
    mkAssociado({ id: '2', cpf: '222.222.222-22', status: 'inativo' }),
  ];

  it('encontra associado ativo com mesmo CPF (ignorando pontuação)', () => {
    const dup = encontrarAssociadoComCpfDuplicado(associados, '11111111111');
    expect(dup?.id).toBe('1');
  });

  it('ignora associados inativos', () => {
    expect(encontrarAssociadoComCpfDuplicado(associados, '222.222.222-22')).toBeUndefined();
  });

  it('exclui o próprio registro sendo editado', () => {
    expect(encontrarAssociadoComCpfDuplicado(associados, '111.111.111-11', '1')).toBeUndefined();
  });

  it('retorna undefined para CPF vazio', () => {
    expect(encontrarAssociadoComCpfDuplicado(associados, '')).toBeUndefined();
  });
});

describe('calcularNVidasEIdades', () => {
  it('conta titular + dependentes, e calcula idade a partir do ano de nascimento', () => {
    const anoAtual = new Date().getFullYear();
    const deps: Dependente[] = [
      { id: 'd1', nome: 'A', parentesco: 'filho', data_nascimento: `${anoAtual - 10}-01-01` },
      { id: 'd2', nome: 'B', parentesco: 'filha' }, // sem data de nascimento
    ];
    const { nVidas, idadesDependentes } = calcularNVidasEIdades(deps);
    expect(nVidas).toBe(3);
    expect(idadesDependentes).toEqual([10, 0]);
  });

  it('retorna nVidas = 1 quando não há dependentes', () => {
    expect(calcularNVidasEIdades(undefined)).toEqual({ nVidas: 1, idadesDependentes: [] });
    expect(calcularNVidasEIdades([])).toEqual({ nVidas: 1, idadesDependentes: [] });
  });
});

describe('construirEntradaHistoricoContrato', () => {
  it('monta a entrada com os dados do plano anterior', () => {
    const entrada = construirEntradaHistoricoContrato(
      { plano_nome: 'Plano Ouro', valor_plano: 150, data_adesao: '2025-01-01' },
      'novo-id',
      '2026-09-04'
    );
    expect(entrada).toEqual({
      id: 'novo-id',
      plano: 'Plano Ouro',
      valor: 150,
      data_inicio: '2025-01-01',
      data_fim: '2026-09-04',
    });
  });

  it('usa "Anterior" quando o plano antigo não tem nome', () => {
    const entrada = construirEntradaHistoricoContrato(
      { plano_nome: undefined, valor_plano: undefined, data_adesao: '2025-01-01' },
      'novo-id',
      '2026-09-04'
    );
    expect(entrada.plano).toBe('Anterior');
    expect(entrada.valor).toBe(0);
  });
});

describe('aplicarEnderecoViaCep', () => {
  it('substitui logradouro/bairro/cidade quando o ViaCEP retorna valor', () => {
    const prev: Partial<Associado> = { endereco_logradouro: 'Antiga Rua', endereco_bairro: 'Bairro Antigo' };
    const result = aplicarEnderecoViaCep(prev, { logradouro: 'Rua Nova', bairro: 'Bairro Novo', localidade: 'Cuiabá', uf: 'MT' }, '78000-000');
    expect(result.endereco_logradouro).toBe('RUA NOVA');
    expect(result.logradouro).toBe('RUA NOVA');
    expect(result.endereco_bairro).toBe('BAIRRO NOVO');
    expect(result.endereco_cidade).toBe('CUIABÁ - MT');
    expect(result.endereco_cep).toBe('78000-000');
    expect(result.cep).toBe('78000-000');
  });

  it('preserva o valor já digitado quando o ViaCEP não retorna logradouro/bairro', () => {
    const prev = { endereco_logradouro: 'Rua Que O Usuário Já Digitou', endereco_bairro: 'Bairro Já Digitado' };
    const result = aplicarEnderecoViaCep(prev, { logradouro: '', bairro: '', localidade: 'Cuiabá', uf: 'MT' }, '78000-000');
    expect(result.endereco_logradouro).toBe('Rua Que O Usuário Já Digitou');
    expect(result.endereco_bairro).toBe('Bairro Já Digitado');
  });
});

describe('aplicarMudancaCampoAssociado', () => {
  it('maiusculiza valores de texto por padrão', () => {
    const result = aplicarMudancaCampoAssociado({ nome: '' }, 'nome', 'maria da silva');
    expect(result.nome).toBe('MARIA DA SILVA');
  });

  it('não maiusculiza email, senha ou status', () => {
    const vazio: Record<string, unknown> = {};
    expect(aplicarMudancaCampoAssociado(vazio, 'email', 'maria@x.com').email).toBe('maria@x.com');
    expect(aplicarMudancaCampoAssociado(vazio, 'status', 'ativo').status).toBe('ativo');
  });

  it('mascara o CEP progressivamente e sincroniza os dois aliases', () => {
    const vazio: Record<string, unknown> = {};
    const result = aplicarMudancaCampoAssociado(vazio, 'endereco_cep', '78000000');
    expect(result.endereco_cep).toBe('78000-000');
    expect(result.cep).toBe('78000-000');
  });

  it('sincroniza logradouro <-> endereco_logradouro', () => {
    const vazio: Record<string, unknown> = {};
    const result = aplicarMudancaCampoAssociado(vazio, 'logradouro', 'rua nova');
    expect(result.logradouro).toBe('RUA NOVA');
    expect(result.endereco_logradouro).toBe('RUA NOVA');
  });

  it('sincroniza cidade/endereco_cidade/municipio juntos', () => {
    const vazio: Record<string, unknown> = {};
    const result = aplicarMudancaCampoAssociado(vazio, 'endereco_cidade', 'cuiabá');
    expect(result.endereco_cidade).toBe('CUIABÁ');
    expect(result.cidade).toBe('CUIABÁ');
    expect(result.municipio).toBe('CUIABÁ');
  });

  it('preserva os demais campos do objeto original', () => {
    const result = aplicarMudancaCampoAssociado({ id: '1', nome: 'X' }, 'telefone', '65999998888');
    expect(result.id).toBe('1');
    expect(result.nome).toBe('X');
  });
});
