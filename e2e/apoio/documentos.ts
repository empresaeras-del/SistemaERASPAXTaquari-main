/**
 * Os CPFs de `seed-homologacao.sql` são inválidos de propósito, para ninguém os confundir com
 * pessoa real — e o formulário de associado valida o dígito verificador. Então um teste que
 * CADASTRA precisa de um CPF que passe, e precisa que ele seja diferente a cada execução: a
 * guarda `encontrarAssociadoComCpfDuplicado` recusaria o segundo cadastro com o mesmo número,
 * e contra homologação o banco persiste entre as rodadas.
 */
const digitoVerificador = (base: number[]): number => {
  const peso = base.length + 1;
  const soma = base.reduce((acc, d, i) => acc + d * (peso - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
};

export const cpfValido = (): string => {
  const nove = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const d1 = digitoVerificador(nove);
  const d2 = digitoVerificador([...nove, d1]);
  const n = [...nove, d1, d2].join('');
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
};

/** Um sufixo curto para o nome, para o registro da rodada ser reconhecível no banco. */
export const marcaDaRodada = (): string =>
  new Date().toISOString().replace(/[^0-9]/g, '').slice(4, 14);
