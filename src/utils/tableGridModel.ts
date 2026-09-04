/**
 * Operações de edição de tabela em nível de célula (mesclar, dividir, inserir/excluir
 * linhas e colunas) — o motor por trás do editor de tabelas "modelo Office" dos
 * Documentos Padrões (`DocumentoTableEditModal.tsx`).
 *
 * Todas as funções operam diretamente sobre um `HTMLTableElement` já inserido em uma
 * árvore DOM (tipicamente um documento fabricado via `DOMParser`), mutando-o in place.
 * A grade de ocupação (`buildOccupancy`) é o modelo padrão usado por editores de tabela
 * para lidar corretamente com `colspan`/`rowspan`: cada posição (linha, coluna) da grade
 * aponta para a célula real que a ocupa, mesmo quando essa célula é maior que 1x1.
 */

export interface CellRef {
  el: HTMLTableCellElement;
  originRow: number;
  originCol: number;
  rowSpan: number;
  colSpan: number;
}

export type Occupancy = (CellRef | undefined)[][];

export function buildOccupancy(table: HTMLTableElement): Occupancy {
  const rows = Array.from(table.rows);
  const grid: Occupancy = rows.map(() => []);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let c = 0;
    for (const cell of Array.from(row.cells) as HTMLTableCellElement[]) {
      while (grid[r][c]) c++;
      const rowSpan = cell.rowSpan || 1;
      const colSpan = cell.colSpan || 1;
      const ref: CellRef = { el: cell, originRow: r, originCol: c, rowSpan, colSpan };
      for (let dr = 0; dr < rowSpan; dr++) {
        if (!grid[r + dr]) grid[r + dr] = [];
        for (let dc = 0; dc < colSpan; dc++) {
          grid[r + dr][c + dc] = ref;
        }
      }
      c += colSpan;
    }
  }
  return grid;
}

export function countColumns(grid: Occupancy): number {
  return grid.reduce((max, row) => Math.max(max, row.length), 0);
}

function createEmptyCell(doc: Document, likeRow: HTMLTableRowElement): HTMLTableCellElement {
  const isHeaderRow = likeRow.cells.length > 0 && Array.from(likeRow.cells).every(c => c.tagName === 'TH');
  const cell = doc.createElement(isHeaderRow ? 'th' : 'td') as HTMLTableCellElement;
  cell.innerHTML = '&nbsp;';
  return cell;
}

/** Índice de inserção (childIndex) dentro do DOM de `rowEl` para uma coluna-alvo, dada a grade daquela linha. */
function domInsertIndexForColumn(rowEl: HTMLTableRowElement, gridRow: (CellRef | undefined)[], targetCol: number): number {
  const seen = new Set<HTMLTableCellElement>();
  let index = 0;
  for (let c = 0; c < targetCol; c++) {
    const ref = gridRow[c];
    if (ref && ref.el.parentElement === rowEl && !seen.has(ref.el)) {
      seen.add(ref.el);
      index++;
    }
  }
  return index;
}

/** Mescla o retângulo [r1,c1]–[r2,c2] (inclusive, em coordenadas de grade) em uma única célula. */
export function mergeCells(table: HTMLTableElement, r1: number, c1: number, r2: number, c2: number): { ok: true } | { ok: false; motivo: string } {
  const rMin = Math.min(r1, r2), rMax = Math.max(r1, r2);
  const cMin = Math.min(c1, c2), cMax = Math.max(c1, c2);
  const grid = buildOccupancy(table);

  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const ref = grid[r]?.[c];
      if (!ref) return { ok: false, motivo: 'Seleção inclui uma posição vazia da tabela.' };
      const spansOutside =
        ref.originRow < rMin || ref.originRow + ref.rowSpan - 1 > rMax ||
        ref.originCol < cMin || ref.originCol + ref.colSpan - 1 > cMax;
      if (spansOutside) {
        return { ok: false, motivo: 'A seleção corta uma célula já mesclada. Ajuste a seleção para incluí-la por inteiro.' };
      }
    }
  }

  const origin = grid[rMin][cMin]!;
  origin.el.rowSpan = rMax - rMin + 1;
  origin.el.colSpan = cMax - cMin + 1;

  const removed = new Set<HTMLTableCellElement>([origin.el]);
  for (let r = rMin; r <= rMax; r++) {
    for (let c = cMin; c <= cMax; c++) {
      const ref = grid[r][c]!;
      if (!removed.has(ref.el)) {
        removed.add(ref.el);
        ref.el.remove();
      }
    }
  }
  return { ok: true };
}

/** Desfaz a mesclagem da célula que ocupa (r,c), devolvendo células vazias 1x1 às posições liberadas. */
export function splitCell(table: HTMLTableElement, r: number, c: number): void {
  const doc = table.ownerDocument;
  // Uma única leitura da grade, antes de qualquer mutação: recalcular a grade no meio da
  // divisão veria um estado temporariamente incompleto (colunas ainda vazias) e colocaria
  // as células remanescentes da linha nas colunas erradas.
  const grid = buildOccupancy(table);
  const ref = grid[r]?.[c];
  if (!ref) return;
  const { rowSpan, colSpan, originRow, originCol, el } = ref;
  if (rowSpan <= 1 && colSpan <= 1) return;

  el.rowSpan = 1;
  el.colSpan = 1;

  for (let dr = 0; dr < rowSpan; dr++) {
    const targetRow = originRow + dr;
    const rowEl = table.rows[targetRow];
    if (!rowEl) continue;
    const gridRow = grid[targetRow] || [];
    let insertedInRow = 0;

    for (let dc = 0; dc < colSpan; dc++) {
      if (dr === 0 && dc === 0) continue;
      const targetCol = originCol + dc;
      const baseIndex = domInsertIndexForColumn(rowEl, gridRow, targetCol);
      const insertIndex = baseIndex + insertedInRow;
      const newCell = createEmptyCell(doc, rowEl);
      rowEl.insertBefore(newCell, rowEl.children[insertIndex] || null);
      insertedInRow++;
    }
  }
}

export function insertRow(table: HTMLTableElement, atIndex: number, position: 'above' | 'below'): void {
  const doc = table.ownerDocument;
  const grid = buildOccupancy(table);
  const numCols = countColumns(grid);
  const B = position === 'above' ? atIndex : atIndex + 1;

  const refRow = table.rows[atIndex] || table.rows[table.rows.length - 1];
  const newTr = doc.createElement('tr');

  const processed = new Set<HTMLTableCellElement>();
  for (let c = 0; c < numCols; c++) {
    const aboveRef = B - 1 >= 0 ? grid[B - 1]?.[c] : undefined;
    if (aboveRef && aboveRef.originRow + aboveRef.rowSpan > B) {
      if (!processed.has(aboveRef.el)) {
        aboveRef.el.rowSpan = (aboveRef.el.rowSpan || 1) + 1;
        processed.add(aboveRef.el);
      }
      continue;
    }
    newTr.appendChild(createEmptyCell(doc, refRow || newTr));
  }

  if (position === 'above' && refRow) {
    refRow.parentElement?.insertBefore(newTr, refRow);
  } else if (refRow) {
    refRow.parentElement?.insertBefore(newTr, refRow.nextSibling);
  } else {
    (table.tBodies[0] || table).appendChild(newTr);
  }
}

export function deleteRow(table: HTMLTableElement, atIndex: number): void {
  if (table.rows.length <= 1) return;
  const grid = buildOccupancy(table);
  const rowEl = table.rows[atIndex];
  if (!rowEl) return;
  const numCols = countColumns(grid);
  const processed = new Set<HTMLTableCellElement>();

  for (let c = 0; c < numCols; c++) {
    const ref = grid[atIndex]?.[c];
    if (!ref || processed.has(ref.el)) continue;
    processed.add(ref.el);

    if (ref.el.parentElement === rowEl) {
      const rowSpan = ref.el.rowSpan || 1;
      if (rowSpan > 1) {
        const nextRow = table.rows[atIndex + 1];
        ref.el.rowSpan = rowSpan - 1;
        if (nextRow) {
          const gridNext = grid[atIndex + 1] || [];
          const insertIndex = domInsertIndexForColumn(nextRow, gridNext, ref.originCol);
          nextRow.insertBefore(ref.el, nextRow.children[insertIndex] || null);
        }
      }
    } else {
      const rowSpan = ref.el.rowSpan || 1;
      if (rowSpan > 1) ref.el.rowSpan = rowSpan - 1;
    }
  }

  rowEl.remove();
}

export function insertColumn(table: HTMLTableElement, atIndex: number, position: 'left' | 'right'): void {
  const grid = buildOccupancy(table);
  const numRows = table.rows.length;
  const B = position === 'left' ? atIndex : atIndex + 1;
  const processed = new Set<HTMLTableCellElement>();

  for (let r = 0; r < numRows; r++) {
    const leftRef = B - 1 >= 0 ? grid[r]?.[B - 1] : undefined;
    if (leftRef && leftRef.originCol + leftRef.colSpan > B) {
      if (!processed.has(leftRef.el)) {
        leftRef.el.colSpan = (leftRef.el.colSpan || 1) + 1;
        processed.add(leftRef.el);
      }
      continue;
    }
    const rowEl = table.rows[r];
    const insertIndex = domInsertIndexForColumn(rowEl, grid[r] || [], B);
    const newCell = createEmptyCell(table.ownerDocument, rowEl);
    rowEl.insertBefore(newCell, rowEl.children[insertIndex] || null);
  }
}

export function deleteColumn(table: HTMLTableElement, atIndex: number): void {
  const grid = buildOccupancy(table);
  const numCols = countColumns(grid);
  if (numCols <= 1) return;
  const numRows = table.rows.length;
  const processed = new Set<HTMLTableCellElement>();

  for (let r = 0; r < numRows; r++) {
    const ref = grid[r]?.[atIndex];
    if (!ref || processed.has(ref.el)) continue;
    processed.add(ref.el);
    const colSpan = ref.el.colSpan || 1;
    if (colSpan > 1) {
      ref.el.colSpan = colSpan - 1;
    } else {
      ref.el.remove();
    }
  }
}

/** Aplica uma largura (px) à coluna inteira via `<colgroup>`, criando-o se necessário. */
export function setColumnWidth(table: HTMLTableElement, colIndex: number, widthPx: number): void {
  const doc = table.ownerDocument;
  let colgroup = table.querySelector('colgroup');
  const grid = buildOccupancy(table);
  const numCols = countColumns(grid);

  if (!colgroup) {
    colgroup = doc.createElement('colgroup');
    for (let i = 0; i < numCols; i++) colgroup.appendChild(doc.createElement('col'));
    table.insertBefore(colgroup, table.firstChild);
  } else {
    while (colgroup.children.length < numCols) colgroup.appendChild(doc.createElement('col'));
  }

  const col = colgroup.children[colIndex] as HTMLElement | undefined;
  if (col) col.style.width = `${widthPx}px`;
}
