import {
  House, Receipt, TrendingUp, Landmark, CircleCheck, FileText, ChartColumn, Undo2, Tag,
  Megaphone, Banknote, Smartphone, Inbox, Building2, Plug, MessageCircle,
} from 'lucide-react'

const ICONS = {
  home: House,
  receipt: Receipt,
  trend: TrendingUp,
  bank: Landmark,
  check: CircleCheck,
  bill: FileText,
  report: ChartColumn,
  refund: Undo2,
  tag: Tag,
  megaphone: Megaphone,
  cash: Banknote,
  terminal: Smartphone,
  inbox: Inbox,
  building: Building2,
  plug: Plug,
  chat: MessageCircle,
}

/** @param {{name: string, className?: string}} props */
export function NavIcon({ name, className }) {
  const Icon = ICONS[name] ?? House
  return <Icon className={className ?? 'size-5'} strokeWidth={1.8} aria-hidden="true" />
}
