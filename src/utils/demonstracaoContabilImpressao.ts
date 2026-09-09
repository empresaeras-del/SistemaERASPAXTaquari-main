/**
 * HTML da janela de impressão da Demonstração Contábil.
 *
 * Mora aqui, e não dentro do modal, pela mesma razão de `montarHtmlImpressaoFicha`: é uma
 * função pura, dá para testar sem navegador, e mantém a prévia em tela e o papel lendo a
 * **mesma** decisão de o quê mostrar (`linhasDaDemonstracao`), com cada renderizador
 * decidindo só o como.
 *
 * ## A regra que este arquivo respeita
 *
 * A janela de impressão é `window.open('')` + `document.write` — um documento à parte, onde
 * **nenhuma classe do Tailwind existe**. `text-right`, `font-bold`, `tabular-nums`: todas
 * inertes lá dentro. Foi assim que a assinatura de documento saiu do tamanho errado no papel
 * (ver CLAUDE.md, "Impressão: três regras que já foram quebradas"). Por isso todo o estilo
 * daqui é CSS próprio, nomeando classes próprias — e o teste trava isso.
 */
import { LinhaDemonstracao, ResumoDemonstracao, ValoresDaConta } from './demonstracaoContabil';

export interface CabecalhoDemonstracao {
  empresaNome: string;
  /** CNPJ do emitente, **sem máscara**: é a identificação de quem emite, e é dado público. */
  empresaCnpj?: string | null;
  empresaEndereco?: string | null;
  logoUrl?: string | null;
  exercicio: number;
  planoNome: string;
  geradoPor: string;
  geradoEm: Date;
}

export interface DadosDemonstracao {
  cabecalho: CabecalhoDemonstracao;
  linhas: LinhaDemonstracao[];
  resumo: ResumoDemonstracao;
  foraDoExercicio: ValoresDaConta;
  naoClassificado: ValoresDaConta;
}

const moeda = (v: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const percentual = (v: number | null): string =>
  v === null ? '—' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v)}%`;

const dataHora = (d: Date): string =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d);

/** Escapa o que vem de dado do usuário antes de entrar na string de HTML. */
export function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * CSS da janela de impressão. Tudo o que a página precisa, porque nada mais chega lá.
 * Exportado à parte para o teste conseguir afirmar sobre as regras.
 */
export const CSS_IMPRESSAO_DEMONSTRACAO = `
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #0f172a;
    background: #fff;
  }
  .dc-cabecalho {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 12px;
  }
  .dc-emitente { font-size: 9pt; line-height: 1.35; }
  .dc-emitente strong { font-size: 12pt; text-transform: uppercase; display: block; }
  .dc-logo { max-height: 52px; max-width: 200px; object-fit: contain; }
  .dc-titulo { text-align: right; }
  .dc-titulo h1 { margin: 0; font-size: 13pt; text-transform: uppercase; letter-spacing: .5px; }
  .dc-titulo p { margin: 2px 0 0; font-size: 9pt; color: #475569; }

  .dc-resumo { display: flex; gap: 8px; margin-bottom: 12px; }
  .dc-cartao { flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; }
  .dc-cartao span { display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .4px; color: #64748b; }
  .dc-cartao b { display: block; font-size: 12pt; margin-top: 2px; }
  .dc-cartao em { display: block; font-style: normal; font-size: 8pt; color: #475569; }
  .dc-receita b { color: #047857; }
  .dc-despesa b { color: #b91c1c; }
  .dc-positivo b { color: #047857; }
  .dc-negativo b { color: #b91c1c; }

  table.dc-tabela { width: 100%; border-collapse: collapse; }
  table.dc-tabela thead th {
    background: #0f172a;
    color: #fff;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: .4px;
    padding: 5px 6px;
    text-align: left;
  }
  table.dc-tabela thead th.dc-num { text-align: right; }
  table.dc-tabela tbody td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; font-size: 9pt; }
  table.dc-tabela tbody td.dc-num { text-align: right; font-variant-numeric: tabular-nums; }
  table.dc-tabela tbody tr.dc-grupo { background: #f1f5f9; }
  table.dc-tabela tbody tr.dc-grupo td { font-weight: bold; }
  .dc-codigo { font-family: "Courier New", Courier, monospace; white-space: nowrap; }
  .dc-inativa { color: #94a3b8; }
  .dc-selo { font-size: 7pt; text-transform: uppercase; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 4px; margin-left: 4px; }

  .dc-nota { margin-top: 10px; font-size: 8.5pt; color: #475569; line-height: 1.4; }
  .dc-nota-alerta { color: #92400e; }
  .dc-rodape { margin-top: 14px; padding-top: 6px; border-top: 1px solid #cbd5e1; font-size: 8pt; color: #64748b; display: flex; justify-content: space-between; }

  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
`;

/** Indentação da conta pelo nível, em espaços não-quebráveis (não há Tailwind para isso). */
const recuo = (nivel: number): string => '&nbsp;'.repeat(Math.max(0, (nivel - 1) * 3));

function linhasHtml(linhas: LinhaDemonstracao[]): string {
  if (linhas.length === 0) {
    return '<tr><td colspan="5" style="padding:16px;text-align:center;color:#64748b;">Nenhuma conta com movimento neste exercício.</td></tr>';
  }
  return linhas
    .map((l) => {
      const classes = [l.tipo === 'sintetica' ? 'dc-grupo' : '', !l.ativo ? 'dc-inativa' : '']
        .filter(Boolean)
        .join(' ');
      const selo = l.ativo ? '' : '<span class="dc-selo">desativada</span>';
      return `<tr class="${classes}">
        <td class="dc-codigo">${recuo(l.nivel)}${escaparHtml(l.codigo)}</td>
        <td>${escaparHtml(l.nome)}${selo}</td>
        <td class="dc-num">${moeda(l.previsto)}</td>
        <td class="dc-num">${moeda(l.realizado)}</td>
        <td class="dc-num">${percentual(l.execucao)}</td>
      </tr>`;
    })
    .join('');
}

function notasHtml(dados: DadosDemonstracao): string {
  const notas: string[] = [];

  if (dados.foraDoExercicio.previsto !== 0 || dados.foraDoExercicio.realizado !== 0) {
    notas.push(
      `<p class="dc-nota dc-nota-alerta"><b>Fora do exercício ${dados.cabecalho.exercicio}:</b> ` +
        `${moeda(dados.foraDoExercicio.realizado)} realizado e ${moeda(dados.foraDoExercicio.previsto)} previsto ` +
        `em contas deste plano, com vencimento ou liquidação em outro ano — tipicamente as prestações ` +
        `seguintes de um parcelamento longo. Não estão somados acima.</p>`,
    );
  }

  if (dados.naoClassificado.previsto !== 0 || dados.naoClassificado.realizado !== 0) {
    notas.push(
      `<p class="dc-nota"><b>Sem conta deste plano:</b> ${moeda(dados.naoClassificado.realizado)} realizado e ` +
        `${moeda(dados.naoClassificado.previsto)} previsto em lançamentos anteriores ao plano de contas ou ` +
        `classificados em outro exercício. Não estão somados acima.</p>`,
    );
  }

  notas.push(
    '<p class="dc-nota"><b>Critérios:</b> <i>Previsto</i> é a parcela lançada, pelo valor de face e pela data de ' +
      'vencimento. <i>Realizado</i> é a parcela liquidada, pelo valor efetivamente recebido ou pago e pela data da ' +
      'liquidação. Parcelas canceladas ficam de fora das duas colunas. Uma parcela que vence num exercício e é ' +
      'liquidada no seguinte aparece como prevista em um e realizada no outro.</p>',
  );

  return notas.join('');
}

function cartao(titulo: string, valores: ValoresDaConta, classe: string): string {
  return `<div class="dc-cartao ${classe}">
    <span>${escaparHtml(titulo)}</span>
    <b>${moeda(valores.realizado)}</b>
    <em>realizado · previsto ${moeda(valores.previsto)}</em>
  </div>`;
}

/** Documento completo da janela de impressão. */
export function montarHtmlImpressaoDemonstracao(dados: DadosDemonstracao): string {
  const { cabecalho, resumo } = dados;

  const logo = cabecalho.logoUrl
    ? `<img class="dc-logo" src="${escaparHtml(cabecalho.logoUrl)}" alt="" />`
    : '';

  const emitente = `<div class="dc-emitente">
    ${logo}
    <strong>${escaparHtml(cabecalho.empresaNome)}</strong>
    ${cabecalho.empresaCnpj ? `CNPJ: ${escaparHtml(cabecalho.empresaCnpj)}<br/>` : ''}
    ${cabecalho.empresaEndereco ? escaparHtml(cabecalho.empresaEndereco) : ''}
  </div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Demonstração Contábil ${cabecalho.exercicio} — ${escaparHtml(cabecalho.empresaNome)}</title>
  <style>${CSS_IMPRESSAO_DEMONSTRACAO}</style>
</head>
<body>
  <div class="dc-cabecalho">
    ${emitente}
    <div class="dc-titulo">
      <h1>Demonstração Contábil</h1>
      <p>Exercício ${cabecalho.exercicio} · ${escaparHtml(cabecalho.planoNome)}</p>
    </div>
  </div>

  <div class="dc-resumo">
    ${cartao('Receitas', resumo.receita, 'dc-receita')}
    ${cartao('Despesas', resumo.despesa, 'dc-despesa')}
    ${cartao('Resultado do exercício', resumo.resultado, resumo.resultado.realizado < 0 ? 'dc-negativo' : 'dc-positivo')}
  </div>

  <table class="dc-tabela">
    <thead>
      <tr>
        <th>Código</th>
        <th>Conta</th>
        <th class="dc-num">Previsto</th>
        <th class="dc-num">Realizado</th>
        <th class="dc-num">Execução</th>
      </tr>
    </thead>
    <tbody>${linhasHtml(dados.linhas)}</tbody>
  </table>

  ${notasHtml(dados)}

  <div class="dc-rodape">
    <span>Emitido por ${escaparHtml(cabecalho.geradoPor)} em ${dataHora(cabecalho.geradoEm)}</span>
    <span>Sistema ERAS PAX</span>
  </div>
</body>
</html>`;
}
