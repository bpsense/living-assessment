import {
  BookOpen,
  Calculator,
  Microscope,
  Globe,
  Palette,
  HeartPulse,
  Users,
  Lightbulb,
  MessageCircle,
  Compass,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  'book-open': BookOpen,
  calculator: Calculator,
  microscope: Microscope,
  globe: Globe,
  palette: Palette,
  'heart-pulse': HeartPulse,
  users: Users,
  lightbulb: Lightbulb,
  'message-circle': MessageCircle,
  compass: Compass,
}

interface Props {
  name: string | null
  className?: string
}

export function DimensionIcon({ name, className }: Props) {
  const Icon = name ? ICON_MAP[name] ?? BookOpen : BookOpen
  return <Icon className={className} />
}
