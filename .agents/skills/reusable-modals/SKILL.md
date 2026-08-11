---
name: reusable-modals
description: Guía para utilizar el sistema de modales y diálogos de confirmación reutilizables (Mobile First).
---

# Reusable Modals & Confirm Dialogs

Esta aplicación utiliza un sistema de modales centralizado para evitar el uso de diálogos nativos del navegador (`window.confirm`, `window.alert`, `window.prompt`).

## Reglas Principales

1. **NUNCA** utilices `window.confirm()`, `confirm()`, `alert()` o `prompt()` nativos.
2. Todo mensaje, advertencia o solicitud de confirmación debe usar el hook `useConfirm()` o un componente `<Modal>` personalizado.
3. El diseño es **Mobile First**. Los modales están pensados para ocupar `w-full` y adaptarse con márgenes/paddings en pantallas más grandes. 

## Cómo usar el Diálogo de Confirmación (`useConfirm`)

El hook `useConfirm` expone un método asíncrono que reemplaza el clásico `if (!confirm(...)) return;`.

### Ejemplo de uso

```tsx
import { useConfirm } from '../context/ConfirmContext';

export default function MiComponente() {
    const { confirm } = useConfirm();

    const handleDelete = async () => {
        // 1. Llamar a confirm() y esperar (await) la respuesta del usuario
        const isConfirmed = await confirm('¿Estás seguro que deseas eliminar este elemento?', {
            title: 'Confirmar Eliminación',
            confirmText: 'Sí, eliminar',
            cancelText: 'Cancelar',
            isDestructive: true // true por defecto; pinta el botón de acción en rojo
        });

        // 2. Si el usuario cancela, detenemos el flujo
        if (!isConfirmed) return;

        // 3. Continuar con la acción destructiva
        await deleteItem();
    };

    return <button onClick={handleDelete}>Eliminar</button>;
}
```

### Opciones de `confirm(message, options)`

- `title?: string`: Título del modal. Si se omite, usa una traducción genérica (ej. "Confirmar").
- `confirmText?: string`: Texto del botón de confirmación.
- `cancelText?: string`: Texto del botón de cancelación.
- `isDestructive?: boolean`: (Default `true`). Si es verdadero, el botón principal será rojo. Si es falso, usará el color primario de la app (útil para confirmaciones positivas).

## Cómo crear un Modal personalizado

Si necesitas un modal más complejo (con formularios o información estructurada), utiliza el componente base `<Modal>`.

```tsx
import { useState } from 'react';
import { Modal } from '../components/ui/Modal';

export function MiModalPersonalizado() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button onClick={() => setIsOpen(true)}>Abrir Modal</button>
            
            <Modal 
                isOpen={isOpen} 
                onClose={() => setIsOpen(false)} 
                title="Título del Modal"
                maxWidth="max-w-lg" // Opcional, por defecto max-w-md
            >
                <div>
                    <p>Contenido personalizado aquí.</p>
                </div>
            </Modal>
        </>
    );
}
```

El componente `<Modal>` incluye por defecto:
- Cierre al presionar la tecla `Escape`.
- Cierre al hacer clic en el backdrop oscurecido.
- Bloqueo del scroll del body mientras está abierto.
- Diseño responsivo, optimizado para móvil pero con límites de ancho en escritorio (`maxWidth`).
