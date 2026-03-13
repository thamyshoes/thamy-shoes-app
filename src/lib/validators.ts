import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
})

export const resetPasswordFormSchema = z
  .object({
    token: z.string().min(1, 'Token inválido'),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })

export const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  perfil: z.enum(['ADMIN', 'PCP', 'PRODUCAO']),
  setor: z.enum(['CABEDAL', 'PALMILHA', 'SOLA']).nullable(),
})

export const updateUserSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional(),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').optional(),
  perfil: z.enum(['ADMIN', 'PCP', 'PRODUCAO']).optional(),
  setor: z.enum(['CABEDAL', 'PALMILHA', 'SOLA']).nullable().optional(),
  ativo: z.boolean().optional(),
})

export const editUserSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').optional().or(z.literal('')),
  perfil: z.enum(['ADMIN', 'PCP', 'PRODUCAO']),
  setor: z.enum(['CABEDAL', 'PALMILHA', 'SOLA']).nullable(),
})

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export const importPedidoSchema = z.object({
  idBling: z.number().int().positive(),
})

export const gerarFichasSchema = z.object({
  pedidoId: z.string().uuid(),
  setores: z.array(z.enum(['CABEDAL', 'SOLA', 'PALMILHA', 'FACHETA'])).min(1).optional(),
})

export const consolidarSchema = z.object({
  pedidoIds: z.array(z.string().uuid()).min(2).max(100),
  agruparPorFaixa: z.boolean().optional().default(false),
})

export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type EditUserInput = z.infer<typeof editUserSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type ImportPedidoInput = z.infer<typeof importPedidoSchema>
export type GerarFichasInput = z.infer<typeof gerarFichasSchema>
export type ConsolidarInput = z.infer<typeof consolidarSchema>
