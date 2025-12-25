
# LogiSync Pro - Documentación del Sistema

## 1. Arquitectura Recomendada
El sistema se ha diseñado como una **Single Page Application (SPA)** de alto rendimiento utilizando React 18 y TypeScript. 

### Por qué esta arquitectura:
- **Procesamiento en el Cliente:** Dado que los archivos CSV suelen ser de tamaño moderado (miles de filas), procesarlos en el navegador es más rápido y privado, eliminando la latencia de subida al servidor.
- **Robustez:** El uso de bibliotecas estándar de la industria (`xlsx`, `jspdf`, `papaparse`) garantiza que los archivos generados sean compatibles con cualquier sistema de logística.
- **Portabilidad:** Se puede desplegar como contenido estático en cualquier servidor web (Nginx, S3, Vercel) sin necesidad de un backend complejo.

## 2. Estructura del Proyecto
- `App.tsx`: Orquestador de la UI y estados.
- `services/processor.ts`: Cerebro del sistema. Parsea, filtra y genera los Blobs de los archivos.
- `utils/helpers.ts`: Implementación de las Reglas 4 y 9 (normalización y mapeo de columnas).
- `types.ts`: Definiciones estrictas para evitar errores de tipo en producción.

## 3. Instrucciones de Ejecución Local
1. Asegúrate de tener **Node.js 18+** instalado.
2. Instala las dependencias: `npm install lucide-react papaparse xlsx jspdf jszip`
3. Inicia el servidor de desarrollo: `npm start`
4. Abre `http://localhost:3000`.

## 4. Opciones de Deploy
- **Docker:** Utilizar una imagen de Nginx para servir los archivos estáticos generados por el build.
- **VPS:** Clonar el repo, hacer `npm run build` y servir la carpeta `dist/` con Apache o Nginx.
- **Límites:** El sistema soporta archivos de hasta 100MB cómodamente en navegadores modernos. Para archivos mayores, se recomienda implementar chunking o mover la lógica a un worker de Node.js.

## 5. Pruebas
He incluido un archivo `utils/converters.test.ts` que valida las reglas críticas:
- `22,98` -> `22980`
- `NUNOA` -> `ÑUÑOA`
- Mapeo de columnas por letras de Excel.
