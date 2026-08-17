import { z } from 'zod';

export const contratoSchema = z.object({
  plano_pax_id: z.string().min(1, 'Plano é obrigatório'),
  tipo_plano: z.enum(['individual', 'coletivo']).optional(),
  n_vidas: z.number().int('Deve ser número inteiro').min(1, 'Número de vidas deve ser no mínimo 1').optional().default(1),
  data_adesao: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.tipo_plano === 'coletivo' && (!data.n_vidas || data.n_vidas < 2)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Planos coletivos exigem no mínimo 2 vidas.',
      path: ['n_vidas'],
    });
  }
});

export type ContratoFormData = z.infer<typeof contratoSchema>;
