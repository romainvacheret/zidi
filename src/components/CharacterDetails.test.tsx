import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { type CharacterDetails } from '../dictionary';
import DictionaryView from './DictionaryView';

const details: CharacterDetails = {
  character: '世', pinyin: 'shì', gloss: 'generation', codepoint: 'U+4E16',
  stroke_count: 5, original_meaning: 'leaf', hint: 'Depicts leaves on branches.',
  hsk_level: 3, movie_rank: 340, book_rank: 181, readings: ['shì'],
  components: [], words: [{ word: '世界', traditional: '世界', gloss: 'world' }],
  variants: ['枼'], sources: ['unicode'],
};

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  // jsdom has no native dialog lifecycle; browser checks cover real dialogs.
  Object.defineProperties(HTMLDialogElement.prototype, {
    show: { configurable: true, value() { this.setAttribute('open', ''); } },
    showModal: { configurable: true, value() { this.setAttribute('open', ''); } },
    close: { configurable: true, value() { this.removeAttribute('open'); } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function mockApi() {
  const fetch = vi.fn().mockImplementation(async (url: string) => ({
    ok: true, json: async () => url.includes('/search?') ? {
      results: [details, { ...details, character: '事' }], limit: 50,
    } : details,
  }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

test('opens a character preview, closes with Escape, and keeps results', async () => {
  const fetch = mockApi();
  const user = userEvent.setup();
  render(<DictionaryView />);
  await user.type(screen.getByLabelText('Character or pinyin'), 'shi{Enter}');
  const card = await screen.findByRole('button', { name: 'View details for 世' });
  await user.click(card);
  const panel = await screen.findByRole('dialog', { name: '世 Character details' });
  expect(await within(panel).findByText('Depicts leaves on branches.')).toBeInTheDocument();
  expect(within(panel).getByText('world')).toBeInTheDocument();
  expect(card).toHaveAttribute('aria-pressed', 'true');
  expect(fetch.mock.lastCall![0]).toBe('/api/dictionary/characters/%E4%B8%96');
  await user.click(within(panel).getByRole('button', { name: 'Close character details' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(card).toHaveFocus();
  expect(screen.getByLabelText('Character or pinyin')).toHaveValue('shi');
  await user.click(card);
  await screen.findByRole('dialog');
  // Exercise the Escape handler when focus is within the panel.
  screen.getByRole('button', { name: 'Close character details' }).focus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('opens a bookmarkable full entry and returns to the previous results', async () => {
  mockApi();
  const user = userEvent.setup();
  render(<DictionaryView />);
  await user.type(screen.getByLabelText('Character or pinyin'), 'shi{Enter}');
  await user.click(await screen.findByRole('button', { name: 'View details for 世' }));
  await user.click(await screen.findByRole('link', { name: 'Open full details' }));
  expect(await screen.findByRole('link', { name: '← Back to results' })).toBeInTheDocument();
  expect(window.location.hash).toBe('#/dictionary/%E4%B8%96');
  expect(await screen.findByText('Dictionary sources')).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: '← Back to results' }));
  await waitFor(() => expect(screen.getByLabelText('Character or pinyin')).toBeVisible());
  expect(screen.getByLabelText('Character or pinyin')).toHaveValue('shi');
  expect(screen.getByRole('button', { name: 'View details for 世' })).toBeInTheDocument();
});

test('supports direct entry links, sparse details, missing entries, and retry', async () => {
  window.history.replaceState(null, '', '/#/dictionary/%F0%A0%AE%B7');
  const fetch = vi.fn()
    .mockResolvedValueOnce({ ok: false, status: 404 })
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      ...details, character: '𠮷', pinyin: '', gloss: null, codepoint: null,
      stroke_count: null, hsk_level: null, original_meaning: null, hint: null,
      movie_rank: null, book_rank: null, readings: [], words: [], variants: [], sources: [],
    }) });
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  render(<DictionaryView />);
  expect(await screen.findByRole('alert')).toHaveTextContent('not in the dictionary');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No definition available.')).toBeInTheDocument();
  expect(screen.getByText('Usage data is not available for this character.')).toBeInTheDocument();
});

test('ignores late details when another character is selected', async () => {
  let resolve!: (value: unknown) => void;
  const fetch = vi.fn().mockImplementation(async (url: string) => {
    if (url.includes('/search?')) return { ok: true, json: async () => ({
      results: [details, { ...details, character: '事' }], limit: 50,
    }) };
    if (url.endsWith('%E4%B8%96')) return new Promise(done => { resolve = done; });
    return { ok: true, json: async () => ({ ...details, character: '事', gloss: 'matter' }) };
  });
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  render(<DictionaryView />);
  await user.type(screen.getByLabelText('Character or pinyin'), 'shi{Enter}');
  await user.click(await screen.findByRole('button', { name: 'View details for 世' }));
  const signal = fetch.mock.lastCall![1].signal as AbortSignal;
  await user.click(screen.getByRole('button', { name: 'View details for 事' }));
  expect(await within(screen.getByRole('dialog')).findByText('matter')).toBeInTheDocument();
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ok: true, json: async () => details }));
  expect(within(screen.getByRole('dialog')).queryByText('generation')).not.toBeInTheDocument();
});
