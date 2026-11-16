// The matchers are registered at runtime in `setup.ts` with `expect.extend`
// because the `/vitest` entry point binds them to another `expect` under Vitest 5.
// This type-only import keeps the canonical augmentation of `vitest`'s
// `Assertion` so `tsc -b` accepts `toHaveTextContent`, `toBeInTheDocument`, etc.
import '@testing-library/jest-dom/vitest'
