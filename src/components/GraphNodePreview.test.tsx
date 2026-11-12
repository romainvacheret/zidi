import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import GraphNodePreview from './GraphNodePreview';

afterEach(() => vi.unstubAllGlobals());

test('looks up constituent-only characters and handles missing pronunciation', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    character: '龘', pinyin: '', readings: [], gloss: 'the appearance of a dragon walking',
  }) });
  vi.stubGlobal('fetch', fetch);
  render(<GraphNodePreview node={{ id: '龘', entries: [] }} />);
  expect(await screen.findByText('the appearance of a dragon walking')).toBeInTheDocument();
  expect(screen.getByText('Pronunciation unavailable')).toBeInTheDocument();
  expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open details for 龘' })).toHaveAttribute('href', '#/dictionary/%E9%BE%98');
});

test('keeps the entry link available when the dictionary cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  render(<GraphNodePreview node={{ id: '爸', entries: [] }} />);
  expect(await screen.findByText('Details unavailable. Try opening the entry.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open details for 爸' })).toBeInTheDocument();
});
