---
name: Glassmorphism Design System
description: Guidelines for building UI components and pages using the app's glassmorphism style and Framer Motion.
---

# Glassmorphism Design System

This application utilizes a modern Glassmorphism (Glass Polymorphism) design system to provide a premium, cohesive user experience. When creating or modifying UI components, you must adhere to these guidelines to ensure consistency.

## 1. Backgrounds & Surfaces

**NEVER use solid white or solid dark colors for surfaces (e.g., `bg-white`, `bg-gray-800`).**

Instead, use the global glass and card utilities defined in `index.css`:

- **`.card`**: Use this class for all main content panels, forms, and cards. It automatically applies the correct `backdrop-blur`, semi-transparent background, subtle borders, and shadows for both light and dark modes.
- **`.glass`**: A utility class for when you need a stronger glass effect (e.g., for sticky navbars or floating elements) without the padding and structural styles of `.card`.

Example:
```tsx
// ❌ Incorrect
<div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
  Content
</div>

// ✅ Correct
<div className="card">
  Content
</div>
```

## 2. Micro-Animations with Framer Motion

To maintain the premium feel, all pages and interactive components should use `framer-motion`.

- **Page Transitions**: Wrap the main content of new pages in a `<motion.div>` with a fade and slight slide-up effect.

Example:
```tsx
import { motion } from 'framer-motion';

export default function NewPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="card">
        <h1>Hello World</h1>
      </div>
    </motion.div>
  );
}
```

## 3. Global Mesh Gradient

The application body has a fixed, animated mesh gradient applied via `index.css`. This provides the vibrant colors needed for the glass effect to be visible. You do not need to add background colors to layout wrappers.

## 4. Typography

Ensure text contrast is maintained. Use the existing semantic text colors from Tailwind (e.g., `text-gray-900 dark:text-gray-100` or the custom CSS variables). Avoid adding opaque backgrounds behind text unless absolutely necessary for readability.
