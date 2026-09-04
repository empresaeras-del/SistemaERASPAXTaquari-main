import { describe, it, expect } from 'vitest';
import {
  getActionConfig,
  getUserRoleBadge,
  formatKeyName,
  calcularCamposAlterados,
  formatDetalhesParaTexto,
  filtrarLogsAuditoria,
  calcularEstatisticasAuditoria,
} from './auditoriaHelpers';
import { LogAuditoria } from '../services/auditoriaService';

describe('getActionConfig', () => {
  it('classifica backup/restauração como "backup", mesmo mencionando "excluir"', () => {
    expect(getActionConfig('Restaurar Backup e excluir temporários').type).toBe('backup');
  });

  it('classifica exclusão/estorno/cancelamento como "delete"', () => {
    expect(getActionConfig('Excluir Associado').type).toBe('delete');
    expect(getActionConfig('Estorno de Recebimento').type).toBe('delete');
    expect(getActionConfig('Cancelamento de Receita').type).toBe('delete');
  });

  it('rótulo de estorno é diferente do rótulo genérico de exclusão', () => {
    expect(getActionConfig('Estorno de Pagamento').badgeLabel).toBe('ESTORNO');
    expect(getActionConfig('Excluir Fornecedor').badgeLabel).toBe('EXCLUSÃO');
  });

  it('classifica criação/novo/abertura como "create"', () => {
    expect(getActionConfig('Criar Associado').type).toBe('create');
    expect(getActionConfig('Abertura de Caixa').type).toBe('create');
  });

  it('"salvar" sem "editar" é criação, mas com "editar" não é', () => {
    expect(getActionConfig('Salvar Receita').type).toBe('create');
    expect(getActionConfig('Salvar após Editar Cadastro').type).not.toBe('create');
  });

  it('classifica termos financeiros como "finance"', () => {
    expect(getActionConfig('Registrar Receita').type).toBe('finance');
    expect(getActionConfig('Pagamento de Despesa').type).toBe('finance');
  });

  it('classifica edição/atualização/fechamento como "update"', () => {
    expect(getActionConfig('Editar Contrato').type).toBe('update');
    expect(getActionConfig('Fechamento do Cadastro').type).toBe('update');
  });

  it(
    'quirk pré-existente do original: "reabertura" cai em "create" porque contém "abertura" ' +
    '(a checagem de criação vem antes da de atualização) — documentado, não corrigido nesta extração',
    () => {
      expect(getActionConfig('Reabertura de Caixa').type).toBe('create');
      expect(getActionConfig('Reabertura de Lote').badgeLabel).toBe('NOVO REGISTRO');
    }
  );

  it('rótulo de alteração para edição genérica', () => {
    expect(getActionConfig('Editar Usuário').badgeLabel).toBe('ALTERAÇÃO');
  });

  it('cai no fallback "general" para ações não reconhecidas', () => {
    expect(getActionConfig('Login no sistema via SSO').type).toBe('backup'); // contém "sistema"
    expect(getActionConfig('Consultar relatório').type).toBe('general');
  });

  it('cada tipo tem um ícone associado', () => {
    expect(getActionConfig('Criar Associado').icon).toBeDefined();
    expect(getActionConfig('Consultar relatório').icon).toBeDefined();
  });
});

describe('getUserRoleBadge', () => {
  it('mapeia cada nível conhecido para um rótulo em português', () => {
    expect(getUserRoleBadge('super_admin').label).toBe('Super Admin');
    expect(getUserRoleBadge('admin').label).toBe('Administrador');
    expect(getUserRoleBadge('gerente').label).toBe('Gerente');
    expect(getUserRoleBadge('funcionario').label).toBe('Funcionário');
    expect(getUserRoleBadge('sistema').label).toBe('Sistema');
  });

  it('cai em "Operador" para nível desconhecido ou ausente', () => {
    expect(getUserRoleBadge(undefined).label).toBe('Operador');
    expect(getUserRoleBadge('nivel-inexistente').label).toBe('Operador');
  });
});

describe('formatKeyName', () => {
  it('usa o rótulo mapeado quando existe', () => {
    expect(formatKeyName('valor_pago')).toBe('Valor Pago');
    expect(formatKeyName('razao_social')).toBe('Razão Social');
  });

  it('para chaves não mapeadas, converte snake_case em Title Case', () => {
    expect(formatKeyName('campo_customizado_novo')).toBe('Campo Customizado Novo');
  });
});

describe('calcularCamposAlterados', () => {
  it('retorna só os campos que mudaram', () => {
    const changes = calcularCamposAlterados({ nome: 'A', status: 'ativo' }, { nome: 'B', status: 'ativo' });
    expect(changes).toEqual([{ key: 'nome', oldVal: 'A', newVal: 'B' }]);
  });

  it('detecta campos novos (ausentes no anterior) e removidos (ausentes no novo)', () => {
    const changes = calcularCamposAlterados({ a: 1 }, { b: 2 });
    expect(changes).toEqual(expect.arrayContaining([
      { key: 'a', oldVal: 1, newVal: undefined },
      { key: 'b', oldVal: undefined, newVal: 2 },
    ]));
  });

  it('retorna lista vazia quando não há diferenças', () => {
    expect(calcularCamposAlterados({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it('trata null/undefined como objeto vazio', () => {
    expect(calcularCamposAlterados(null, { a: 1 })).toEqual([{ key: 'a', oldVal: undefined, newVal: 1 }]);
    expect(calcularCamposAlterados(undefined, undefined)).toEqual([]);
  });
});

describe('formatDetalhesParaTexto', () => {
  it('retorna "-" para detalhes ausentes', () => {
    expect(formatDetalhesParaTexto(null)).toBe('-');
  });

  it('retorna a string diretamente quando detalhes já é string', () => {
    expect(formatDetalhesParaTexto('texto livre')).toBe('texto livre');
  });

  it('formata um diff de dados_anteriores/dados_novos', () => {
    const texto = formatDetalhesParaTexto({ dados_anteriores: { nome: 'A' }, dados_novos: { nome: 'B' } });
    expect(texto).toBe('Nome: "A" -> "B"');
  });

  it('indica quando não há alterações diretas em campos', () => {
    const texto = formatDetalhesParaTexto({ dados_anteriores: { nome: 'A' }, dados_novos: { nome: 'A' } });
    expect(texto).toBe('Sem alterações diretas em campos.');
  });

  it('monta texto a partir de justificativa/motivo/observação e demais campos', () => {
    const texto = formatDetalhesParaTexto({ justificativa: 'Erro de digitação', valor: 150 });
    expect(texto).toContain('Justificativa: Erro de digitação');
    expect(texto).toContain('Valor: R$');
  });

  it('ignora chaves de metadado internas (usuario, usuario_email etc.)', () => {
    const texto = formatDetalhesParaTexto({ usuario: 'fulano', usuario_email: 'a@b.com', descricao: 'X' });
    expect(texto).not.toContain('fulano');
    expect(texto).toContain('Descrição');
  });
});

const mkLog = (over: Partial<LogAuditoria>): LogAuditoria => ({
  id: over.id || 'l1',
  tenant_id: 'default_tenant',
  usuario_id: 'u1',
  acao: 'Ação Genérica',
  detalhes: null,
  created_at: '2026-09-04T12:00:00.000Z',
  ...over,
});

describe('filtrarLogsAuditoria', () => {
  const filtrosBase = { searchTerm: '', dataInicio: '', dataFim: '', moduloFiltro: 'todos', tipoAcaoFiltro: 'todos' as const, usuarioFiltro: 'todos' };

  it('busca por texto na ação', () => {
    const logs = [mkLog({ id: '1', acao: 'Excluir Associado' }), mkLog({ id: '2', acao: 'Editar Contrato' })];
    expect(filtrarLogsAuditoria(logs, { ...filtrosBase, searchTerm: 'associado' }).map(l => l.id)).toEqual(['1']);
  });

  it('busca por nome/email do usuário responsável', () => {
    const logs = [mkLog({ id: '1', usuarios: { nome: 'Maria Silva', email: 'maria@x.com' } })];
    expect(filtrarLogsAuditoria(logs, { ...filtrosBase, searchTerm: 'maria' })).toHaveLength(1);
  });

  it('filtra por período', () => {
    const logs = [
      mkLog({ id: '1', created_at: '2026-01-10T12:00:00.000Z' }),
      mkLog({ id: '2', created_at: '2026-02-10T12:00:00.000Z' }),
    ];
    const r = filtrarLogsAuditoria(logs, { ...filtrosBase, dataInicio: '2026-02-01', dataFim: '2026-02-28' });
    expect(r.map(l => l.id)).toEqual(['2']);
  });

  it('filtra por módulo financeiro (palavras-chave)', () => {
    const logs = [mkLog({ id: '1', acao: 'Registrar Receita' }), mkLog({ id: '2', acao: 'Editar Associado' })];
    expect(filtrarLogsAuditoria(logs, { ...filtrosBase, moduloFiltro: 'financeiro' }).map(l => l.id)).toEqual(['1']);
  });

  it('filtra por tipo de ação (via getActionConfig)', () => {
    const logs = [mkLog({ id: '1', acao: 'Excluir Associado' }), mkLog({ id: '2', acao: 'Criar Associado' })];
    expect(filtrarLogsAuditoria(logs, { ...filtrosBase, tipoAcaoFiltro: 'delete' }).map(l => l.id)).toEqual(['1']);
  });

  it('filtra por usuário "sistema" quando não há usuario_id', () => {
    const logs = [mkLog({ id: '1', usuario_id: '' }), mkLog({ id: '2', usuario_id: 'u2' })];
    expect(filtrarLogsAuditoria(logs, { ...filtrosBase, usuarioFiltro: 'sistema' }).map(l => l.id)).toEqual(['1']);
  });

  it('filtra por um usuário específico (id, email ou nome)', () => {
    const logs = [
      mkLog({ id: '1', usuario_id: 'u1' }),
      mkLog({ id: '2', usuario_id: 'outro', usuarios: { nome: 'X', email: 'x@x.com' } }),
    ];
    expect(filtrarLogsAuditoria(logs, { ...filtrosBase, usuarioFiltro: 'u1' }).map(l => l.id)).toEqual(['1']);
  });

  it('combina todos os filtros ao mesmo tempo', () => {
    const logs = [mkLog({ id: '1', acao: 'Excluir Associado', usuario_id: 'u1' })];
    expect(filtrarLogsAuditoria(logs, { ...filtrosBase, searchTerm: 'associado', tipoAcaoFiltro: 'delete', usuarioFiltro: 'u1' })).toHaveLength(1);
  });
});

describe('calcularEstatisticasAuditoria', () => {
  it('conta total, logs de hoje, últimos 7 dias e usuários únicos', () => {
    const hoje = new Date('2026-09-10T12:00:00.000Z');
    const logs = [
      mkLog({ id: '1', usuario_id: 'u1', created_at: '2026-09-10T08:00:00.000Z' }), // hoje
      mkLog({ id: '2', usuario_id: 'u2', created_at: '2026-09-05T08:00:00.000Z' }), // dentro de 7 dias
      mkLog({ id: '3', usuario_id: 'u1', created_at: '2026-08-01T08:00:00.000Z' }), // fora do período
    ];
    const stats = calcularEstatisticasAuditoria(logs, hoje);
    expect(stats.totalLogs).toBe(3);
    expect(stats.logsHoje).toBe(1);
    expect(stats.logsUltimos7Dias).toBe(2);
    expect(stats.usuariosUnicos).toBe(2);
  });

  it('trata usuario_id ausente como usuário anônimo distinto por e-mail', () => {
    const logs = [
      mkLog({ id: '1', usuario_id: '', usuarios: { nome: 'X', email: 'a@x.com' } }),
      mkLog({ id: '2', usuario_id: '' }),
    ];
    const stats = calcularEstatisticasAuditoria(logs);
    expect(stats.usuariosUnicos).toBe(2); // 'a@x.com' e 'anon'
  });
});
