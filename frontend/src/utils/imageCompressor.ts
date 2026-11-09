import imageCompression from 'browser-image-compression'
import { browserAutoOrients, orientationTransform, readExifOrientation } from './orientation'

const MAX_BYTES = 500 * 1024 // límite de 500 KB
const MAX_SIDE = 1280        // lado mayor en píxeles

/**
 * Respaldo: decodifica con un elemento <img>, respeta la rotación EXIF (importante en iPhone)
 * y baja la calidad JPG hasta que la foto pese menos de 500 KB.
 */
async function compressWithImageElement(file: File): Promise<File> {
  // Si el navegador ya gira la foto solo, no hay que girarla otra vez (se giraría doble)
  const orientation = (await browserAutoOrients()) ? 1 : readExifOrientation(await file.arrayBuffer())

  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()

    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const { canvasW, canvasH, matrix } = orientationTransform(orientation, w, h)

    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(...matrix)
    ctx.drawImage(img, 0, 0, w, h)

    let quality = 0.85
    let blob: Blob | null = null
    while (quality >= 0.4) {
      blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
      if (blob && blob.size <= MAX_BYTES) break
      quality -= 0.1
    }
    if (!blob) throw new Error('El navegador no pudo generar la imagen')
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Intenta primero con browser-image-compression (que ya maneja la rotación EXIF).
 * Si falla, usa el método de respaldo.
 */
async function tryCompress(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 0.45,
      maxWidthOrHeight: MAX_SIDE,
      useWebWorker: false, // evita depender de un CDN
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    })
  } catch (err) {
    console.warn('browser-image-compression falló, se usa el método de respaldo:', err)
    return compressWithImageElement(file)
  }
}

/** Convierte HEIC/HEIF a JPG. La librería es pesada: se carga solo si hace falta. */
async function convertHeicToJpeg(file: File): Promise<File | null> {
  const { heicTo, isHeic } = await import('heic-to')
  if (!(await isHeic(file))) return null
  const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 })
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}

/** Lee los primeros bytes del archivo para saber qué formato es en realidad (diagnóstico). */
async function sniffFormat(file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  if (head.length === 0) return 'archivo vacío'
  const ascii = String.fromCharCode(...head.slice(0, 16))
  if (head[0] === 0x89 && ascii.slice(1, 4) === 'PNG') {
    const dv = new DataView(head.buffer)
    return `PNG real ${dv.getUint32(16)}x${dv.getUint32(20)} px`
  }
  if (head[0] === 0xff && head[1] === 0xd8) return 'JPEG real'
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'WebP real'
  if (ascii.slice(4, 8) === 'ftyp') return `contenedor ftyp/${ascii.slice(8, 12)} (HEIC o AVIF)`
  if (ascii.startsWith('GIF8')) return 'GIF real'
  return 'formato desconocido'
}

/**
 * Comprime una imagen en el navegador a menos de 500 KB.
 * La foto resultante sale ya girada correctamente y sin nota EXIF.
 * Si no se puede abrir, prueba a convertirla desde HEIC.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    return await tryCompress(file)
  } catch (firstError) {
    console.warn('No se pudo abrir la foto, se prueba como HEIC:', firstError)
    try {
      const converted = await convertHeicToJpeg(file)
      if (converted) return await tryCompress(converted)
    } catch (heicError) {
      console.error('La conversión HEIC también falló:', heicError)
    }
    const msg = firstError instanceof Error ? firstError.message : 'error desconocido'
    const mb = (file.size / 1024 / 1024).toFixed(1)
    const real = await sniffFormat(file).catch(() => 'no se pudo leer')
    throw new Error(`${msg} [declara: ${file.type || 'desconocido'}, ${mb} MB, real: ${real}]`)
  }
}
