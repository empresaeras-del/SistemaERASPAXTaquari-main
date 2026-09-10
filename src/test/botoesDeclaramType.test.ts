import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda de projeto: todo `<button>` do `src/` declara `type` explicitamente.
 *
 * Em HTML, botão sem `type` dentro de um `<form>` vale `type="submit"`. Como modais e
 * abas deste sistema são renderizados dentro do `<form>` de outra tela — o
 * `AssociadoFormModal` embrulha todas as abas num só —, o botão de zoom e o X de fechar
 * do visualizador de documentos acabavam salvando e fechando o cadastro do associado.
 * Bug real relatado da UI em 10/09/2026 (PR #48) e varrido do projeto inteiro depois.
 *
 * A checagem é sobre o **código-fonte**, de propósito: o defeito não aparece no
 * componente isolado, só quando ele é montado dentro de um formulário — e é exatamente
 * essa combinação que ninguém lembra de testar. Aqui não depende de lembrar.
 */
const RAIZ = 'src';
const JANELA_TAG = 40;

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosTsx(caminho);
    return caminho.endsWith('.tsx') ? [caminho] : [];
  });
}

/**
 * Tags `<button>` de verdade, com a tag de abertura inteira — ela pode ocupar várias
 * linhas. Duas exclusões que a primeira versão desta varredura não tinha, e que a
 * fariam acusar falso:
 *
 * - **Linha de comentário não é JSX.** Este próprio arquivo cita `<button>` na
 *   documentação acima; um detector ingênuo se acusaria.
 * - **Tag que não fecha na janela é ignorada.** Sem isso, um trecho que só se parece
 *   com abertura de tag consumiria dezenas de linhas e reportaria lixo.
 *
 * O fim da tag é o primeiro `>` em fim de linha com as chaves de expressão JSX
 * balanceadas: `className={\`...\`}` e `onClick={() => {...}}` têm `>` no meio que não
 * fecham tag nenhuma.
 */
function tagsDeBotao(fonte: string): { linha: number; tag: string }[] {
  const linhas = fonte.split('\n');
  const encontradas: { linha: number; tag: string }[] = [];

  for (let i = 0; i < linhas.length; i++) {
    if (!/<button(?=[\s>])|<button$/.test(linhas[i])) continue;
    if (/^\s*(\*|\/\/|\/\*)/.test(linhas[i])) continue;

    const bloco: string[] = [];
    let fechou = false;
    for (let j = i; j < Math.min(i + JANELA_TAG, linhas.length); j++) {
      bloco.push(linhas[j]);
      const ate = bloco.join('\n');
      const chavesBalanceadas =
        (ate.match(/\{/g) || []).length === (ate.match(/\}/g) || []).length;
      if (/>\s*$/.test(linhas[j]) && chavesBalanceadas) {
        fechou = true;
        i = j;
        break;
      }
    }
    if (fechou) encontradas.push({ linha: i + 1, tag: bloco.join('\n') });
  }
  return encontradas;
}

describe('todo <button> declara type', () => {
  const arquivos = arquivosTsx(RAIZ);

  it('nenhum botão fica sem type', () => {
    const semType: string[] = [];

    for (const arquivo of arquivos) {
      const fonte = readFileSync(arquivo, 'utf-8');
      for (const { linha, tag } of tagsDeBotao(fonte)) {
        if (!/\btype\s*=/.test(tag)) semType.push(`${arquivo}:${linha}`);
      }
    }

    expect(semType).toEqual([]);
  });

  // As duas asserções abaixo guardam o guarda: uma varredura quebrada passaria vazia e
  // não estaria protegendo nada.
  it('a varredura encontra os arquivos do projeto', () => {
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it('a varredura de fato enxerga botões', () => {
    const total = arquivos.reduce(
      (acc, arquivo) => acc + tagsDeBotao(readFileSync(arquivo, 'utf-8')).length,
      0,
    );
    expect(total).toBeGreaterThan(300);
  });

  it('ignora <button> citado em comentário — este arquivo mesmo cita um', () => {
    const fonte = ['/**', ' * Exemplo: <button> sem type.', ' */', 'const x = 1;'].join('\n');
    expect(tagsDeBotao(fonte)).toEqual([]);
  });

  it('encontra tanto a tag de uma linha quanto a de várias', () => {
    const umaLinha = '<button onClick={f}>Ok</button>';
    const varias = ['<button', '  onClick={f}', '>', '  Ok', '</button>'].join('\n');
    expect(tagsDeBotao(umaLinha)).toHaveLength(1);
    expect(tagsDeBotao(varias)).toHaveLength(1);
  });
});
