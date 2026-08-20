/// <reference types="vite/client" />

// Standard Vite scaffolding that was missing from this project.
// Without it `import.meta.env.DEV` does not type-check, which blocks the panel runtime's
// development self-check (window.__panelAudit). Adding this reference file is the idiomatic
// fix and avoids editing tsconfig.json, which the work package freezes.
