/**
 * assignment-files.ts
 *
 * Upload helpers for the standards-driven assignment refactor.
 *
 * Two scopes of attachment, two destination tables:
 *   - assignment_attachments     (creation-time, visible to all assigned students)
 *   - assessment_attachments     (per-student-per-assessment, "show their work")
 *
 * Storage: bucket `assignment-files`, paths namespaced as
 *   assignment/<assignment_id>/<timestamp>_<name>
 *   assessment/<assessment_id>/<timestamp>_<name>
 *
 * Images are auto-downscaled in the browser before upload to keep DB
 * row sizes and bandwidth reasonable. Non-images are uploaded as-is
 * up to the per-file cap.
 */
import { supabase } from './supabase'

// ============================================================
// Caps & defaults
// ============================================================

/** Per-file cap (post-downscale for images). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

/** Target dimensions for image downscaling. The longest edge is clamped
 *  to this; aspect ratio preserved. 1600 px keeps print-friendly clarity
 *  without ballooning storage. */
export const IMAGE_MAX_DIMENSION = 1600

/** JPEG quality used by the canvas-based downscaler (0–1). */
export const IMAGE_JPEG_QUALITY = 0.82

const STORAGE_BUCKET = 'assignment-files'

// ============================================================
// Image downscaling (browser-only, canvas-based)
// ============================================================

function isImage(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Downscale an image File so its longest edge ≤ IMAGE_MAX_DIMENSION.
 * Returns the original File untouched if it's already small enough,
 * if it isn't an image, or if anything in the pipeline fails (we'd
 * rather upload the original than lose the user's work).
 */
export async function maybeDownscaleImage(file: File): Promise<File> {
  if (!isImage(file)) return file

  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    if (longest <= IMAGE_MAX_DIMENSION) return file

    const scale = IMAGE_MAX_DIMENSION / longest
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)

    // PNG with transparency stays PNG; everything else compresses to JPEG.
    const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outType, IMAGE_JPEG_QUALITY)
    )
    if (!blob) return file

    const newName = file.name.replace(/\.(jpe?g|png|webp|bmp|tiff?)$/i, '') +
      (outType === 'image/png' ? '.png' : '.jpg')
    return new File([blob], newName, { type: outType, lastModified: Date.now() })
  } catch {
    return file
  }
}

// ============================================================
// Upload helpers
// ============================================================

export interface AttachmentRow {
  id: string
  file_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string
  created_at: string
}

async function uploadOne(prefix: string, file: File): Promise<{
  path: string
  finalFile: File
}> {
  const finalFile = await maybeDownscaleImage(file)
  if (finalFile.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `${file.name} is ${(finalFile.size / 1024 / 1024).toFixed(1)} MB after downscaling — exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MB cap.`
    )
  }
  const path = `${prefix}/${Date.now()}_${sanitizeName(finalFile.name)}`
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, finalFile)
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return { path, finalFile }
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadAssignmentAttachments(args: {
  assignmentId: string
  schoolId: string
  uploadedBy: string
  files: File[]
}): Promise<AttachmentRow[]> {
  const { assignmentId, schoolId, uploadedBy, files } = args
  if (files.length === 0) return []

  const results: AttachmentRow[] = []
  for (const file of files) {
    const { path, finalFile } = await uploadOne(`assignment/${assignmentId}`, file)
    const { data, error } = await supabase
      .from('assignment_attachments')
      .insert({
        assignment_id: assignmentId,
        school_id: schoolId,
        file_path: path,
        file_name: finalFile.name,
        mime_type: finalFile.type || null,
        size_bytes: finalFile.size,
        uploaded_by: uploadedBy,
      })
      .select('*')
      .single()
    if (error || !data) throw new Error(`Failed to record attachment: ${error?.message}`)
    results.push(data as AttachmentRow)
  }
  return results
}

export async function uploadAssessmentAttachments(args: {
  assessmentId: string
  schoolId: string
  uploadedBy: string
  files: File[]
}): Promise<AttachmentRow[]> {
  const { assessmentId, schoolId, uploadedBy, files } = args
  if (files.length === 0) return []

  const results: AttachmentRow[] = []
  for (const file of files) {
    const { path, finalFile } = await uploadOne(`assessment/${assessmentId}`, file)
    const { data, error } = await supabase
      .from('assessment_attachments')
      .insert({
        assessment_id: assessmentId,
        school_id: schoolId,
        file_path: path,
        file_name: finalFile.name,
        mime_type: finalFile.type || null,
        size_bytes: finalFile.size,
        uploaded_by: uploadedBy,
      })
      .select('*')
      .single()
    if (error || !data) throw new Error(`Failed to record attachment: ${error?.message}`)
    results.push(data as AttachmentRow)
  }
  return results
}

export async function listAssignmentAttachments(assignmentId: string): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from('assignment_attachments')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as AttachmentRow[]
}

export async function listAssessmentAttachments(assessmentId: string): Promise<AttachmentRow[]> {
  const { data, error } = await supabase
    .from('assessment_attachments')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as AttachmentRow[]
}

/** Get a temporary signed URL for displaying/downloading an attachment. */
export async function getAttachmentUrl(filePath: string, expiresIn = 60 * 30): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, expiresIn)
  if (error || !data) throw new Error(`Failed to get signed URL: ${error?.message}`)
  return data.signedUrl
}
