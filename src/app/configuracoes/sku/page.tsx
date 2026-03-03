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

interface RegraSkU {
  id: string
  nome: string
  separador: string
  ordem: Segmento[]
  segmentos: string[]
  ativa: boolean
  createdAt: string
  updatedAt: string
}

const SEPARADORES = ['-', '.', '/', '_']
const SEGMENTOS_OPCOES: Segmento[] = ['modelo', 'cor', 'tamanho']
const SEGMENTO_LABELS: Record<Segmento, string> = { modelo: 'Modelo', cor: 'Cor', tamanho: 'Tamanho' }

function parseSku(sku: string, separador: string, ordem: Segmento[]) {
  const partes = sku.split(separador)
  return ordem.map((seg, i) => ({ campo: seg, valor: partes[i] ?? '' }))
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
  const [formSeparador, setFormSeparador] = useState('-')
  const [formOrdem, setFormOrdem] = useState<Segmento[]>(['modelo', 'cor', 'tamanho'])
  const [saving, setSaving] = useState(false)

  // Confirm dialogs
  const [confirmAtivar, setConfirmAtivar] = useState<RegraSkU | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<RegraSkU | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Teste SKU
  const [skuInput, setSkuInput] = useState('')
  const [skuResult, setSkuResult] = useState<{ campo: Segmento; valor: string }[]>([])
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
      if (ativa && skuInput) {
        setSkuResult(parseSku(skuInput, ativa.separador, ativa.ordem))
      } else {
        setSkuResult([])
      }
    }, TIMING.DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [skuInput, regras])

  function abrirCriar() {
    setEditando(null)
    setFormNome('')
    setFormSeparador('-')
    setFormOrdem(['modelo', 'cor', 'tamanho'])
    setModalOpen(true)
  }

  function abrirEditar(regra: RegraSkU) {
    setEditando(regra)
    setFormNome(regra.nome)
    setFormSeparador(regra.separador)
    setFormOrdem(regra.ordem)
    setModalOpen(true)
  }

  async function salvar() {
    if (!formNome.trim()) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const body = { nome: formNome.trim(), separador: formSeparador, ordem: formOrdem, segmentos: [] }
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
    ;[nova[index], nova[alvo]] = [nova[alvo], nova[index]]
    setFormOrdem(nova)
  }

  const preview = `REF001${formSeparador}PT${formSeparador}38`
  const previewParsed = parseSku(preview, formSeparador, formOrdem)

  const regrasAtivas = regras.filter((r) => r.ativa)
  const regraAtiva = regrasAtivas[0]

  const COLUMNS: Column<RegraSkU>[] = [
    {
      key: 'nome',
      header: 'Nome',
      sortable: true,
    },
    {
      key: 'separador',
      header: 'Separador',
      mono: true,
      render: (r) => <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{r.separador}</span>,
    },
    {
      key: 'ordem',
      header: 'Ordem',
      render: (r) => (
        <div className="flex items-center gap-1">
          {r.ordem.map((seg, i) => (
            <span key={seg}>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{SEGMENTO_LABELS[seg]}</span>
              {i < r.ordem.length - 1 && <span className="mx-0.5 text-secondary">→</span>}
            </span>
          ))}
        </div>
      ),
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
          <button
            onClick={() => abrirEditar(r)}
            className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
          >
            Editar
          </button>
          {!r.ativa && (
            <button
              onClick={() => setConfirmAtivar(r)}
              className="text-xs font-medium text-primary hover:underline focus:outline-none focus:underline"
            >
              Ativar
            </button>
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
              Usando regra ativa: <span className="font-medium text-foreground">{regraAtiva.nome}</span>
              {' '}(separador: <span className="font-mono">{regraAtiva.separador}</span>)
            </p>
            <input
              type="text"
              placeholder={`Ex: REF001${regraAtiva.separador}PT${regraAtiva.separador}38`}
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {skuResult.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {skuResult.map((r) => (
                        <th key={r.campo} className="pb-1 text-left font-medium text-secondary">
                          {SEGMENTO_LABELS[r.campo]}
                        </th>
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
          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="sku-nome">Nome</label>
            <input
              id="sku-nome"
              type="text"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={formNome}
              onChange={(e) => setFormNome(e.target.value)}
              placeholder="Ex: Padrão Bling"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground" htmlFor="sku-sep">Separador</label>
            <select
              id="sku-sep"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                <div key={seg} className="flex items-center gap-2 rounded border border-border bg-white p-2">
                  <span className="w-4 text-xs text-secondary">{i + 1}º</span>
                  <span className="flex-1 text-sm">{SEGMENTO_LABELS[seg]}</span>
                  <button type="button" onClick={() => moverSegmento(i, -1)} disabled={i === 0} className="text-secondary hover:text-foreground disabled:opacity-30" aria-label="Mover para cima">↑</button>
                  <button type="button" onClick={() => moverSegmento(i, 1)} disabled={i === formOrdem.length - 1} className="text-secondary hover:text-foreground disabled:opacity-30" aria-label="Mover para baixo">↓</button>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-md bg-muted px-3 py-2">
            <p className="text-xs font-medium text-secondary mb-1">Preview: <span className="font-mono text-foreground">{preview}</span></p>
            <div className="flex gap-3">
              {previewParsed.map((p) => (
                <span key={p.campo} className="text-xs">
                  <span className="text-secondary">{SEGMENTO_LABELS[p.campo]}: </span>
                  <span className="font-mono text-foreground">{p.valor}</span>
                </span>
              ))}
            </div>
          </div>

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
