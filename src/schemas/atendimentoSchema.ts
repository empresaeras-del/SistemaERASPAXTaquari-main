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
