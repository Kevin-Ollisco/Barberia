# ============================================================
#  Prepara el Paso 1.3 (MediaPipe) - Ejecutar DENTRO de frontend
#  Uso:  powershell -ExecutionPolicy Bypass -File .\setup-paso-1.3.ps1
# ============================================================
$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'package.json')) {
  Write-Host 'ERROR: ejecuta este script dentro de la carpeta frontend (donde esta package.json).' -ForegroundColor Red
  exit 1
}

Write-Host '1/4 Creando carpetas...' -ForegroundColor Cyan
$carpetas = 'src\components','src\pages','src\types','src\utils','public\mediapipe','public\models'
foreach ($c in $carpetas) { New-Item -ItemType Directory -Force -Path $c | Out-Null }

Write-Host '2/4 Instalando paquetes...' -ForegroundColor Cyan
npm install react react-dom react-router-dom axios browser-image-compression lucide-react heic-to @mediapipe/tasks-vision
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss @tailwindcss/vite

Write-Host '3/4 Copiando archivos WASM de MediaPipe a public...' -ForegroundColor Cyan
if (Test-Path 'public\mediapipe\wasm') { Remove-Item 'public\mediapipe\wasm' -Recurse -Force }
Copy-Item 'node_modules\@mediapipe\tasks-vision\wasm' 'public\mediapipe\wasm' -Recurse

Write-Host '4/4 Descargando el modelo de rostro (unos 4 MB)...' -ForegroundColor Cyan
$modelo = 'public\models\face_landmarker.task'
if (-not (Test-Path $modelo)) {
  Invoke-WebRequest -Uri 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' -OutFile $modelo
}

Write-Host ''
Write-Host 'Listo. Ahora ejecuta:  npm run dev' -ForegroundColor Green
