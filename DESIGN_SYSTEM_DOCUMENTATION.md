# CardPop Design System Documentation

This document outlines the foundational design language, components, and structural guidelines for the CardPop web application. It is derived directly from the application's core CSS (`index.css`), Tailwind configuration (`tailwind.config.js`), and primary UI components.

---

## 1. Color Palette

The color system uses CSS custom properties formatted as HSL components (e.g., `348 83% 47%`) mapped directly to Tailwind utility classes.

### Core UI Theme
| Token | Light Mode (HSL) | Dark Mode (HSL) | Usage |
|-------|------------------|-----------------|-------|
| `--background` | `0 0% 100%` (White) | `240 10% 3.9%` (Rich Black) | Main page canvas |
| `--foreground` | `240 10% 3.9%` (Rich Black)| `0 0% 98%` (Off-white) | Default text color |
| `--card` | `0 0% 100%` (White) | `240 10% 3.9%` (Rich Black) | Card backgrounds |
| `--card-foreground` | `240 10% 3.9%` (Rich Black)| `0 0% 98%` (Off-white) | Text inside cards |
| `--popover` | `0 0% 100%` (White) | `240 10% 3.9%` (Rich Black) | Dropdowns, tooltips |
| `--popover-foreground` | `240 10% 3.9%` (Rich Black)| `0 0% 98%` (Off-white) | Text inside popovers |

### Semantic Brand Colors
| Token | Light Mode (HSL) | Dark Mode (HSL) | Notes |
|-------|------------------|-----------------|-------|
| `--primary` | `348 83% 47%` (Deep Red) | `348 83% 47%` (Deep Red) | Brand accent, primary buttons, active states. |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Text on primary backgrounds. |
| `--secondary` | `240 4.8% 95.9%` (Light Gray) | `240 3.7% 15.9%` (Dark Gray) | Secondary actions, gentle highlights. |
| `--secondary-foreground`| `240 5.9% 10%` | `0 0% 98%` | Text on secondary backgrounds. |
| `--muted` | `240 4.8% 95.9%` (Light Gray) | `240 3.7% 15.9%` (Dark Gray) | Subtle backgrounds, disabled states. |
| `--muted-foreground` | `240 3.8% 46.1%` | `240 5% 64.9%` | Secondary text, placeholder text. |
| `--accent` | `240 4.8% 95.9%` (Light Gray) | `240 3.7% 15.9%` (Dark Gray) | Hover states on menus and ghost buttons. |
| `--accent-foreground` | `240 5.9% 10%` | `0 0% 98%` | Text on accent backgrounds. |
| `--destructive` | `0 84.2% 60.2%` (Bright Red) | `0 62.8% 30.6%` (Dark Red) | Error states, delete actions. |

### Borders & Rings
| Token | Light Mode (HSL) | Dark Mode (HSL) |
|-------|------------------|-----------------|
| `--border` | `220 13% 91%` | `220 13% 20%` |
| `--card-border` | `220 13% 91%` | `220 13% 20%` |
| `--input-border` | `220 13% 85%` | `220 13% 25%` |
| `--ring` | `348 83% 47%` (Matches Primary) | `348 83% 47%` (Matches Primary) |

---

## 2. Typography System

The application relies on two Google Fonts, imported in `index.css`.

### Font Families
*   **Sans-serif (`--font-sans`)**: `'Plus Jakarta Sans', sans-serif`
    *   **Usage**: Body text, button labels, navigation, inputs, badges.
    *   **Weights mapped**: 400 (normal), 500 (medium), 600 (semibold), 700 (bold).
*   **Heading (`--font-heading`)**: `'Syne', sans-serif`
    *   **Usage**: Application logo text, `h1`-`h6` tags, major marketing headers.
    *   **Weights mapped**: 400 (normal), 600 (semibold), 700 (bold), 800 (extrabold).

### Typography Scale (CSS Variables)
*   `--font-size-sm`: `0.875rem` (14px)
*   `--font-size-base`: `1rem` (16px)
*   `--font-size-lg`: `1.125rem` (18px)
*   `--font-size-xl`: `1.25rem` (20px)
*   `--font-size-2xl`: `1.5rem` (24px)

### Default Styling
*   All headings (`h1` through `h6`) use the Syne font family (`var(--font-heading)`) and have `text-wrap: balance` applied globally to prevent orphaned words.
*   The `html` selector implements `scroll-behavior: smooth`.

---

## 3. Spacing & Breakpoints

CardPop uses the default Tailwind CSS spacing scale (1 = 0.25rem = 4px).

### Breakpoints (Tailwind Defaults)
*   `sm`: 640px
*   `md`: 768px
*   `lg`: 1024px
*   `xl`: 1280px
*   `2xl`: 1400px (Customized in `tailwind.config.js` via the `container` configuration)

---

## 4. Component Library

### Structural Globals (`index.css`)
*   `--radius`: `0.75rem` (12px) - Maps to Tailwind's `rounded-lg`.
*   `--border-radius`: `0.75rem` (12px) - Used as a fallback/alias variable.

### Button (`Button.jsx`)
Powered by `class-variance-authority` (cva).
*   **Base Styles**: `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors`.
*   **Variants**:
    *   `default`: `bg-primary text-primary-foreground shadow hover:bg-primary/90`
    *   `destructive`: `bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90`
    *   `outline`: `border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground`
    *   `secondary`: `bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80`
    *   `ghost`: `hover:bg-accent hover:text-accent-foreground`
    *   `link`: `text-primary underline-offset-4 hover:underline`
*   **Sizes**:
    *   `default`: `h-9 px-4 py-2`
    *   `sm`: `h-8 rounded-md px-3 text-xs`
    *   `lg`: `h-10 rounded-md px-8`
    *   `icon`: `h-9 w-9`

### Card (`card.jsx`)
*   **Base (`Card`)**: `rounded-[var(--border-radius)] border border-[hsl(var(--card-border))] bg-card text-card-foreground shadow-sm`.
*   **Header (`CardHeader`)**: `flex flex-col space-y-1.5 p-6`.
*   **Title (`CardTitle`)**: `font-semibold leading-none tracking-tight`.
*   **Content (`CardContent`)**: `p-6 pt-0`.
*   **Footer (`CardFooter`)**: `flex items-center p-6 pt-0`.

### Input (`input.jsx`)
*   **Base Styles**: `flex h-9 w-full rounded-[var(--border-radius)] border border-[hsl(var(--input-border))] bg-transparent px-3 py-1 text-base shadow-sm transition-colors`.

---

## 5. Layout Standards

### Layout Utilities (`@layer components`)
*   `.container-default`: Represents the standard page wrapper constraint.
    *   Styles: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
*   `.section-padding`: Standardized vertical padding for content blocks.
    *   Styles: `py-16 md:py-24`
*   `.card-hover`: Unified hover interaction for interactive cards.
    *   Styles: `transition-all duration-300 hover:shadow-lg hover:-translate-y-1`
*   `.glass-header`: Used for sticky site headers.
    *   Styles: `bg-background/80 backdrop-blur-md border-b border-[hsl(var(--border))]`

---

## 6. Branding Guidelines

### Logo & Identity
The CardPop identity heavily relies on a specific typographic treatment embedded directly into the header and footer JSX components, rather than using a static image.
*   **Text Formatting**: "Card" in foreground color, "Pop" in primary brand color.
*   **Font**: Syne (`font-serif` mapped incorrectly in Tailwind, but implies heading font usage).
*   **JSX Pattern**: