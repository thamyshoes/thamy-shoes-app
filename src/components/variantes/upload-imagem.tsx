'use client'

import { useRef, useState } from 'react'
import { ImageIcon, UploadCloud, AlertTriangle, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'

interface UploadImagemProps {
  imagemUrl?: string | null
  onUpload: (url: string) => void
  disabled?: boolean
}

const MAX_SIZE_KB = 500
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

async function compressImage(file: File): Promise<File> {
  const Compressor = (await import('compressorjs')).default
  return new Promise<File>((resolve, reject) => {
    new Compressor(file, {
      maxWidth: 600,
      maxHeight: 600,
      quality: 0.8,
      convertSize: MAX_SIZE_KB * 1024,
      success(result) {
        resolve(result instanceof File ? result : new File([result], file.name, { type: result.type }))
      },
      error(err) {
        reject(err)
      },
    })
  })
}

async function getSignedUrl(
  fileName: string,
  contentType: string,
): Promise<{ signedUrl: string; publicUrl: string }> {
  const res = await fetch('/api/variantes/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, contentType }),
  })
  if (!res.ok) throw new Error('Não foi possível enviar a imagem. Tente novamente.')
  const json = await res.json() as { signedUrl: string; publicUrl: string }
  return { signedUrl: json.signedUrl, publicUrl: json.publicUrl }
}

async function uploadToSupabase(signedUrl: string, file: File): Promise<void> {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) throw new Error('Não foi possível enviar a imagem. Tente novamente.')
}

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

export function UploadImagem({ imagemUrl, onUpload, disabled }: UploadImagemProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const lastFileRef = useRef<File | null>(null)

  const state: UploadState = errorMsg ? 'error' : uploading ? 'uploading' : imagemUrl ? 'success' : 'idle'

  async function handleFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WebP.')
      return
    }

    lastFileRef.current = file
    setErrorMsg(null)
    setUploading(true)
    setProgress(10)

    try {
      // 1. Validar MIME antes de comprimir
      setProgress(20)

      // 2. Comprimir
      const compressed = await compressImage(file)
      setProgress(50)

      // 3. Validar tamanho pós-compressão
      if (compressed.size > MAX_SIZE_KB * 1024) {
        toast.error(`Arquivo muito grande (max ${MAX_SIZE_KB}KB após compressão)`)
        setUploading(false)
        setProgress(0)
        return
      }

      // 4. Obter signed URL (retry automático 1x em caso de 403)
      let urls: { signedUrl: string; publicUrl: string }
      try {
        urls = await getSignedUrl(compressed.name || file.name, compressed.type)
      } catch {
        // Retry uma vez
        urls = await getSignedUrl(compressed.name || file.name, compressed.type)
      }
      setProgress(70)

      // 5. Upload direto para Supabase Storage
      await uploadToSupabase(urls.signedUrl, compressed)
      setProgress(100)

      onUpload(urls.publicUrl)
      toast.success('Imagem enviada com sucesso')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar imagem'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  function handleRetry() {
    if (lastFileRef.current) {
      void handleFile(lastFileRef.current)
    } else {
      setErrorMsg(null)
      inputRef.current?.click()
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled || uploading) return
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  function handleClick() {
    if (disabled || uploading) return
    if (state === 'error') {
      handleRetry()
      return
    }
    inputRef.current?.click()
  }

  const hasImage = state === 'success'

  return (
    <div
      className={cn(
        'relative h-12 w-12 shrink-0 overflow-hidden rounded-[6px] transition-colors',
        hasImage
          ? 'border border-border'
          : state === 'error'
          ? 'border-2 border-danger/60 bg-danger/5'
          : 'border-2 border-dashed',
        dragging
          ? 'border-primary bg-primary/5'
          : state === 'error'
          ? ''
          : hasImage
          ? ''
          : 'border-muted-foreground/30 bg-muted',
        (disabled || uploading) && 'opacity-60',
        !disabled && !uploading && 'cursor-pointer',
        !disabled && !uploading && state === 'idle' && 'hover:border-muted-foreground/60',
      )}
      onClick={handleClick}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={
        state === 'error' ? 'Tentar novamente'
        : hasImage ? 'Trocar imagem'
        : 'Adicionar imagem'
      }
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled || uploading}
        aria-hidden="true"
      />

      {/* Progress bar */}
      {uploading && (
        <div
          className="absolute bottom-0 left-0 h-1 bg-primary transition-all"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      )}

      {/* Content by state */}
      {hasImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagemUrl!}
            alt="Imagem da variante"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
            <span className="text-[10px] font-medium text-white">Trocar</span>
          </div>
        </>
      ) : state === 'error' ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5" aria-live="polite">
          <AlertTriangle className="h-3.5 w-3.5 text-danger" />
          <RotateCw className="h-2.5 w-2.5 text-danger/70" />
        </div>
      ) : uploading ? (
        <div className="flex h-full w-full items-center justify-center">
          <UploadCloud className="h-4 w-4 animate-pulse text-primary" />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
        </div>
      )}
    </div>
  )
}
