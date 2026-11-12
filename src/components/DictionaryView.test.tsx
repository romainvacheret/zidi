import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import DictionaryView from './DictionaryView';

afterEach(() => vi.unstubAllGlobals());

test('searches character/pinyin and English modes through HTTP and displays cards', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    results: [{ character: '世', pinyin: 'shì', gloss: 'generation', codepoint: null }], limit: 50,
  }) });
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  render(<DictionaryView />);
  await user.type(screen.getByLabelText('Character or pinyin'), 'shì{Enter}');
  expect(await screen.findByText('世')).toBeInTheDocument();
  expect(screen.getByText('generation')).toBeInTheDocument();
  expect(fetch.mock.calls[0][0]).toBe('/api/dictionary/search?q=sh%C3%AC&mode=character');
  await user.selectOptions(screen.getByLabelText('Search by'), 'translation');
  const input = screen.getByLabelText('English meaning');
  await user.clear(input);
  await user.type(input, 'law');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText('世');
  expect(fetch.mock.lastCall![0]).toBe('/api/dictionary/search?q=law&mode=translation');
});

test('shows empty results, handles errors, and allows retrying', async () => {
  const fetch = vi.fn()
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], limit: 50 }) });
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  render(<DictionaryView />);
  expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  await user.type(screen.getByLabelText('Character or pinyin'), 'unknown{Enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('backend');
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByText('No matching characters.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('ignores an obsolete response after editing the query', async () => {
  let resolve!: (value: unknown) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise(done => { resolve = done; }));
  vi.stubGlobal('fetch', fetch);
  const user = userEvent.setup();
  render(<DictionaryView />);
  const input = screen.getByLabelText('Character or pinyin');
  await user.type(input, 'shi{Enter}');
  expect(screen.getByText('Searching…')).toBeInTheDocument();
  const signal = fetch.mock.calls[0][1].signal as AbortSignal;
  await user.clear(input);
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ok: true, json: async () => ({
    results: [{ character: '世', pinyin: 'shì', gloss: null, codepoint: null }], limit: 50,
  }) }));
  await waitFor(() => expect(screen.queryByText('世')).not.toBeInTheDocument());
});
