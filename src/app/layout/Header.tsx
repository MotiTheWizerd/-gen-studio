import { Sparkles, Github } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header className="flex h-full items-center justify-between border-b bg-card/60 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-fuchsia-500">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Vibe Studio</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            personal gen lab
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground"
          >
            <Github className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </header>
  )
}
