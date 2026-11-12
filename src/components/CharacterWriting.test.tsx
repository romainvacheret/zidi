import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { CharacterDetails } from '../dictionary';
import CharacterWriting from './CharacterWriting';

const data: CharacterDetails = {
  character: '好', pinyin: 'hǎo', gloss: 'good', codepoint: 'U+597D', stroke_count: 2,
  original_meaning: null, hint: null, hsk_level: 1, movie_rank: 15, book_rank: 82,
  readings: ['hǎo'], words: [], variants: [], sources: ['makemeahanzi'],
  components: [{ character: '女', roles: ['meaning'], hint: null }, { character: '子', roles: ['meaning'], hint: null }],
  stroke_data: {
    source: 'makemeahanzi', strokes: ['M 100 600 L 200 600 L 200 650 Z', 'M 500 600 L 700 600 L 700 650 Z'],
    medians: [[[100, 625], [200, 625]], [[500, 625], [700, 625]]], component_indices: [0, 1],
  },
};

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test('steps, scrubs and resets the ordered stroke display', async () => {
  const user = userEvent.setup();
  render(<CharacterWriting data={data} />);
  expect(screen.getByRole('img', { name: 'Stroke order for 好' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('2 of 2 strokes');
  await user.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByRole('status')).toHaveTextContent('0 of 2 strokes');
  expect(screen.getByRole('button', { name: 'Previous stroke' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Next stroke' }));
  expect(screen.getByRole('status')).toHaveTextContent('1 of 2 strokes');
  fireEvent.change(screen.getByRole('slider', { name: 'Stroke progress' }), { target: { value: '2' } });
  expect(screen.getByRole('button', { name: 'Next stroke' })).toBeDisabled();
});

test('plays, pauses, changes speed and completes the stroke animation', () => {
  vi.useFakeTimers();
  render(<CharacterWriting data={data} />);
  fireEvent.click(screen.getByRole('button', { name: 'Play stroke order' }));
  act(() => vi.advanceTimersByTime(400));
  expect(screen.getByRole('status')).toHaveTextContent('Drawing stroke 1 of 2');
  fireEvent.click(screen.getByRole('button', { name: 'Pause stroke order' }));
  const paused = screen.getByRole('status').textContent;
  act(() => vi.advanceTimersByTime(1500));
  expect(screen.getByRole('status')).toHaveTextContent(paused!);
  fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Play stroke order' }));
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByRole('status')).toHaveTextContent('2 of 2 strokes');
  expect(screen.getByRole('button', { name: 'Play stroke order' })).toBeInTheDocument();
});

test('colors components consistently and highlights the selected part', async () => {
  const user = userEvent.setup();
  render(<CharacterWriting data={data} />);
  const glyph = screen.getByRole('img', { name: 'Component decomposition of 好' });
  const paths = glyph.querySelectorAll('g > path');
  expect(paths[0].getAttribute('fill')).not.toBe(paths[1].getAttribute('fill'));
  await user.click(screen.getByRole('button', { name: 'Highlight component 女' }));
  expect(paths[0]).toHaveAttribute('opacity', '1');
  expect(paths[1]).toHaveAttribute('opacity', '0.15');
  expect(screen.getByRole('link', { name: 'Open component 子' })).toHaveAttribute('href', '#/dictionary/%E5%AD%90');
  await user.click(screen.getByRole('button', { name: 'Highlight component 女' }));
  expect(paths[1]).toHaveAttribute('opacity', '1');
});

test('handles absent data, unmapped components and reduced motion accessibly', () => {
  const first = render(<CharacterWriting data={{ ...data, stroke_data: null }} />);
  expect(screen.getByText('Stroke-order data is not available for this character.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Highlight component 女' })).toBeDisabled();
  first.unmount();
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<CharacterWriting data={{ ...data, stroke_data: { ...data.stroke_data!, component_indices: [null, null] } }} />);
  expect(screen.getByRole('button', { name: 'Play stroke order' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Previous stroke' })).toBeEnabled();
  expect(screen.getByText(/Component-to-stroke mapping is unavailable/)).toBeInTheDocument();
  expect(within(screen.getByRole('img', { name: 'Component decomposition of 好' })).queryByRole('button')).not.toBeInTheDocument();
});
