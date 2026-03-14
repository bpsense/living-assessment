import { supabase } from './supabase'
import type {
  CompetencyFramework,
  CompetencyDomain,
  CompetencySubdomain,
  Competency,
  CompetencyFrameworkInsert,
  CompetencyDomainInsert,
  CompetencySubdomainInsert,
  CompetencyInsert,
  StepDescriptors,
} from '../types/database'

// ============================================================
// Types for parsed upload data
// ============================================================

export interface ParsedCompetency {
  code: string
  name: string
  objective: string
  stepDescriptors: StepDescriptors
}

export interface ParsedSubdomain {
  name: string
  competencies: ParsedCompetency[]
}

export interface ParsedDomain {
  name: string
  codePrefix: string
  subdomains: ParsedSubdomain[]
}

export interface ParsedFramework {
  name: string
  description: string
  domains: ParsedDomain[]
}

// ============================================================
// CSV/XLSX Parsing
// ============================================================

const STEP_COLUMNS = [
  'Step E1', 'Step E2', 'Step E3', 'Step E4', 'Step E5', 'Step E6',
  'Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5', 'Step 6',
  'Step 7', 'Step 8', 'Step 9', 'Step 10',
]

const STEP_KEYS = [
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
]

/**
 * Parse a single sheet (domain) of competency data.
 * Expected columns: Domain, Sub-domain, Standard (Competency), Code, Objective, Step E1...Step 10
 */
export function parseCompetencySheet(
  rows: Record<string, string>[],
  sheetName: string
): ParsedDomain | null {
  if (rows.length === 0) return null

  const domain: ParsedDomain = {
    name: '',
    codePrefix: '',
    subdomains: [],
  }

  const subdomainMap = new Map<string, ParsedSubdomain>()

  for (const row of rows) {
    const domainName = (row['Domain'] || '').trim()
    const subdomainName = (row['Sub-domain'] || '').trim()
    const competencyName = (row['Standard (Competency)'] || row['Standard'] || '').trim()
    const code = (row['Code'] || '').trim()
    const objective = (row['Objective'] || '').trim()

    if (!competencyName || !code) continue

    // Set domain name from first valid row
    if (!domain.name && domainName) {
      domain.name = domainName
      // Extract code prefix from first code (e.g. "Intra" from "Intra111")
      const prefixMatch = code.match(/^([A-Za-z]+)/)
      domain.codePrefix = prefixMatch ? prefixMatch[1] : ''
    }

    // Build step descriptors
    const stepDescriptors: StepDescriptors = {}
    for (let i = 0; i < STEP_COLUMNS.length; i++) {
      const val = (row[STEP_COLUMNS[i]] || '').trim()
      if (val && val !== 'N/A') {
        stepDescriptors[STEP_KEYS[i]] = val
      }
    }

    const competency: ParsedCompetency = {
      code,
      name: competencyName,
      objective,
      stepDescriptors,
    }

    // Group by subdomain
    const sdKey = subdomainName || sheetName
    if (!subdomainMap.has(sdKey)) {
      subdomainMap.set(sdKey, { name: sdKey, competencies: [] })
    }
    subdomainMap.get(sdKey)!.competencies.push(competency)
  }

  domain.subdomains = Array.from(subdomainMap.values())
  return domain.subdomains.length > 0 ? domain : null
}

/**
 * Parse a multi-sheet workbook into a full framework.
 * Each sheet = one domain.
 */
export function parseMultiSheetData(
  sheets: Record<string, Record<string, string>[]>,
  frameworkName: string
): ParsedFramework {
  const domains: ParsedDomain[] = []

  for (const [sheetName, rows] of Object.entries(sheets)) {
    const domain = parseCompetencySheet(rows, sheetName)
    if (domain) {
      // Use sheet name as domain name if none found in data
      if (!domain.name) domain.name = sheetName
      domains.push(domain)
    }
  }

  return {
    name: frameworkName,
    description: `${domains.length} domains, uploaded ${new Date().toLocaleDateString()}`,
    domains,
  }
}

/**
 * Parse a single-sheet CSV where all domains are in one table.
 */
export function parseSingleSheetData(
  rows: Record<string, string>[],
  frameworkName: string
): ParsedFramework {
  const domainMap = new Map<string, { rows: Record<string, string>[]; name: string }>()

  for (const row of rows) {
    const domainName = (row['Domain'] || 'Unknown').trim()
    if (!domainMap.has(domainName)) {
      domainMap.set(domainName, { rows: [], name: domainName })
    }
    domainMap.get(domainName)!.rows.push(row)
  }

  const domains: ParsedDomain[] = []
  for (const [, { rows: dRows, name }] of domainMap) {
    const domain = parseCompetencySheet(dRows, name)
    if (domain) domains.push(domain)
  }

  return {
    name: frameworkName,
    description: `${domains.length} domains, uploaded ${new Date().toLocaleDateString()}`,
    domains,
  }
}

// ============================================================
// Validation
// ============================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
  stats: {
    domains: number
    subdomains: number
    competencies: number
  }
}

export function validateParsedFramework(framework: ParsedFramework): ValidationResult {
  const errors: string[] = []
  let subdomainCount = 0
  let competencyCount = 0

  if (!framework.name.trim()) {
    errors.push('Framework name is required')
  }

  if (framework.domains.length === 0) {
    errors.push('No domains found in the uploaded data')
  }

  for (const domain of framework.domains) {
    if (!domain.name.trim()) {
      errors.push('One or more domains are missing a name')
    }
    subdomainCount += domain.subdomains.length

    for (const subdomain of domain.subdomains) {
      for (const comp of subdomain.competencies) {
        competencyCount++
        if (!comp.code.trim()) {
          errors.push(`Competency "${comp.name}" is missing a code`)
        }
        if (!comp.name.trim()) {
          errors.push(`Competency with code "${comp.code}" is missing a name`)
        }
        if (Object.keys(comp.stepDescriptors).length === 0) {
          errors.push(`Competency "${comp.code}" has no step descriptors`)
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      domains: framework.domains.length,
      subdomains: subdomainCount,
      competencies: competencyCount,
    },
  }
}

// ============================================================
// Database Operations
// ============================================================

/**
 * Save a parsed framework to the database.
 * Creates framework, domains, subdomains, and competencies in order.
 */
export async function saveFrameworkToDb(
  schoolId: string,
  parsed: ParsedFramework,
  isDefault = false
): Promise<string> {
  // 1. Create framework
  const { data: fw, error: fwErr } = await supabase
    .from('competency_frameworks')
    .insert({
      school_id: schoolId,
      name: parsed.name,
      description: parsed.description,
      version: '1.0',
      is_default: isDefault,
    } satisfies CompetencyFrameworkInsert)
    .select('id')
    .single()

  if (fwErr || !fw) throw new Error(`Failed to create framework: ${fwErr?.message}`)

  const frameworkId = fw.id

  // 2. Create domains, subdomains, competencies
  for (let di = 0; di < parsed.domains.length; di++) {
    const domain = parsed.domains[di]

    const { data: dom, error: domErr } = await supabase
      .from('competency_domains')
      .insert({
        framework_id: frameworkId,
        name: domain.name,
        display_order: di,
        code_prefix: domain.codePrefix || null,
      } satisfies CompetencyDomainInsert)
      .select('id')
      .single()

    if (domErr || !dom) throw new Error(`Failed to create domain: ${domErr?.message}`)

    for (let si = 0; si < domain.subdomains.length; si++) {
      const subdomain = domain.subdomains[si]

      const { data: sd, error: sdErr } = await supabase
        .from('competency_subdomains')
        .insert({
          domain_id: dom.id,
          name: subdomain.name,
          display_order: si,
        } satisfies CompetencySubdomainInsert)
        .select('id')
        .single()

      if (sdErr || !sd) throw new Error(`Failed to create subdomain: ${sdErr?.message}`)

      // Batch insert competencies for this subdomain
      const competencyInserts: CompetencyInsert[] = subdomain.competencies.map((c) => ({
        subdomain_id: sd.id,
        framework_id: frameworkId,
        code: c.code,
        name: c.name,
        objective: c.objective || null,
        step_descriptors: c.stepDescriptors,
      }))

      if (competencyInserts.length > 0) {
        const { error: compErr } = await supabase
          .from('competencies')
          .insert(competencyInserts)

        if (compErr) throw new Error(`Failed to create competencies: ${compErr.message}`)
      }
    }
  }

  return frameworkId
}

// ============================================================
// Fetch Operations
// ============================================================

export async function fetchFrameworks(schoolId: string): Promise<CompetencyFramework[]> {
  const { data, error } = await supabase
    .from('competency_frameworks')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export interface FrameworkWithCounts extends CompetencyFramework {
  domain_count: number
  competency_count: number
}

export async function fetchFrameworksWithCounts(schoolId: string): Promise<FrameworkWithCounts[]> {
  const frameworks = await fetchFrameworks(schoolId)

  const result: FrameworkWithCounts[] = []
  for (const fw of frameworks) {
    const { count: domainCount } = await supabase
      .from('competency_domains')
      .select('*', { count: 'exact', head: true })
      .eq('framework_id', fw.id)

    const { count: compCount } = await supabase
      .from('competencies')
      .select('*', { count: 'exact', head: true })
      .eq('framework_id', fw.id)

    result.push({
      ...fw,
      domain_count: domainCount || 0,
      competency_count: compCount || 0,
    })
  }

  return result
}

export interface FrameworkTree {
  framework: CompetencyFramework
  domains: (CompetencyDomain & {
    subdomains: (CompetencySubdomain & {
      competencies: Competency[]
    })[]
  })[]
}

export async function fetchFrameworkTree(frameworkId: string): Promise<FrameworkTree> {
  const { data: fw, error: fwErr } = await supabase
    .from('competency_frameworks')
    .select('*')
    .eq('id', frameworkId)
    .single()

  if (fwErr || !fw) throw new Error('Framework not found')

  const { data: domains } = await supabase
    .from('competency_domains')
    .select('*')
    .eq('framework_id', frameworkId)
    .order('display_order')

  const { data: subdomains } = await supabase
    .from('competency_subdomains')
    .select('*')
    .in('domain_id', (domains || []).map((d) => d.id))
    .order('display_order')

  const { data: competencies } = await supabase
    .from('competencies')
    .select('*')
    .eq('framework_id', frameworkId)
    .order('code')

  const subdomainMap = new Map<string, (CompetencySubdomain & { competencies: Competency[] })[]>()
  for (const sd of subdomains || []) {
    if (!subdomainMap.has(sd.domain_id)) subdomainMap.set(sd.domain_id, [])
    const comps = (competencies || []).filter((c) => c.subdomain_id === sd.id)
    subdomainMap.get(sd.domain_id)!.push({ ...sd, competencies: comps })
  }

  return {
    framework: fw,
    domains: (domains || []).map((d) => ({
      ...d,
      subdomains: subdomainMap.get(d.id) || [],
    })),
  }
}

export async function deleteFramework(frameworkId: string): Promise<void> {
  const { error } = await supabase
    .from('competency_frameworks')
    .delete()
    .eq('id', frameworkId)

  if (error) throw error
}
