import { z } from 'zod';

const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

/** Dados do falecido para atendimento de cliente externo (sem associado vinculado). */
export const falecidoExternoSchema = z.object({
  falecido_nome: z.string().trim().min(3, 'Informe o nome completo do falecido.'),
  falecido_cpf: z
    .string()
    .optional()
    .refine((v) => !v || CPF_REGEX.test(v), { message: 'CPF inválido. Use o formato 000.000.000-00.' }),
  falecido_data_nascimento: z.string().optional(),
});

export type FalecidoExternoFormData = z.infer<typeof falecidoExternoSchema>;

/**
 * Dados do responsável pelo falecido em atendimento de **cliente externo**.
 *
 * Em atendimento de associado esses campos vêm preenchidos do cadastro do titular
 * (ver `utils/responsavelAtendimento.ts`) e não passam por aqui: lá o operador pode
 * corrigi-los, inclusive deixá-los em branco, e o dado que interessa já existe no
 * cadastro. Sem associado não existe esse cadastro, então é o formulário que precisa
 * cobrar — é a única etapa em que a informação pode entrar no sistema.
 *
 * `responsavel_observacoes` fica de fora da obrigatoriedade de propósito: é campo de
 * anotação livre, e exigir texto num campo assim só ensina o operador a digitar um
 * ponto para passar da tela.
 */
export const responsavelExternoSchema = z.object({
  responsavel_nome: z.string().trim().min(3, 'Informe o nome completo do responsável.'),
  responsavel_cpf: z
    .string()
    .trim()
    .refine((v) => CPF_REGEX.test(v), { message: 'CPF do responsável inválido. Use o formato 000.000.000-00.' }),
  responsavel_rg: z.string().trim().min(1, 'Informe o RG do responsável.'),
  responsavel_parentesco: z.string().trim().min(1, 'Informe o parentesco/vínculo do responsável com o falecido.'),
  responsavel_endereco: z.string().trim().min(5, 'Informe o endereço completo do responsável.'),
  responsavel_contato: z.string().trim().min(1, 'Informe um contato do responsável (telefone ou e-mail).'),
  responsavel_nacionalidade: z.string().trim().min(1, 'Informe a nacionalidade do responsável.'),
  responsavel_observacoes: z.string().optional(),
});

export type ResponsavelExternoFormData = z.infer<typeof responsavelExternoSchema>;
