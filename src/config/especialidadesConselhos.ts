/**
 * Catálogos de especialidades por conselho profissional, para o cadastro de
 * credenciados.
 *
 * Cada conselho mantém a própria lista: um cirurgião-dentista não tem
 * especialidade do CFM, um fisioterapeuta não tem do CFO. Por isso o catálogo
 * oferecido no formulário é escolhido pelo **ramo de atividade** do credenciado,
 * e não é uma lista única.
 *
 * ── PROCEDÊNCIA E CONFIANÇA ──────────────────────────────────────────────────
 * Cada catálogo declara `fonte` e `verificado`. `verificado: false` significa
 * que a lista foi montada a partir de conhecimento geral e de busca, mas **não**
 * foi conferida item a item contra o texto oficial do conselho — este ambiente
 * bloqueia o acesso de rede aos portais do CFM, CFO, COFFITO e CFP.
 *
 * Para o CFO a incerteza é maior e vale registrar: as fontes secundárias
 * divergem entre 19, 23 e 24 especialidades, porque a lista mudou em 2021
 * (quatro deixaram de ser reconhecidas) e voltou a crescer em 2023/2024. Trate
 * a lista abaixo como ponto de partida a conferir, não como referência.
 *
 * Conferir um catálogo é barato: troque os itens do array e marque
 * `verificado: true`. Os testes cobrem o mecanismo (mapeamento por ramo, ordem,
 * duplicatas, busca) e não travam o conteúdo das listas não verificadas — travar
 * uma contagem que não pude conferir daria uma falsa sensação de garantia.
 */
import { contemTermo, normalizarTermo } from '../utils/normalizarTexto';

export { normalizarTermo };

/** Um catálogo de especialidades de um conselho profissional. */
export interface CatalogoEspecialidades {
  id: string;
  /** Sigla do conselho (CFM, CFO, COFFITO, CFP). */
  conselho: string;
  /** Norma de onde a lista vem, para quem for conferir. */
  fonte: string;
  /** A lista já foi conferida item a item contra a fonte oficial? */
  verificado: boolean;
  itens: readonly string[];
}

/**
 * As 55 especialidades médicas da Resolução CFM nº 2.221/2018 — a lista que os
 * Conselhos Regionais, o CRM/MS incluído, usam para registrar especialistas.
 * Não existe lista própria por estado.
 */
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
 * Especialidades odontológicas (CFO). Ver a ressalva sobre a divergência entre
 * fontes no cabeçalho deste arquivo — esta é a de conferência mais urgente.
 */
export const ESPECIALIDADES_ODONTOLOGICAS: readonly string[] = [
  'Acupuntura',
  'Cirurgia e Traumatologia Buco-Maxilo-Faciais',
  'Dentística',
  'Disfunção Temporomandibular e Dor Orofacial',
  'Endodontia',
  'Estomatologia',
  'Harmonização Orofacial',
  'Homeopatia',
  'Implantodontia',
  'Odontogeriatria',
  'Odontologia do Esporte',
  'Odontologia do Trabalho',
  'Odontologia Hospitalar',
  'Odontologia Legal',
  'Odontologia para Pacientes com Necessidades Especiais',
  'Odontopediatria',
  'Ortodontia',
  'Ortopedia Funcional dos Maxilares',
  'Patologia Oral e Maxilofacial',
  'Periodontia',
  'Prótese Buco-Maxilo-Facial',
  'Prótese Dentária',
  'Radiologia Odontológica e Imaginologia',
  'Saúde Coletiva e da Família',
] as const;

/** Especialidades de fisioterapia (COFFITO). */
export const ESPECIALIDADES_FISIOTERAPIA: readonly string[] = [
  'Fisioterapia Aquática',
  'Fisioterapia Cardiovascular',
  'Fisioterapia Dermatofuncional',
  'Fisioterapia do Trabalho',
  'Fisioterapia em Acupuntura',
  'Fisioterapia em Gerontologia',
  'Fisioterapia em Oncologia',
  'Fisioterapia em Osteopatia',
  'Fisioterapia em Quiropraxia',
  'Fisioterapia em Saúde da Mulher',
  'Fisioterapia em Terapia Intensiva',
  'Fisioterapia Esportiva',
  'Fisioterapia Neurofuncional',
  'Fisioterapia Respiratória',
  'Fisioterapia Traumato-Ortopédica',
  'Saúde Coletiva',
] as const;

/** Especialidades de psicologia (CFP). */
export const ESPECIALIDADES_PSICOLOGIA: readonly string[] = [
  'Neuropsicologia',
  'Psicologia Clínica',
  'Psicologia do Esporte',
  'Psicologia do Trânsito',
  'Psicologia em Saúde',
  'Psicologia Escolar/Educacional',
  'Psicologia Hospitalar',
  'Psicologia Jurídica',
  'Psicologia Organizacional e do Trabalho',
  'Psicologia Social',
  'Psicomotricidade',
  'Psicopedagogia',
] as const;

export const CATALOGOS: readonly CatalogoEspecialidades[] = [
  {
    id: 'medicina',
    conselho: 'CFM',
    fonte: 'Resolução CFM nº 2.221/2018',
    verificado: false,
    itens: ESPECIALIDADES_MEDICAS,
  },
  {
    id: 'odontologia',
    conselho: 'CFO',
    fonte: 'Resoluções CFO (lista divergente entre fontes — conferir)',
    verificado: false,
    itens: ESPECIALIDADES_ODONTOLOGICAS,
  },
  {
    id: 'fisioterapia',
    conselho: 'COFFITO',
    fonte: 'Resoluções COFFITO',
    verificado: false,
    itens: ESPECIALIDADES_FISIOTERAPIA,
  },
  {
    id: 'psicologia',
    conselho: 'CFP',
    fonte: 'Resolução CFP de especialidades',
    verificado: false,
    itens: ESPECIALIDADES_PSICOLOGIA,
  },
] as const;

/**
 * Ramo de atividade → conselho cujo catálogo se aplica. Ramos ausentes daqui
 * (farmácia, outros) não têm catálogo: o campo de especialidade some do
 * formulário em vez de oferecer uma lista que não faz sentido para eles.
 */
const CATALOGO_POR_RAMO: Record<string, string> = {
  clinica_medica: 'medicina',
  hospital: 'medicina',
  medico_independente: 'medicina',
  laboratorio: 'medicina',
  odontologia: 'odontologia',
  fisioterapia: 'fisioterapia',
  psicologia: 'psicologia',
};

/** Catálogo aplicável a um ramo de atividade, ou `null` quando não há. */
export function catalogoDoRamo(ramo: string | undefined | null): CatalogoEspecialidades | null {
  if (!ramo) return null;
  const id = CATALOGO_POR_RAMO[ramo];
  if (!id) return null;
  return CATALOGOS.find((c) => c.id === id) ?? null;
}

/**
 * Filtra um catálogo por um termo digitado. Termo vazio devolve a lista inteira,
 * para o combobox abrir mostrando todas as opções.
 */
export function filtrarEspecialidades(
  termo: string,
  catalogo: readonly string[] = ESPECIALIDADES_MEDICAS,
): string[] {
  if (!normalizarTermo(termo)) return [...catalogo];
  return catalogo.filter((e) => contemTermo(e, termo));
}

/**
 * Diz se um valor já gravado pertence ao catálogo indicado — é assim que um
 * dado antigo, ou de outro conselho, é sinalizado em vez de descartado.
 */
export function ehEspecialidadeConhecida(
  valor: string | undefined | null,
  catalogo: readonly string[] = ESPECIALIDADES_MEDICAS,
): boolean {
  if (!valor) return false;
  const alvo = normalizarTermo(valor);
  return catalogo.some((e) => normalizarTermo(e) === alvo);
}
