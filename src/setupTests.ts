import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// The sidebar observes its dimensions; jsdom does not implement this API.
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

afterEach(cleanup);
