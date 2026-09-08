/**
 * Conteúdo da Ficha de Cadastro do Associado — extraído para ser a fonte única
 * dos três lugares que precisam do mesmo dado: a prévia em tela (JSX, com
 * zoom), a impressão (janela própria com CSS puro, sem Tailwind — ver
 * CLAUDE.md) e o PDF exportável (jsPDF). Antes cada um remontava os campos à
 * mão; divergiam sem ninguém perceber (o rótulo "Cidade/UF" nunca mostrou o
 * UF, porque só `endereco_cidade` era interpolado).
 *
 * O agrupamento de campos por linha é uma decisão de layout, então mora aqui
 * também — os três renderizadores usam o mesmo agrupamento, em vez de cada
 * um decidir sozinho quantos campos cabem por linha.
 */
import { Associado, Dependente } from '../services/associadosService';
import { Empresa } from '../services/empresasService';
import { formatLocalDate } from './dateUtils';

export interface CampoFicha {
  label: string;
  valor: string;
}

export interface SecaoFicha {
  titulo: string;
  /** Cada item é uma linha visual; uma linha pode ter 1 ou 2 campos. */
  linhas: CampoFicha[][];
}

const NAO_INFORMADO = 'Não informado';

const valorOu = (valor: string | null | undefined, fallback = NAO_INFORMADO): string => {
  const v = (valor ?? '').trim();
  return v || fallback;
};

const formatarMoeda = (valor: number | null | undefined): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

/** Monta as quatro seções de campos (fora dos dependentes, tratados à parte). */
export function montarSecoesFicha(associado: Associado): SecaoFicha[] {
  const cidadeUf = [associado.endereco_cidade, associado.endereco_estado]
    .filter((v) => (v ?? '').trim())
    .join(' - ');

  return [
    {
      titulo: 'Dados Pessoais & Contato',
      linhas: [
        [{ label: 'Nome', valor: valorOu(associado.nome, '') }],
        [
          { label: 'CPF', valor: valorOu(associado.cpf, '') },
          { label: 'RG', valor: valorOu(associado.rg) },
        ],
        [
          {
            label: 'Data de Nascimento',
            valor: formatLocalDate(associado.data_nascimento, 'dd/MM/yyyy', NAO_INFORMADO),
          },
          { label: 'Sexo', valor: valorOu(associado.sexo) },
        ],
        [
          { label: 'Status', valor: associado.status.toUpperCase() },
          {
            label: 'Data de Adesão',
            valor: formatLocalDate(associado.data_adesao, 'dd/MM/yyyy', NAO_INFORMADO),
          },
        ],
        [
          { label: 'Telefone', valor: valorOu(associado.telefone) },
          { label: 'E-mail', valor: valorOu(associado.email) },
        ],
      ],
    },
    {
      titulo: 'Endereço Residencial',
      linhas: [
        [
          {
            label: 'Logradouro',
            valor: `${valorOu(associado.endereco_logradouro, '')}${
              associado.endereco_numero ? `, ${associado.endereco_numero}` : ', s/n'
            }`,
          },
        ],
        [
          { label: 'Bairro', valor: valorOu(associado.endereco_bairro) },
          { label: 'Cidade/UF', valor: valorOu(cidadeUf) },
        ],
        [{ label: 'CEP', valor: valorOu(associado.endereco_cep) }],
      ],
    },
    {
      titulo: 'Filiação',
      linhas: [
        [{ label: 'Nome da Mãe', valor: valorOu(associado.nome_mae) }],
        [{ label: 'Nome do Pai', valor: valorOu(associado.nome_pai) }],
      ],
    },
    {
      titulo: 'Plano & Contrato',
      linhas: [
        [
          { label: 'Plano Atual', valor: valorOu(associado.plano_nome, 'Sem plano vinculado') },
          { label: 'Valor do Plano', valor: formatarMoeda(associado.valor_plano) },
        ],
        [{ label: 'Total de Vidas', valor: `${associado.n_vidas || 1} vida(s)` }],
      ],
    },
  ];
}

export interface LinhaDependenteFicha {
  nome: string;
  parentesco: string;
  cpf: string;
  dataNascimento: string;
}

/** Dependentes formatados para a tabela da ficha — vazio quando não há nenhum. */
export function montarDependentesFicha(associado: Associado): LinhaDependenteFicha[] {
  const dependentes: Dependente[] = associado.dependentes || [];
  return dependentes.map((dep) => ({
    nome: dep.nome,
    parentesco: dep.parentesco || '',
    cpf: dep.cpf || '',
    dataNascimento: formatLocalDate(dep.data_nascimento, 'dd/MM/yyyy', ''),
  }));
}

/**
 * HTML da janela de impressão da ficha — CSS próprio, sem Tailwind (a janela
 * de impressão não o enxerga; ver CLAUDE.md, "Impressão: três regras..."). É
 * função pura para dar para verificar de verdade, renderizando num navegador
 * (Chromium + Puppeteer, como o CLAUDE.md documenta para Documentos Padrões)
 * em vez de confiar só na leitura do CSS.
 */
export function montarHtmlImpressaoFicha(
  associado: Associado,
  empresa: Empresa | null,
  dataEmissao: string,
): string {
  const secoes = montarSecoesFicha(associado);
  const dependentes = montarDependentesFicha(associado);
  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || '';

  const secaoHtml = (secao: SecaoFicha) => `
    <div class="box">
      <div class="box-title">${secao.titulo}</div>
      <div class="box-body">
        ${secao.linhas
          .map(
            (linha) => `
          <div class="row">
            ${linha
              .map(
                (campo) =>
                  `<span class="field"><strong>${campo.label}:</strong> ${campo.valor}</span>`,
              )
              .join('')}
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;

  const dependentesHtml =
    dependentes.length > 0
      ? `
    <table class="dep-table">
      <thead>
        <tr><th>Nome</th><th>Parentesco</th><th>CPF</th><th>Data de Nascimento</th></tr>
      </thead>
      <tbody>
        ${dependentes
          .map(
            (dep) => `
          <tr>
            <td>${dep.nome}</td>
            <td>${dep.parentesco}</td>
            <td>${dep.cpf}</td>
            <td>${dep.dataNascimento}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `
      : '<p class="empty">Nenhum dependente cadastrado.</p>';

  const logoHtml = empresa?.logo_url
    ? `<img src="${empresa.logo_url}" alt="Logo" style="max-height: 46px; max-width: 200px; object-fit: contain;" />`
    : empresaNome
      ? `<h2 class="empresa-nome">${empresaNome}</h2>`
      : '';

  const assinaturaEmpresaHtml = empresa?.assinatura_url
    ? `<img src="${empresa.assinatura_url}" alt="Assinatura" style="max-height: 40px; max-width: 170px; object-fit: contain; margin-bottom: 3px;" />`
    : `<div style="height: 30px;"></div>`;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Ficha de Cadastro - ${associado.nome}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 15mm; }
          *, *::before, *::after { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a; margin: 0; padding: 0; background: #fff;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
          .empresa-nome { margin: 0; font-size: 15px; text-transform: uppercase; font-weight: 800; }
          .empresa-cnpj { margin: 2px 0 0 0; font-size: 9px; color: #64748b; }
          .titulo-doc { text-align: right; }
          .titulo-doc h1 { margin: 0; font-size: 15px; text-transform: uppercase; font-weight: 800; }
          .titulo-doc p { margin: 2px 0 0 0; font-size: 9px; color: #64748b; }
          .status-pill { display: inline-block; margin-top: 3px; padding: 1px 8px; border-radius: 10px; font-size: 8px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; border: 1px solid #cbd5e1; color: #334155; }
          .box { border: 1px solid #cbd5e1; border-radius: 5px; margin-bottom: 6px; page-break-inside: avoid; overflow: hidden; }
          .box-title { background: #f1f5f9; border-bottom: 1px solid #cbd5e1; padding: 3px 8px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #334155; letter-spacing: 0.03em; }
          .box-body { padding: 5px 8px; }
          .row { display: flex; flex-wrap: wrap; gap: 4px 20px; font-size: 10.5px; padding: 1.5px 0; }
          .row .field strong { color: #334155; }
          .dep-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
          .dep-table th, .dep-table td { border: 1px solid #cbd5e1; padding: 3px 6px; text-align: left; font-size: 9.5px; }
          .dep-table th { background: #f1f5f9; font-weight: 700; }
          .empty { font-style: italic; color: #64748b; font-size: 10px; margin: 0 0 6px 0; }
          .footer-signatures { margin-top: 18px; display: flex; justify-content: space-between; page-break-inside: avoid; }
          .sign-col { text-align: center; width: 46%; }
          .sign-line { border-top: 1px solid #0f172a; margin-top: 3px; padding-top: 3px; }
          .sign-line .nome { font-weight: 700; font-size: 10px; text-transform: uppercase; }
          .sign-line .sub { font-size: 8.5px; color: #64748b; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            ${logoHtml}
            ${empresa?.cnpj ? `<p class="empresa-cnpj">CNPJ: ${empresa.cnpj}</p>` : ''}
          </div>
          <div class="titulo-doc">
            <h1>Ficha de Cadastro do Associado</h1>
            <p>Emitida em: ${dataEmissao}</p>
            <span class="status-pill">${associado.status}</span>
          </div>
        </div>

        ${secoes.map(secaoHtml).join('')}

        <div class="box">
          <div class="box-title">Dependentes (${dependentes.length})</div>
          <div class="box-body">${dependentesHtml}</div>
        </div>

        <div class="footer-signatures">
          <div class="sign-col">
            <div style="height: 30px;"></div>
            <div class="sign-line">
              <div class="nome">${associado.nome}</div>
              <div class="sub">Assinatura do Associado</div>
            </div>
          </div>
          <div class="sign-col">
            ${assinaturaEmpresaHtml}
            <div class="sign-line">
              <div class="nome">${empresaNome || 'Assinatura da Empresa'}</div>
              <div class="sub">${empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : 'Carimbo e Assinatura'}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}
