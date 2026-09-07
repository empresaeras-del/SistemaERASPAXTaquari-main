/**
 * Catálogo de especialidades médicas para o cadastro de credenciados.
 *
 * Fonte: Resolução CFM nº 2.221/2018, que reconhece 55 especialidades médicas
 * (e 59 áreas de atuação, não incluídas aqui). Os Conselhos Regionais — o
 * CRM/MS entre eles — registram especialistas a partir dessa mesma lista; não
 * existe uma lista própria de cada estado.
 *
 * ATENÇÃO ao manter: este arquivo foi montado sem acesso de rede ao texto da
 * resolução (o ambiente bloqueia o portal do CFM), então confira contra a fonte
 * oficial antes de tratar a lista como definitiva. A contagem de 55 é validada
 * por teste — se adicionar ou remover um item, ajuste o teste conscientemente,
 * porque ele existe justamente para a divergência não passar despercebida.
 *
 * As especialidades são gravadas em `credenciados.especialidade` pelo próprio
 * rótulo (texto), e não por um código: é o que já estava previsto na coluna, e
 * mantém o dado legível em relatórios e exportações sem precisar de um de-para.
 */

import { contemTermo, normalizarTermo } from '../utils/normalizarTexto';

export { normalizarTermo };

/** As 55 especialidades médicas reconhecidas, em ordem alfabética. */
export const ESPECIALIDADES_MEDICAS: readonly string[] = [
  'Acupuntura',
  'Alergia e Imunologia',
  'Anestesiologia',
  'Angiologia',
  'Cardiologia',
  'Cirurgia Cardiovascular',
  'Cirurgia da Mão',
  'Cirurgia de Cabeça e Pescoço',
  'Cirurgia do Aparelho Digestivo',
  'Cirurgia Geral',
  'Cirurgia Oncológica',
  'Cirurgia Pediátrica',
  'Cirurgia Plástica',
  'Cirurgia Torácica',
  'Cirurgia Vascular',
  'Clínica Médica',
  'Coloproctologia',
  'Dermatologia',
  'Endocrinologia e Metabologia',
  'Endoscopia',
  'Gastroenterologia',
  'Genética Médica',
  'Geriatria',
  'Ginecologia e Obstetrícia',
  'Hematologia e Hemoterapia',
  'Homeopatia',
  'Infectologia',
  'Mastologia',
  'Medicina de Emergência',
  'Medicina de Família e Comunidade',
  'Medicina de Tráfego',
  'Medicina do Trabalho',
  'Medicina Esportiva',
  'Medicina Física e Reabilitação',
  'Medicina Intensiva',
  'Medicina Legal e Perícia Médica',
  'Medicina Nuclear',
  'Medicina Preventiva e Social',
  'Nefrologia',
  'Neurocirurgia',
  'Neurologia',
  'Nutrologia',
  'Oftalmologia',
  'Oncologia Clínica',
  'Ortopedia e Traumatologia',
  'Otorrinolaringologia',
  'Patologia',
  'Patologia Clínica/Medicina Laboratorial',
  'Pediatria',
  'Pneumologia',
  'Psiquiatria',
  'Radiologia e Diagnóstico por Imagem',
  'Radioterapia',
  'Reumatologia',
  'Urologia',
] as const;

/**
 * Filtra o catálogo por um termo digitado. Termo vazio devolve a lista inteira,
 * para o combobox abrir mostrando todas as opções.
 */
export function filtrarEspecialidades(
  termo: string,
  catalogo: readonly string[] = ESPECIALIDADES_MEDICAS,
): string[] {
  if (!normalizarTermo(termo)) return [...catalogo];
  return catalogo.filter((e) => contemTermo(e, termo));
}

/** Diz se um valor já gravado pertence ao catálogo — usado para sinalizar dado legado. */
export function ehEspecialidadeConhecida(
  valor: string | undefined | null,
  catalogo: readonly string[] = ESPECIALIDADES_MEDICAS,
): boolean {
  if (!valor) return false;
  const alvo = normalizarTermo(valor);
  return catalogo.some((e) => normalizarTermo(e) === alvo);
}
