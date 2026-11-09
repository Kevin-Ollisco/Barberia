// Las tres vistas que pide el flujo de captura
export type PhotoKey = 'frente' | 'lateral' | 'cenital'

// Una foto ya comprimida, lista para guardar en el estado
export interface CapturedPhoto {
  file: File        // archivo comprimido (< 500 KB), el que se enviará al backend
  previewUrl: string // URL temporal para mostrar la vista previa
  sizeKB: number    // peso final, solo informativo
}

export type Photos = Record<PhotoKey, CapturedPhoto | null>
