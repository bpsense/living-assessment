import { useParams, useNavigate } from 'react-router-dom'
import { differenceInYears, format } from 'date-fns'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Printer,
  TrendingUp,
  Trophy,
  Compass,
  Anchor,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  useReportData,
  getCompetencyLevel,
  getCompetencyLabel,
  getInterestLabel,
} from '../lib/report-data'
import { classifyZones, type Zone } from '../lib/student-data'
import { DimensionIcon } from '../components/student/DimensionIcon'
import { INTEREST_ENABLED } from '../lib/features'

// ============================================================
// Competency level → colour helpers
// ============================================================

const LEVEL_COLOR: Record<string, string> = {
  emerging: 'text-alert-600',
  developing: 'text-caution-600',
  practicing: 'text-primary-700',
  proficient: 'text-success-600',
}

const LEVEL_BG: Record<string, string> = {
  emerging: 'bg-alert-50 border-alert-200',
  developing: 'bg-caution-50 border-caution-200',
  practicing: 'bg-primary-50 border-primary-200',
  proficient: 'bg-success-50 border-success-200',
}

const LEVEL_DOT: Record<string, string> = {
  emerging: 'bg-alert-500',
  developing: 'bg-caution-500',
  practicing: 'bg-primary-500',
  proficient: 'bg-success-500',
}

// ============================================================
// Zone config for the 2x2 matrix (print version)
// ============================================================

const ZONE_CONFIG: Record<
  Zone,
  { label: string; description: string; icon: React.ReactNode; bgClass: string; textClass: string }
> = {
  growth: {
    label: 'Growth Zone',
    description: 'High interest, developing skill',
    icon: <TrendingUp className="h-4 w-4" />,
    bgClass: 'bg-success-50 border-success-200',
    textClass: 'text-success-700',
  },
  mastery: {
    label: 'Mastery Zone',
    description: 'High interest, strong skill',
    icon: <Trophy className="h-4 w-4" />,
    bgClass: 'bg-primary-50 border-primary-200',
    textClass: 'text-primary-700',
  },
  explore: {
    label: 'Explore Zone',
    description: 'Opportunity to spark interest',
    icon: <Compass className="h-4 w-4" />,
    bgClass: 'bg-accent-50 border-accent-200',
    textClass: 'text-accent-700',
  },
  cruise: {
    label: 'Cruise Zone',
    description: 'Strong skill, less engaged',
    icon: <Anchor className="h-4 w-4" />,
    bgClass: 'bg-bg-muted border-bg-muted',
    textClass: 'text-text-muted',
  },
}

// ============================================================
// Main Export Page
// ============================================================

export default function ExportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    data,
    loading,
    error,
    setPeriodKey,
    selectedPeriodKey,
  } = useReportData(id)

  function handlePrint() {
    window.print()
  }

  // ---------- Loading / Error states ----------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary-500" />
          <p className="mt-3 text-sm text-text-muted">Loading report data...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-alert-500" />
          <h2 className="mt-3 text-lg font-semibold text-text">Unable to load report</h2>
          <p className="mt-1 text-sm text-text-muted">{error ?? 'Learner not found.'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  const {
    student,
    classroom,
    school,
    dimensionScores,
    dimensionReports,
    availablePeriods,
  } = data

  const age = student.date_of_birth
    ? differenceInYears(new Date(), new Date(student.date_of_birth))
    : null

  const selectedPeriod = availablePeriods.find((p) => p.key === selectedPeriodKey)
  const periodLabel = selectedPeriod?.label ?? 'Current'

  const classified = classifyZones(dimensionScores)

  // Radar chart data
  const radarData = dimensionScores.map((ds) => ({
    name: ds.dimension_name.length > 18
      ? ds.dimension_name.slice(0, 16) + '...'
      : ds.dimension_name,
    competency: ds.competency,
    interest: ds.interest,
  }))

  return (
    <div className="mx-auto max-w-4xl">
      {/* ================================================================
          TOOLBAR (hidden when printing)
          ================================================================ */}
      <div className="mb-6 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Profile
        </button>

        <div className="glass-card flex flex-wrap items-end gap-4 p-5">
          {/* Period selector */}
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-text-muted">
              Academic Period
            </label>
            <select
              value={selectedPeriodKey ?? ''}
              onChange={(e) => setPeriodKey(e.target.value || null)}
              className="w-full rounded-lg border border-bg-muted bg-bg px-3 py-2 text-sm text-text focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
            >
              {availablePeriods.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Export button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600"
          >
            <Printer className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* ================================================================
          PRINTABLE REPORT
          ================================================================ */}
      <div className="space-y-6 rounded-xl border border-bg-muted bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        {/* ---- HEADER ---- */}
        <header className="border-b border-bg-muted pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text">
                Learner Profile Report
              </h1>
              <p className="mt-1 text-lg text-primary-700 font-semibold">
                {school.name}
              </p>
            </div>
            <div className="text-right text-sm text-text-muted">
              <p>Generated {format(new Date(), 'MMMM d, yyyy')}</p>
              <p className="font-medium text-text">{periodLabel}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-text-light">
                Student
              </span>
              <p className="text-base font-bold text-text">
                {student.first_name} {student.last_name}
              </p>
            </div>
            {classroom && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-text-light">
                  Classroom
                </span>
                <p className="text-sm font-medium text-text">{classroom.name}</p>
              </div>
            )}
            {student.grade_level && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-text-light">
                  Grade
                </span>
                <p className="text-sm font-medium text-text">{student.grade_level}</p>
              </div>
            )}
            {age !== null && (
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-text-light">
                  Age
                </span>
                <p className="text-sm font-medium text-text">{age}</p>
              </div>
            )}
          </div>
        </header>

        {/* ---- SUMMARY RADAR CHART ---- */}
        <section>
          <h2 className="mb-3 text-lg font-bold text-text">
            Development Overview
          </h2>
          <div className="flex justify-center">
            <div className="w-full max-w-lg">
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                  <PolarGrid stroke="#E8E4DD" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#636E72' }}
                  />
                  <PolarRadiusAxis
                    domain={[0, 5]}
                    tick={{ fontSize: 9, fill: '#B2BEC3' }}
                    axisLine={false}
                  />
                  <Radar
                    name="Competency"
                    dataKey="competency"
                    stroke="#0D7377"
                    fill="#0D7377"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  {INTEREST_ENABLED && (
                    <Radar
                      name="Interest"
                      dataKey="interest"
                      stroke="#D4943A"
                      fill="#D4943A"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      strokeDasharray="4 2"
                    />
                  )}
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ---- ZONE MATRIX (2×2) ---- */}
        {INTEREST_ENABLED && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-text">
            Learning Zones
          </h2>
          <p className="mb-4 text-sm text-text-muted">
            Dimensions mapped to interest and competency levels.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['growth', 'mastery', 'explore', 'cruise'] as Zone[]).map(
              (zoneKey) => {
                const zc = ZONE_CONFIG[zoneKey]
                const dims = classified.filter((c) => c.zone === zoneKey)
                return (
                  <div
                    key={zoneKey}
                    className={clsx(
                      'rounded-lg border p-3',
                      zc.bgClass
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className={zc.textClass}>{zc.icon}</span>
                      <div>
                        <h4 className={clsx('text-sm font-semibold', zc.textClass)}>
                          {zc.label}
                        </h4>
                        <p className="text-[10px] text-text-muted">{zc.description}</p>
                      </div>
                    </div>
                    {dims.length === 0 ? (
                      <p className="text-[11px] italic text-text-light">
                        No dimensions
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {dims.map((d) => (
                          <span
                            key={d.dimension_id}
                            className={clsx(
                              'rounded-full px-2 py-0.5 text-[10px] font-medium text-white',
                              zoneKey === 'growth'
                                ? 'bg-success-500'
                                : zoneKey === 'mastery'
                                  ? 'bg-primary-500'
                                  : zoneKey === 'explore'
                                    ? 'bg-accent-500'
                                    : 'bg-text-light'
                            )}
                          >
                            {d.dimension_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
            )}
          </div>
        </section>
        )}

        {/* ---- DIMENSION DETAILS ---- */}
        <section>
          <h2 className="mb-4 text-lg font-bold text-text">
            Dimension Details
          </h2>

          <div className="space-y-5">
            {dimensionReports.map((dr) => {
              const level = dr.score.competency > 0
                ? getCompetencyLevel(dr.score.competency)
                : null

              return (
                <div
                  key={dr.dimension.id}
                  className="rounded-lg border border-bg-muted p-4 break-inside-avoid"
                >
                  {/* Dimension header */}
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
                      <DimensionIcon
                        name={dr.dimension.icon}
                        className="h-4 w-4 text-primary-600"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-text">
                        {dr.dimension.name}
                      </h3>
                      {dr.dimension.description && (
                        <p className="text-xs text-text-muted">
                          {dr.dimension.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Competency + Interest row */}
                  <div className="mb-3 flex flex-wrap gap-3">
                    {/* Competency badge */}
                    <div
                      className={clsx(
                        'flex items-center gap-2 rounded-lg border px-3 py-2',
                        level ? LEVEL_BG[level] : 'bg-bg-muted border-bg-muted'
                      )}
                    >
                      {level && (
                        <span
                          className={clsx(
                            'h-2.5 w-2.5 rounded-full',
                            LEVEL_DOT[level]
                          )}
                        />
                      )}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-light">
                          Competency
                        </p>
                        <p
                          className={clsx(
                            'text-sm font-bold',
                            level ? LEVEL_COLOR[level] : 'text-text-light'
                          )}
                        >
                          {dr.score.competency > 0
                            ? getCompetencyLabel(dr.score.competency)
                            : 'Not assessed'}
                        </p>
                      </div>
                    </div>

                    {/* Interest badge */}
                    {INTEREST_ENABLED && (
                      <div className="flex items-center gap-2 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-light">
                            Interest
                          </p>
                          <p className="text-sm font-bold text-accent-700">
                            {getInterestLabel(dr.score.interest)}
                            {dr.score.interest > 0 && (
                              <span className="ml-1 text-xs font-normal text-accent-500">
                                ({dr.score.interest.toFixed(1)}/5)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Observations count */}
                    <div className="flex items-center gap-2 rounded-lg border border-bg-muted bg-bg px-3 py-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-text-light">
                          Observations
                        </p>
                        <p className="text-sm font-bold text-text">
                          {dr.score.observation_count}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Educator narrative */}
                  {dr.latestNarrative && (
                    <div className="mb-3 rounded-lg bg-bg p-3">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-light">
                        Educator Observation
                      </p>
                      <p className="text-xs leading-relaxed text-text">
                        &ldquo;{dr.latestNarrative}&rdquo;
                      </p>
                      <p className="mt-1 text-[10px] text-text-light">
                        {dr.narrativeObserver && `— ${dr.narrativeObserver}`}
                        {dr.narrativeDate &&
                          `, ${format(new Date(dr.narrativeDate), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        </section>

        {/* ---- FOOTER ---- */}
        <footer className="border-t border-bg-muted pt-4 text-center">
          <p className="text-xs text-text-light">
            This report was generated from {school.name}&apos;s learner profile
            system.
          </p>
          <p className="mt-1 text-[10px] text-text-light">
            Competency levels reflect educator observations.
            {INTEREST_ENABLED &&
              ' Interest levels are based on student self-assessment surveys.'}
          </p>
        </footer>
      </div>

      {/* ================================================================
          PRINT STYLES
          ================================================================ */}
      <style>{`
        @media print {
          /* Hide everything except the report */
          body > * { visibility: hidden; }
          #root { visibility: visible; }

          /* Hide app layout chrome */
          nav, aside, header:not(.report-header),
          [data-sidebar], [data-topbar] {
            display: none !important;
          }

          /* Ensure the main content fills the page */
          main, [role="main"], .flex-1 {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }

          /* Page setup */
          @page {
            size: A4;
            margin: 1.5cm;
          }

          /* Avoid breaking inside dimension cards */
          .break-inside-avoid {
            break-inside: avoid;
          }

          /* Ensure backgrounds print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  )
}
