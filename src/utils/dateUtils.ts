import { format, parseISO, isValid } from 'date-fns';

export const getCurrentDate = (): Date => {
  return new Date();
};

/**
 * Converte qualquer string de data ou Date em um objeto Date seguro,
 * evitando a regressão de 1 dia causada pela interpretação de fuso horário UTC (ex: UTC-3 / UTC-4).
 */
export const parseLocalDate = (dateVal: string | Date | null | undefined): Date | null => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }

  const str = String(dateVal).trim();
  if (!str) return null;

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0); // Meio-dia local seguro
  }

  // Formato YYYY-MM-DDTHH:mm:ss... ou ISO com tempo
  if (str.includes('T')) {
    const d = parseISO(str);
    if (isValid(d)) return d;
  }

  // Se vier com espaço YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}\s/.test(str)) {
    const d = parseISO(str.replace(' ', 'T'));
    if (isValid(d)) return d;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Formata com segurança uma data para exibição (padrão: dd/MM/yyyy).
 * Se a data for nula ou inválida, retorna o fallback (padrão: '-').
 */
export const formatLocalDate = (
  dateVal: string | Date | null | undefined,
  pattern: string = 'dd/MM/yyyy',
  fallback: string = '-'
): string => {
  const d = parseLocalDate(dateVal);
  if (!d) return fallback;
  try {
    return format(d, pattern);
  } catch {
    return fallback;
  }
};

/**
 * Formata data e hora para exibição (padrão: dd/MM/yyyy HH:mm).
 */
export const formatLocalDateTime = (
  dateVal: string | Date | null | undefined,
  fallback: string = '-'
): string => {
  return formatLocalDate(dateVal, 'dd/MM/yyyy HH:mm', fallback);
};

/**
 * Retorna se a data informada é estritamente anterior a hoje (comparando dia/mês/ano no fuso local).
 */
export const isDateBeforeToday = (dateVal: string | Date | null | undefined): boolean => {
  const d = parseLocalDate(dateVal);
  if (!d) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  
  return target.getTime() < today.getTime();
};

/**
 * Retorna se a data informada é hoje (comparando dia/mês/ano no fuso local).
 */
export const isDateToday = (dateVal: string | Date | null | undefined): boolean => {
  const d = parseLocalDate(dateVal);
  if (!d) return false;
  
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};
