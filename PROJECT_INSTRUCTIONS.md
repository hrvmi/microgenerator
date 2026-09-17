# MicroGenerator — Project Instructions & Architecture Guide

## 1. Project Overview
MicroGenerator is a lightweight, zero-dependency procedural pattern generator and design tool. It computes multi-layered typographic/ASCII grids using procedural 2D noise algorithms and renders scalable vector graphics (SVG) with export support for both vector and raster image formats.

---

## 2. Architecture & File Structure

The project follows a pure vanilla web architecture designed to run directly in modern browsers without build steps, package managers, or complex runtime toolchains:

```
├── index.html        # 3-column studio interface & preview stage
├── styles.css        # Technical modernist design system & responsive layout
├── app.js           # Procedural generator, SVG builder, DOM bindings & export logic
└── README.md         # Quickstart guide for opening and using the tool
```

### Core Architecture
1. **Studio Interface (`index.html`)**:
   - **Left Sidebar**: Brand metadata, variation selector, procedural parameter sliders, action button, and shortcut bindings.
   - **Center Stage**: Preview container with technical corner crop marks and an aspect-ratio-constrained preview box.
   - **Right Sidebar**: Live output specifications (ratio, dimensions, format, style), aspect ratio selector grid, export format picker, and export trigger.

2. **Procedural Generator (`app.js`)**:
   - **Variations & Presets**: Extensible dictionary of glyph sets (blocks, symbols, alphanumeric, braille, etc.).
   - **Noise-Driven Grid**: Multi-octave 2D procedural noise modulates cell density, glyph selection, and color accents across a monospace character grid.
   - **SVG Generation**: Assembles a standalone `<svg>` containing background geometry and positioned `<text>` nodes, injected directly into the stage for real-time preview.

3. **Export Engine**:
   - **Vector (SVG)**: Exports the raw SVG string as an XML blob.
   - **Raster Formats**: Converts the SVG into an in-memory image, draws it onto an off-screen HTML5 `<canvas>` at target resolution, and triggers a download for the selected format (PNG, JPG, WebP).

---

## 3. Visual Language & Design System

The visual language is grounded in technical Swiss typography, print-proofing interfaces, and generative art tooling:

- **Color System**:
  - Light neutral canvas (`--bg`) and clean surface (`--surface`).
  - High-contrast near-black typography (`--text`) with muted gray metadata (`--text-muted`).
  - Subtle hairline dividers (`--line-faint`, `--line`).
  - Signature high-visibility orange accent (`--accent`, e.g. `#FF3C00`) used selectively for highlights and focal points.
- **Typography**:
  - UI labels: System sans-serif.
  - Specs, data readouts, and pattern glyphs: System monospace stack (`SF Mono`, `Menlo`, `Consolas`, monospace).
  - Micro-labels: Small, bold, uppercase with wide letter tracking.
- **Controls & Detailing**:
  - Print-inspired crop marks at preview frame corners.
  - Wireframe geometric shapes inside ratio buttons indicating orientation.
  - Functional, utilitarian controls without decorative gradients or heavy drop shadows.

---

## 4. Key Constraints

1. **Zero External Dependencies**:
   - No npm/node dependencies, bundlers (Vite/Webpack), or external runtime libraries.
   - Must run locally without requiring third-party runtime toolchains.
2. **Vector Single Source of Truth**:
   - The SVG document is the authoritative definition of the generated artwork. All raster exports must be faithfully derived from this vector source.
3. **Local Execution & Security Boundaries**:
   - The tool is designed to run locally via `file://` or any basic static file server (e.g. `python3 -m http.server`).
   - Note: Some modern browsers impose local origin restrictions on `file://` that can taint canvas elements when rasterizing SVG object URLs. Serving via a local static HTTP server is the standard environment for full raster export support.
4. **Offline Operation**:
   - The core application must remain completely operational without an active internet connection.

---

## 5. Mandatory Approval Gates & Prohibitions

### Actions Requiring Prior User Approval
You must obtain explicit user approval before performing any of the following:

1. **Architectural Changes**: Introducing new rendering paradigms, changing the core state flow, or adding frameworks.
2. **Dependency Additions**: Adding any third-party library, package manager, build tool, or external CDN asset.
3. **Application Source-File Restructuring**: Renaming, moving, deleting, or adding new application source files or altering core directory structure.
   *(Note: Creating documentation files like Markdown notes or standalone scratch test files does not require prior approval.)*
4. **Git State Changes**: Running `git commit`, `git push`, switching/creating branches, or modifying remotes.
5. **Figma Modifications**: Writing to, updating, or modifying any Figma files or tokens (read-only inspection of Figma references is permitted).

### Prohibited Actions
- **Destructive Git Operations**: Never run commands that can destroy working state or discard uncommitted changes (e.g., `git reset --hard`, `git checkout --`, `git restore .`, `git clean -fd`).

---

## 6. Safe Development & Proportional Verification

1. **Preserve Interaction Contracts**:
   - Keep real-time feedback active when adjusting controls.
   - Maintain keyboard shortcuts (e.g. `G` for generate) and ensure form inputs remain accessible with semantic labels.
2. **Proportional Export Verification**:
   Verify exports appropriately based on the blast radius of the change:
   - **Minor UI / CSS Tweaks**: Visually verify stage preview and control alignment in the browser.
   - **Layout, Aspect Ratio, or Dimension Changes**: Verify on-screen preview plus at least one raster export (e.g. PNG) to ensure canvas sizing math is intact.
   - **Core Engine, SVG Output, or Export Pipeline Changes**: Perform full end-to-end verification across all supported export formats (SVG, PNG, JPG, WebP).
3. **Font & Glyph Safety**:
   - Ensure standard system monospace font stacks are maintained in generated SVG text elements to guarantee predictable cross-platform fallbacks during on-screen rendering and canvas rasterization.
   - Ensure XML character escaping is applied to dynamic glyphs to avoid malformed SVG markup.
