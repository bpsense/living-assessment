/**
 * AssignmentTypeSelector.tsx
 *
 * Inline picker shown before the Create-New form: two large cards choosing
 * between a Project (PBL) and a Focused Task.
 */
import { clsx } from 'clsx'
import { Layers, Target } from 'lucide-react'
import type { AssignmentType } from '../../lib/assignment-data'

interface Props {
  selected?: AssignmentType | null
  onSelect: (type: AssignmentType) => void
}

const CARDS: {
  type: AssignmentType
  title: string
  blurb: string
  Icon: typeof Layers
}[] = [
  {
    type: 'project',
    title: 'Project',
    blurb: 'Multi-disciplinary, driving question, sustained inquiry, and a public product.',
    Icon: Layers,
  },
  {
    type: 'focused_task',
    title: 'Focused Task',
    blurb: 'A specific skill or concept with targeted practice and a clear scaffold.',
    Icon: Target,
  },
]

export default function AssignmentTypeSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CARDS.map(({ type, title, blurb, Icon }) => {
        const active = selected === type
        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className={clsx(
              'flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all',
              active
                ? 'border-primary-500 bg-primary-50 shadow-sm'
                : 'border-bg-muted bg-bg-card hover:border-primary-200 hover:bg-bg'
            )}
          >
            <span
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                active ? 'bg-primary-500 text-white' : 'bg-bg-muted text-text-muted'
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className={clsx('text-sm font-bold', active ? 'text-primary-700' : 'text-text')}>
              {title}
            </span>
            <span className="text-xs leading-snug text-text-muted">{blurb}</span>
          </button>
        )
      })}
    </div>
  )
}
