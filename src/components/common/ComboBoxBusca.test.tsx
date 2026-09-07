import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComboBoxBusca } from './ComboBoxBusca';

const OPCOES = ['Cardiologia', 'Clínica Médica', 'Cirurgia Vascular', 'Pediatria'];

describe('ComboBoxBusca', () => {
  it('mostra o placeholder quando não há valor', () => {
    render(<ComboBoxBusca options={OPCOES} onChange={() => {}} placeholder="Selecione..." />);
    expect(screen.getByRole('button', { name: /Selecione/ })).toBeTruthy();
  });

  it('mostra o valor escolhido no lugar do placeholder', () => {
    render(<ComboBoxBusca options={OPCOES} value="Pediatria" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Pediatria/ })).toBeTruthy();
  });

  it('abre a lista com todas as opções ao clicar', () => {
    render(<ComboBoxBusca options={OPCOES} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('option')).toHaveLength(OPCOES.length);
  });

  it('filtra ignorando acento — é o ponto do campo de busca', () => {
    render(<ComboBoxBusca options={OPCOES} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'clinica' } });
    const itens = screen.getAllByRole('option');
    expect(itens).toHaveLength(1);
    expect(itens[0].textContent).toContain('Clínica Médica');
  });

  it('avisa quando a busca não acha nada', () => {
    render(<ComboBoxBusca options={OPCOES} onChange={() => {}} emptyLabel="Nada aqui" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Nada aqui')).toBeTruthy();
  });

  it('devolve a opção escolhida e fecha a lista', () => {
    const onChange = vi.fn();
    render(<ComboBoxBusca options={OPCOES} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Cardiologia'));
    expect(onChange).toHaveBeenCalledWith('Cardiologia');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('limpa a seleção sem abrir a lista', () => {
    const onChange = vi.fn();
    render(<ComboBoxBusca options={OPCOES} value="Pediatria" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Limpar seleção'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('escolhe pelo teclado: seta para baixo e Enter', () => {
    const onChange = vi.fn();
    render(<ComboBoxBusca options={OPCOES} onChange={onChange} />);
    const botao = screen.getByRole('button');
    fireEvent.keyDown(botao, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByPlaceholderText('Buscar...'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByPlaceholderText('Buscar...'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('Clínica Médica');
  });

  it('fecha com Escape sem escolher nada', () => {
    const onChange = vi.fn();
    render(<ComboBoxBusca options={OPCOES} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByPlaceholderText('Buscar...'), { key: 'Escape' });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('não abre quando desabilitado', () => {
    render(<ComboBoxBusca options={OPCOES} onChange={() => {}} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
