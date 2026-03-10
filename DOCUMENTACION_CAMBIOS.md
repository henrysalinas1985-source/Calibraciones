# Documentación de Cambios - Sistema de Calibraciones

Este documento resume las mejoras y correcciones realizadas para permitir la edición avanzada de certificados Excel y la persistencia de datos técnicos.

## 1. Migración a ExcelJS
Se reemplazó la librería `xlsx` (SheetJS) por **ExcelJS** para garantizar que los certificados generados preserven el **formato, colores, bordes y estilos** de la plantilla original.
- **CDN:** `https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js`

## 2. Nuevos Campos de Edición
Se agregaron campos en el modal de edición para personalizar la información del equipo:
- **Ubicación:** Edificio (H5), Sector (H6), Ubicación Técnica (H7).
- **Equipo:** Marca (D7) y Modelo (D5).
- **Instrumental Utilizado:** Tabla dinámica para múltiples instrumentos.

## 3. Instrumental Utilizado (Tabla Dinámica y Autocompletado)
Se implementó una sección que permite añadir/quitar instrumentos.
- **Autocompletado Inteligente**: Al escribir el nombre de un instrumental, el sistema sugiere nombres basados en calibraciones anteriores.
- **Auto-llenado**: Al seleccionar un instrumento sugerido, se completan automáticamente su **Marca, Modelo y N° de Serie**.
- **Inyección en Excel**: Inicia en la **Fila 12** y soporta hasta 5 filas (hasta la 16) para evitar superposición.
- **Columnas:**
    - A: Nombre del instrumental
    - B: Marca
    - C: Modelo
    - D: N° de serie
    - E: Fecha de calibración

## 4. Lógica de Persistencia (IndexedDB)
Los datos editados ya no se pierden al cerrar la sesión:
- **`storeCalibration`**: Actualizado para guardar `building`, `sector`, `location`, `brand`, `model` e `instruments`.
- **`window.openEdit`**: Implementa una lógica de pre-llenado inteligente:
    1. Prioriza datos guardados en la base de datos (ediciones previas).
    2. Si no hay datos guardados, busca en el Excel base cargado inicialmente.
    3. Permite sobrescritura manual antes de generar el certificado.

## 5. Mapeo de Celdas (Plantilla 2025)
Mapeo exacto configurado en `app.js`:
- `A5`: Nombre/Equipo
- `D5`: Modelo
- `A7`: N° de Serie
- `D7`: Marca
- `H5, H6, H7`: Ubicación
- `H8`: Fecha Calibración
- `H9`: Orden M
- `H10`: Técnico Realizó

---
*Referencia para futuras expansiones: El objeto `updates` en `updateExcelCertificate` controla el mapeo directo, mientras que el bucle sobre `instruments` maneja las filas dinámicas.*
