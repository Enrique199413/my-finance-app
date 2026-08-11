# Reglas de Contraste para Fondos Dinámicos (Theme Contrast)

Esta regla se aplica SIEMPRE al crear o modificar componentes de Interfaz de Usuario (UI) en el proyecto, para garantizar la compatibilidad con nuestra paleta de fondos dinámicos personalizables tanto en modo oscuro como claro.

## El Problema
La aplicación utiliza fondos de tema dinámicos (`backgroundColorDark` y `backgroundColorLight`) que el usuario puede personalizar (ej. azul noche, esmeralda oscuro, crema, etc.). Si utilizamos colores opacos de la escala de grises de Tailwind (como `bg-white` y `dark:bg-gray-800` o `dark:bg-gray-900`) para las tarjetas (cards), modales, o inputs, estos colores opacos desentonarán horriblemente con el fondo dinámico. 

## Reglas de Implementación

1. **Nunca usar grises opacos en modo oscuro para contenedores de superficie.**
   - ❌ **INCORRECTO**: `dark:bg-gray-800`, `dark:bg-gray-900`, `dark:bg-gray-700`
   - ✅ **CORRECTO**: Usar colores translúcidos sobre el fondo principal: `dark:bg-white/5`, `dark:bg-black/20`, `dark:bg-white/10`.

2. **Bordes Adaptativos:**
   - ❌ **INCORRECTO**: `dark:border-gray-700`, `border-gray-200` (si está sobre un fondo que no sea blanco).
   - ✅ **CORRECTO**: `border-black/5 dark:border-white/10`, o aprovechar los bordes translúcidos de los colores primarios: `border-primary-500/20`.

3. **Opacidad de Textos en lugar de Grises:**
   - En lugar de usar `text-gray-500` en modo oscuro (que podría chocar con un fondo azul marino), usa opacidad de blanco.
   - ❌ **INCORRECTO**: `dark:text-gray-400`, `dark:text-gray-500`
   - ✅ **CORRECTO**: `dark:text-white/60`, `dark:text-white/80`. (Nota: en modo claro `text-gray-500` sigue siendo aceptable si el fondo claro es un blanco roto).

4. **Inputs y Campos de Texto:**
   - ❌ **INCORRECTO**: `dark:bg-gray-900`
   - ✅ **CORRECTO**: `dark:bg-black/20` o `dark:bg-black/40` con `dark:text-white`.

## Excepciones
- Estas reglas no aplican si el elemento UI requiere un contraste fuerte o un color absoluto intencionado, como un botón de acción primario (`bg-primary-600`) o una insignia de estado crítico (`bg-red-500`).
