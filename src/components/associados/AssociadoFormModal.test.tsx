import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AssociadoFormModal } from './AssociadoFormModal';

// AssociadoFormModal recebe todo o seu estado via props (props: any vindas de
// useAssociadosState) — não tem hooks próprios, então um smoke test de render
// não precisa de contexto/provider, só de props suficientes para o caminho
// renderizado. activeTab é propositalmente um valor que não bate com nenhuma
// aba conhecida, para renderizar só o cabeçalho/navegação (o corpo de cada aba
// vira null nesse caso) sem precisar simular os dados de todas as abas.
const baseProps = {
  isModalOpen: true,
  editingAssociado: { nome: 'Maria da Silva' },
  hasUnsavedChanges: false,
  isEditingMode: true,
  activeTab: '__nenhuma_aba__',
  setActiveTab: vi.fn(),
  executarValidacaoOuAlertar: vi.fn(() => true),
  handleCloseModal: vi.fn(),
  isSavingAssociado: false,
  isSavedAssociado: false,
  state: { isOnline: true, user: { nome: 'Teste' } },
  // O modal de Relatório Profissional é renderizado incondicionalmente no fim
  // do componente (controla sua própria visibilidade via isOpen internamente),
  // então mesmo os testes com o modal principal fechado precisam dessas props.
  filtered: [],
  empresaData: null,
  searchTerm: '',
  statusFilter: 'todos',
  planoFilter: 'todos',
  relatorioReportType: null,
  showRelatorioModal: false,
  setShowRelatorioModal: vi.fn(),
};

describe('AssociadoFormModal (smoke)', () => {
  it('não renderiza nada quando o modal está fechado', () => {
    const { container } = render(<AssociadoFormModal {...baseProps} isModalOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('não renderiza nada quando não há associado em edição, mesmo com o modal "aberto"', () => {
    const { container } = render(<AssociadoFormModal {...baseProps} editingAssociado={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza o cabeçalho com o nome do associado quando o modal está aberto (modo edição)', () => {
    const { getByText } = render(<AssociadoFormModal {...baseProps} />);
    expect(getByText('Editar Associado')).toBeInTheDocument();
  });

  it('mostra "Novo Associado" quando o associado em edição ainda não tem nome', () => {
    const { getByText } = render(<AssociadoFormModal {...baseProps} editingAssociado={{ nome: '' }} />);
    expect(getByText('Novo Associado')).toBeInTheDocument();
  });

  it('mostra o aviso de alterações pendentes quando hasUnsavedChanges é true', () => {
    const { getByText } = render(<AssociadoFormModal {...baseProps} hasUnsavedChanges />);
    expect(getByText('Alterações pendentes')).toBeInTheDocument();
  });
});
