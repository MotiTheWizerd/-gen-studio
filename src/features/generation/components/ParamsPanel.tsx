import { Fragment, useEffect, useRef } from 'react'
import { z } from 'zod'
import { ImagePlus, Plus, Trash2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/Dropdown'
import { imageModels, getImageModel } from '@/providers/images'
import { PersonaPicker } from '@/features/characters/PersonaPicker'
import { MaskEditor } from './MaskEditor'
import type { ModelKind } from '@/providers/types'

interface LoraEntry {
  path: string
  scale: number
}

const MODES = [
  { value: 'standard', label: 'Standard' },
  { value: 'persona_replacement', label: 'Persona replacement' },
  { value: 'persona_switcher', label: 'Persona switcher (from image)' },
] as const

type Mode = (typeof MODES)[number]['value']

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
  providerId?: string
}

/**
 * Introspect a top-level zod object schema and render a form for each field.
 * Supports: string, number (w/ slider if min+max), boolean, optional.
 */
export function ParamsPanel({ schema, values, onChange, modelKind, providerId }: Props) {
  const fields = collectFields(schema)
  // fal's flat imageModels[] picker + size presets + persona modes only
  // apply to the stub image shell — other providers (modelslab, etc.) drive
  // everything from their own zod schema.
  const isFalImageShell = providerId === 'stub' && modelKind === 'image'
  const modelName = (values.model_name as string) ?? imageModels[0]?.model_name
  const selectedImageModel = isFalImageShell ? getImageModel(modelName) : undefined
  const supportsEdit = selectedImageModel?.support_edit === true
  const supportsLora =
    selectedImageModel?.fal_pipeline === 'kontext-lora-inpaint'
  // Non-fal image providers always get the upload button — the model's
  // run() silently falls back to t2i when images aren't supported, so we
  // don't lose paste just because the currently selected model is text-only.
  const showUploadButton = isFalImageShell
    ? supportsEdit
    : modelKind === 'image'
  const mode = (values.mode as Mode | undefined) ?? 'standard'
  const personaId = values.persona_id as string | undefined
  const showPersonaPicker = isFalImageShell && mode !== 'standard'

  useEffect(() => {
    if (isFalImageShell && imageModels.length > 0 && values.model_name == null) {
      onChange({ model_name: imageModels[0].model_name })
    }
    // onChange intentionally omitted — parents pass a new identity each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFalImageShell, values.model_name])

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!showUploadButton) return
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
      {isFalImageShell && (
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
      {showPersonaPicker && (
        <div className="flex flex-col gap-1.5">
          <Label>Persona</Label>
          <PersonaPicker
            value={personaId}
            onChange={(v) => onChange({ persona_id: v })}
          />
        </div>
      )}
      {isFalImageShell && imageModels.length > 0 && (
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
      )}
      {modelKind === 'image' && (
        <div className="flex flex-col gap-1.5">
          <Label>Image size</Label>
          <Dropdown
            options={IMAGE_SIZE_PRESETS}
            value={(values.image_size as string) ?? 'square_hd'}
            onChange={(v) => onChange({ image_size: v })}
            placeholder="Image size…"
          />
        </div>
      )}
      {fields.map((f) => (
        <Fragment key={f.key}>
          <FieldRow
            field={f}
            value={values[f.key]}
            onChange={(v) => onChange({ [f.key]: v })}
          />
          {f.key === 'prompt' && showUploadButton && (
            <ImageUploadButton
              current={(values.input_images as string[] | undefined) ?? []}
              onChange={(imgs) => onChange({ input_images: imgs })}
            />
          )}
          {f.key === 'prompt' && supportsLora && (
            <LoraPicker
              value={(values.loras as LoraEntry[] | undefined) ?? []}
              onChange={(loras) => onChange({ loras })}
            />
          )}
          {f.key === 'prompt' &&
            supportsLora &&
            ((values.input_images as string[] | undefined)?.[0]) && (
              <MaskEditor
                sourceImage={(values.input_images as string[])[0]}
                value={values.mask_url as string | undefined}
                onChange={(mask_url) => onChange({ mask_url })}
              />
            )}
          {f.key === 'prompt' && supportsLora && (
            <StrengthSlider
              value={
                typeof values.strength === 'number' ? values.strength : 1
              }
              onChange={(strength) => onChange({ strength })}
            />
          )}
        </Fragment>
      ))}
    </div>
  )
}

function StrengthSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>Strength</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value.toFixed(2)}
        </span>
      </div>
      <Slider
        min={0.05}
        max={1}
        step={0.05}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  )
}

function LoraPicker({
  value,
  onChange,
}: {
  value: LoraEntry[]
  onChange: (v: LoraEntry[]) => void
}) {
  const update = (i: number, patch: Partial<LoraEntry>) =>
    onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const add = () => onChange([...value, { path: '', scale: 1 }])

  return (
    <div className="flex flex-col gap-2">
      <Label>LoRAs</Label>
      {value.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={entry.path}
            onChange={(e) => update(i, { path: e.target.value })}
            placeholder="https://…/lora.safetensors"
            className="flex-1"
          />
          <Input
            type="number"
            step="0.05"
            min={0}
            max={2}
            value={entry.scale}
            onChange={(e) => update(i, { scale: Number(e.target.value) })}
            className="w-20"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(i)}
            aria-label="Remove LoRA"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full justify-start"
      >
        <Plus className="h-4 w-4" />
        Add LoRA
      </Button>
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

  const remove = (i: number) => onChange(current.filter((_, j) => j !== i))

  return (
    <div className="flex flex-col gap-2">
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
      {current.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {current.map((url, i) => (
            <div
              key={i}
              className="group relative h-16 w-16 overflow-hidden rounded-md border bg-muted"
            >
              <img
                src={url}
                alt=""
                className="h-full w-full object-cover no-drag"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove image"
                className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={remaining === 0}
        onClick={() => inputRef.current?.click()}
        className="w-full justify-start"
      >
        <ImagePlus className="h-4 w-4" />
        {current.length === 0 ? 'Add image (or paste)' : 'Add another'}
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

  if (unwrapped instanceof z.ZodEnum) {
    const options = (unwrapped.options as readonly string[]).map((o) => ({
      value: o,
      label: o,
    }))
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{field.label}</Label>
        <Dropdown
          options={options}
          value={(value as string) ?? options[0]?.value}
          onChange={(v) => onChange(v)}
        />
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

// Fields rendered by dedicated widgets (not the auto-form).
const HANDLED_BY_CUSTOM_UI = new Set([
  'image_size',
  'input_images',
  'mask_url',
  'loras',
])

function collectFields(schema: z.ZodType): FieldMeta[] {
  const unwrapped = unwrap(schema)
  if (!(unwrapped instanceof z.ZodObject)) return []
  const shape = unwrapped.shape as Record<string, z.ZodTypeAny>
  return Object.entries(shape)
    .filter(([key]) => !HANDLED_BY_CUSTOM_UI.has(key))
    .map(([key, field]) => ({
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
