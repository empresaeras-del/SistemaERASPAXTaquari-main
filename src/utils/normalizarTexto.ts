/**
 * Normalização de texto para busca: remove acentos, baixa a caixa e apara as
 * pontas. É o que faz "clinica medica" encontrar "Clínica Médica" num campo de
 * busca — sem isso, quem digita sem acento não acha nada.
 */
export function normalizarTermo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** `alvo` contém `termo`, ignorando acentos e caixa. */
export function contemTermo(alvo: string, termo: string): boolean {
  const t = normalizarTermo(termo);
  if (!t) return true;
  return normalizarTermo(alvo).includes(t);
}
