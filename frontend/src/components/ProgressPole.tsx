import type { CapturedPhoto, PhotoKey } from '../types'

interface Props {
  keys: PhotoKey[]
  photos: Record<PhotoKey, CapturedPhoto | null>
  current: number
}

// Barra de progreso de 3 tramos. Los pasos completados se llenan con las rayas del poste.
export default function ProgressPole({ keys, photos, current }: Props) {
  return (
    <div className="flex gap-2" role="progressbar" aria-valuemin={0} aria-valuemax={keys.length} aria-valuenow={keys.filter((k) => photos[k]).length}>
      {keys.map((k, i) => (
        <div key={k} className={`h-2.5 flex-1 overflow-hidden rounded-full ${i === current ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''} bg-line`}>
          {photos[k] && <div className="pole-stripes pole-animate h-full w-full" />}
        </div>
      ))}
    </div>
  )
}
