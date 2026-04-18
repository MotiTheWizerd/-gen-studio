import { Fragment, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { ImagePlus, Users } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/Dropdown'
import { imageModels, getImageModel } from '@/providers/images'
import { db } from '@/db/dexie'
import type { ModelKind } from '@/providers/types'

const MODES = [
  { value: 'standard', label: 'Standard' },
  { value: 'persona_replacement', label: 'Persona replacement' },
] as const

const MAX_INPUT_IMAGES = 3

const IMAGE_SIZE_PRESETS = [
  { value: 'square_hd', label: 'Square HD · 1024×1024' },
  { value: 'square', label: 'Square · 512×512' },
  { value: 'portrait_4_3', label: 'Portrait 4:3 · 768×1024' },
  { value: 'portrait_16_9', label: 'Portrait 16:9 · 576×1024' },
  { value: 'landscape_4_3', label: 'Landscape 4:3 · 1024×768' },
  { value: 'landscape_16_9', label: 'Landscape 16:9 · 1024×576' },
]

interface FieldMeta {
  key: string
  label: string
  schema: z.ZodTypeAny
}

interface Props {
  schema: z.ZodType
  values: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
  modelKind?: ModelKind
}

/**
 * Introspect a top-level zod object schema and render a form for each field.
 * Supports: string, number (w/ slider if min+max), boolean, optional.
 */
export function ParamsPanel({ schema, values, onChange, modelKind }: Props) {
  const fields = collectFields(schema)
  const modelName = (values.model_name as string) ?? imageModels[0]?.model_name
  const selectedImageModel = getImageModel(modelName)
  const supportsEdit = selectedImageModel?.support_edit === true
  const isImageModel = modelKind === 'image'
  const mode = (values.mode as 'standard' | 'persona_replacement' | undefined) ?? 'standard'
  const personaId = values.persona_id as string | undefined
  const personas = useLiveQuery(
    () =>
      isImageModel && mode === 'persona_replacement'
        ? db.personas.orderBy('name').toArray()
        : Promise.resolve([]),
    [isImageModel, mode],
  )

  useEffect(() => {
    if (imageModels.length > 0 && values.model_name == null) {
      onChange({ model_name: imageModels[0].model_name })
    }
    // onChange intentionally omitted — parents pass a new identity each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.model_name])

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!supportsEdit) return
    const files: File[] = []
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) files.push(f)
      }
    }
    if (files.length === 0) return
    e.preventDefault()
    const current = (values.input_images as string[] | undefined) ?? []
    const remaining = Math.max(0, MAX_INPUT_IMAGES - current.length)
    if (remaining === 0) return
    const toAdd = files.slice(0, remaining)
    void (async () => {
      const urls = await Promise.all(toAdd.map(fileToDataURL))
      onChange({
        input_images: [...current, ...urls].slice(0, MAX_INPUT_IMAGES),
      })
    })()
  }

  return (
    <div className="flex flex-col gap-4" onPaste={handlePaste}>
      {isImageModel && (
        <div className="flex flex-col gap-1.5">
          <Label>Mode</Label>
          <Dropdown
            options={MODES.map((m) => ({ value: m.value, label: m.label }))}
            value={mode}
            onChange={(v) =>
              onChange({
                mode: v,
                ...(v === 'standard' ? { persona_id: undefined } : {}),
              })
            }
          />
        </div>
      )}
      {isImageModel && mode === 'persona_replacement' && (
        <div className="flex flex-col gap-1.5">
          <Label>Persona</Label>
          {personas && personas.length > 0 ? (
            <Dropdown
              options={personas.map((p) => ({
                value: p.id,
                label: p.name || '(unnamed)',
              }))}
              value={personaId}
              onChange={(v) => onChange({ persona_id: v })}
              placeholder="Select persona…"
            />
          ) : (
            <Link
              to="/characters/new"
              className="flex items-center gap-2 rounded-md border border-dashed bg-background/40 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:bg-accent/30"
            >
              <Users className="h-3.5 w-3.5" />
              No personas yet — create one
            </Link>
          )}
        </div>
      )}
      {imageModels.length > 0 && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Model</Label>
            <Dropdown
              options={imageModels.map((m) => ({
                value: m.model_name,
                label: m.model_name,
              }))}
              value={modelName}
              onChange={(v) => onChange({ model_name: v })}
              placeholder="Select model…"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Image size</Label>
            <Dropdown
              options={IMAGE_SIZE_PRESETS}
              value={(values.image_size as string) ?? 'square_hd'}
              onChange={(v) => onChange({ image_size: v })}
              placeholder="Image size…"
            />
          </div>
        </>
      )}
      {fields.map((f) => (
        <Fragment key={f.key}>
          <FieldRow
            field={f}
            value={values[f.key]}
            onChange={(v) => onChange({ [f.key]: v })}
          />
          {f.key === 'prompt' && supportsEdit && (
            <ImageUploadButton
              current={(values.input_images as string[] | undefined) ?? []}
              onChange={(imgs) => onChange({ input_images: imgs })}
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

function ImageUploadButton({
  current,
  onChange,
}: {
  current: string[]
  onChange: (imgs: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const remaining = Math.max(0, MAX_INPUT_IMAGES - current.length)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const selected = Array.from(files).slice(0, remaining)
    const urls = await Promise.all(selected.map(fileToDataURL))
    onChange([...current, ...urls].slice(0, MAX_INPUT_IMAGES))
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={remaining === 0}
        onClick={() => inputRef.current?.click()}
        className="w-full justify-start"
      >
        <ImagePlus className="h-4 w-4" />
        Add image
        {current.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {current.length}/{MAX_INPUT_IMAGES}
          </span>
        )}
      </Button>
    </div>
  )
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FieldMeta
  value: unknown
  onChange: (v: unknown) => void
}) {
  const unwrapped = unwrap(field.schema)
  const isLong = field.key === 'prompt' || field.key === 'negative_prompt'

  if (unwrapped instanceof z.ZodString) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        {isLong ? (
          <Textarea
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe what you want…"
            rows={4}
          />
        ) : (
          <Input
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    )
  }

  if (unwrapped instanceof z.ZodNumber) {
    const { min, max, step } = numberMeta(unwrapped)
    const n = typeof value === 'number' ? value : undefined
    const hasRange = min !== undefined && max !== undefined
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>{field.label}</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {n ?? '—'}
          </span>
        </div>
        {hasRange ? (
          <Slider
            min={min}
            max={max}
            step={step ?? 1}
            value={[n ?? min]}
            onValueChange={(v) => onChange(v[0])}
          />
        ) : (
          <Input
            type="number"
            value={n ?? ''}
            onChange={(e) =>
              onChange(e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        )}
      </div>
    )
  }

  if (unwrapped instanceof z.ZodBoolean) {
    return (
      <div className="flex items-center justify-between">
        <Label>{field.label}</Label>
        <Switch
          checked={!!value}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{field.label}</Label>
      <Input
        value={value == null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function collectFields(schema: z.ZodType): FieldMeta[] {
  const unwrapped = unwrap(schema)
  if (!(unwrapped instanceof z.ZodObject)) return []
  const shape = unwrapped.shape as Record<string, z.ZodTypeAny>
  return Object.entries(shape).map(([key, field]) => ({
    key,
    label: labelFor(key, field),
    schema: field,
  }))
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let cur: z.ZodTypeAny = schema
  // peel off optional / default / nullable / describe wrappers
  // so we reach the underlying ZodString/ZodNumber/etc.
  // ZodEffects (refine/transform) we also peel.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const def = (cur as { _def?: { typeName?: string } })._def
    const tn = def?.typeName
    if (
      tn === 'ZodOptional' ||
      tn === 'ZodDefault' ||
      tn === 'ZodNullable' ||
      tn === 'ZodEffects'
    ) {
      // @ts-expect-error internal
      cur = def.innerType ?? def.schema
      continue
    }
    break
  }
  return cur
}

function numberMeta(s: z.ZodNumber): {
  min?: number
  max?: number
  step?: number
} {
  const checks = (s as unknown as { _def: { checks: Array<{ kind: string; value: number }> } })
    ._def.checks
  let min: number | undefined
  let max: number | undefined
  let step: number | undefined
  for (const c of checks) {
    if (c.kind === 'min') min = c.value
    if (c.kind === 'max') max = c.value
    if (c.kind === 'multipleOf') step = c.value
    if (c.kind === 'int') step = step ?? 1
  }
  return { min, max, step }
}

function labelFor(key: string, field: z.ZodTypeAny): string {
  const described = (field as { description?: string }).description
  if (described) return described
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
