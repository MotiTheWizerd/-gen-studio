import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dropdown } from '@/components/Dropdown'
import {
  createPersona,
  getPersona,
  updatePersona,
} from '@/db/personas.repo'
import { VISION_MODELS } from '@/providers/vision'
import { analyzePersona } from './analyze'

export function PersonaEditor() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()

  const [loading, setLoading] = useState(!isNew)
  const [name, setName] = useState('')
  const [facialDetails, setFacialDetails] = useState('')
  const [bodyShape, setBodyShape] = useState('')
  const [faceImage, setFaceImage] = useState<Blob | null>(null)
  const [bodyImage, setBodyImage] = useState<Blob | null>(null)
  const [model, setModel] = useState<string>(VISION_MODELS[0].id)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    void (async () => {
      const p = await getPersona(id!)
      if (cancelled) return
      if (!p) {
        toast.error('Persona not found')
        navigate('/characters', { replace: true })
        return
      }
      setName(p.name)
      setFacialDetails(p.facial_details)
      setBodyShape(p.body_shape)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isNew, navigate])

  const facePreview = useObjectUrl(faceImage)
  const bodyPreview = useObjectUrl(bodyImage)

  const canAnalyze = (faceImage || bodyImage) && !analyzing
  const canSave = name.trim().length > 0 && !saving

  async function handleAnalyze() {
    if (!faceImage && !bodyImage) return
    const controller = new AbortController()
    setAnalyzing(true)
    setProgress('starting…')
    try {
      const out = await analyzePersona({
        faceImage: faceImage ?? undefined,
        bodyImage: bodyImage ?? undefined,
        model,
        signal: controller.signal,
        onProgress: (m) => setProgress(m),
      })
      if (out.facial_details) setFacialDetails(out.facial_details)
      if (out.body_shape) setBodyShape(out.body_shape)
      toast.success('Analysis complete')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
    } finally {
      setAnalyzing(false)
      setProgress(null)
    }
  }

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        facial_details: facialDetails.trim(),
        body_shape: bodyShape.trim(),
      }
      if (isNew) {
        await createPersona(payload)
        toast.success('Persona created')
      } else {
        await updatePersona(id!, payload)
        toast.success('Persona saved')
      }
      navigate('/characters')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/characters')}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? 'New persona' : 'Edit persona'}
          </h1>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="persona-name">Name</Label>
            <Input
              id="persona-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aria, the data scientist"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ImageSlot
              label="Face image"
              hint="Drop or click — face to camera"
              preview={facePreview}
              onPick={setFaceImage}
              onClear={() => setFaceImage(null)}
            />
            <ImageSlot
              label="Body image"
              hint="Drop or click — full body (optional)"
              preview={bodyPreview}
              onPick={setBodyImage}
              onClear={() => setBodyImage(null)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Vision model</Label>
            <Dropdown
              options={VISION_MODELS.map((m) => ({ value: m.id, label: m.label }))}
              value={model}
              onChange={(v) => setModel(v)}
            />
          </div>

          <div>
            <Button onClick={handleAnalyze} disabled={!canAnalyze}>
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {analyzing ? 'Analyzing…' : 'Analyze with vision model'}
            </Button>
            {progress && (
              <span className="ml-3 text-xs text-muted-foreground">{progress}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="facial-details">Facial details</Label>
            <Textarea
              id="facial-details"
              value={facialDetails}
              onChange={(e) => setFacialDetails(e.target.value)}
              placeholder="Filled by analysis or written manually."
              rows={6}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="body-shape">Body shape</Label>
            <Textarea
              id="body-shape"
              value={bodyShape}
              onChange={(e) => setBodyShape(e.target.value)}
              placeholder="Filled by analysis or written manually."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/characters')}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isNew ? 'Create persona' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageSlot({
  label,
  hint,
  preview,
  onPick,
  onClear,
}: {
  label: string
  hint: string
  preview: string | null
  onPick: (b: Blob) => void
  onClear: () => void
}) {
  const inputId = useMemo(() => `slot-${Math.random().toString(36).slice(2, 9)}`, [])

  function handleFiles(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Only image files are supported')
      return
    }
    onPick(f)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <label
        htmlFor={inputId}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleFiles(e.dataTransfer.files)
        }}
        className="group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed border-input bg-background/40 text-xs text-muted-foreground hover:border-primary/50 hover:bg-accent/30"
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt=""
              className="h-full w-full object-cover no-drag"
            />
            <button
              type="button"
              aria-label="Remove image"
              onClick={(e) => {
                e.preventDefault()
                onClear()
              }}
              className="absolute right-1.5 top-1.5 rounded-md bg-background/80 p-1 opacity-0 backdrop-blur transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 p-3 text-center">
            <ImagePlus className="h-6 w-6 opacity-60" />
            <span>{hint}</span>
          </div>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
    </div>
  )
}

function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
