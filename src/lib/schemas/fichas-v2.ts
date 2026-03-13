import { z } from 'zod'

// ─── Modelo ───────────────────────────────────────────────────────────────────

export const ModeloUpdateSchema = z.object({
  materialCabedal:  z.string().max(200).optional().nullable(),
  materialSola:     z.string().max(200).optional().nullable(),
  materialPalmilha: z.string().max(200).optional().nullable(),
  materialFacheta:  z.string().max(200).optional().nullable(),
  facheta:          z.string().max(200).optional().nullable(),
})

export type ModeloUpdateInput = z.infer<typeof ModeloUpdateSchema>

// ─── Variantes ────────────────────────────────────────────────────────────────

export const VarianteItemSchema = z.object({
  id:          z.string().optional().nullable(),
  corCodigo:   z.string().min(1, 'Cor principal obrigatória'),
  imagemUrl:   z.string().url().optional().nullable(),
  corCabedal:  z.string().max(100).optional().nullable(),
  corSola:     z.string().max(100).optional().nullable(),
  corPalmilha: z.string().max(100).optional().nullable(),
  corFacheta:  z.string().max(100).optional().nullable(),
})

export const VarianteBatchSchema = z.object({
  modeloId:   z.string().cuid(),
  variantes:  z.array(VarianteItemSchema).min(1, 'Ao menos uma variante obrigatória'),
  deletedIds: z.array(z.string()).optional(),
})

export type VarianteBatchInput = z.infer<typeof VarianteBatchSchema>
export type VarianteItemInput  = z.infer<typeof VarianteItemSchema>

// ─── MapeamentoCor ────────────────────────────────────────────────────────────

export const MapeamentoCorUpdateSchema = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'hex deve ser formato #RRGGBB').optional().nullable(),
})

export type MapeamentoCorUpdateInput = z.infer<typeof MapeamentoCorUpdateSchema>

// ─── Storage ──────────────────────────────────────────────────────────────────

export const SignedUrlRequestSchema = z.object({
  fileName:    z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export type SignedUrlRequest = z.infer<typeof SignedUrlRequestSchema>
