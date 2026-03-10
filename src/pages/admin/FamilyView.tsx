import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useParentDashboard } from '../../lib/dashboard-data'
import ParentDashboard from '../../components/dashboard/ParentDashboard'

export default function FamilyView() {
  const { parentId } = useParams<{ parentId: string }>()
  const navigate = useNavigate()
  const [parentName, setParentName] = useState<string | null>(null)
  const [loadingName, setLoadingName] = useState(true)

  // Fetch parent's display name
  useEffect(() => {
    if (!parentId) return
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', parentId)
      .single()
      .then(({ data }) => {
        setParentName(data?.full_name ?? 'Unknown')
        setLoadingName(false)
      })
  }, [parentId])

  const dashData = useParentDashboard(null, parentId)

  if (loadingName || dashData.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate('/admin/families')}
        className="flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Families
      </button>

      {/* Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-accent-200 bg-accent-50 px-5 py-3">
        <Eye className="h-5 w-5 text-accent-600" />
        <p className="text-sm font-medium text-accent-700">
          Viewing as <span className="font-bold">{parentName}</span>
        </p>
      </div>

      {/* Render the parent dashboard */}
      <ParentDashboard
        data={dashData}
        userName={parentName ?? ''}
        hideAddLearner
      />
    </div>
  )
}
