import { Moon, Sun, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/db/dexie'
import { useTabsStore } from '@/features/tabs/tabs.store'

export function SettingsPage() {
  const closeAll = useTabsStore((s) => s.closeAll)

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark')
  }

  const clearLibrary = async () => {
    if (!confirm('Delete all stored generations? This cannot be undone.')) return
    await db.generations.clear()
    toast.success('Library cleared')
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Toggle light / dark mode.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={toggleTheme}>
              <Sun className="h-4 w-4" />
              <span className="mx-1">/</span>
              <Moon className="h-4 w-4" />
              Toggle theme
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data</CardTitle>
            <CardDescription>
              Everything is local — tabs in localStorage, media in IndexedDB.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" onClick={closeAll}>
              Close all tabs
            </Button>
            <Button variant="destructive" onClick={clearLibrary}>
              <Trash2 className="h-4 w-4" />
              Clear library
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
