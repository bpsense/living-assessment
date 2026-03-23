/**
 * seed-demo-school.ts
 *
 * Populates "Demo School 123" with realistic multi-year demo data.
 * Run with: npx tsx scripts/seed-demo-school.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (or as env var).
 * Uses the service-role client so RLS is bypassed.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ============================================================
// 0. Bootstrap — env + Supabase client
// ============================================================

const __filename2 = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url)
const __dirname2 = typeof __dirname !== 'undefined' ? __dirname : dirname(__filename2)

function loadEnv() {
  // Try multiple paths to find .env.local
  const candidates = [
    resolve(__dirname2, '..', '.env.local'),
    resolve(process.cwd(), '.env.local'),
  ]
  for (const envPath of candidates) {
    try {
      const raw = readFileSync(envPath, 'utf-8')
      for (const line of raw.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq < 0) continue
        const key = trimmed.slice(0, eq)
        const val = trimmed.slice(eq + 1)
        if (!process.env[key]) process.env[key] = val
      }
      return // success
    } catch {
      // try next candidate
    }
  }
}

loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '❌  Missing env vars. Ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local or as environment variables.'
  )
  process.exit(1)
}

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_PASSWORD = 'demo1234'
const SCHOOL_NAME = 'Demo School 123'

// ============================================================
// Helpers
// ============================================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

/** Seeded-ish random for reproducible runs */
let _seed = 42
function seededRandom(): number {
  _seed = (_seed * 16807 + 0) % 2147483647
  return (_seed - 1) / 2147483646
}

function uuid(): string {
  return crypto.randomUUID()
}

function dateStr(d: Date): string {
  return d.toISOString()
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

// ============================================================
// Data constants
// ============================================================

const NOW = new Date('2026-03-15T12:00:00Z')

interface ClassroomDef {
  name: string
  ageMin: number
  ageMax: number
  description: string
  studentCount: number
}

const CLASSROOMS: ClassroomDef[] = [
  { name: 'Explorers', ageMin: 4, ageMax: 6, description: 'Early childhood, play-based learning', studentCount: 12 },
  { name: 'Navigators', ageMin: 6, ageMax: 9, description: 'Lower elementary, foundational skills', studentCount: 15 },
  { name: 'Pathfinders', ageMin: 9, ageMax: 12, description: 'Upper elementary, deepening inquiry', studentCount: 12 },
  { name: 'Trailblazers', ageMin: 12, ageMax: 15, description: 'Middle school, independent projects', studentCount: 10 },
]

interface EducatorDef {
  full_name: string
  email: string
  classrooms: string[] // classroom names
}

const EDUCATORS: EducatorDef[] = [
  { full_name: 'Maria Santos', email: 'maria@demo123.edu', classrooms: ['Explorers'] },
  { full_name: 'James Chen', email: 'james@demo123.edu', classrooms: ['Navigators'] },
  { full_name: 'Aisha Patel', email: 'aisha@demo123.edu', classrooms: ['Pathfinders'] },
  { full_name: 'David Kim', email: 'david@demo123.edu', classrooms: ['Trailblazers'] },
  { full_name: 'Sophie Laurent', email: 'sophie@demo123.edu', classrooms: ['Navigators', 'Pathfinders'] },
  { full_name: 'Omar Hassan', email: 'omar@demo123.edu', classrooms: ['Explorers', 'Trailblazers'] },
]

// Diverse international student names
const FIRST_NAMES = [
  'Amara', 'Bodhi', 'Chiara', 'Davi', 'Elena', 'Finn', 'Gia', 'Hugo', 'Isla', 'Jasper',
  'Kaia', 'Leo', 'Maya', 'Niko', 'Olive', 'Priya', 'Quentin', 'Ren', 'Sofia', 'Tariq',
  'Uma', 'Viggo', 'Wren', 'Xander', 'Yara', 'Zain', 'Akira', 'Beatriz', 'Callum', 'Daria',
  'Emiliano', 'Freya', 'Gael', 'Hana', 'Ibrahim', 'Juniper', 'Kai', 'Luna', 'Mateo', 'Nia',
  'Oscar', 'Paloma', 'Rafael', 'Suki', 'Theo', 'Valentina', 'Willa', 'Yuki', 'Zara',
]
const LAST_NAMES = [
  'Okafor', 'Nakamura', 'Rivera', 'Johansson', 'Abadi', 'Kowalski', 'Chen', 'Santos',
  'Petrov', 'Al-Farsi', 'Singh', 'Moreau', 'Kim', 'Oduya', 'Bergström', 'Tanaka', 'Flores',
  'Dubois', 'Yamamoto', 'Gupta', 'Nascimento', 'Park', 'Ivanova', 'Delgado', 'Sato',
  'Andersen', 'Chakrabarti', 'O\'Brien', 'Nguyen', 'Fischer', 'Larsson', 'Almeida',
  'Hassan', 'Müller', 'Takahashi', 'Romero', 'Björk', 'Reyes', 'Kwon', 'Volkov',
  'Costa', 'Ishikawa', 'Fernandez', 'Lindqvist', 'Kamau', 'Bianchi', 'Hernandez', 'Ito', 'Lim',
]

// Enrollment cohorts: enrollment date → fraction
const COHORTS = [
  { date: new Date('2025-03-01'), pct: 0.30 },
  { date: new Date('2024-03-01'), pct: 0.30 },
  { date: new Date('2023-03-01'), pct: 0.25 },
  { date: new Date('2022-03-01'), pct: 0.15 },
]

// Student archetypes
type Archetype = 'accelerated' | 'steady' | 'building' | 'spiky'

function assignArchetype(): Archetype {
  const r = Math.random()
  if (r < 0.20) return 'accelerated'
  if (r < 0.80) return 'steady'
  if (r < 0.95) return 'building'
  return 'spiky'
}

// ============================================================
// Skill definitions per dimension category
// ============================================================

interface SkillDef {
  name: string
  description: string
  minAge: number
  maxAge: number
}

/** Returns skill definitions for a dimension based on its category. Each dimension gets unique skills. */
function getSkillsForDimension(
  dimName: string,
  dimCategory: string
): SkillDef[] {
  // Return category-appropriate skills, customized with dimension name
  const skills: Record<string, SkillDef[]> = {
    'Academic': [
      { name: 'Pattern Recognition', description: 'Identify and extend simple patterns in objects and numbers', minAge: 4, maxAge: 6 },
      { name: 'Counting & Cardinality', description: 'Count to 100 and understand one-to-one correspondence', minAge: 4, maxAge: 6 },
      { name: 'Letter-Sound Connections', description: 'Associate letters with their sounds and blend simple words', minAge: 4, maxAge: 7 },
      { name: 'Addition & Subtraction Fluency', description: 'Solve addition and subtraction problems within 20 with fluency', minAge: 5, maxAge: 8 },
      { name: 'Reading Comprehension', description: 'Extract meaning from grade-level texts and make inferences', minAge: 6, maxAge: 9 },
      { name: 'Place Value Understanding', description: 'Understand the value of digits in multi-digit numbers', minAge: 6, maxAge: 9 },
      { name: 'Informational Writing', description: 'Write organized informational texts with supporting details', minAge: 7, maxAge: 10 },
      { name: 'Multiplication & Division', description: 'Apply multiplication and division strategies to solve problems', minAge: 8, maxAge: 11 },
      { name: 'Fractions & Decimals', description: 'Understand, compare, and operate with fractions and decimals', minAge: 9, maxAge: 12 },
      { name: 'Persuasive Argumentation', description: 'Construct persuasive arguments supported by evidence', minAge: 10, maxAge: 13 },
      { name: 'Algebraic Reasoning', description: 'Use variables and expressions to represent mathematical relationships', minAge: 11, maxAge: 14 },
      { name: 'Research & Synthesis', description: 'Conduct research using multiple sources and synthesize findings', minAge: 12, maxAge: 15 },
    ],
    'Creative & Arts': [
      { name: 'Free Exploration with Materials', description: 'Experiment freely with art materials to discover properties', minAge: 4, maxAge: 6 },
      { name: 'Story Through Drawing', description: 'Communicate stories and ideas through drawings and illustrations', minAge: 4, maxAge: 7 },
      { name: 'Rhythm & Movement', description: 'Express musical rhythm through body movement and simple instruments', minAge: 4, maxAge: 7 },
      { name: 'Color Mixing & Theory', description: 'Understand primary/secondary colors and intentional color choices', minAge: 5, maxAge: 8 },
      { name: 'Dramatic Play & Roleplay', description: 'Engage in dramatic play to explore perspectives and narratives', minAge: 5, maxAge: 8 },
      { name: 'Visual Composition', description: 'Create balanced compositions using design elements and principles', minAge: 7, maxAge: 10 },
      { name: 'Creative Writing & Poetry', description: 'Write original stories, poems, and creative narratives', minAge: 7, maxAge: 11 },
      { name: 'Music Notation & Performance', description: 'Read basic notation and perform simple musical pieces', minAge: 8, maxAge: 12 },
      { name: 'Digital Media Creation', description: 'Create digital art, photography, or video with intention', minAge: 9, maxAge: 13 },
      { name: 'Design Thinking', description: 'Apply iterative design processes to creative challenges', minAge: 10, maxAge: 14 },
      { name: 'Artistic Critique & Analysis', description: 'Analyze and critique artwork using formal vocabulary', minAge: 11, maxAge: 15 },
    ],
    'Physical & Health': [
      { name: 'Gross Motor Coordination', description: 'Run, jump, climb, and balance with increasing control', minAge: 4, maxAge: 6 },
      { name: 'Fine Motor Skills', description: 'Use scissors, pencils, and small tools with precision', minAge: 4, maxAge: 7 },
      { name: 'Body Awareness', description: 'Understand body parts, personal space, and spatial relationships', minAge: 4, maxAge: 7 },
      { name: 'Healthy Habits Awareness', description: 'Understand basic hygiene, nutrition, and sleep habits', minAge: 5, maxAge: 8 },
      { name: 'Team Sports Participation', description: 'Participate cooperatively in structured physical activities', minAge: 6, maxAge: 9 },
      { name: 'Nutrition & Wellness', description: 'Make informed choices about food, rest, and physical activity', minAge: 7, maxAge: 10 },
      { name: 'Endurance & Fitness', description: 'Build cardiovascular endurance and muscular strength', minAge: 8, maxAge: 12 },
      { name: 'Risk Assessment & Safety', description: 'Evaluate physical risks and make safe choices in activities', minAge: 9, maxAge: 13 },
      { name: 'Mindfulness & Stress Management', description: 'Practice mindfulness techniques for emotional and physical wellbeing', minAge: 10, maxAge: 14 },
      { name: 'Personal Fitness Planning', description: 'Design and follow a personal fitness plan', minAge: 12, maxAge: 15 },
    ],
    'Social & Emotional': [
      { name: 'Emotion Identification', description: 'Name and recognize basic emotions in self and others', minAge: 4, maxAge: 6 },
      { name: 'Turn-Taking & Sharing', description: 'Practice turn-taking, sharing, and waiting patiently', minAge: 4, maxAge: 6 },
      { name: 'Friendship Skills', description: 'Initiate and maintain positive peer relationships', minAge: 4, maxAge: 7 },
      { name: 'Empathy & Perspective-Taking', description: 'Understand and respond to others\' feelings and viewpoints', minAge: 5, maxAge: 8 },
      { name: 'Conflict Resolution', description: 'Resolve disagreements through communication and compromise', minAge: 6, maxAge: 10 },
      { name: 'Self-Regulation', description: 'Manage impulses, emotions, and behavior in various settings', minAge: 6, maxAge: 10 },
      { name: 'Collaborative Problem-Solving', description: 'Work effectively with others to solve complex problems', minAge: 8, maxAge: 12 },
      { name: 'Growth Mindset', description: 'Embrace challenges, persist through difficulty, and learn from mistakes', minAge: 8, maxAge: 12 },
      { name: 'Community Responsibility', description: 'Contribute positively to classroom and school community', minAge: 9, maxAge: 13 },
      { name: 'Leadership & Advocacy', description: 'Take initiative, mentor peers, and advocate for self and others', minAge: 11, maxAge: 15 },
      { name: 'Ethical Reasoning', description: 'Consider multiple perspectives and make principled decisions', minAge: 12, maxAge: 15 },
    ],
    'Cognitive': [
      { name: 'Curiosity & Questioning', description: 'Ask meaningful questions and show wonder about the world', minAge: 4, maxAge: 7 },
      { name: 'Observation & Description', description: 'Observe carefully and describe findings with detail', minAge: 4, maxAge: 7 },
      { name: 'Sorting & Classifying', description: 'Group objects by attributes and explain categorization choices', minAge: 4, maxAge: 7 },
      { name: 'Cause & Effect Reasoning', description: 'Identify cause-and-effect relationships in everyday situations', minAge: 5, maxAge: 8 },
      { name: 'Scientific Inquiry', description: 'Form hypotheses, conduct experiments, and draw conclusions', minAge: 6, maxAge: 10 },
      { name: 'Logical Sequencing', description: 'Arrange events, steps, or ideas in logical order', minAge: 6, maxAge: 9 },
      { name: 'Data Collection & Analysis', description: 'Gather, organize, and interpret data to answer questions', minAge: 8, maxAge: 12 },
      { name: 'Systems Thinking', description: 'Understand how parts of a system interact and influence each other', minAge: 9, maxAge: 13 },
      { name: 'Abstract Reasoning', description: 'Work with abstract concepts, models, and representations', minAge: 10, maxAge: 14 },
      { name: 'Critical Analysis', description: 'Evaluate sources, arguments, and evidence for validity and bias', minAge: 11, maxAge: 15 },
      { name: 'Metacognition', description: 'Reflect on and regulate one\'s own thinking and learning processes', minAge: 12, maxAge: 15 },
    ],
  }

  // Fallback: if dimension category doesn't match exactly, use Academic
  const base = skills[dimCategory] || skills['Academic']
  // Prefix with dimension name to make skills unique per dimension
  return base.map((s) => ({
    ...s,
    name: `${s.name}`,
    description: `${s.description} (${dimName})`,
  }))
}

// Project definitions
interface ProjectDef {
  title: string
  description: string
  classroom: string
  skillKeywords: string[] // partial match against skill names
}

const PROJECTS: ProjectDef[] = [
  {
    title: 'Our Neighborhood Map',
    description: 'Students explore their neighborhood, create maps, and identify community features.',
    classroom: 'Explorers',
    skillKeywords: ['Pattern', 'Counting', 'Observation', 'Emotion', 'Gross Motor'],
  },
  {
    title: 'Season Stories',
    description: 'Students observe seasonal changes and create a storybook documenting what they discover.',
    classroom: 'Explorers',
    skillKeywords: ['Letter-Sound', 'Story Through', 'Curiosity', 'Friendship', 'Body Awareness'],
  },
  {
    title: 'Community Garden Design',
    description: 'Students design and plan a community garden, learning measurement, science, and teamwork.',
    classroom: 'Navigators',
    skillKeywords: ['Addition', 'Place Value', 'Scientific Inquiry', 'Collaborative', 'Nutrition'],
  },
  {
    title: 'Animal Adaptation Research',
    description: 'Students research how animals adapt to environments and present findings.',
    classroom: 'Navigators',
    skillKeywords: ['Reading Comprehension', 'Informational', 'Cause & Effect', 'Empathy', 'Color Mixing'],
  },
  {
    title: 'Inventors Workshop',
    description: 'Students study famous inventors and create their own inventions to solve a classroom problem.',
    classroom: 'Navigators',
    skillKeywords: ['Multiplication', 'Visual Composition', 'Conflict', 'Self-Regulation', 'Logical'],
  },
  {
    title: 'Local History Documentary',
    description: 'Students research local history, interview community members, and produce a short documentary.',
    classroom: 'Pathfinders',
    skillKeywords: ['Research', 'Fractions', 'Digital Media', 'Data Collection', 'Community'],
  },
  {
    title: 'Ecosystem in a Bottle',
    description: 'Students build and monitor a closed ecosystem, tracking changes over time.',
    classroom: 'Pathfinders',
    skillKeywords: ['Scientific Inquiry', 'Data Collection', 'Systems Thinking', 'Endurance', 'Growth Mindset'],
  },
  {
    title: 'Sustainable Business Plan',
    description: 'Students develop a business plan for a sustainable product or service.',
    classroom: 'Trailblazers',
    skillKeywords: ['Algebraic', 'Persuasive', 'Design Thinking', 'Leadership', 'Critical Analysis'],
  },
  {
    title: 'Global Issues Podcast',
    description: 'Students research a global issue, conduct interviews, and produce a podcast episode.',
    classroom: 'Trailblazers',
    skillKeywords: ['Research', 'Artistic Critique', 'Ethical Reasoning', 'Abstract', 'Metacognition'],
  },
  {
    title: 'Community Impact Project',
    description: 'Students identify a community need and design an actionable project to address it.',
    classroom: 'Trailblazers',
    skillKeywords: ['Persuasive', 'Personal Fitness', 'Leadership', 'Mindfulness', 'Systems Thinking'],
  },
]

// ============================================================
// Assessment level logic
// ============================================================

const LEVELS = ['emerging', 'developing', 'achieving', 'exceeding'] as const
type Level = (typeof LEVELS)[number]

const LEVEL_TO_RATING: Record<Level, number> = {
  emerging: 1,
  developing: 2,
  achieving: 3,
  exceeding: 4,
}

function progressLevel(
  current: Level,
  monthsOnSkill: number,
  archetype: Archetype,
  isDimStrong: boolean,
  isDimWeak: boolean
): Level {
  const idx = LEVELS.indexOf(current)

  // Regression chance: 5%
  if (Math.random() < 0.05 && idx > 0) {
    return LEVELS[idx - 1]
  }

  // If already exceeding, stay
  if (idx >= 3) return current

  // Base advance probability: ~20% per month
  let advanceChance = 0.20

  // Archetype modifiers
  if (archetype === 'accelerated') advanceChance = 0.30
  if (archetype === 'building') advanceChance = 0.12
  if (archetype === 'spiky') {
    advanceChance = isDimStrong ? 0.35 : 0.08
  }

  // Dimension strength/weakness modifiers
  if (isDimStrong && archetype !== 'spiky') advanceChance += 0.08
  if (isDimWeak && archetype !== 'spiky') advanceChance -= 0.06

  // Time factor: slightly more likely to advance if stuck at same level for many months
  if (monthsOnSkill > 6) advanceChance += 0.05
  if (monthsOnSkill > 12) advanceChance += 0.05

  if (Math.random() < advanceChance) {
    return LEVELS[idx + 1]
  }

  return current
}

// ============================================================
// Main seed function
// ============================================================

async function main() {
  console.log('🌱 Seeding Demo School 123...\n')

  // ── Step 1: Look up school ──
  console.log('Step 1: Looking up school...')
  const { data: school, error: schoolErr } = await sb
    .from('schools')
    .select('*')
    .eq('name', SCHOOL_NAME)
    .single()

  if (schoolErr || !school) {
    console.error(`❌ School "${SCHOOL_NAME}" not found. Create it in the app first.`)
    process.exit(1)
  }

  const schoolId = school.id
  console.log(`  ✅ Found school: ${school.name} (${schoolId})`)

  // ── Clean up existing demo data ──
  console.log('\nCleaning up existing demo data...')
  // Delete in dependency order (children first)
  const tables = [
    'observations', 'competency_scores', 'student_skill_assignments', 'skill_assignments',
    'student_assignments', 'assignment_skills', 'assignment_competencies', 'assignments',
    'skill_progression_steps', 'skill_competencies', 'parent_students',
    'student_classrooms', 'educator_classrooms',
  ]
  for (const table of tables) {
    await sb.from(table).delete().eq('school_id', schoolId)
  }
  // Delete students (cascades contacts, notes, etc.)
  await sb.from('students').delete().eq('school_id', schoolId)
  // Delete skills (school-scoped)
  await sb.from('skills').delete().eq('school_id', schoolId)
  // Delete classrooms and dimensions
  await sb.from('classrooms').delete().eq('school_id', schoolId)
  await sb.from('dimensions').delete().eq('school_id', schoolId)
  // Delete educator/parent profiles and auth users
  const { data: existingProfiles } = await sb
    .from('profiles')
    .select('id, email')
    .eq('school_id', schoolId)
    .in('role', ['educator', 'parent'])
  if (existingProfiles && existingProfiles.length > 0) {
    for (const p of existingProfiles) {
      await sb.from('profiles').delete().eq('id', p.id)
      await sb.auth.admin.deleteUser(p.id)
    }
  }
  console.log('  ✅ Cleaned up existing data')

  // ── Step 1b: Create Learner Profile dimensions ──
  console.log('\nStep 1b: Creating Learner Profile dimensions...')
  const defaultDims = [
    { name: 'Literacy & Communication', category: 'Academic', icon: 'book-open', description: 'Reading, writing, speaking, and listening skills' },
    { name: 'Mathematical Reasoning', category: 'Academic', icon: 'calculator', description: 'Number sense, operations, patterns, and problem solving' },
    { name: 'Scientific Inquiry', category: 'Cognitive', icon: 'microscope', description: 'Observation, experimentation, and evidence-based reasoning' },
    { name: 'Creative Expression', category: 'Creative & Arts', icon: 'palette', description: 'Visual arts, music, drama, and creative writing' },
    { name: 'Physical Development', category: 'Physical & Health', icon: 'heart-pulse', description: 'Motor skills, fitness, health, and body awareness' },
    { name: 'Social & Emotional Growth', category: 'Social & Emotional', icon: 'users', description: 'Self-awareness, relationships, empathy, and collaboration' },
    { name: 'Critical Thinking', category: 'Cognitive', icon: 'lightbulb', description: 'Analysis, evaluation, metacognition, and systems thinking' },
    { name: 'Global Citizenship', category: 'Social & Emotional', icon: 'globe', description: 'Cultural awareness, ethical reasoning, and community responsibility' },
  ]
  const dimInserts = defaultDims.map((d, i) => ({
    school_id: schoolId,
    name: d.name,
    description: d.description,
    category: d.category,
    icon: d.icon,
    display_order: i,
    is_active: true,
    visible_to_family: true,
  }))
  const { data: dimensions, error: dimErr } = await sb.from('dimensions').insert(dimInserts).select('*')
  if (dimErr || !dimensions) throw new Error(`Failed to create dimensions: ${dimErr?.message}`)
  console.log(`  ✅ Created ${dimensions.length} dimensions`)

  // ── Step 2: Create Classrooms ──
  console.log('\nStep 2: Creating classrooms...')
  const classroomRows = CLASSROOMS.map((c) => ({
    school_id: schoolId,
    name: c.name,
    grade_level: null,
  }))
  const { data: classrooms, error: clErr } = await sb
    .from('classrooms')
    .insert(classroomRows)
    .select('id, name')
  if (clErr) throw new Error(`Failed to create classrooms: ${clErr.message}`)
  const classroomMap = new Map<string, string>() // name → id
  for (const c of classrooms!) {
    classroomMap.set(c.name, c.id)
  }
  console.log(`  ✅ Created ${classrooms!.length} classrooms`)

  // ── Step 3: Create Educators ──
  console.log('\nStep 3: Creating educators...')
  const educatorIds: Map<string, string> = new Map() // email → userId
  const educatorClassroomLinks: { educator_id: string; classroom_id: string; school_id: string }[] = []

  for (const ed of EDUCATORS) {
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email: ed.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ed.full_name, role: 'educator', school_id: schoolId },
    })
    if (authErr) {
      // User might already exist from partial run
      console.warn(`  ⚠️  Auth user ${ed.email}: ${authErr.message}`)
      continue
    }
    const userId = authData.user.id
    educatorIds.set(ed.email, userId)

    await sb.from('profiles').upsert({
      id: userId,
      school_id: schoolId,
      role: 'educator',
      full_name: ed.full_name,
      email: ed.email,
      is_active: true,
    }, { onConflict: 'id' })

    for (const clName of ed.classrooms) {
      const clId = classroomMap.get(clName)
      if (clId) {
        educatorClassroomLinks.push({ educator_id: userId, classroom_id: clId, school_id: schoolId })
      }
    }
  }

  if (educatorClassroomLinks.length > 0) {
    await sb.from('educator_classrooms').insert(educatorClassroomLinks)
  }
  console.log(`  ✅ Created ${educatorIds.size} educators`)

  // Build classroom → educator list for later
  const classroomEducators = new Map<string, string[]>() // classroomId → [educatorId]
  for (const link of educatorClassroomLinks) {
    const list = classroomEducators.get(link.classroom_id) || []
    list.push(link.educator_id)
    classroomEducators.set(link.classroom_id, list)
  }

  // ── Step 4: Create Students ──
  console.log('\nStep 4: Creating students...')
  let nameIdx = 0
  interface StudentRecord {
    id: string
    firstName: string
    lastName: string
    dob: Date
    enrollmentDate: Date
    classroomName: string
    classroomId: string
    archetype: Archetype
    strongDimensions: Set<number>
    weakDimensions: Set<number>
  }
  const allStudents: StudentRecord[] = []

  for (const clDef of CLASSROOMS) {
    const clId = classroomMap.get(clDef.name)!

    // Distribute enrollment dates
    let cohortIdx = 0
    let cohortAlloc = [
      Math.round(clDef.studentCount * 0.30),
      Math.round(clDef.studentCount * 0.30),
      Math.round(clDef.studentCount * 0.25),
      clDef.studentCount, // remainder goes to 4-year
    ]
    // Ensure sum = studentCount
    const partialSum = cohortAlloc[0] + cohortAlloc[1] + cohortAlloc[2]
    cohortAlloc[3] = clDef.studentCount - partialSum

    let created = 0
    for (let ci = 0; ci < COHORTS.length; ci++) {
      const count = cohortAlloc[ci]
      for (let j = 0; j < count && created < clDef.studentCount; j++) {
        const firstName = FIRST_NAMES[nameIdx % FIRST_NAMES.length]
        const lastName = LAST_NAMES[nameIdx % LAST_NAMES.length]
        nameIdx++

        const enrollDate = COHORTS[ci].date
        const yearsEnrolled = (NOW.getTime() - enrollDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

        // Calculate age: should be within classroom range NOW
        const currentAge = clDef.ageMin + Math.random() * (clDef.ageMax - clDef.ageMin)
        const dob = new Date(NOW)
        dob.setFullYear(dob.getFullYear() - Math.floor(currentAge))
        dob.setMonth(dob.getMonth() - Math.floor(Math.random() * 12))

        const archetype = assignArchetype()
        // Strong/weak dimensions
        const dimIndices = dimensions!.map((_: any, i: number) => i)
        const strong = new Set(pickN(dimIndices, archetype === 'spiky' ? 2 : archetype === 'accelerated' ? 4 : 2))
        const weakPool = dimIndices.filter((i: number) => !strong.has(i))
        const weak = new Set(pickN(weakPool, archetype === 'spiky' ? 3 : archetype === 'building' ? 3 : 1))

        allStudents.push({
          id: uuid(),
          firstName,
          lastName,
          dob,
          enrollmentDate: enrollDate,
          classroomName: clDef.name,
          classroomId: clId,
          archetype,
          strongDimensions: strong,
          weakDimensions: weak,
        })
        created++
      }
    }
  }

  // Batch insert students
  const studentInserts = allStudents.map((s) => ({
    id: s.id,
    school_id: schoolId,
    classroom_id: s.classroomId,
    first_name: s.firstName,
    last_name: s.lastName,
    date_of_birth: s.dob.toISOString().split('T')[0],
    enrollment_date: s.enrollmentDate.toISOString().split('T')[0],
    student_status: 'active' as const,
    grade_level: null,
  }))
  const { error: stErr } = await sb.from('students').insert(studentInserts)
  if (stErr) throw new Error(`Failed to create students: ${stErr.message}`)

  // Create student_classrooms entries (current)
  const scInserts = allStudents.map((s) => ({
    student_id: s.id,
    classroom_id: s.classroomId,
    school_id: schoolId,
    is_primary: true,
    status: 'active' as const,
  }))
  await sb.from('student_classrooms').insert(scInserts)

  // Historical classroom records for multi-year students
  const historicalLinks: { student_id: string; classroom_id: string; school_id: string; is_primary: boolean; status: 'archived' }[] = []
  for (const s of allStudents) {
    const yearsEnrolled = (NOW.getTime() - s.enrollmentDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (yearsEnrolled < 2) continue

    const currentClassIdx = CLASSROOMS.findIndex((c) => c.name === s.classroomName)
    if (currentClassIdx <= 0) continue

    // If enrolled 2+ years, they came from the previous classroom
    const prevClass = CLASSROOMS[currentClassIdx - 1]
    const prevId = classroomMap.get(prevClass.name)
    if (prevId) {
      historicalLinks.push({
        student_id: s.id,
        classroom_id: prevId,
        school_id: schoolId,
        is_primary: false,
        status: 'archived',
      })
    }

    // If enrolled 3+ years and there's a class 2 levels back
    if (yearsEnrolled >= 3 && currentClassIdx >= 2) {
      const prevPrevClass = CLASSROOMS[currentClassIdx - 2]
      const prevPrevId = classroomMap.get(prevPrevClass.name)
      if (prevPrevId) {
        historicalLinks.push({
          student_id: s.id,
          classroom_id: prevPrevId,
          school_id: schoolId,
          is_primary: false,
          status: 'archived',
        })
      }
    }
  }
  if (historicalLinks.length > 0) {
    await sb.from('student_classrooms').insert(historicalLinks)
  }
  console.log(`  ✅ Created ${allStudents.length} students (${historicalLinks.length} historical classroom records)`)

  // ── Step 5: Create Skills ──
  console.log('\nStep 5: Creating skills...')
  interface SkillRecord {
    id: string
    name: string
    dimensionId: string
    dimensionIdx: number
    minAge: number
    maxAge: number
  }
  const allSkills: SkillRecord[] = []
  const skillInserts: any[] = []

  for (let di = 0; di < dimensions!.length; di++) {
    const dim = dimensions![di]
    const skillDefs = getSkillsForDimension(dim.name, dim.category)

    for (const sd of skillDefs) {
      const id = uuid()
      allSkills.push({
        id,
        name: sd.name,
        dimensionId: dim.id,
        dimensionIdx: di,
        minAge: sd.minAge,
        maxAge: sd.maxAge,
      })
      skillInserts.push({
        id,
        school_id: schoolId,
        name: sd.name,
        description: sd.description,
        category: dim.category,
        progression_domain: dim.name,
        is_default: false,
        is_assessable: true,
        source_framework: 'custom',
        created_by: null,
        min_grade: ageToGrade(sd.minAge),
        max_grade: ageToGrade(sd.maxAge),
      })
    }
  }

  // Batch insert skills
  const BATCH = 50
  for (let i = 0; i < skillInserts.length; i += BATCH) {
    const { error } = await sb.from('skills').insert(skillInserts.slice(i, i + BATCH))
    if (error) throw new Error(`Failed to insert skills batch: ${error.message}`)
  }
  console.log(`  ✅ Created ${allSkills.length} skills across ${dimensions!.length} dimensions`)

  // ── Step 6: Assign skills to students ──
  console.log('\nStep 6: Assigning skills to students...')

  // We need skill_assignments + student_skill_assignments
  // First create a "standalone" skill_assignment per skill per classroom
  // Then link students

  // Group skills by applicable classroom
  function skillAppliesToClassroom(skill: SkillRecord, clDef: ClassroomDef): boolean {
    return skill.minAge < clDef.ageMax && skill.maxAge > clDef.ageMin
  }

  // Create skill_assignments per classroom
  interface SkillAssignmentRecord {
    id: string
    skillId: string
    classroomId: string
    stepId: string | null
  }
  const skillAssignmentInserts: any[] = []
  const skillAssignmentRecords: SkillAssignmentRecord[] = []

  // We need progression steps — create minimal ones
  const stepInserts: any[] = []
  const skillStepMap = new Map<string, string>() // skillId → stepId

  for (const skill of allSkills) {
    const stepId = uuid()
    skillStepMap.set(skill.id, stepId)
    stepInserts.push({
      id: stepId,
      skill_id: skill.id,
      school_id: schoolId,
      grade_level: ageToGrade(skill.minAge),
      expectation_description: `Demonstrate competency in ${skill.name}`,
      example_tasks: null,
      prerequisite_step_id: null,
      competency_ids: [],
    })
  }

  // Batch insert steps
  for (let i = 0; i < stepInserts.length; i += BATCH) {
    const { error } = await sb.from('skill_progression_steps').insert(stepInserts.slice(i, i + BATCH))
    if (error) throw new Error(`Failed to insert steps batch: ${error.message}`)
  }

  // Create skill assignments per classroom
  for (const clDef of CLASSROOMS) {
    const clId = classroomMap.get(clDef.name)!
    const educators = classroomEducators.get(clId) || []
    const assignedBy = educators[0] || [...educatorIds.values()][0]

    for (const skill of allSkills) {
      if (!skillAppliesToClassroom(skill, clDef)) continue
      const saId = uuid()
      const stepId = skillStepMap.get(skill.id)!
      skillAssignmentRecords.push({ id: saId, skillId: skill.id, classroomId: clId, stepId })
      skillAssignmentInserts.push({
        id: saId,
        school_id: schoolId,
        classroom_id: clId,
        skill_id: skill.id,
        assigned_step_id: stepId,
        assigned_by: assignedBy,
        assignment_type: 'class',
        title: null,
        instructions: null,
        due_date: null,
        status: 'active',
      })
    }
  }

  for (let i = 0; i < skillAssignmentInserts.length; i += BATCH) {
    const { error } = await sb.from('skill_assignments').insert(skillAssignmentInserts.slice(i, i + BATCH))
    if (error) throw new Error(`Failed to insert skill_assignments batch: ${error.message}`)
  }

  // Create student_skill_assignments
  const ssaInserts: any[] = []
  for (const sa of skillAssignmentRecords) {
    const studentsInClass = allStudents.filter((s) => s.classroomId === sa.classroomId)
    for (const student of studentsInClass) {
      ssaInserts.push({
        skill_assignment_id: sa.id,
        student_id: student.id,
        student_step_id: sa.stepId,
        status: 'assigned',
        score: null,
        scored_by: null,
        scored_at: null,
        notes: null,
        is_above_grade: false,
      })
    }
  }

  for (let i = 0; i < ssaInserts.length; i += BATCH) {
    const { error } = await sb.from('student_skill_assignments').insert(ssaInserts.slice(i, i + BATCH))
    if (error) throw new Error(`Failed to insert student_skill_assignments batch: ${error.message}`)
  }
  console.log(`  ✅ Created ${skillAssignmentInserts.length} skill assignments, ${ssaInserts.length} student links`)

  // ── Step 7: Create Projects ──
  console.log('\nStep 7: Creating projects...')
  let projectCount = 0
  let projectSkillLinks = 0

  for (const proj of PROJECTS) {
    const clId = classroomMap.get(proj.classroom)
    if (!clId) continue
    const educators = classroomEducators.get(clId) || []
    const teacherId = educators[0] || [...educatorIds.values()][0]

    // Find matching skills
    const matchingSkills = allSkills.filter((sk) => {
      const clDef = CLASSROOMS.find((c) => c.name === proj.classroom)!
      if (!skillAppliesToClassroom(sk, clDef)) return false
      return proj.skillKeywords.some((kw) => sk.name.toLowerCase().includes(kw.toLowerCase()))
    })
    const projectSkills = matchingSkills.slice(0, 5) // max 5

    const { data: assignment, error: aErr } = await sb
      .from('assignments')
      .insert({
        school_id: schoolId,
        classroom_id: clId,
        teacher_id: teacherId,
        title: proj.title,
        description: proj.description,
        assignment_type: 'class',
        status: 'active',
      })
      .select('id')
      .single()

    if (aErr || !assignment) {
      console.warn(`  ⚠️  Failed to create project "${proj.title}": ${aErr?.message}`)
      continue
    }

    // Link skills to assignment
    if (projectSkills.length > 0) {
      const links = projectSkills.map((sk) => ({
        assignment_id: assignment.id,
        skill_id: sk.id,
      }))
      await sb.from('assignment_skills').insert(links)
      projectSkillLinks += links.length
    }

    // Create student_assignments for all students in classroom
    const studentsInClass = allStudents.filter((s) => s.classroomId === clId)
    const saInserts = studentsInClass.map((s) => ({
      assignment_id: assignment.id,
      student_id: s.id,
      status: 'assigned',
      learner_column: 'on_deck',
    }))
    if (saInserts.length > 0) {
      await sb.from('student_assignments').insert(saInserts)
    }
    projectCount++
  }
  console.log(`  ✅ Created ${projectCount} projects with ${projectSkillLinks} skill links`)

  // ── Step 8: Generate Assessment History ──
  console.log('\nStep 8: Generating assessment history (this takes a moment)...')

  // We generate observations (dimension-level) monthly for each student
  const observationInserts: any[] = []
  let obsCount = 0

  // Assessment notes pool
  const NOTES_POOL = [
    'Great progress this month',
    'Showing strong engagement in group work',
    'Needs more practice with independent application',
    'Demonstrates clear understanding of core concepts',
    'Beginning to make connections across domains',
    'Excellent effort and persistence',
    'Would benefit from additional challenge',
    'Shows leadership in collaborative settings',
    'Working on applying skills in new contexts',
    'Progressing steadily with scaffolded support',
    null, null, null, null, null, null, null, null, null, null, // 10 nulls = ~66% no notes
  ]

  for (const student of allStudents) {
    const startDate = new Date(student.enrollmentDate)
    const totalMonths = monthsBetween(startDate, NOW)

    // Track levels per dimension
    const dimLevels: Level[] = dimensions!.map(() => 'emerging' as Level)
    const dimMonthsAtLevel: number[] = dimensions!.map(() => 0)

    for (let m = 0; m <= totalMonths; m++) {
      const assessDate = new Date(startDate)
      assessDate.setMonth(assessDate.getMonth() + m)
      if (assessDate > NOW) break

      // Get classroom educators for this time period
      const clId = student.classroomId
      const educators = classroomEducators.get(clId) || []
      const assessor = educators.length > 0 ? pick(educators) : [...educatorIds.values()][0]

      for (let di = 0; di < dimensions!.length; di++) {
        const dim = dimensions![di]
        const isDimStrong = student.strongDimensions.has(di)
        const isDimWeak = student.weakDimensions.has(di)

        // Progress level
        const newLevel = progressLevel(
          dimLevels[di],
          dimMonthsAtLevel[di],
          student.archetype,
          isDimStrong,
          isDimWeak
        )

        if (newLevel !== dimLevels[di]) {
          dimMonthsAtLevel[di] = 0
        } else {
          dimMonthsAtLevel[di]++
        }
        dimLevels[di] = newLevel

        const rating = LEVEL_TO_RATING[newLevel]
        const notes = pick(NOTES_POOL)

        observationInserts.push({
          school_id: schoolId,
          student_id: student.id,
          dimension_id: dim.id,
          observer_id: assessor,
          rating,
          notes,
          observed_at: dateStr(assessDate),
        })
        obsCount++
      }
    }
  }

  // Batch insert observations
  console.log(`  Inserting ${obsCount} observations in batches...`)
  const OBS_BATCH = 200
  for (let i = 0; i < observationInserts.length; i += OBS_BATCH) {
    const { error } = await sb.from('observations').insert(observationInserts.slice(i, i + OBS_BATCH))
    if (error) throw new Error(`Failed to insert observations batch ${i}: ${error.message}`)
    if (i % 2000 === 0 && i > 0) {
      process.stdout.write(`  ... ${i}/${obsCount}\r`)
    }
  }
  console.log(`  ✅ Created ${obsCount} observations`)

  // ── Step 9: Create Families ──
  console.log('\nStep 9: Creating families...')
  let familyCount = 0

  for (const student of allStudents) {
    const parentFirst = pick(['Sarah', 'Michael', 'Ana', 'Robert', 'Lin', 'Marcus', 'Fatima', 'Thomas', 'Yuki', 'Carlos'])
    const parentEmail = `${student.firstName.toLowerCase()}.${student.lastName.toLowerCase()}@demo123.family`.replace(/'/g, '')

    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email: parentEmail,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: `${parentFirst} ${student.lastName}`,
        role: 'parent',
        school_id: schoolId,
      },
    })

    if (authErr) {
      // Skip duplicates silently
      continue
    }

    const parentId = authData.user.id
    await sb.from('profiles').upsert({
      id: parentId,
      school_id: schoolId,
      role: 'parent',
      full_name: `${parentFirst} ${student.lastName}`,
      email: parentEmail,
      student_id: student.id,
      is_active: true,
    }, { onConflict: 'id' })

    await sb.from('parent_students').insert({
      parent_id: parentId,
      student_id: student.id,
      school_id: schoolId,
    })

    familyCount++
  }
  console.log(`  ✅ Created ${familyCount} parent accounts`)

  // ── Summary ──
  console.log('\n' + '='.repeat(60))
  console.log(`🎉 Seeded Demo School 123:`)
  console.log(`   ${classrooms!.length} classrooms`)
  console.log(`   ${educatorIds.size} educators`)
  console.log(`   ${allStudents.length} students`)
  console.log(`   ${allSkills.length} skills`)
  console.log(`   ${skillAssignmentInserts.length} skill assignments`)
  console.log(`   ${projectCount} projects`)
  console.log(`   ${obsCount} observations/assessments`)
  console.log(`   ${familyCount} parent accounts`)
  console.log('='.repeat(60))
}

// ============================================================
// Utility: age → grade mapping
// ============================================================

function ageToGrade(age: number): string {
  if (age <= 4) return 'Pre-K'
  if (age <= 5) return 'K'
  if (age <= 6) return '1'
  if (age <= 7) return '2'
  if (age <= 8) return '3'
  if (age <= 9) return '4'
  if (age <= 10) return '5'
  if (age <= 11) return '6'
  if (age <= 12) return '7'
  if (age <= 13) return '8'
  if (age <= 14) return '9'
  return '10'
}

// ============================================================
// Run
// ============================================================

main().catch((err) => {
  console.error('\n❌ Seed failed:', err)
  process.exit(1)
})
