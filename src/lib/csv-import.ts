import Papa from 'papaparse'
import type { StudentInsert, StudentStatus } from '../types/database'

// ============================================================
// Types
// ============================================================

export interface CsvRow {
  [key: string]: string
}

export interface CsvValidationError {
  row: number
  field: string
  message: string
}

export interface CsvParseResult {
  headers: string[]
  rows: CsvRow[]
}

export interface ColumnMapping {
  [csvHeader: string]: string // maps CSV header → DB field name (or '' to skip)
}

// ============================================================
// DB field definitions for the column mapping UI
// ============================================================

export const STUDENT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'middle_name', label: 'Middle Name' },
  { key: 'preferred_name', label: 'Preferred Name' },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'pronouns', label: 'Pronouns' },
  { key: 'grade_level', label: 'Grade Level' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'first_language', label: 'First Language' },
  { key: 'additional_languages', label: 'Additional Languages' },
  { key: 'medical_conditions', label: 'Medical Conditions' },
  { key: 'student_support_needs', label: 'Support Needs' },
  { key: 'dietary_restrictions', label: 'Dietary Restrictions' },
  { key: 'medications', label: 'Medications' },
  { key: 'enrollment_date', label: 'Enrollment Date' },
]

// ============================================================
// Fuzzy header-to-field mapping
// ============================================================

const HEADER_ALIASES: Record<string, string> = {
  // first_name
  'first name': 'first_name',
  'first_name': 'first_name',
  firstname: 'first_name',
  'given name': 'first_name',
  'given_name': 'first_name',
  // last_name
  'last name': 'last_name',
  'last_name': 'last_name',
  lastname: 'last_name',
  surname: 'last_name',
  'family name': 'last_name',
  'family_name': 'last_name',
  // middle_name
  'middle name': 'middle_name',
  'middle_name': 'middle_name',
  middlename: 'middle_name',
  // preferred_name
  'preferred name': 'preferred_name',
  'preferred_name': 'preferred_name',
  nickname: 'preferred_name',
  // date_of_birth
  'date of birth': 'date_of_birth',
  'date_of_birth': 'date_of_birth',
  dob: 'date_of_birth',
  birthday: 'date_of_birth',
  birthdate: 'date_of_birth',
  'birth date': 'date_of_birth',
  // pronouns
  pronouns: 'pronouns',
  pronoun: 'pronouns',
  // grade_level
  'grade level': 'grade_level',
  'grade_level': 'grade_level',
  grade: 'grade_level',
  // nationality
  nationality: 'nationality',
  // first_language
  'first language': 'first_language',
  'first_language': 'first_language',
  'primary language': 'first_language',
  'home language': 'first_language',
  'mother tongue': 'first_language',
  language: 'first_language',
  // additional_languages
  'additional languages': 'additional_languages',
  'additional_languages': 'additional_languages',
  'other languages': 'additional_languages',
  'second language': 'additional_languages',
  // medical_conditions
  'medical conditions': 'medical_conditions',
  'medical_conditions': 'medical_conditions',
  medical: 'medical_conditions',
  'health conditions': 'medical_conditions',
  // student_support_needs
  'student support needs': 'student_support_needs',
  'student_support_needs': 'student_support_needs',
  'support needs': 'student_support_needs',
  'special needs': 'student_support_needs',
  'learning needs': 'student_support_needs',
  accommodations: 'student_support_needs',
  // dietary_restrictions
  'dietary restrictions': 'dietary_restrictions',
  'dietary_restrictions': 'dietary_restrictions',
  dietary: 'dietary_restrictions',
  diet: 'dietary_restrictions',
  allergies: 'dietary_restrictions',
  'food allergies': 'dietary_restrictions',
  // medications
  medications: 'medications',
  medication: 'medications',
  meds: 'medications',
  // enrollment_date
  'enrollment date': 'enrollment_date',
  'enrollment_date': 'enrollment_date',
  enrolled: 'enrollment_date',
  'start date': 'enrollment_date',
}

// ============================================================
// Parse CSV
// ============================================================

export function parseCSV(text: string): CsvParseResult {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  return {
    headers: result.meta.fields ?? [],
    rows: result.data,
  }
}

// ============================================================
// Auto-map CSV headers to DB fields
// ============================================================

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const usedFields = new Set<string>()

  for (const header of headers) {
    const normalized = header.toLowerCase().trim()
    const match = HEADER_ALIASES[normalized]
    if (match && !usedFields.has(match)) {
      mapping[header] = match
      usedFields.add(match)
    } else {
      mapping[header] = '' // not mapped
    }
  }

  return mapping
}

// ============================================================
// Validate a single row
// ============================================================

export function validateRow(
  row: CsvRow,
  mapping: ColumnMapping,
  rowIndex: number
): CsvValidationError[] {
  const errors: CsvValidationError[] = []

  // Build reverse mapping: DB field → CSV header
  const fieldToHeader = new Map<string, string>()
  for (const [csvHeader, dbField] of Object.entries(mapping)) {
    if (dbField) fieldToHeader.set(dbField, csvHeader)
  }

  // Required fields
  for (const field of ['first_name', 'last_name']) {
    const header = fieldToHeader.get(field)
    if (!header) {
      errors.push({ row: rowIndex, field, message: `${field} is required but not mapped` })
    } else if (!row[header]?.trim()) {
      errors.push({ row: rowIndex, field, message: `${field} is empty` })
    }
  }

  // Date validation
  for (const dateField of ['date_of_birth', 'enrollment_date']) {
    const header = fieldToHeader.get(dateField)
    if (header && row[header]?.trim()) {
      const parsed = parseDate(row[header].trim())
      if (!parsed) {
        errors.push({
          row: rowIndex,
          field: dateField,
          message: `Invalid date format: "${row[header]}"`,
        })
      }
    }
  }

  return errors
}

// ============================================================
// Parse flexible date formats → YYYY-MM-DD
// ============================================================

function parseDate(value: string): string | null {
  // Try ISO format first: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value + 'T00:00:00')
    return isNaN(d.getTime()) ? null : value
  }

  // Try MM/DD/YYYY
  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    if (!isNaN(date.getTime())) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  // Try DD/MM/YYYY (common in international schools)
  const dmyMatch = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    const date = new Date(Number(y), Number(m) - 1, Number(d))
    if (!isNaN(date.getTime())) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  // Last resort: try native Date parse
  const d = new Date(value)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }

  return null
}

// ============================================================
// Transform a CSV row to a StudentInsert
// ============================================================

export function transformRowToStudentInsert(
  row: CsvRow,
  mapping: ColumnMapping,
  schoolId: string,
  classroomId: string
): StudentInsert {
  // Build reverse mapping
  const getValue = (dbField: string): string => {
    const header = Object.entries(mapping).find(([, v]) => v === dbField)?.[0]
    return header ? (row[header]?.trim() ?? '') : ''
  }

  const dob = getValue('date_of_birth')
  const enrollmentDate = getValue('enrollment_date')
  const additionalLangs = getValue('additional_languages')

  return {
    school_id: schoolId,
    classroom_id: classroomId,
    first_name: getValue('first_name'),
    last_name: getValue('last_name'),
    middle_name: getValue('middle_name') || null,
    preferred_name: getValue('preferred_name') || null,
    pronouns: getValue('pronouns') || null,
    date_of_birth: dob ? parseDate(dob) : null,
    grade_level: getValue('grade_level') || null,
    nationality: getValue('nationality') || null,
    first_language: getValue('first_language') || null,
    additional_languages: additionalLangs
      ? additionalLangs.split(',').map((l) => l.trim()).filter(Boolean)
      : null,
    medical_conditions: getValue('medical_conditions') || null,
    student_support_needs: getValue('student_support_needs') || null,
    dietary_restrictions: getValue('dietary_restrictions') || null,
    medications: getValue('medications') || null,
    enrollment_date: enrollmentDate ? parseDate(enrollmentDate) : null,
    student_status: 'active' as StudentStatus,
    avatar_url: null,
    family_code: null,
    student_number: null,
  }
}

// ============================================================
// Generate template CSV
// ============================================================

export function generateTemplateCSV(): string {
  const headers = [
    'First Name',
    'Last Name',
    'Middle Name',
    'Preferred Name',
    'Date of Birth',
    'Pronouns',
    'Grade Level',
    'Nationality',
    'First Language',
    'Additional Languages',
    'Medical Conditions',
    'Support Needs',
    'Dietary Restrictions',
    'Medications',
    'Enrollment Date',
  ]
  const sampleRow = [
    'Amara',
    'Johnson',
    'Lee',
    'AJ',
    '2018-03-15',
    'she/her',
    '3',
    'American',
    'English',
    'Spanish, French',
    '',
    '',
    'Nut allergy',
    '',
    '2024-09-01',
  ]
  return headers.join(',') + '\n' + sampleRow.join(',') + '\n'
}
