/**
 * Manejo de la rotación de las fotos (EXIF).
 * Los iPhone guardan la foto "acostada" con una nota interna (EXIF) que dice cómo girarla.
 * Si no se respeta, la foto sale de lado. Este archivo lee esa nota y gira la imagen.
 */

/** Lee la orientación EXIF (1 a 8) de los bytes de un JPEG. Si no hay nota, devuelve 1 (sin giro). */
export function readExifOrientation(buf: ArrayBuffer): number {
  try {
    const dv = new DataView(buf)
    if (dv.byteLength < 4 || dv.getUint16(0) !== 0xffd8) return 1 // no es JPEG
    let off = 2
    while (off + 4 <= dv.byteLength) {
      if (dv.getUint8(off) !== 0xff) break
      const marker = dv.getUint8(off + 1)
      if (marker === 0xda) break // empiezan los datos de imagen: ya no hay más cabeceras
      const len = dv.getUint16(off + 2)
      if (marker === 0xe1 && dv.getUint32(off + 4) === 0x45786966) {
        // Bloque "Exif"
        const tiff = off + 10
        const little = dv.getUint16(tiff) === 0x4949
        const ifd = tiff + dv.getUint32(tiff + 4, little)
        const entries = dv.getUint16(ifd, little)
        for (let i = 0; i < entries; i++) {
          const e = ifd + 2 + i * 12
          if (dv.getUint16(e, little) === 0x0112) {
            const v = dv.getUint16(e + 8, little)
            return v >= 1 && v <= 8 ? v : 1
          }
        }
        return 1
      }
      off += 2 + len
    }
  } catch {
    // archivo raro o cortado: asumimos sin giro
  }
  return 1
}

/**
 * Matriz del canvas para dibujar una imagen girada según su orientación EXIF.
 * w y h son el tamaño de la imagen SIN girar (ya escalado).
 */
export function orientationTransform(o: number, w: number, h: number) {
  const matrices: Record<number, [number, number, number, number, number, number]> = {
    1: [1, 0, 0, 1, 0, 0],
    2: [-1, 0, 0, 1, w, 0],
    3: [-1, 0, 0, -1, w, h],
    4: [1, 0, 0, -1, 0, h],
    5: [0, 1, 1, 0, 0, 0],
    6: [0, 1, -1, 0, h, 0],
    7: [0, -1, -1, 0, h, w],
    8: [0, -1, 1, 0, 0, w],
  }
  const swap = o >= 5 // en estos casos el ancho y el alto se intercambian
  return { canvasW: swap ? h : w, canvasH: swap ? w : h, matrix: matrices[o] ?? matrices[1] }
}

// JPEG de 2x1 px con nota "girar 90°". Si el navegador lo muestra de 1x2, gira solo.
const PROBE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3E//Z'
let autoOrientCache: Promise<boolean> | null = null

/** Indica si este navegador ya gira las fotos por sí solo al mostrarlas (Chrome y Safari modernos lo hacen). */
export function browserAutoOrients(): Promise<boolean> {
  if (!autoOrientCache) {
    autoOrientCache = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img.width === 1 && img.height === 2)
      img.onerror = () => resolve(false)
      img.src = PROBE
    })
  }
  return autoOrientCache
}
