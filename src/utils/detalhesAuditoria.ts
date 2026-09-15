/**
 * Enxuga o que vai para `auditoria.detalhes`.
 *
 * ## O que este módulo existe para impedir
 *
 * `saveAssociado` e `salvarPlano` passam o **registro inteiro** como
 * `dados_anteriores`/`dados_novos` — é o que alimenta o visualizador de diff da Ata de
 * Ocorrências, e está certo. O problema é o que vem junto: `associado.documentos[]` guarda
 * cada anexo como **data URI em base64**, e um contrato em PDF de 352 KB vira ~470 mil
 * caracteres — **duplicados**, porque o mesmo arquivo aparece no "antes" e no "depois".
 *
 * Em produção isso deu 76 linhas de "Editar Associado" com média de 385 mil caracteres,
 * **28 MB** numa tabela cujas outras 492 linhas somavam ~100 KB. O efeito não era só peso:
 * o `select('*')` da tela falhava, o `catch` servia o IndexedDB, e a Ata exibia o cache
 * local como se fosse o banco (ver a seção dela no CLAUDE.md).
 *
 * E o diff daquilo nunca foi legível: dois blocos de base64 de 470 KB lado a lado não
 * dizem a ninguém o que mudou.
 *
 * ## As três decisões
 *
 * - **Substituir, não remover.** Um anexo omitido vira
 *   `[arquivo application/pdf · 344 KB · #a3f21b8c]`. Some do log o **conteúdo**, não o
 *   fato de que existe um anexo — e é isso que faz a linha continuar auditável.
 * - **O descritor carrega uma impressão digital do conteúdo.** Sem ela, trocar um PDF por
 *   outro de tamanho parecido não apareceria no diff: `calcularCamposAlterados` compara
 *   com `JSON.stringify`, então dois descritores iguais significam "não mudou". O hash é
 *   um FNV-1a de 32 bits — não é criptográfico, e não precisa ser: ele responde "é o mesmo
 *   arquivo de antes?", não "qual é o arquivo".
 * - **O teto total é a última rede, e ela avisa.** Se mesmo enxugado o payload passar de
 *   `LIMITE_TOTAL_DETALHES`, as chaves mais pesadas saem e uma chave `_omitido` diz quais
 *   foram. Um log que encolheu em silêncio afirmaria ser completo sem ser — e esta tela
 *   existe justamente para ser a fonte da verdade sobre o que aconteceu.
 */

/** Acima disto, uma string de texto comum é cortada. */
export const LIMITE_STRING_DETALHE = 500;

/** Teto do payload inteiro, já enxugado. */
export const LIMITE_TOTAL_DETALHES = 64 * 1024;

/** Profundidade máxima percorrida — proteção contra estrutura circular/patológica. */
const PROFUNDIDADE_MAXIMA = 12;

const RE_DATA_URI = /^data:([^;,]*)?(;[^,]*)?,/i;

/**
 * FNV-1a 32 bits, em hex. Determinístico, síncrono e suficiente para responder
 * "este anexo é o mesmo de antes?" dentro de um diff.
 */
export const impressaoDigital = (texto: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

/** "344 KB", "1,2 MB" — só para leitura humana no descritor. */
export const formatarTamanho = (chars: number): string => {
  if (chars < 1024) return `${chars} B`;
  if (chars < 1024 * 1024) return `${Math.round(chars / 1024)} KB`;
  return `${(chars / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

/**
 * `true` para `data:application/pdf;base64,...` e afins.
 *
 * Devolve `boolean`, e não um type predicate `valor is string`: dentro de `enxugarValor` o
 * valor já está estreitado para `string`, e um predicate ali reduziria o ramo negativo a
 * `never` — o `tsc` reclama de `.length` logo abaixo.
 */
export const ehDataUri = (valor: unknown): boolean =>
  typeof valor === 'string' && RE_DATA_URI.test(valor);

/** Troca um anexo embutido pelo descritor que o representa no log. */
export const descreverAnexo = (dataUri: string): string => {
  const m = dataUri.match(RE_DATA_URI);
  const mime = (m?.[1] || 'desconhecido').trim() || 'desconhecido';
  return `[arquivo ${mime} · ${formatarTamanho(dataUri.length)} · #${impressaoDigital(dataUri)}]`;
};

const encurtarTexto = (texto: string): string =>
  `${texto.slice(0, LIMITE_STRING_DETALHE)}… [+${texto.length - LIMITE_STRING_DETALHE} caracteres · #${impressaoDigital(texto)}]`;

const enxugarValor = (valor: unknown, profundidade: number): unknown => {
  if (valor === null || valor === undefined) return valor;

  if (typeof valor === 'string') {
    if (ehDataUri(valor)) return descreverAnexo(valor);
    return valor.length > LIMITE_STRING_DETALHE ? encurtarTexto(valor) : valor;
  }

  if (typeof valor !== 'object') return valor;

  if (profundidade >= PROFUNDIDADE_MAXIMA) return '[profundidade máxima atingida]';

  if (Array.isArray(valor)) return valor.map(v => enxugarValor(v, profundidade + 1));

  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    saida[k] = enxugarValor(v, profundidade + 1);
  }
  return saida;
};

const pesoDe = (valor: unknown): number => {
  try {
    return JSON.stringify(valor)?.length ?? 0;
  } catch {
    return 0;
  }
};

/**
 * Enxuga o payload de `detalhes` inteiro. Idempotente: rodar duas vezes dá o mesmo
 * resultado, porque os descritores já não são data URI nem passam do limite de string.
 */
export const enxugarDetalhesAuditoria = (
  detalhes: Record<string, unknown>,
): Record<string, unknown> => {
  const enxuto = enxugarValor(detalhes, 0) as Record<string, unknown>;

  if (pesoDe(enxuto) <= LIMITE_TOTAL_DETALHES) return enxuto;

  // Rede final: mesmo sem anexos o payload passou do teto. Sai o mais pesado primeiro,
  // e a linha `_omitido` registra o que saiu — encolher calado faria o log afirmar que
  // está completo quando não está.
  const porPeso = Object.entries(enxuto).sort((a, b) => pesoDe(b[1]) - pesoDe(a[1]));
  const resultado: Record<string, unknown> = { ...enxuto };
  const omitidos: string[] = [];

  // A própria linha `_omitido` ocupa espaço, e ela cresce a cada campo removido. Medir o
  // payload sem contá-la faria o corte parar cedo demais e estourar o teto assim que a
  // mensagem fosse acrescentada — foi o que o teste do teto pegou.
  const mensagemDe = (lista: string[]) =>
    lista.length > 0 ? `Campos removidos por tamanho: ${lista.join(', ')}` : undefined;
  const pesoComMensagem = () => {
    const m = mensagemDe(omitidos);
    return pesoDe(m === undefined ? resultado : { ...resultado, _omitido: m });
  };

  for (const [chave] of porPeso) {
    if (pesoComMensagem() <= LIMITE_TOTAL_DETALHES) break;
    // `usuario`/`usuario_email`/`id` dizem quem agiu e sobre o quê: é o mínimo que um log
    // precisa ter para ainda valer como log.
    if (chave === 'usuario' || chave === 'usuario_email' || chave === 'id') continue;
    omitidos.push(`${chave} (${formatarTamanho(pesoDe(resultado[chave]))})`);
    delete resultado[chave];
  }

  const mensagem = mensagemDe(omitidos);
  if (mensagem !== undefined) resultado._omitido = mensagem;
  return resultado;
};
