import { Link } from 'react-router-dom'
import { Plus, Trash2, Users } from 'lucide-react'
import { deletePersona, usePersonas, type Persona } from '@/lib/personaApi'
import { Button } from '@/components/ui/button'

export function CharactersPage() {
  const personas = usePersonas()

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Consist Characters
            </h1>
            <p className="text-sm text-muted-foreground">
              {personas?.length ?? 0} persona{personas?.length === 1 ? '' : 's'}
            </p>
          </div>
          <Button asChild>
            <Link to="/characters/new">
              <Plus className="h-4 w-4" />
              New persona
            </Link>
          </Button>
        </div>

        {personas && personas.length === 0 ? (
          <div className="mt-24 flex flex-col items-center text-center text-sm text-muted-foreground">
            <Users className="mb-3 h-10 w-10 opacity-40" />
            <p>No personas yet.</p>
            <p className="mt-1">
              Create one — upload a face, let the vision model extract details.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {personas?.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <Link to={`/characters/${p.id}`} className="block">
                  <div className="flex items-start gap-3">
                    <PersonaThumb persona={p} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium">{p.name || 'Untitled'}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Updated {new Date(p.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                    {p.facial_details || p.body_shape || 'No description yet.'}
                  </p>
                </Link>
                <button
                  aria-label="Delete persona"
                  onClick={(e) => {
                    e.preventDefault()
                    if (confirm(`Delete "${p.name || 'this persona'}"?`)) {
                      void deletePersona(p.id)
                    }
                  }}
                  className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PersonaThumb({ persona }: { persona: Persona }) {
  const face = persona.images.find((i) => i.slot === 'face')
  if (face) {
    return (
      <img
        src={face.url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover no-drag"
      />
    )
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
      <Users className="h-5 w-5" />
    </div>
  )
}
