import { NavLink } from 'react-router-dom'
import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminNav, employeeNav } from '@/config/nav'
import { useAuth } from '@/features/auth/auth-context'

interface SidebarNavProps {
  onNavigate?: () => void
}

function Item({
  title,
  to,
  icon: Icon,
  onNavigate,
}: {
  title: string
  to: string
  icon: LucideIcon
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          'text-muted-foreground hover:bg-accent hover:text-foreground',
          isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{title}</span>
    </NavLink>
  )
}

function Section({ title, items, onNavigate }: { title: string; items: { title: string; to: string; icon: LucideIcon }[]; onNavigate?: () => void }) {
  return (
    <div className="px-3 py-2">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <Item key={item.to} {...item} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  )
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const { isManager } = useAuth()
  const sections = isManager ? adminNav : employeeNav

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto py-2">
      <div className="mb-2 flex items-center gap-3 px-6 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          O
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Oklut HRMS</p>
          <p className="text-xs text-muted-foreground">Human Resources</p>
        </div>
      </div>
      {sections.map((section) => (
        <Section key={section.title} {...section} onNavigate={onNavigate} />
      ))}
    </div>
  )
}
