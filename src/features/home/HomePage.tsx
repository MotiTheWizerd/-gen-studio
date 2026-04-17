import { Link } from 'react-router-dom'
import { Wand2, Library, Plug } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HomePage() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back.
        </h1>
        <p className="mt-1 text-muted-foreground">
          Your personal lab for image and video generation.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <QuickCard to="/studio" icon={Wand2} title="Studio" desc="Open a model as a tab and generate." />
          <QuickCard to="/library" icon={Library} title="Library" desc="Browse past generations from IndexedDB." />
          <QuickCard to="/providers" icon={Plug} title="Providers" desc="See which API keys are configured." />
        </div>
      </div>
    </div>
  )
}

function QuickCard({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string
  icon: typeof Wand2
  title: string
  desc: string
}) {
  return (
    <Link to={to}>
      <Card className="transition-colors hover:border-primary/50 hover:bg-accent/20">
        <CardHeader>
          <Icon className="h-6 w-6 text-primary" />
          <CardTitle className="mt-2">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </Link>
  )
}
