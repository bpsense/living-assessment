import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../Toast'
import type { Dimension } from '../../types/database'

interface DomainRow {
  id: string
  name: string
}

interface MapRow {
  id: string
  competency_domain_id: string
  dimension_id: string
}

interface Props {
  schoolId: string
  dimensions: Dimension[]
  canEdit: boolean
}

export default function StandardsMappingSection({ schoolId, dimensions, canEdit }: Props) {
  const { toast } = useToast()
  const [domains, setDomains] = useState<DomainRow[]>([])
  const [mapByDomain, setMapByDomain] = useState<Map<string, MapRow>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingDomainId, setSavingDomainId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: fwData, error: fwErr } = await supabase
      .from('competency_frameworks')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_default', true)
      .maybeSingle()

    if (fwErr) {
      setError(fwErr.message)
      setLoading(false)
      return
    }

    if (!fwData) {
      setDomains([])
      setMapByDomain(new Map())
      setLoading(false)
      return
    }

    const [{ data: domData, error: domErr }, { data: mapData, error: mapErr }] =
      await Promise.all([
        supabase
          .from('competency_domains')
          .select('id, name, display_order')
          .eq('framework_id', fwData.id)
          .order('display_order'),
        supabase
          .from('competency_domain_dimension_map')
          .select('id, competency_domain_id, dimension_id')
          .eq('school_id', schoolId),
      ])

    if (domErr || mapErr) {
      setError((domErr ?? mapErr)!.message)
      setLoading(false)
      return
    }

    setDomains((domData ?? []) as DomainRow[])
    const map = new Map<string, MapRow>()
    for (const row of (mapData ?? []) as MapRow[]) {
      map.set(row.competency_domain_id, row)
    }
    setMapByDomain(map)
    setLoading(false)
  }, [schoolId])

  useEffect(() => {
    load()
  }, [load])

  async function handleChange(domainId: string, dimensionId: string) {
    setSavingDomainId(domainId)
    const existing = mapByDomain.get(domainId)
    const next = new Map(mapByDomain)

    if (dimensionId === '') {
      if (existing) {
        const { error: delErr } = await supabase
          .from('competency_domain_dimension_map')
          .delete()
          .eq('id', existing.id)
        if (delErr) {
          toast(`Failed to clear mapping: ${delErr.message}`, 'error')
          setSavingDomainId(null)
          return
        }
        next.delete(domainId)
      }
    } else if (existing) {
      const { error: updErr } = await supabase
        .from('competency_domain_dimension_map')
        .update({ dimension_id: dimensionId })
        .eq('id', existing.id)
      if (updErr) {
        toast(`Failed to update mapping: ${updErr.message}`, 'error')
        setSavingDomainId(null)
        return
      }
      next.set(domainId, { ...existing, dimension_id: dimensionId })
    } else {
      const { data: ins, error: insErr } = await supabase
        .from('competency_domain_dimension_map')
        .insert({
          school_id: schoolId,
          competency_domain_id: domainId,
          dimension_id: dimensionId,
        })
        .select('id, competency_domain_id, dimension_id')
        .single()
      if (insErr || !ins) {
        toast(`Failed to save mapping: ${insErr?.message}`, 'error')
        setSavingDomainId(null)
        return
      }
      next.set(domainId, ins as MapRow)
    }

    setMapByDomain(next)
    setSavingDomainId(null)
    toast('Mapping saved', 'success')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text">Standards Mapping</h2>
        <p className="mt-1 text-sm text-text-muted">
          Map each standards domain to one of your Learner Profile dimensions. Skill
          assessments roll up through this mapping to feed the amoeba visualization.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-alert-50 px-4 py-3 text-sm text-alert-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {domains.length === 0 ? (
        <div className="rounded-xl border border-dashed border-bg-muted py-8 text-center text-sm text-text-muted">
          This school has no standards framework yet.
        </div>
      ) : (
        <div className="divide-y divide-bg-muted overflow-hidden rounded-xl border border-bg-muted">
          {domains.map((dom) => {
            const current = mapByDomain.get(dom.id)?.dimension_id ?? ''
            return (
              <div key={dom.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{dom.name}</p>
                  {!current && (
                    <p className="mt-0.5 text-xs text-text-light">
                      Not mapped — assessments in this domain won't feed the amoeba.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={current}
                    disabled={!canEdit || savingDomainId === dom.id}
                    onChange={(e) => handleChange(dom.id, e.target.value)}
                    className="min-w-[16rem] rounded-lg border border-bg-muted bg-bg-card px-3 py-2 text-sm text-text shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="">— Not mapped —</option>
                    {dimensions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  {savingDomainId === dom.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary-400" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
