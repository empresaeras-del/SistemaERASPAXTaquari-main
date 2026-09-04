import { describe, it, expect } from 'vitest';
import {
  resolverVariaveisEmpresa,
  resolverVariaveisAssociado,
  resolverVariaveisDependente,
  resolverVariaveisContrato,
  resolverVariaveisAtendimento,
  resolverVariaveisAtendimentoParcelas,
  resolverVariaveisUsuario,
  resolverVariaveisSistema,
} from './documentoVariaveis';
import { Empresa } from '../services/empresasService';
import { Associado, Dependente } from '../services/associadosService';
import { Atendimento } from '../types/atendimentos';
import { ParcelaReceber } from '../services/financeiroService';
import { Usuario } from '../types';

const empresa: Empresa = {
  id: 'emp-1',
  razao_social: 'Eras Pax Taquari LTDA',
  nome_fantasia: 'Eras Pax',
  cnpj: '12.345.678/0001-90',
  email: 'contato@eraspax.com.br',
  telefone: '(67) 99999-0000',
  endereco: 'Rua Principal, 100 - Coxim/MS',
  status: 'ativo',
  chave_pix: '12345678000190',
};

const associado: Associado = {
  id: 'assoc-1',
  tenant_id: 'emp-1',
  nome: 'João da Silva',
  cpf: '111.222.333-44',
  status: 'ativo',
  data_adesao: '2026-01-15',
  endereco_logradouro: 'Rua das Flores',
  endereco_numero: '42',
  endereco_bairro: 'Centro',
  endereco_cidade: 'Coxim',
  endereco_cep: '79400-000',
  numero_contrato: 'CTR-0001',
  valor_plano: 89.9,
  plano_nome: 'Plano Família',
  dependentes: [
    { id: 'dep-1', nome: 'Maria da Silva', cpf: '555.666.777-88', data_nascimento: '2010-03-20', parentesco: 'Filha' },
  ],
};

describe('resolverVariaveisEmpresa', () => {
  it('resolve nome, razão social, CNPJ e chave PIX', () => {
    const vars = resolverVariaveisEmpresa(empresa);
    expect(vars['{{empresa_nome}}']).toBe('Eras Pax');
    expect(vars['{{empresa_razao_social}}']).toBe('Eras Pax Taquari LTDA');
    expect(vars['{{empresa_cnpj}}']).toBe('12.345.678/0001-90');
    expect(vars['{{empresa_chave_pix}}']).toBe('12345678000190');
  });

  it('usa razão social como fallback quando não há nome fantasia', () => {
    const semFantasia: Empresa = { ...empresa, nome_fantasia: '' };
    const vars = resolverVariaveisEmpresa(semFantasia);
    expect(vars['{{empresa_nome}}']).toBe('Eras Pax Taquari LTDA');
  });
});

describe('resolverVariaveisAssociado', () => {
  it('resolve nome, CPF, endereço completo e lista de dependentes', () => {
    const vars = resolverVariaveisAssociado(associado);
    expect(vars['{{associado_nome}}']).toBe('João da Silva');
    expect(vars['{{associado_cpf}}']).toBe('111.222.333-44');
    expect(vars['{{associado_endereco}}']).toContain('Rua das Flores');
    expect(vars['{{associado_endereco}}']).toContain('nº 42');
    expect(vars['{{quantidade_dependentes}}']).toBe('1');
    expect(vars['{{associado_dependentes}}']).toContain('Maria da Silva');
    expect(vars['{{associado_dependentes}}']).toContain('Filha');
  });

  it('mostra mensagem padrão quando não há dependentes', () => {
    const semDependentes: Associado = { ...associado, dependentes: [] };
    const vars = resolverVariaveisAssociado(semDependentes);
    expect(vars['{{associado_dependentes}}']).toBe('Nenhum dependente vinculado');
    expect(vars['{{quantidade_dependentes}}']).toBe('0');
  });
});

describe('resolverVariaveisDependente', () => {
  it('resolve os dados do dependente individualmente selecionado', () => {
    const dep: Dependente = associado.dependentes![0];
    const vars = resolverVariaveisDependente(dep);
    expect(vars['{{dependente_nome}}']).toBe('Maria da Silva');
    expect(vars['{{dependente_parentesco}}']).toBe('Filha');
  });
});

describe('resolverVariaveisContrato', () => {
  it('deriva os dados de contrato a partir do associado (não há tabela de contrato própria)', () => {
    const vars = resolverVariaveisContrato(associado);
    expect(vars['{{contrato_numero}}']).toBe('CTR-0001');
    expect(vars['{{contrato_status}}']).toBe('ATIVO');
    expect(vars['{{contrato_valor_mensalidade}}']).toContain('89,90');
  });
});

describe('resolverVariaveisAtendimento', () => {
  const atendimento: Atendimento = {
    id: 'atd-1',
    tenant_id: 'emp-1',
    tipo_cliente: 'associado',
    falecido_nome: 'José Pereira',
    falecido_cpf: '999.888.777-66',
    status: 'concluido',
    valor_total: 1500,
    cor_falecido: 'Parda',
    sexo_falecido: 'Masculino',
    local_obito: 'Hospital Municipal',
    hora_obito: '14:30',
    declaracao_obito: 'DO-2026-0042',
    medico_responsavel: 'Dra. Ana Costa',
    crm_medico: 'CRM/MS 12345',
    rqe_medico: 'RQE 6789',
    inicio_tanato: '16:00',
    termino_tanato: '18:00',
  };

  it('resolve os dados do falecido, incluindo os campos de óbito religados na Fase 1', () => {
    const vars = resolverVariaveisAtendimento(atendimento);
    expect(vars['{{falecido_nome}}']).toBe('José Pereira');
    expect(vars['{{cor_falecido}}']).toBe('Parda');
    expect(vars['{{sexo_falecido}}']).toBe('Masculino');
    expect(vars['{{local_obito}}']).toBe('Hospital Municipal');
    expect(vars['{{hora_obito}}']).toBe('14:30');
    expect(vars['{{declaracao_obito}}']).toBe('DO-2026-0042');
    expect(vars['{{medico_resp}}']).toBe('Dra. Ana Costa');
    expect(vars['{{crm_medico}}']).toBe('CRM/MS 12345');
    expect(vars['{{rqe_medico}}']).toBe('RQE 6789');
    expect(vars['{{inicio_tanato}}']).toBe('16:00');
    expect(vars['{{termino_tanato}}']).toBe('18:00');
  });

  it('resolve as tags com o prefixo atendimento_ como aliases das mesmas informações', () => {
    const vars = resolverVariaveisAtendimento(atendimento);
    expect(vars['{{atendimento_falecido_nome}}']).toBe(vars['{{falecido_nome}}']);
    expect(vars['{{atendimento_local_velorio}}']).toBe(vars['{{local_velorio}}']);
  });
});

describe('resolverVariaveisAtendimentoParcelas', () => {
  it('lista as parcelas financeiras formatadas', () => {
    const parcelas: ParcelaReceber[] = [
      { id: 'p1', tenant_id: 'emp-1', receita_id: 'r1', numero_parcela: 1, valor: 250, data_vencimento: '2026-10-01', status: 'pendente' },
    ];
    const vars = resolverVariaveisAtendimentoParcelas(parcelas);
    expect(vars['{{atendimento_parcelas_lista}}']).toContain('Parcela 1');
    expect(vars['{{atendimento_parcelas_lista}}']).toContain('PENDENTE');
  });

  it('mostra mensagem padrão quando não há parcelas', () => {
    const vars = resolverVariaveisAtendimentoParcelas([]);
    expect(vars['{{atendimento_parcelas_lista}}']).toBe('Nenhuma parcela financeira');
  });
});

describe('resolverVariaveisUsuario', () => {
  it('traduz o nível de acesso para um rótulo legível', () => {
    const user: Usuario = { id: 'u1', nome: 'Carla Souza', email: 'carla@eraspax.com.br', nivel: 'admin', modulos_permitidos: [] };
    const vars = resolverVariaveisUsuario(user);
    expect(vars['{{usuario_nome}}']).toBe('Carla Souza');
    expect(vars['{{usuario_nivel}}']).toBe('Administrador');
  });
});

describe('resolverVariaveisSistema', () => {
  it('resolve data, hora e mês a partir de uma data fixa', () => {
    const vars = resolverVariaveisSistema(new Date(2026, 8, 4, 10, 30));
    expect(vars['{{data_atual}}']).toBe('04/09/2026');
    expect(vars['{{ano_atual}}']).toBe('2026');
    expect(vars['{{mes_atual}}'].toLowerCase()).toContain('setembro');
  });
});
