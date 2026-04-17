import { CheckCircle2, XCircle } from 'lucide-react'
import { providers } from '@/providers/registry'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ProvidersPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
        <p className="text-sm text-muted-foreground">
          Keys live in <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>.
          Restart the dev server after changing them.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {providers.map((p) => {
            const ok = p.isConfigured?.() ?? true
            return (
              <Card key={p.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.label}</CardTitle>
                    {ok ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <CardDescription>
                    {p.kinds.join(' + ')} · {p.models.length} model
                    {p.models.length === 1 ? '' : 's'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {p.setupHint && (
                    <p className="text-xs text-muted-foreground">
                      {p.setupHint}
                    </p>
                  )}
                  <ul className="mt-3 space-y-1 text-sm">
                    {p.models.map((m) => (
                      <li key={m.id} className="flex items-center justify-between">
                        <span>{m.label}</span>
                        <span className="text-xs uppercase text-muted-foreground">
                          {m.kind}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
