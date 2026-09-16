/**
 * Regras da troca de senha feita pelo PRÓPRIO usuário, a partir do menu do topo.
 *
 * Puro de propósito: a decisão de "esta troca pode seguir?" precisa ser testável sem
 * navegador e sem rede, e é a mesma pergunta que o modal faz para habilitar o botão e
 * que `alterarPropriaSenha` faz antes de gastar uma chamada ao servidor.
 *
 * Duas decisões valem como regra:
 *
 * - **A senha não é aparada.** `signInWithPassword` manda exatamente o que o usuário
 *   digitou (ver `AuthContext.signIn` e `LoginPage`, que não chamam `trim`), então
 *   aparar aqui gravaria uma senha diferente da que o login vai enviar — e o usuário
 *   ficaria trancado para fora com a senha que ele mesmo acabou de escolher.
 * - **O mínimo é 6, o mesmo do resto do sistema** (`usuariosService`, `ResetPasswordPage`
 *   e o próprio Supabase). A força é dica, nunca trava: exigir mais aqui recusaria uma
 *   senha que um admin pode gravar para o mesmo usuário pela tela de Configurações, e
 *   duas guardas que discordam sobre a mesma coisa é como as metades divergem.
 */

export const TAMANHO_MINIMO_SENHA = 6;
export const TAMANHO_RECOMENDADO_SENHA = 8;

export const MENSAGEM_SENHA_ATUAL_VAZIA = 'Informe sua senha atual.';
export const MENSAGEM_SENHA_CURTA =
  `A nova senha deve ter no mínimo ${TAMANHO_MINIMO_SENHA} caracteres.`;
export const MENSAGEM_SENHA_IGUAL_A_ATUAL =
  'A nova senha precisa ser diferente da senha atual.';
export const MENSAGEM_CONFIRMACAO_DIFERENTE =
  'A confirmação não confere com a nova senha.';

export interface TrocaDeSenha {
  senhaAtual: string;
  novaSenha: string;
  confirmacao: string;
}

export type ValidacaoTrocaDeSenha =
  | { ok: true }
  | { ok: false; mensagem: string };

/**
 * Devolve o PRIMEIRO problema encontrado, na ordem em que o formulário é preenchido.
 * Listar todos de uma vez transforma o aviso num parágrafo que ninguém lê.
 */
export const validarTrocaDeSenha = ({
  senhaAtual,
  novaSenha,
  confirmacao
}: TrocaDeSenha): ValidacaoTrocaDeSenha => {
  if (!senhaAtual) return { ok: false, mensagem: MENSAGEM_SENHA_ATUAL_VAZIA };
  if (novaSenha.length < TAMANHO_MINIMO_SENHA) {
    return { ok: false, mensagem: MENSAGEM_SENHA_CURTA };
  }
  if (novaSenha === senhaAtual) {
    return { ok: false, mensagem: MENSAGEM_SENHA_IGUAL_A_ATUAL };
  }
  if (novaSenha !== confirmacao) {
    return { ok: false, mensagem: MENSAGEM_CONFIRMACAO_DIFERENTE };
  }
  return { ok: true };
};

export type ForcaSenha = 'fraca' | 'media' | 'forte';

const CLASSES_DE_CARACTERE = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/];

export const classesDaSenha = (senha: string): number =>
  CLASSES_DE_CARACTERE.filter((re) => re.test(senha)).length;

/**
 * Comprimento e variedade, nessa ordem de peso — uma senha longa de um tipo só continua
 * ruim, e uma curta cheia de símbolos também. Não entra no caminho de gravação: quem
 * decide se a troca segue é `validarTrocaDeSenha`.
 */
export const forcaDaSenha = (senha: string): ForcaSenha => {
  if (senha.length < TAMANHO_MINIMO_SENHA) return 'fraca';
  const classes = classesDaSenha(senha);
  if (senha.length >= 12 && classes >= 3) return 'forte';
  if (senha.length >= TAMANHO_RECOMENDADO_SENHA && classes >= 4) return 'forte';
  if (senha.length >= TAMANHO_RECOMENDADO_SENHA && classes >= 2) return 'media';
  return 'fraca';
};

export const dicaDeForca = (forca: ForcaSenha): string => {
  if (forca === 'forte') return 'Senha forte.';
  if (forca === 'media') {
    return 'Senha razoável. Misturar maiúsculas, números e símbolos deixa melhor.';
  }
  return `Senha fraca. Prefira ${TAMANHO_RECOMENDADO_SENHA} caracteres ou mais, misturando letras, números e símbolos.`;
};
