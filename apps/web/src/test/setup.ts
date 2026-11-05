import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'

// Register the DOM matchers on this runner's own `expect`. Importing the
// `@testing-library/jest-dom/vitest` entry point registers them on another
// `expect` instance under Vitest 5, so every `toHaveTextContent` failed.
expect.extend(matchers)

// findBy*/waitFor default to 1 s, too short when the whole suite runs in parallel.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.unstubAllGlobals()
})
