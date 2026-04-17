import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DropdownOption<T extends string = string> {
  value: T
  label: React.ReactNode
  disabled?: boolean
  group?: string
}

export interface DropdownProps<T extends string = string> {
  options: DropdownOption<T>[]
  value?: T
  defaultValue?: T
  onChange?: (value: T) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  align?: 'start' | 'center' | 'end'
  id?: string
  'aria-label'?: string
}

export function Dropdown<T extends string = string>({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = 'Select…',
  disabled,
  className,
  contentClassName,
  align = 'start',
  id,
  'aria-label': ariaLabel,
}: DropdownProps<T>) {
  const groups = React.useMemo(() => {
    const ordered: string[] = []
    const map = new Map<string, DropdownOption<T>[]>()
    for (const opt of options) {
      const key = opt.group ?? ''
      if (!map.has(key)) {
        map.set(key, [])
        ordered.push(key)
      }
      map.get(key)!.push(opt)
    }
    return ordered.map((key) => ({ label: key, items: map.get(key)! }))
  }, [options])

  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onChange?.(v as T)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&>span]:truncate',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          align={align}
          className={cn(
            'relative z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {groups.map((g, i) => (
              <SelectPrimitive.Group key={g.label || `__g${i}`}>
                {g.label && (
                  <SelectPrimitive.Label className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {g.label}
                  </SelectPrimitive.Label>
                )}
                {g.items.map((opt) => (
                  <SelectPrimitive.Item
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className={cn(
                      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
                      'focus:bg-accent focus:text-accent-foreground',
                      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator>
                        <Check className="h-4 w-4" />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Group>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
