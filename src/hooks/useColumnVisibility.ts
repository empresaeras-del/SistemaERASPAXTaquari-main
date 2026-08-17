import { useState } from 'react';

export function useColumnVisibility(defaultColumns: string[]) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultColumns);
  const isVisible = (col: string) => visibleColumns.includes(col);
  return { visibleColumns, setVisibleColumns, isVisible };
}
