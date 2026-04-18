import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { usePersonas, type Persona } from '@/lib/personaApi'
import { Dropdown } from '@/components/Dropdown'

interface Props {
  value: string | undefined
  onChange: (id: string) => void
  /** If true, the dropdown is rendered into the document body instead of the
   * trigger's parent stacking context — useful inside scrollable side-panels. */
  popper?: boolean
  className?: string
}

export function PersonaPicker({ value, onChange, className }: Props) {
  const personas = usePersonas()

  if (!personas) return null

  if (personas.length === 0) {
    return (
      <Link
        to="/characters/new"
        className={
          className ??
          'flex items-center gap-2 rounded-md border border-dashed bg-background/40 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:bg-accent/30'
        }
      >
        <Users className="h-3.5 w-3.5" />
        No personas yet — create one
      </Link>
    )
  }

  const sorted = [...personas].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Dropdown
      className={className}
      options={sorted.map((p) => ({
        value: p.id,
        label: (
          <span className="flex items-center gap-2">
            <PersonaAvatar persona={p} />
            <span className="truncate">{p.name || '(unnamed)'}</span>
          </span>
        ),
      }))}
      value={value}
      onChange={onChange}
      placeholder="Select persona…"
    />
  )
}

function PersonaAvatar({ persona }: { persona: Persona }) {
  const face = persona.images.find((i) => i.slot === 'face')
  if (face) {
    return (
      <img
        src={face.url}
        alt=""
        className="h-5 w-5 shrink-0 rounded-full object-cover no-drag"
      />
    )
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
      <Users className="h-3 w-3" />
    </span>
  )
}
