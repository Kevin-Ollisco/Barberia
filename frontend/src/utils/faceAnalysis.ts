import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { PhotoKey } from '../types'

export interface ValidationResult {
  ok: boolean
  message?: string // qué debe corregir el barbero
}

// Puntos clave de la malla facial de MediaPipe (468 puntos)
const NOSE_TIP = 1
const CHEEK_A = 234
const CHEEK_B = 454
const EYE_OUTER_A = 33
const EYE_OUTER_B = 263

// Umbrales: se pueden ajustar sin tocar el resto del código
const MIN_FACE_WIDTH = 0.25 // el rostro debe ocupar al menos 25% del ancho de la foto
const MAX_ROLL_DEG = 12     // inclinación máxima de la cabeza (ladeada)
const YAW_MIN = 0.38        // rango de "mira de frente" (0.5 = perfectamente de frente)
const YAW_MAX = 0.62

// ---------- Carga del modelo (una sola vez) ----------
let landmarkerPromise: Promise<FaceLandmarker> | null = null

export function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      // Los archivos WASM y el modelo se sirven desde /public (sin depender de un CDN)
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 2, // pedimos 2 para poder avisar si hay más de una persona
      })
    })().catch((err) => {
      landmarkerPromise = null // permite reintentar
      throw err
    })
  }
  return landmarkerPromise
}

// ---------- Cálculos geométricos ----------
// Posición de la nariz entre las dos mejillas: 0.5 = de frente, cerca de 0 o 1 = de lado
function yawRatio(lm: NormalizedLandmark[]): number {
  return (lm[NOSE_TIP].x - lm[CHEEK_A].x) / (lm[CHEEK_B].x - lm[CHEEK_A].x)
}

// Inclinación de la cabeza en grados, según la línea de los ojos
function rollDegrees(lm: NormalizedLandmark[], w: number, h: number): number {
  const dx = (lm[EYE_OUTER_B].x - lm[EYE_OUTER_A].x) * w
  const dy = (lm[EYE_OUTER_B].y - lm[EYE_OUTER_A].y) * h
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI
  if (Math.abs(angle) > 90) angle -= Math.sign(angle) * 180
  return angle
}

function boundingBox(lm: NormalizedLandmark[]) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const p of lm) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, maxX, minY, maxY, width: maxX - minX }
}

// ---------- Validación por tipo de foto ----------
export async function validatePhoto(key: PhotoKey, file: File): Promise<ValidationResult> {
  // Desde arriba no hay cara que detectar
  if (key === 'cenital') return { ok: true }

  let landmarker: FaceLandmarker
  try {
    landmarker = await loadFaceLandmarker()
  } catch (err) {
    // Si MediaPipe no carga, no bloqueamos al barbero: dejamos pasar la foto
    console.warn('MediaPipe no se pudo cargar, se omite la validación:', err)
    return { ok: true }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (err) {
    console.warn('No se pudo preparar la foto para MediaPipe, se omite la validación:', err)
    return { ok: true }
  }
  try {
    const faces = landmarker.detect(bitmap).faceLandmarks

    if (key === 'lateral') {
      // Solo bloqueamos el caso claro: una cara de frente en la foto de perfil
      if (faces.length === 1) {
        const ratio = yawRatio(faces[0])
        if (ratio > YAW_MIN && ratio < YAW_MAX) {
          return { ok: false, message: 'Esta foto parece de frente. Sube una foto de perfil: el cliente de lado.' }
        }
      }
      return { ok: true }
    }

    // key === 'frente'
    if (faces.length === 0) {
      return { ok: false, message: 'No se detecta ninguna cara. Usa una foto de frente, con buena luz y sin gorra ni lentes oscuros.' }
    }
    if (faces.length > 1) {
      return { ok: false, message: 'Se detectan varias caras. La foto debe tener solo al cliente.' }
    }

    const lm = faces[0]
    const box = boundingBox(lm)

    if (box.minX < 0.01 || box.maxX > 0.99 || box.minY < 0.01 || box.maxY > 0.99) {
      return { ok: false, message: 'El rostro está cortado. Deja más espacio alrededor de la cabeza.' }
    }
    if (box.width < MIN_FACE_WIDTH) {
      return { ok: false, message: 'El rostro se ve muy lejos. Acércate un poco al cliente.' }
    }
    if (Math.abs(rollDegrees(lm, bitmap.width, bitmap.height)) > MAX_ROLL_DEG) {
      return { ok: false, message: 'La cabeza está inclinada hacia un lado. Pide al cliente que la mantenga recta.' }
    }
    const ratio = yawRatio(lm)
    if (ratio < YAW_MIN || ratio > YAW_MAX) {
      return { ok: false, message: 'El cliente no está mirando de frente. Pídele que mire directo a la cámara.' }
    }
    return { ok: true }
  } catch (err) {
    // Un fallo técnico del detector no debe bloquear al barbero
    console.warn('MediaPipe falló al analizar la foto, se omite la validación:', err)
    return { ok: true }
  } finally {
    bitmap.close()
  }
}
