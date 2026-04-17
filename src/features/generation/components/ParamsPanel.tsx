import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

interface FieldMeta {
  key: string
  label: string
  schema: z.ZodTypeAny
}

interface Props {
  schema: z.ZodType
  values: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
}

/**
 * Introspect a top-level zod object schema and render a form for each field.
 * Supports: string, number (w/ slider if min+max), boolean, optional.
 */
export function ParamsPanel({ schema, values, onChange }: Props) {
  const fields = collectFields(schema)
  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => (
        <FieldRow
          key={f.key}
          field={f}
          value={values[f.key]}
          onChange={(v) => onChange({ [f.key]: v })}
        />
      ))}
    </div>
  )
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
