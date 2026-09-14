/**
 * O que falta num cadastro de usuário, e para qual usuário.
 *
 * Um cadastro de usuário deste sistema nasce em dois lugares: a credencial no Supabase Auth
 * (`auth.users`) e o perfil no app (`public.users`). Entre um e outro há um trigger
 * (`handle_new_user`) e um e-mail de confirmação — e os dois podem falhar sem que nada
 * apareça na tela. Já aconteceu: `empresa.eras@gmail.com` autenticou por 28 dias sem ter
 * perfil, e o único sintoma era que o sistema "não funcionava" para essa pessoa.
 *
 * Este módulo é puro: recebe o que `listar_cadastros_incompletos()` devolveu e decide
 * **o que falta**, **quão grave é** e **como dizer isso**. Quem grava a notificação é
 * `services/cadastrosIncompletosService.ts`; quem a dispara é
 * `hooks/useAvisoCadastrosIncompletos.ts`.
 */

/** O que pode estar faltando num cadastro. */
export type PendenciaCadastro = 'perfil_ausente' | 'email_nao_confirmado';

/**
 * Um cadastro como o banco o descreve, sem juízo nenhum sobre ele.
 *
 * Note o que **não** está aqui: "perfil sem credencial". `public.users.id` referencia
 * `auth.users(id) ON DELETE CASCADE`, então esse estado é impossível por construção — a FK
 * já responde. Inventar uma pendência para ele seria manter viva uma pergunta que o schema
 * fechou.
 */
export interface CadastroDeUsuario {
  usuario_id: string;
  email: string;
  nome: string | null;
  tenant_id: string | null;
  nivel: string | null;
  criado_em: string | null;
  tem_perfil: boolean;
  email_confirmado: boolean;
  ja_acessou: boolean;
  convite_enviado_em: string | null;
}

export interface DescricaoPendencia {
  /** O rótulo curto, para a etiqueta na tabela. */
  rotulo: string;
  /** O que falta, na linguagem de quem vai resolver. */
  oQueFalta: string;
  /** O que o admin precisa fazer — uma ação, não um diagnóstico. */
  comoResolver: string;
}

/**
 * Perfil ausente vem primeiro, e não é ordem alfabética: é gravidade.
 *
 * Quem não confirmou o e-mail simplesmente ainda não entrou — ninguém está usando o sistema
 * pela metade. Quem tem credencial sem perfil **entra** e encontra um sistema que não
 * reconhece quem ele é: o login funciona, o app não. É o estado que fica escondido, porque
 * quem o vive costuma achar que "o sistema está com problema", não que o cadastro dele está
 * incompleto.
 */
export const DESCRICAO_PENDENCIA: Record<PendenciaCadastro, DescricaoPendencia> = {
  perfil_ausente: {
    rotulo: 'Sem perfil de acesso',
    oQueFalta:
      'a credencial de login existe, mas o usuário não tem perfil no sistema — ele consegue ' +
      'autenticar e nenhuma tela reconhece quem ele é',
    comoResolver:
      'Criar o perfil de acesso deste usuário (nome, nível e empresa já ficaram gravados no ' +
      'convite e vêm preenchidos).',
  },
  email_nao_confirmado: {
    rotulo: 'Convite não confirmado',
    oQueFalta: 'o e-mail do convite nunca foi confirmado, então o usuário ainda não consegue entrar',
    comoResolver: 'Reenviar a confirmação para o e-mail do usuário, ou conferir se o endereço está correto.',
  },
};

/** A ordem em que as pendências aparecem, da mais grave para a menos. */
export const ORDEM_DE_GRAVIDADE: PendenciaCadastro[] = ['perfil_ausente', 'email_nao_confirmado'];

/**
 * O que falta neste cadastro.
 *
 * **"Nunca acessou" não é pendência**, e de propósito. Um usuário com perfil e e-mail
 * confirmado que ainda não entrou não tem nada faltando *no sistema* — falta ele entrar, e
 * isso não é trabalho do admin. Tratar isso como pendência encheria o aviso de linhas sobre
 * as quais não há o que fazer, e é assim que um aviso útil vira ruído que se aprende a
 * ignorar. `ja_acessou` continua no tipo porque é **contexto** de uma pendência real: um
 * convite não confirmado por alguém que nunca entrou é outra história que um não confirmado
 * por quem já usava o sistema.
 */
export const pendenciasDoCadastro = (
  cadastro: Pick<CadastroDeUsuario, 'tem_perfil' | 'email_confirmado'> | null | undefined,
): PendenciaCadastro[] => {
  if (!cadastro) return [];
  const pendencias: PendenciaCadastro[] = [];
  if (!cadastro.tem_perfil) pendencias.push('perfil_ausente');
  if (!cadastro.email_confirmado) pendencias.push('email_nao_confirmado');
  return pendencias;
};

export const cadastroEstaPelaMetade = (
  cadastro: Pick<CadastroDeUsuario, 'tem_perfil' | 'email_confirmado'> | null | undefined,
): boolean => pendenciasDoCadastro(cadastro).length > 0;

/** A pendência que define a gravidade do cadastro — a primeira na ordem de gravidade. */
export const pendenciaPrincipal = (
  cadastro: Pick<CadastroDeUsuario, 'tem_perfil' | 'email_confirmado'> | null | undefined,
): PendenciaCadastro | null => {
  const pendencias = pendenciasDoCadastro(cadastro);
  return ORDEM_DE_GRAVIDADE.find((p) => pendencias.includes(p)) || null;
};

/** Como chamar o usuário no aviso: o nome, se houver, senão o e-mail. */
export const identificacaoDoCadastro = (
  cadastro: Pick<CadastroDeUsuario, 'nome' | 'email'>,
): string => (cadastro.nome || '').trim() || (cadastro.email || '').trim() || 'usuário sem identificação';

/**
 * Os cadastros pela metade, do mais grave para o menos, desempatando pelo mais antigo.
 *
 * O desempate pelo mais antigo importa: um convite parado há três dias é distração, um
 * parado há um mês é alguém que desistiu de entrar e ninguém percebeu.
 */
export const ordenarPorGravidade = (cadastros: CadastroDeUsuario[]): CadastroDeUsuario[] =>
  [...cadastros].filter(cadastroEstaPelaMetade).sort((a, b) => {
    const pa = ORDEM_DE_GRAVIDADE.indexOf(pendenciaPrincipal(a) as PendenciaCadastro);
    const pb = ORDEM_DE_GRAVIDADE.indexOf(pendenciaPrincipal(b) as PendenciaCadastro);
    if (pa !== pb) return pa - pb;
    return (a.criado_em || '').localeCompare(b.criado_em || '');
  });

/** Quantas linhas do aviso cabem antes de ele virar um texto que ninguém lê. */
export const LIMITE_DE_LINHAS_NO_AVISO = 5;

/**
 * O título é **constante**, e a contagem vive na mensagem.
 *
 * Não é estilo: é o que torna o aviso reconhecível como o mesmo assunto entre um
 * carregamento e outro. Com o número no título ("2 cadastros..."), resolver um deles
 * produziria um título novo, e a rotina não teria como achar o aviso anterior para saber
 * que já avisou — voltaria a avisar do zero a cada mudança, que é a armadilha do seeding
 * de boas-vindas registrada no `useNotifications`.
 */
export const TITULO_AVISO_CADASTROS_INCOMPLETOS = 'Cadastros de usuário pela metade';

export interface AvisoCadastrosIncompletos {
  titulo: typeof TITULO_AVISO_CADASTROS_INCOMPLETOS;
  mensagem: string;
  /**
   * A assinatura do conjunto avisado.
   *
   * É o que impede o aviso de nascer de novo a cada carregamento: enquanto o conjunto de
   * pendências for o mesmo, é o mesmo aviso. Quando um cadastro é resolvido — ou aparece um
   * novo —, a assinatura muda e o admin é avisado outra vez, que é justamente quando avisar
   * tem valor. A lição é a do seeding de boas-vindas, que reaparecia a cada load porque
   * ninguém perguntava se já tinha sido dado.
   */
  assinatura: string;
}

/**
 * O aviso ao admin, ou `null` quando não há o que avisar.
 *
 * A mensagem nomeia **cada usuário** e **o que falta nele** — um "há 2 cadastros
 * incompletos" obrigaria o admin a ir procurar quais, e é aí que o aviso deixa de ser lido.
 */
export const montarAvisoCadastrosIncompletos = (
  cadastros: CadastroDeUsuario[],
): AvisoCadastrosIncompletos | null => {
  const pendentes = ordenarPorGravidade(cadastros || []);
  if (pendentes.length === 0) return null;

  const linhas = pendentes.slice(0, LIMITE_DE_LINHAS_NO_AVISO).map((c) => {
    const faltas = pendenciasDoCadastro(c)
      .map((p) => DESCRICAO_PENDENCIA[p].oQueFalta)
      .join('; ');
    return `• ${identificacaoDoCadastro(c)} (${c.email}): ${faltas}.`;
  });

  const restantes = pendentes.length - linhas.length;
  if (restantes > 0) {
    linhas.push(`• e mais ${restantes} cadastro(s) — veja a lista completa em Configurações → Usuários.`);
  }

  const abertura =
    pendentes.length === 1
      ? '1 cadastro de usuário não está completo:'
      : `${pendentes.length} cadastros de usuário não estão completos:`;

  return {
    titulo: TITULO_AVISO_CADASTROS_INCOMPLETOS,
    mensagem: [abertura, ...linhas, 'Abra Configurações → Usuários para resolver.'].join('\n'),
    assinatura: assinaturaDoAviso(pendentes),
  };
};

/**
 * A identidade do conjunto avisado: cada usuário mais o que falta nele.
 *
 * Inclui as pendências, não só os ids: um cadastro que ganhou perfil mas segue sem confirmar
 * o e-mail continua na lista, e o admin precisa saber que a situação mudou — se a assinatura
 * fosse só o conjunto de ids, essa mudança passaria calada.
 */
export const assinaturaDoAviso = (cadastros: CadastroDeUsuario[]): string =>
  (cadastros || [])
    .filter(cadastroEstaPelaMetade)
    .map((c) => `${c.usuario_id}:${pendenciasDoCadastro(c).join('+')}`)
    .sort()
    .join('|');
