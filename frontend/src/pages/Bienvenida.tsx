import { useNavigate } from 'react-router-dom'
import { ImagePlus, Scissors } from 'lucide-react'

// Pantalla de bienvenida para el barbero
export default function Bienvenida() {
  const navigate = useNavigate()

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col md:max-w-2xl">
      {/* Franja de poste de barbero: el sello visual de la app */}
      <div className="pole-stripes pole-animate h-4 w-full" aria-hidden />

      <section className="flex flex-1 flex-col justify-between px-6 pb-8 pt-12">
        <div>
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-white">
            <Scissors size={28} />
          </div>
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tight md:text-6xl">
            Muestra el corte antes de hacerlo.
          </h1>
          <p className="mt-5 max-w-sm text-lg leading-relaxed text-steel">
            Sube 3 fotos del cliente y la IA le enseña cómo le quedarían distintos cortes.
          </p>
        </div>

        <div className="mt-10">
          <button
            onClick={() => navigate('/escaner')}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-pole px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-pole/25 transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ImagePlus size={22} />
            Empezar nuevo cliente
          </button>
          <p className="mt-4 text-center text-sm text-steel">
            Ten las 3 fotos listas en tu celular. Pide permiso al cliente antes de usar su imagen.
          </p>
        </div>
      </section>
    </main>
  )
}
