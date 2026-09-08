/**
 * Filtro da listagem de credenciados.
 *
 * Extraído da página para poder ser testado: a combinação de busca livre com
 * três filtros é o tipo de lógica que quebra em silêncio quando alguém
 * acrescenta mais um critério.
 */
import type { Credenciado } from '../types/credenciados';
import { contemTermo, normalizarTermo } from './normalizarTexto';

export interface FiltrosCredenciados {
  busca?: string;
  status?: string;
  /** `'todos'` = sem filtro. */
  ramo?: string;
  /** `'todas'` = sem filtro. */
  especialidade?: string;
}

/** Campos varridos pela busca livre. */
export function casaBusca(credenciado: Credenciado, busca: string): boolean {
  if (!normalizarTermo(busca)) return true;
  const alvos = [
    credenciado.razao_social,
    credenciado.nome_fantasia,
    credenciado.cnpj_cpf,
    // A especialidade entra na busca livre: quem procura "cardio" espera achar
    // o cardiologista sem precisar abrir o seletor de especialidade.
    credenciado.especialidade,
  ];
  return alvos.some((alvo) => alvo && contemTermo(alvo, busca));
}

/** Aplica busca e filtros na ordem em que a listagem os apresenta. */
export function filtrarCredenciados(
  credenciados: readonly Credenciado[],
  filtros: FiltrosCredenciados,
): Credenciado[] {
  const { busca = '', status = '', ramo = 'todos', especialidade = 'todas' } = filtros;
  return credenciados.filter((c) => {
    if (!casaBusca(c, busca)) return false;
    if (status && c.status !== status) return false;
    if (ramo !== 'todos' && c.ramo_atividade !== ramo) return false;
    if (especialidade !== 'todas' && c.especialidade !== especialidade) return false;
    return true;
  });
}

/**
 * Especialidades presentes na base, para montar o seletor. Só faz sentido
 * oferecer o que existe — uma lista com as 55 do CFM, quase todas sem nenhum
 * credenciado, seria ruído.
 */
export function especialidadesPresentes(credenciados: readonly Credenciado[]): string[] {
  const vistas = new Set<string>();
  for (const c of credenciados) {
    const valor = (c.especialidade || '').trim();
    if (valor) vistas.add(valor);
  }
  return [...vistas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
