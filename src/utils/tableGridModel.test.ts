import { describe, it, expect } from 'vitest';
import {
  buildOccupancy, countColumns, mergeCells, splitCell,
  insertRow, deleteRow, insertColumn, deleteColumn, setColumnWidth,
} from './tableGridModel';

function makeTable(rowsxcols: number[]): HTMLTableElement {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  for (let r = 0; r < rowsxcols.length; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < rowsxcols[r]; c++) {
      const cell = document.createElement('td');
      cell.textContent = `r${r}c${c}`;
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  document.body.appendChild(table);
  return table;
}

describe('tableGridModel', () => {
  it('buildOccupancy mapeia uma tabela simples 3x3', () => {
    const t = makeTable([3, 3, 3]);
    const grid = buildOccupancy(t);
    expect(grid.length).toBe(3);
    expect(countColumns(grid)).toBe(3);
    expect(grid[1][1]!.el.textContent).toBe('r1c1');
  });

  it('mergeCells mescla um retângulo 2x2', () => {
    const t = makeTable([3, 3, 3]);
    const res = mergeCells(t, 0, 0, 1, 1);
    expect(res.ok).toBe(true);
    const grid = buildOccupancy(t);
    const origin = grid[0][0]!;
    expect(origin.rowSpan).toBe(2);
    expect(origin.colSpan).toBe(2);
    expect(grid[1][1]).toBe(origin);
    expect(t.rows[0].cells.length).toBe(2);
    expect(t.rows[1].cells.length).toBe(1);
  });

  it('mergeCells rejeita seleção que corta uma célula já mesclada', () => {
    const t = makeTable([3, 3, 3]);
    mergeCells(t, 0, 0, 1, 1);
    const res = mergeCells(t, 1, 1, 2, 2);
    expect(res.ok).toBe(false);
  });

  it('splitCell desfaz a mesclagem devolvendo células 1x1', () => {
    const t = makeTable([3, 3, 3]);
    mergeCells(t, 0, 0, 1, 1);
    splitCell(t, 0, 0);
    const grid = buildOccupancy(t);
    expect(grid[0][0]!.rowSpan).toBe(1);
    expect(grid[0][0]!.colSpan).toBe(1);
    expect(grid[0][1]!.rowSpan).toBe(1);
    expect(grid[1][0]!.rowSpan).toBe(1);
    expect(grid[1][1]!.rowSpan).toBe(1);
    expect(countColumns(grid)).toBe(3);
    expect(t.rows[0].cells.length).toBe(3);
    expect(t.rows[1].cells.length).toBe(3);
  });

  it('insertRow "below" cresce um merge vertical que cruza o ponto de inserção', () => {
    const t = makeTable([2, 2, 2]);
    mergeCells(t, 0, 0, 1, 0);
    insertRow(t, 0, 'below');
    const grid = buildOccupancy(t);
    expect(grid.length).toBe(4);
    expect(grid[0][0]!.rowSpan).toBe(3);
    expect(grid[0][0]).toBe(grid[1][0]);
    expect(grid[0][0]).toBe(grid[2][0]);
    expect(grid[1][1]).toBeDefined();
  });

  it('insertRow "above" não afeta um merge que começa depois do ponto de inserção', () => {
    const t = makeTable([2, 2, 2]);
    mergeCells(t, 0, 0, 1, 0);
    insertRow(t, 0, 'above');
    const grid = buildOccupancy(t);
    expect(grid.length).toBe(4);
    expect(grid[1][0]!.rowSpan).toBe(2);
    expect(grid[0][0]).not.toBe(grid[1][0]);
  });

  it('deleteRow relocaliza a origem de um merge vertical para a próxima linha', () => {
    const t = makeTable([2, 2, 2]);
    mergeCells(t, 0, 0, 1, 0);
    deleteRow(t, 0);
    const grid = buildOccupancy(t);
    expect(grid.length).toBe(2);
    expect(grid[0][0]!.rowSpan).toBe(1);
    expect(t.rows[0].cells.length).toBe(2);
  });

  it('insertColumn "right" cresce um merge horizontal que cruza o ponto de inserção', () => {
    const t = makeTable([3, 3]);
    mergeCells(t, 0, 0, 0, 1);
    insertColumn(t, 0, 'right');
    const grid = buildOccupancy(t);
    expect(countColumns(grid)).toBe(4);
    expect(grid[0][0]!.colSpan).toBe(3);
    expect(grid[1][0]).not.toBe(grid[0][0]);
    expect(grid[1][1]).toBeDefined();
  });

  it('deleteColumn encolhe ou remove células conforme o colSpan', () => {
    const t = makeTable([3, 3]);
    mergeCells(t, 0, 0, 0, 1);
    deleteColumn(t, 0);
    const grid = buildOccupancy(t);
    expect(countColumns(grid)).toBe(2);
    expect(grid[0][0]!.colSpan).toBe(1);
    expect(grid[1][0]!.el.textContent).toBe('r1c1');
  });

  it('setColumnWidth cria um colgroup e define a largura da coluna', () => {
    const t = makeTable([2, 2]);
    setColumnWidth(t, 1, 150);
    const colgroup = t.querySelector('colgroup');
    expect(colgroup).not.toBeNull();
    expect(colgroup!.children.length).toBe(2);
    expect((colgroup!.children[1] as HTMLElement).style.width).toBe('150px');
  });
});
