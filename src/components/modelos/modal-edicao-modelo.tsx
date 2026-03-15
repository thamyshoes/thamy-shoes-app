'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES } from '@/lib/constants'
import { useMateriais } from '@/hooks/use-materiais'
import type { ModeloRow } from './tabela-modelos'

export interface GradeOption {
  id: string
  nome: string
  tamanhoMin: number
  tamanhoMax: number
}

interface ModalEdicaoModeloProps {
  open: boolean
  modelo: ModeloRow | null
  mode: 'create' | 'edit'
  grades: GradeOption[]
  onClose: () => void
  onSaved: () => void
}

interface FormData {
  codigo: string
  nome: string
  gradeId: string
  cabedal: string
  sola: string
  palmilha: string
  facheta: string
  materialCabedal: string
  materialSola: string
  materialPalmilha: string
  materialFacheta: string
}

const EMPTY: FormData = {
  codigo: '',
  nome: '',
  gradeId: '',
  cabedal: '',
  sola: '',
  palmilha: '',
  facheta: '',
  materialCabedal: '',
  materialSola: '',
  materialPalmilha: '',
  materialFacheta: '',
}

export function ModalEdicaoModelo({ open, modelo, mode, grades, onClose, onSaved }: ModalEdicaoModeloProps) {
  const [form, setForm] = useState<FormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<FormData>>({})

  const { materiais: matsCabedal } = useMateriais('CABEDAL')
  const { materiais: matsSola } = useMateriais('SOLA')
  const { materiais: matsPalmilha } = useMateriais('PALMILHA')
  const { materiais: matsFacheta } = useMateriais('FACHETA')

  useEffect(() => {
    if (modelo && mode === 'edit') {
      setForm({
        codigo:           modelo.codigo,
        nome:             modelo.nome,
        gradeId:          modelo.gradeId         ?? '',
        cabedal:          modelo.cabedal         ?? '',
        sola:             modelo.sola            ?? '',
        palmilha:         modelo.palmilha        ?? '',
        facheta:          modelo.facheta         ?? '',
        materialCabedal:  modelo.materialCabedal  ?? '',
        materialSola:     modelo.materialSola      ?? '',
        materialPalmilha: modelo.materialPalmilha  ?? '',
        materialFacheta:  modelo.materialFacheta   ?? '',
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
  }, [modelo, mode])

  function validate(): boolean {
    const errs: Partial<FormData> = {}
    if (!form.codigo.trim()) errs.codigo = 'Código é obrigatório'
    if (!form.nome.trim()) errs.nome = 'Nome é obrigatório'
    if (form.codigo.trim().length > 20) errs.codigo = 'Máximo 20 caracteres'
    if (form.nome.trim().length > 100) errs.nome = 'Máximo 100 caracteres'
    if (form.cabedal.length > 200) errs.cabedal = 'Máximo 200 caracteres'
    if (form.sola.length > 200) errs.sola = 'Máximo 200 caracteres'
    if (form.palmilha.length > 200) errs.palmilha = 'Máximo 200 caracteres'
    if (form.facheta.length > 200) errs.facheta = 'Máximo 200 caracteres'
    if (form.materialCabedal.length > 200) errs.materialCabedal = 'Máximo 200 caracteres'
    if (form.materialSola.length > 200) errs.materialSola = 'Máximo 200 caracteres'
    if (form.materialPalmilha.length > 200) errs.materialPalmilha = 'Máximo 200 caracteres'
    if (form.materialFacheta.length > 200) errs.materialFacheta = 'Máximo 200 caracteres'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nullIfEmpty(v: string): string | null {
    return v.trim() || null
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        codigo:           form.codigo.trim(),
        nome:             form.nome.trim(),
        gradeId:          form.gradeId || null,
        cabedal:          nullIfEmpty(form.cabedal),
        sola:             nullIfEmpty(form.sola),
        palmilha:         nullIfEmpty(form.palmilha),
        facheta:          nullIfEmpty(form.facheta),
        materialCabedal:  nullIfEmpty(form.materialCabedal),
        materialSola:     nullIfEmpty(form.materialSola),
        materialPalmilha: nullIfEmpty(form.materialPalmilha),
        materialFacheta:  nullIfEmpty(form.materialFacheta),
      }

      if (mode === 'edit' && modelo) {
        await apiClient.put(`${API_ROUTES.MODELOS}/${modelo.id}`, payload)
        toast.success('Modelo atualizado com sucesso')
      } else {
        await apiClient.post(API_ROUTES.MODELOS, payload)
        toast.success('Modelo criado com sucesso')
      }

      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar modelo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? `Editar — ${modelo?.codigo ?? ''}` : 'Novo Modelo'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSave()}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* IDENTIFICAÇÃO */}
        <div>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-secondary">
            Identificação
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modelo-codigo" className="mb-1 block text-xs font-medium text-secondary">
                Código <span className="text-danger">*</span>
              </label>
              <input
                id="modelo-codigo"
                data-autofocus
                className={`w-full rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary ${errors.codigo ? 'border-danger' : 'border-border'}`}
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                disabled={mode === 'edit' || saving}
                placeholder="Ex: ABC001"
                maxLength={20}
                aria-describedby={errors.codigo ? 'err-codigo' : undefined}
              />
              {errors.codigo && (
                <p id="err-codigo" className="mt-1 text-xs text-danger">{errors.codigo}</p>
              )}
            </div>
            <div>
              <label htmlFor="modelo-nome" className="mb-1 block text-xs font-medium text-secondary">
                Nome <span className="text-danger">*</span>
              </label>
              <input
                id="modelo-nome"
                className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${errors.nome ? 'border-danger' : 'border-border'}`}
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                disabled={saving}
                placeholder="Ex: Bota Social"
                maxLength={100}
                aria-describedby={errors.nome ? 'err-nome' : undefined}
              />
              {errors.nome && (
                <p id="err-nome" className="mt-1 text-xs text-danger">{errors.nome}</p>
              )}
            </div>
            <div>
              <label htmlFor="modelo-grade" className="mb-1 block text-xs font-medium text-secondary">
                Grade de Numeração
              </label>
              <select
                id="modelo-grade"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                value={form.gradeId}
                onChange={(e) => setForm((f) => ({ ...f, gradeId: e.target.value }))}
                disabled={saving}
              >
                <option value="">Sem grade</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome} ({g.tamanhoMin}–{g.tamanhoMax})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* REFERÊNCIAS POR COMPONENTE */}
        <div>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-secondary">
            Referências por Componente
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modelo-cabedal" className="mb-1 block text-xs font-medium text-secondary">Cabedal (Ref)</label>
              <input
                id="modelo-cabedal"
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                value={form.cabedal}
                onChange={(e) => setForm((f) => ({ ...f, cabedal: e.target.value }))}
                disabled={saving}
                placeholder="Ex: CAB-001"
                maxLength={200}
              />
              {errors.cabedal && <p className="mt-1 text-xs text-danger">{errors.cabedal}</p>}
            </div>
            <div>
              <label htmlFor="modelo-sola" className="mb-1 block text-xs font-medium text-secondary">Sola (Ref)</label>
              <input
                id="modelo-sola"
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                value={form.sola}
                onChange={(e) => setForm((f) => ({ ...f, sola: e.target.value }))}
                disabled={saving}
                placeholder="Ex: SOL-001"
                maxLength={200}
              />
              {errors.sola && <p className="mt-1 text-xs text-danger">{errors.sola}</p>}
            </div>
            <div>
              <label htmlFor="modelo-palmilha" className="mb-1 block text-xs font-medium text-secondary">Palmilha (Ref)</label>
              <input
                id="modelo-palmilha"
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                value={form.palmilha}
                onChange={(e) => setForm((f) => ({ ...f, palmilha: e.target.value }))}
                disabled={saving}
                placeholder="Ex: PAL-001"
                maxLength={200}
              />
              {errors.palmilha && <p className="mt-1 text-xs text-danger">{errors.palmilha}</p>}
            </div>
            <div>
              <label htmlFor="modelo-facheta" className="mb-1 block text-xs font-medium text-secondary">Facheta (Ref)</label>
              <input
                id="modelo-facheta"
                type="text"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                value={form.facheta}
                onChange={(e) => setForm((f) => ({ ...f, facheta: e.target.value }))}
                disabled={saving}
                placeholder="Ex: FAC-001"
                maxLength={200}
              />
              {errors.facheta && <p className="mt-1 text-xs text-danger">{errors.facheta}</p>}
            </div>
          </div>
        </div>

        {/* MATERIAIS POR COMPONENTE */}
        <div>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-secondary">
            Materiais por Componente
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modelo-materialCabedal" className="mb-1 block text-xs font-medium text-secondary">Cabedal</label>
              <select
                id="modelo-materialCabedal"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                value={form.materialCabedal}
                onChange={(e) => setForm((f) => ({ ...f, materialCabedal: e.target.value }))}
                disabled={saving}
              >
                <option value="">Selecione...</option>
                {matsCabedal.map((m) => (
                  <option key={m.id} value={m.nome}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="modelo-materialSola" className="mb-1 block text-xs font-medium text-secondary">Sola</label>
              <select
                id="modelo-materialSola"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                value={form.materialSola}
                onChange={(e) => setForm((f) => ({ ...f, materialSola: e.target.value }))}
                disabled={saving}
              >
                <option value="">Selecione...</option>
                {matsSola.map((m) => (
                  <option key={m.id} value={m.nome}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="modelo-materialPalmilha" className="mb-1 block text-xs font-medium text-secondary">Palmilha</label>
              <select
                id="modelo-materialPalmilha"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                value={form.materialPalmilha}
                onChange={(e) => setForm((f) => ({ ...f, materialPalmilha: e.target.value }))}
                disabled={saving}
              >
                <option value="">Selecione...</option>
                {matsPalmilha.map((m) => (
                  <option key={m.id} value={m.nome}>{m.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="modelo-materialFacheta" className="mb-1 block text-xs font-medium text-secondary">Facheta</label>
              <select
                id="modelo-materialFacheta"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                value={form.materialFacheta}
                onChange={(e) => setForm((f) => ({ ...f, materialFacheta: e.target.value }))}
                disabled={saving}
              >
                <option value="">Selecione...</option>
                {matsFacheta.map((m) => (
                  <option key={m.id} value={m.nome}>{m.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
