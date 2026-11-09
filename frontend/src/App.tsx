import { Route, Routes } from 'react-router-dom'
import Bienvenida from './pages/Bienvenida'
import Escaner from './pages/Escaner'

// Enrutador principal. Más adelante se añadirán /login, /dashboard y /resultados.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Bienvenida />} />
      <Route path="/escaner" element={<Escaner />} />
    </Routes>
  )
}
