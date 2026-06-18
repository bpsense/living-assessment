/**
 * MiniBlob.tsx
 * Compact living blob chart for dashboard cards.
 * Shows a simplified amoeba shape without labels — just the
 * competency blob and interest dots at a glance.
 */

import LivingBlob from '../student/LivingBlob'
import type { DimensionScore } from '../../lib/student-data'

interface Props {
  dimensionScores: DimensionScore[]
}

export default function MiniBlob({ dimensionScores }: Props) {
  return (
    <LivingBlob
      dimensionScores={dimensionScores}
      size={200}
      showLabels={false}
      showLevelLabels={false}
      showDots={false}
    />
  )
}
