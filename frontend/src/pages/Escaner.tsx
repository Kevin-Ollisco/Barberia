import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronsDown, ImagePlus, Loader2, RefreshCw, ScanFace, UserRound } from 'lucide-react'
import ProgressPole from '../components/ProgressPole'
import { compressImage } from '../utils/imageCompressor'
import { loadFaceLandmarker, validatePhoto } from '../utils/faceAnalysis'
import type { Photos, PhotoKey } from '../types'

// Definición de los 3 pasos del flujo guiado.
// El barbero ya tomó estas fotos con la cámara de su celular; aquí solo las sube.
const STEPS: { key: PhotoKey; title: string; instruction: string; Icon: typeof ScanFace }[] = [
  { key: 'frente', title: 'Foto de frente', instruction: 'Sube la foto donde el cliente mira a la cámara, con la frente despejada.', Icon: ScanFace },
  { key: 'lateral', title: 'Foto de perfil', instruction: 'Sube la foto de lado. Se debe ver la oreja y toda la línea del cabello.', Icon: UserRound },
  { key: 'cenital', title: 'Foto desde arriba', instruction: 'Sube la foto de la parte alta de la cabeza, tomada desde arriba.', Icon: ChevronsDown },
]
const KEYS = STEPS.map((s) => s.key)

export default function Escaner() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [photos, setPhotos] = useState<Photos>({ frente: null, lateral: null, cenital: null })
  const [isCompressing, setIsCompressing] = useState(false) // true mientras se comprime o analiza
  const [busyText, setBusyText] = useState('Optimizando foto…')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Precarga MediaPipe al entrar, para que la primera validación sea rápida
  useEffect(() => {
    loadFaceLandmarker().catch(() => {})
  }, [])

  // Guardamos una referencia a las fotos para liberar sus URLs al salir de la pantalla
  const photosRef = useRef(photos)
  photosRef.current = photos
  useEffect(
    () => () => Object.values(photosRef.current).forEach((p) => p && URL.revokeObjectURL(p.previewUrl)),
    [],
  )

  const current = STEPS[step]
  const currentPhoto = photos[current.key]
  const allDone = KEYS.every((k) => photos[k])

  // Recibe la foto elegida, la comprime a menos de 500 KB y la guarda en el estado
  const handleNewImage = async (file: File) => {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (JPG, PNG o similar).')
      return
    }
    setIsCompressing(true)
    try {
      const key = current.key
      setBusyText('Optimizando foto…')
      const compressed = await compressImage(file)

      // MediaPipe revisa la foto en el navegador. Si hay un problema, no se guarda.
      setBusyText('Revisando la foto…')
      const check = await validatePhoto(key, compressed)
      if (!check.ok) {
        setError(check.message ?? 'La foto no es válida. Prueba con otra.')
        return
      }

      setPhotos((prev) => {
        if (prev[key]) URL.revokeObjectURL(prev[key]!.previewUrl) // limpia la foto anterior
        return {
          ...prev,
          [key]: {
            file: compressed,
            previewUrl: URL.createObjectURL(compressed),
            sizeKB: Math.round(compressed.size / 1024),
          },
        }
      })
    } catch (err) {
      console.error('Error al procesar la imagen:', err)
      const detalle = err instanceof Error ? err.message : 'error desconocido'
      setError(`No se pudo procesar la imagen (${detalle}). Prueba con otra foto en formato JPG o PNG.`)
    } finally {
      setIsCompressing(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const file = input.files?.[0]
    if (!file) return
    try {
      // En Android el archivo del selector es una referencia temporal. Lo copiamos a la
      // memoria ANTES de hacer nada más, para que no se pierda mientras se procesa.
      const buffer = await file.arrayBuffer()
      const copy = new File([buffer], file.name, { type: file.type })
      await handleNewImage(copy)
    } catch (err) {
      console.error('No se pudo leer el archivo del selector:', err)
      const detalle = err instanceof Error ? err.message : 'error desconocido'
      setError(`No se pudo leer la foto (${detalle}). Si está en la nube, descárgala al celular primero.`)
    } finally {
      input.value = '' // permite elegir el mismo archivo otra vez
    }
  }

  const openPicker = () => fileInputRef.current?.click()

  const handleContinue = () => {
    // TODO Paso 1.3: enviar photos.frente/lateral/cenital.file a MediaPipe y luego al backend
    console.log('Fotos listas:', photos)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-6 pt-5 md:max-w-2xl">
      {/* Encabezado */}
      <header className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate('/')} aria-label="Volver al inicio" className="rounded-full p-2 hover:bg-line focus-visible:outline-2 focus-visible:outline-ink">
          <ArrowLeft size={22} />
        </button>
        <p className="text-sm font-semibold text-steel">Foto {step + 1} de {STEPS.length}</p>
      </header>

      <ProgressPole keys={KEYS} photos={photos} current={step} />

      <h2 className="mt-6 text-3xl font-extrabold tracking-tight">{current.title}</h2>
      <p className="mt-1 max-w-md text-steel">{current.instruction}</p>

      {/* Zona de vista previa. Si aún no hay foto, tocarla abre la galería */}
      <button
        type="button"
        onClick={openPicker}
        disabled={isCompressing}
        aria-label={currentPhoto ? 'Cambiar foto' : 'Elegir foto de la galería'}
        className="relative mt-5 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-line bg-white md:aspect-video"
      >
        {currentPhoto ? (
          <>
            <img src={currentPhoto.previewUrl} alt={`Vista previa: ${current.title}`} className="h-full w-full object-cover" />
            <span className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-white">
              {currentPhoto.sizeKB} KB
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-steel">
            <current.Icon size={64} className="text-line" aria-hidden />
            <span className="font-semibold">Toca para elegir la foto de tu galería</span>
          </div>
        )}

        {isCompressing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 text-ink">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-sm font-semibold">{busyText}</p>
          </div>
        )}
      </button>

      {error && <p role="alert" className="mt-3 text-sm font-semibold text-pole">{error}</p>}

      {/* Botón de subida */}
      <button
        onClick={openPicker}
        disabled={isCompressing}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-4 font-semibold text-white transition active:scale-[0.98] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {currentPhoto ? <RefreshCw size={20} /> : <ImagePlus size={20} />}
        {currentPhoto ? 'Cambiar foto' : 'Subir desde galería'}
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

      {/* Miniaturas de las 3 fotos: permiten volver a un paso anterior */}
      <div className="mt-6 flex gap-3">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(i)}
            aria-label={`Ir a ${s.title}`}
            className={`h-16 w-16 overflow-hidden rounded-xl border-2 bg-white ${i === step ? 'border-pole' : 'border-line'}`}
          >
            {photos[s.key] ? (
              <img src={photos[s.key]!.previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <s.Icon size={22} className="mx-auto text-steel" />
            )}
          </button>
        ))}
      </div>

      {/* Navegación del flujo */}
      <div className="mt-auto flex gap-3 pt-6">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="rounded-2xl border-2 border-line px-5 py-4 font-semibold">
            Atrás
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!currentPhoto || isCompressing}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-pole px-5 py-4 font-semibold text-white transition active:scale-[0.98] disabled:bg-line disabled:text-steel"
          >
            Siguiente <ArrowRight size={20} />
          </button>
        ) : (
          <button
            onClick={handleContinue}
            disabled={!allDone || isCompressing}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-pole px-5 py-4 font-semibold text-white transition active:scale-[0.98] disabled:bg-line disabled:text-steel"
          >
            Continuar con las 3 fotos <ArrowRight size={20} />
          </button>
        )}
      </div>
    </main>
  )
}
