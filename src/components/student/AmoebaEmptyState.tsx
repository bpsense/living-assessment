/**
 * AmoebaEmptyState.tsx
 * Friendly empty-state copy for the Living Assessment surface when one of the
 * required pieces is missing: date of birth, skill assessments, or
 * competency-domain → dimension mappings.
 */

import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

export type AmoebaEmptyVariant = 'no_dob' | 'no_assessments' | 'no_mappings'

interface Props {
  variant: AmoebaEmptyVariant
}

const COPY: Record<AmoebaEmptyVariant, string> = {
  no_dob: "Add a date of birth to view this student's growth profile.",
  no_assessments:
    'Standards-based assessments will populate this view as assignments are completed and assessed.',
  no_mappings:
    'A school admin needs to map standards domains to Learner Profile dimensions before this view can populate.',
}

export default function AmoebaEmptyState({ variant }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-bg-muted bg-bg/50 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
        <Sparkles className="h-6 w-6 text-primary-500" />
      </div>
      <p className="max-w-md text-sm text-text-muted">{COPY[variant]}</p>
      {variant === 'no_mappings' && (
        <Link
          to="/admin/learner-profile"
          className="text-xs font-semibold text-primary-600 hover:text-primary-700"
        >
          Open Learner Profile admin →
        </Link>
      )}
    </div>
  )
}
