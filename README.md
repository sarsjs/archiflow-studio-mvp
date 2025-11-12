
# ArchiFlow Studio — MVP (OnSpace-like starter)

Monorepo con:
- **apps/web** (Next.js): Renderer con **CanvasEditor** (dibujo, selección, mover).
- **apps/mobile** (Expo): Placeholder listo para integrar el renderer móvil.
- **packages/renderer-core**: Editor de canvas reutilizable (Web).
- **packages/blueprint-schemas**: Esquema JSON base del blueprint.

> Objetivo: tener un flujo *prompt → blueprint → render* sencillo y un editor de canvas con **Select/Move** ya funcional en Web.

## Requisitos
- Node.js 18+
- npm 9+

## Instalación rápida
```bash
# En la raíz del repo
npm install

# Ejecutar la app web (Next.js)
npm run dev:web
# abre http://localhost:3000
```

> Si tienes problemas con workspaces en Termux/Android, también puedes instalar por separado entrando a `apps/web` y ejecutando `npm install && npm run dev`.

## Estructura
```
archiflow-studio-mvp/
  apps/
    web/         # Next.js + CanvasEditor (funcional)
    mobile/      # Expo app (placeholder)
  packages/
    renderer-core/
      src/CanvasEditor.tsx
    blueprint-schemas/
      schema.json
```

## Roadmap corto
- [x] Canvas 2D con grid, dibujar rectángulos, seleccionar, mover.
- [ ] Rotar y redimensionar con handles.
- [ ] Capas y bloqueo de capas.
- [ ] Exportar a PDF/DXF.
- [ ] Renderer móvil (Expo) con gestos.

## Licencia
MIT (para que puedas modificar libremente).
