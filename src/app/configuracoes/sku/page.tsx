'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState } from '@/components/ui/error-state'
import { useAuth } from '@/hooks/use-auth'
import { apiClient } from '@/lib/api-client'
import { API_ROUTES, ROUTES, TIMING } from '@/lib/constants'
import { toast } from 'sonner'
import Link from 'next/link'

type Segmento = 'modelo' | 'cor' | 'tamanho'
type Modo = 'SEPARADOR' | 'SUFIXO'

interface DigitosSegmento {
  campo: 'cor' | 'tamanho'
  digitos: number
}

interface RegraSkU {
  id: string
  nome: string
  modo: Modo
  separador: string
  ordem: Segmento[]
  segmentos: string[]
  digitosSufixo: DigitosSegmento[] | null
  ativa: boolean
  createdAt: string
  updatedAt: string
}

const SEPARADORES = ['-', '.', '/', '_']
const SEGMENTO_LABELS: Record<Segmento, string> = { modelo: 'Modelo', cor: 'Cor', tamanho: 'Tamanho' }

const DEFAULT_DIGITOS_SUFIXO: DigitosSegmento[] = [
  { campo: 'tamanho', digitos: 2 },
  { campo: 'cor', digitos: 3 },
]

// ── Preview helpers ───────────────────────────────────────────────────────────

function parseSkuSeparadorLocal(sku: string, separador: string, ordem: Segmento[]) {
  const partes = sku.split(separador)
  return ordem.map((seg, i) => ({ campo: seg, label: SEGMENTO_LABELS[seg], valor: partes[i] ?? '' }))
}

function parseSkuSufixoLocal(
  sku: string,
  digitos: DigitosSegmento[],
): { campo: string; label: string; valor: string }[] | null {
  const mapa: Record<string, string> = {}
  let remaining = sku

  for (const seg of digitos) {
    if (remaining.length < seg.digitos) return null
    mapa[seg.campo] = remaining.slice(-seg.digitos)
    remaining = remaining.slice(0, -seg.digitos)
  }
  mapa['modelo'] = remaining

  return [
    { campo: 'modelo', label: 'Modelo', valor: mapa['modelo'] ?? '' },
    ...[...digitos].reverse().map((seg) => ({
      campo: seg.campo,
      label: SEGMENTO_LABELS[seg.campo as Segmento] ?? seg.campo,
      valor: mapa[seg.campo] ?? '',
    })),
  ]
}

// ── Inner content ─────────────────────────────────────────────────────────────

function SkuContent({ user }: { user: { id: string; perfil: string; setor: string | null; nome: string; email: string } }) {
  const [regras, setRegras] = useState<RegraSkU[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal de criação/edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<RegraSkU | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formModo, setFormModo] = useState<Modo>('SUFIXO')
  const [formSeparador, setFormSeparador] = useState('-')
  const [formOrdem, setFormOrdem] = useState<Segmento[]>(['modelo', 'cor', 'tamanho'])
  const [formDigitosSufixo, setFormDigitosSufixo] = useState<DigitosSegmento[]>(DEFAULT_DIGITOS_SUFIXO)
  const [saving, setSaving] = useState(false)

  // Confirm dialogs
  const [confirmAtivar, setConfirmAtivar] = useState<RegraSkU | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<RegraSkU | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Teste SKU
  const [skuInput, setSkuInput] = useState('')
  const [skuResult, setSkuResult] = useState<{ campo: string; label: string; valor: string }[] | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchRegras = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiClient.get<RegraSkU[]>(API_ROUTES.REGRAS_SKU)
      setRegras(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar regras')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchRegras() }, [fetchRegras])

  // Debounce SKU test
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const ativa = regras.find((r) => r.ativa)
      if (!ativa || !skuInput) { setSkuResult(null); return }

      if ((ativa.modo ?? 'SEPARADOR') === 'SUFIXO' && ativa.digitosSufixo) {
        setSkuResult(parseSkuSufixoLocal(skuInput, ativa.digitosSufixo))
      } else {
        setSkuResult(parseSkuSeparadorLocal(skuInput, ativa.separador, ativa.ordem))
      }
    }, TIMING.DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [skuInput, regras])

  function abrirCriar() {
    setEditando(null)
    setFormNome('')
    setFormModo('SUFIXO')
    setFormSeparador('-')
    setFormOrdem(['modelo', 'cor', 'tamanho'])
    setFormDigitosSufixo([...DEFAULT_DIGITOS_SUFIXO])
    setModalOpen(true)
  }

  function abrirEditar(regra: RegraSkU) {
    setEditando(regra)
    setFormNome(regra.nome)
    setFormModo(regra.modo ?? 'SEPARADOR')
    setFormSeparador(regra.separador)
    setFormOrdem(regra.ordem)
    setFormDigitosSufixo(regra.digitosSufixo ?? [...DEFAULT_DIGITOS_SUFIXO])
    setModalOpen(true)
  }

  async function salvar() {
    if (!formNome.trim()) { toast.error('Nome é obrigatório'); return }
    if (formModo === 'SUFIXO' && formDigitosSufixo.length === 0) {
      toast.error('Configure ao menos um segmento'); return
    }
    setSaving(true)
    try {
      const body = {
        nome: formNome.trim(),
        modo: formModo,
        separador: formModo === 'SEPARADOR' ? formSeparador : '-',
        ordem: formModo === 'SEPARADOR' ? formOrdem : (['modelo', 'cor', 'tamanho'] as Segmento[]),
        segmentos: [],
        digitosSufixo: formModo === 'SUFIXO' ? formDigitosSufixo : null,
      }
      if (editando) {
        await apiClient.patch(`${API_ROUTES.REGRAS_SKU}/${editando.id}`, body)
        toast.success('Regra atualizada')
      } else {
        await apiClient.post(API_ROUTES.REGRAS_SKU, body)
        toast.success('Regra criada')
      }
      setModalOpen(false)
      await fetchRegras()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function ativar() {
    if (!confirmAtivar) return
    setConfirming(true)
    try {
      await apiClient.patch(`${API_ROUTES.REGRAS_SKU}/${confirmAtivar.id}/ativar`, {})
      toast.success('Regra ativada')
      setConfirmAtivar(null)
      await fetchRegras()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ativar')
    } finally {
      setConfirming(false)
    }
  }

  async function excluir() {
    if (!confirmExcluir) return
    setConfirming(true)
    try {
      await apiClient.delete(`${API_ROUTES.REGRAS_SKU}/${confirmExcluir.id}`)
      toast.success('Regra excluída')
      setConfirmExcluir(null)
      await fetchRegras()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setConfirming(false)
    }
  }

  function moverSegmento(index: number, direcao: -1 | 1) {
    const nova = [...formOrdem]
    const alvo = index + direcao
    if (alvo < 0 || alvo >= nova.length) return
    ;[nova[index], nova[alvo]] = [nova[alvo]!, nova[index]!]
    setFormOrdem(nova)
  }

  function moverSufixo(index: number, direcao: -1 | 1) {
    const nova = [...formDigitosSufixo]
    const alvo = index + direcao
    if (alvo < 0 || alvo >= nova.length) return
    ;[nova[index], nova[alvo]] = [nova[alvo]!, nova[index]!]
    setFormDigitosSufixo(nova)
  }

  function updateSufixo(index: number, field: 'campo' | 'digitos', valor: string | number) {
    const nova = [...formDigitosSufixo]
    nova[index] = { ...nova[index]!, [field]: valor } as DigitosSegmento
    setFormDigitosSufixo(nova)
  }

  // Previews para o modal
  const previewSufixo = formModo === 'SUFIXO'
    ? parseSkuSufixoLocal('1611600120', formDigitosSufixo)
    : null

  const previewSepSku = `REF001${formSeparador}PT${formSeparador}38`
  const previewSepParsed = parseSkuSeparadorLocal(previewSepSku, formSeparador, formOrdem)

  const regraAtiva = regras.find((r) => r.ativa)

  const COLUMNS: Column<RegraSkU>[] = [
    { key: 'nome', header: 'Nome', sortable: true },
    {
      key: 'modo',
      header: 'Modo',
      render: (r) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          (r.modo ?? 'SEPARADOR') === 'SUFIXO' ? 'bg-primary/10 text-primary' : 'bg-muted text-secondary'
        }`}>
          {(r.modo ?? 'SEPARADOR') === 'SUFIXO' ? 'Sufixo ←' : 'Separador'}
        </span>
      ),
    },
    {
      key: 'separador',
      header: 'Configuração',
      render: (r) => {
        if ((r.modo ?? 'SEPARADOR') === 'SUFIXO' && r.digitosSufixo) {
          return (
            <div className="flex items-center gap-1 flex-wrap text-xs">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-secondary">Modelo=resto</span>
              {[...r.digitosSufixo].reverse().map((seg, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-secondary">←</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-primary">
                    {SEGMENTO_LABELS[seg.campo as Segmento]}={seg.digitos}
                  </span>
                </span>
              ))}
            </div>
          )
        }
        return (
          <div className="flex items-center gap-1">
            {r.ordem.map((seg, i) => (
              <span key={seg} className="flex items-center gap-1">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{SEGMENTO_LABELS[seg]}</span>
                {i < r.ordem.length - 1 && <span className="text-xs text-secondary">{r.separador}</span>}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'ativa',
      header: 'Ativa',
      render: (r) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${r.ativa ? 'bg-success/10 text-success' : 'bg-muted text-secondary'}`}>
          {r.ativa ? 'Ativa' : 'Inativa'}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Ações',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => abrirEditar(r)} className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline">Editar</button>
          {!r.ativa && (
            <button onClick={() => setConfirmAtivar(r)} className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline">Ativar</button>
          )}
          <button
            disabled={r.ativa}
            title={r.ativa ? 'Desative antes de excluir' : undefined}
            onClick={() => !r.ativa && setConfirmExcluir(r)}
            className="text-xs font-medium text-destructive hover:underline focus:outline-none focus:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            Excluir
          </button>
        </div>
      ),
    },
  ]

  if (error) {
    return <ErrorState title="Erro ao carregar regras" description={error} onRetry={fetchRegras} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="text-sm text-secondary" aria-label="Breadcrumb">
            <Link href={ROUTES.CONFIGURACOES} className="hover:underline">Configurações</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Regras SKU</span>
          </nav>
          <h1 className="mt-1 text-xl font-semibold text-foreground">Regras de Parsing SKU</h1>
        </div>
        <Button onClick={abrirCriar}>Nova Regra</Button>
      </div>

      {/* Tabela */}
      <DataTable
        data={regras}
        columns={COLUMNS}
        loading={loading}
        emptyMessage="Nenhuma regra configurada"
      />

      {/* Teste de SKU */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Testar SKU</h2>
        {regraAtiva ? (
          <>
            <p className="mb-2 text-xs text-secondary">
              Usando regra ativa:{' '}
              <span className="font-medium text-foreground">{regraAtiva.nome}</span>
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ml-2 ${
                (regraAtiva.modo ?? 'SEPARADOR') === 'SUFIXO' ? 'bg-primary/10 text-primary' : 'bg-muted text-secondary'
              }`}>
                {(regraAtiva.modo ?? 'SEPARADOR') === 'SUFIXO' ? 'Sufixo ←' : `sep: "${regraAtiva.separador}"`}
              </span>
            </p>
            <input
              type="text"
              placeholder="Digite um código SKU para testar"
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {skuResult && skuResult.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {skuResult.map((r) => (
                        <th key={r.campo} className="pb-1 text-left font-medium text-secondary">{r.label}</th>
                      ))}
                      <th className="pb-1 text-left font-medium text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {skuResult.map((r) => (
                        <td key={r.campo} className={`py-1 font-mono ${!r.valor ? 'text-destructive' : 'text-foreground'}`}>
                          {r.valor || '—'}
                        </td>
                      ))}
                      <td className={`py-1 font-medium ${skuResult.every((r) => r.valor) ? 'text-success' : 'text-destructive'}`}>
                        {skuResult.every((r) => r.valor) ? 'RESOLVIDO' : 'PENDENTE'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-secondary">Ative uma regra para testar o parsing de SKUs.</p>
        )}
      </div>

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Regra SKU' : 'Nova Regra SKU'}
      >
        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="sku-nome">Nome</label>
            <input
              id="sku-nome"
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              placeholder="Ex: Padrão Thamy Shoes"
            />
          </div>

          {/* Modo */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Modo de parsing</label>
            <div className="flex gap-2">
              {(['SUFIXO', 'SEPARADOR'] as Modo[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFormModo(m)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    formModo === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-secondary hover:text-foreground'
                  }`}
                >
                  {m === 'SUFIXO' ? '← Por sufixo' : 'Por separador'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-secondary">
              {formModo === 'SUFIXO'
                ? 'Lê da direita para a esquerda por número fixo de dígitos. Ideal para SKUs como 1611600120.'
                : 'Divide o SKU por um caractere separador. Ex: 1500-460-35.'}
            </p>
          </div>

          {/* Configuração SUFIXO */}
          {formModo === 'SUFIXO' && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground">Segmentos (direita → esquerda)</label>
                <p className="mb-2 text-xs text-secondary">
                  O Modelo sempre recebe os dígitos restantes à esquerda
                </p>
                <div className="space-y-2">
                  {formDigitosSufixo.map((seg, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border border-border bg-background p-2">
                      <span className="w-6 text-xs text-secondary font-mono">{i + 1}°</span>
                      <select
                        value={seg.campo}
                        onChange={(e) => updateSufixo(i, 'campo', e.target.value)}
                        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="tamanho">Tamanho</option>
                        <option value="cor">Cor</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={seg.digitos}
                        onChange={(e) => updateSufixo(i, 'digitos', parseInt(e.target.value) || 1)}
                        className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-xs text-secondary w-12">dígitos</span>
                      <button type="button" onClick={() => moverSufixo(i, -1)} disabled={i === 0} className="text-secondary hover:text-foreground disabled:opacity-30" aria-label="Mover para cima">↑</button>
                      <button type="button" onClick={() => moverSufixo(i, 1)} disabled={i === formDigitosSufixo.length - 1} className="text-secondary hover:text-foreground disabled:opacity-30" aria-label="Mover para baixo">↓</button>
                    </div>
                  ))}
                  {/* Modelo — sempre o resto */}
                  <div className="flex items-center gap-2 rounded border border-border/40 bg-muted/30 p-2">
                    <span className="w-6 text-xs text-secondary font-mono">{formDigitosSufixo.length + 1}°</span>
                    <span className="flex-1 text-sm text-secondary">Modelo</span>
                    <span className="text-xs text-secondary italic">restante à esquerda</span>
                  </div>
                </div>
              </div>

              {/* Preview sufixo */}
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs font-medium text-secondary mb-1">
                  Preview com <span className="font-mono text-foreground">1611600120</span>:
                </p>
                {previewSufixo ? (
                  <div className="flex gap-4">
                    {previewSufixo.map((p) => (
                      <span key={p.campo} className="text-xs">
                        <span className="text-secondary">{p.label}: </span>
                        <span className={`font-mono font-medium ${p.valor ? 'text-foreground' : 'text-destructive'}`}>
                          {p.valor || '?'}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-destructive">SKU muito curto para a configuração atual</p>
                )}
              </div>
            </>
          )}

          {/* Configuração SEPARADOR */}
          {formModo === 'SEPARADOR' && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground" htmlFor="sku-sep">Separador</label>
                <select
                  id="sku-sep"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  value={formSeparador}
                  onChange={(e) => setFormSeparador(e.target.value)}
                >
                  {SEPARADORES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Ordem dos Segmentos</label>
                <p className="mb-1 text-xs text-secondary">Use as setas para reordenar</p>
                <div className="space-y-1">
                  {formOrdem.map((seg, i) => (
                    <div key={seg} className="flex items-center gap-2 rounded border border-border bg-background p-2">
                      <span className="w-4 text-xs text-secondary">{i + 1}º</span>
                      <span className="flex-1 text-sm">{SEGMENTO_LABELS[seg]}</span>
                      <button type="button" onClick={() => moverSegmento(i, -1)} disabled={i === 0} className="text-secondary hover:text-foreground disabled:opacity-30" aria-label="Mover para cima">↑</button>
                      <button type="button" onClick={() => moverSegmento(i, 1)} disabled={i === formOrdem.length - 1} className="text-secondary hover:text-foreground disabled:opacity-30" aria-label="Mover para baixo">↓</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview separador */}
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs font-medium text-secondary mb-1">
                  Preview: <span className="font-mono text-foreground">{previewSepSku}</span>
                </p>
                <div className="flex gap-3">
                  {previewSepParsed.map((p) => (
                    <span key={p.campo} className="text-xs">
                      <span className="text-secondary">{p.label}: </span>
                      <span className="font-mono text-foreground">{p.valor}</span>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm ativar */}
      <ConfirmDialog
        open={!!confirmAtivar}
        title="Ativar regra"
        description={`Ativar "${confirmAtivar?.nome}"? A regra atual será desativada.`}
        onConfirm={ativar}
        onClose={() => setConfirmAtivar(null)}
        loading={confirming}
      />

      {/* Confirm excluir */}
      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir regra"
        description={`Excluir "${confirmExcluir?.nome}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        onConfirm={excluir}
        onClose={() => setConfirmExcluir(null)}
        loading={confirming}
      />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SkuPage() {
  const { user, loading: authLoading } = useAuth()
  if (authLoading || !user) return null
  return (
    <SidebarLayout user={user}>
      <SkuContent user={user} />
    </SidebarLayout>
  )
}
