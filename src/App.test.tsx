import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ForceGraphProps } from 'react-force-graph-2d';
import type { GraphNode } from './types';
import App from './App';
import { getGraphVocabulary } from './vocabulary';

const { centerAt, zoomToFit, receivedProps, simulation } = vi.hoisted(() => ({
  centerAt: vi.fn(),
  zoomToFit: vi.fn(),
  receivedProps: vi.fn(),
  simulation: { ready: true },
}));

// Exercise the real app, selection, sizing, and sidebar. Only the canvas/force
// engine is substituted because jsdom cannot run it.
vi.mock('react-force-graph-2d', async () => {
  const { forwardRef, useEffect, useImperativeHandle } = await import('react');
  return {
    default: forwardRef(function GraphRenderer(props: ForceGraphProps<GraphNode>, ref) {
      useImperativeHandle(ref, () => ({ centerAt, zoomToFit, graph2ScreenCoords: () => ({ x: 500, y: 350 }) }));
      receivedProps(props);
      useEffect(() => {
        if (simulation.ready) {
          props.graphData?.nodes.forEach((node, index) => {
            node.x = index + 10;
            node.y = index + 20;
          });
          // Model d3 replacing link IDs with node references.
          const link = props.graphData?.links[0];
          if (link) link.source = props.graphData?.nodes.find(node => node.id === link.source);
        }
        props.onEngineTick?.();
      }, [props.graphData, props.onEngineTick]);
      return <canvas aria-label="Character graph" width={props.width} height={props.height} />;
    }),
  };
});

const graphEntries = [
  { text: '爱', pronunciation: 'ài', description: 'to love; affection' },
  { text: '爸爸', pronunciation: 'bà ba', description: 'father (informal); CL:个[ge4]' },
  { text: '女儿', pronunciation: 'nǚ ér', description: 'daughter' },
];
vi.mock('./vocabulary', async importOriginal => ({
  ...await importOriginal<typeof import('./vocabulary')>(),
  getGraphVocabulary: vi.fn(),
}));

const observers = new Map<Element, { callback: ResizeObserverCallback; observer: ResizeObserver }>();

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.clearAllMocks();
  vi.mocked(getGraphVocabulary).mockReset();
  vi.mocked(getGraphVocabulary).mockResolvedValue({ entries: graphEntries, has_more: true });
  observers.clear();
  simulation.ready = true;
  vi.stubGlobal('ResizeObserver', class implements ResizeObserver {
    private targets = new Set<Element>();
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.targets.add(target);
      observers.set(target, { callback: this.callback, observer: this });
      this.callback([resizeEntry(target, 1000, 700)], this);
    }
    unobserve(target: Element) { observers.delete(target); this.targets.delete(target); }
    disconnect() { this.targets.forEach(target => observers.delete(target)); this.targets.clear(); }
  });
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
});

function resizeEntry(target: Element, width: number, height: number): ResizeObserverEntry {
  return {
    target,
    contentRect: new DOMRect(0, 0, width, height),
    borderBoxSize: [],
    contentBoxSize: [],
    devicePixelContentBoxSize: [],
  };
}

function rendererProps(): ForceGraphProps<GraphNode> {
  return receivedProps.mock.lastCall![0];
}

test('loads the graph and centers on a sidebar selection, including repeated selection', async () => {
  const user = userEvent.setup();
  render(<StrictMode><App /></StrictMode>);

  expect(await screen.findByLabelText('Character graph')).toBeInTheDocument();
  expect(rendererProps().graphData?.links).toEqual(expect.arrayContaining([
    expect.objectContaining({ target: '爸' }),
  ]));
  const button = screen.getByRole('button', { name: '爱' });
  await user.click(button);
  expect(button).toHaveAttribute('aria-pressed', 'true');
  const node = rendererProps().graphData!.nodes.find(node => node.id === '爱')!;
  expect(centerAt).toHaveBeenLastCalledWith(node.x, node.y, 300);
  await user.click(button);
  expect(centerAt).toHaveBeenCalledTimes(2);
});

test('updates selection from canvas clicks and offers a fit control', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: '爱' });
  const node = rendererProps().graphData!.nodes.find(node => node.id === '爸爸')!;
  act(() => rendererProps().onNodeClick?.(node, new MouseEvent('click')));
  expect(screen.getByRole('button', { name: '爸爸' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Fit graph' }));
  expect(zoomToFit).toHaveBeenCalledExactlyOnceWith(300, 40);
});

test('waits for simulation coordinates before focusing an early selection', async () => {
  simulation.ready = false;
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: '爱' });
  await user.click(screen.getByRole('button', { name: '爱' }));
  expect(centerAt).not.toHaveBeenCalled();
  const node = rendererProps().graphData!.nodes.find(node => node.id === '爱')!;
  node.x = 0;
  node.y = 25;
  act(() => rendererProps().onEngineTick?.());
  expect(centerAt).toHaveBeenCalledExactlyOnceWith(0, 25, 300);
  act(() => rendererProps().onEngineTick?.());
  expect(centerAt).toHaveBeenCalledTimes(1);
});

test('resizes the canvas without recreating simulation data and disconnects on unmount', async () => {
  const { unmount } = render(<App />);
  await screen.findByRole('button', { name: '爱' });
  const canvas = await screen.findByLabelText('Character graph');
  expect(canvas).toHaveAttribute('width', '1000');
  const graphData = rendererProps().graphData;
  act(() => {
    for (const [element, { callback, observer }] of observers) {
      callback([resizeEntry(element, 640, 480)], observer);
    }
  });
  await waitFor(() => expect(canvas).toHaveAttribute('width', '640'));
  expect(canvas).toHaveAttribute('height', '480');
  expect(rendererProps().graphData).toBe(graphData);
  unmount();
  expect(observers.size).toBe(0);
});

// A fresh mount must not inherit the old renderer's mutated coordinates or link endpoints.
test('isolates renderer mutations across application mounts', async () => {
  const first = render(<App />);
  await screen.findByRole('button', { name: '爱' });
  const previous = rendererProps().graphData!;
  first.unmount();
  simulation.ready = false;
  render(<App />);
  await screen.findByRole('button', { name: '爱' });
  const current = rendererProps().graphData!;
  expect(current.nodes).not.toBe(previous.nodes);
  expect(current.nodes[0].x).toBeUndefined();
  expect(typeof current.links[0].source).toBe('string');
});

test('switches feature tabs with mouse and keyboard while retaining graph selection', async () => {
  const user = userEvent.setup();
  render(<App />);
  const node = await screen.findByRole('button', { name: '爱' });
  await user.click(node);
  await user.click(screen.getByRole('tab', { name: 'Dictionary' }));
  expect(screen.getByRole('heading', { name: 'Dictionary' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Fit graph' })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('Chinese or pinyin'), 'shi');
  screen.getByRole('tab', { name: 'Dictionary' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Graph' })).toHaveFocus();
  expect(screen.getByRole('button', { name: '爱' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('tab', { name: 'Dictionary' }));
  expect(screen.getByLabelText('Chinese or pinyin')).toHaveValue('shi');
});

test('shows a clickable word tooltip, opens its entry, and returns to the centered graph', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: '爱' });
  const node = rendererProps().graphData!.nodes.find(node => node.id === '爸爸')!;
  act(() => rendererProps().onNodeClick?.(node, new MouseEvent('click')));
  const preview = screen.getByRole('complementary', { name: 'Selected graph entry' });
  expect(within(preview).getByText('bà ba')).toBeInTheDocument();
  expect(within(preview).getByText('father (informal)')).toBeInTheDocument();
  await user.click(within(preview).getByRole('link', { name: 'Open details for 爸爸' }));
  expect(await screen.findByRole('heading', { name: '爸爸 Word details' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Open details for 爸' })).toBeInTheDocument();
  centerAt.mockClear();
  await user.click(screen.getByRole('link', { name: 'View in graph' }));
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Graph' })).toHaveAttribute('aria-selected', 'true'));
  expect(screen.getByRole('button', { name: '爸爸' })).toHaveAttribute('aria-pressed', 'true');
  expect(centerAt).toHaveBeenLastCalledWith(node.x, node.y, 300);
  const again = screen.getByRole('complementary', { name: 'Selected graph entry' });
  await user.click(within(again).getByRole('button', { name: 'Close graph tooltip' }));
  expect(screen.queryByRole('complementary', { name: 'Selected graph entry' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '爸爸' }));
  expect(screen.getByRole('complementary', { name: 'Selected graph entry' })).toBeVisible();
  act(() => rendererProps().onBackgroundClick?.(new MouseEvent('click')));
  expect(screen.queryByRole('complementary', { name: 'Selected graph entry' })).not.toBeInTheDocument();
});

test('opens a character entry from the tooltip and navigates back to its graph selection', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    character: '爱', pinyin: 'ài', gloss: 'love', codepoint: 'U+7231', stroke_count: 10,
    original_meaning: null, hint: null, hsk_level: 1, movie_rank: 100, book_rank: 90,
    readings: ['ài'], components: [], words: [], variants: [], sources: [],
  }) }));
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: '爱' }));
  const preview = screen.getByRole('complementary', { name: 'Selected graph entry' });
  expect(within(preview).getByText('ài')).toBeInTheDocument();
  expect(within(preview).getByText('to love')).toBeInTheDocument();
  await user.click(within(preview).getByRole('link', { name: 'Open details for 爱' }));
  expect(await screen.findByRole('heading', { name: '爱 Character details' })).toBeVisible();
  await user.click(await screen.findByRole('link', { name: 'View in graph' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '爱' })).toHaveAttribute('aria-pressed', 'true'));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('complementary', { name: 'Selected graph entry' })).not.toBeInTheDocument();
});

test('centers an external dictionary character after coordinates initialize without losing HSK nodes', async () => {
  window.history.replaceState(null, '', '/#/graph/%F0%A0%AE%B7');
  simulation.ready = false;
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    character: '𠮷', readings: ['jí'], pinyin: 'jí', gloss: 'lucky',
  }) });
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  await screen.findByRole('button', { name: '爱' });
  expect(screen.getByRole('button', { name: '𠮷' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '爱' })).toBeInTheDocument();
  expect(centerAt).not.toHaveBeenCalled();
  const node = rendererProps().graphData!.nodes.find(node => node.id === '𠮷')!;
  node.x = 0; node.y = 42;
  act(() => rendererProps().onEngineTick?.());
  expect(centerAt).toHaveBeenCalledExactlyOnceWith(0, 42, 300);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/dictionary/characters/%F0%A0%AE%B7', expect.anything()));
});

test('adds a dictionary word outside HSK with its constituent links', async () => {
  window.history.replaceState(null, '', '/#/graph/%E6%95%B0%E6%8D%AE%E5%BA%93');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
    character: '数据库', readings: ['shù jù kù'], pinyin: 'shù jù kù', gloss: 'database',
  }) }));
  render(<App />);
  await screen.findByRole('button', { name: '爱' });
  expect(screen.getByRole('button', { name: '数据库' })).toHaveAttribute('aria-pressed', 'true');
  expect(rendererProps().graphData?.links).toEqual(expect.arrayContaining([
    expect.objectContaining({ target: '数' }), expect.objectContaining({ target: '据' }), expect.objectContaining({ target: '库' }),
  ]));
  expect(await screen.findByText('shù jù kù')).toBeInTheDocument();
});

test('filters sidebar entries by Chinese, pinyin and English without changing the graph', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: '爱' });
  const graphData = rendererProps().graphData;
  const search = screen.getByRole('searchbox', { name: 'Search graph' });
  for (const query of ['爸爸', 'bà ba', 'baba', 'ba4 ba', 'father (informal)']) {
    await user.clear(search);
    await user.type(search, query);
    expect(screen.getByRole('button', { name: '爸爸' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '爱' })).not.toBeInTheDocument();
    expect(rendererProps().graphData).toBe(graphData);
  }
  await user.click(screen.getByRole('button', { name: '爸爸' }));
  const node = graphData!.nodes.find(node => node.id === '爸爸')!;
  expect(centerAt).toHaveBeenLastCalledWith(node.x, node.y, 300);
  expect(screen.getByRole('button', { name: '爸爸' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Clear graph search' }));
  expect(search).toHaveFocus();
  expect(search).toHaveValue('');
  expect(screen.getByRole('button', { name: '爱' })).toBeInTheDocument();
  await user.type(search, 'no-matching-vocabulary');
  expect(screen.getByText('No matching entries. Try another search.')).toBeInTheDocument();
  expect(screen.getByText(/0 of \d+ entries/)).toBeInTheDocument();
  expect(rendererProps().graphData).toBe(graphData);
});

test('sidebar pinyin filtering supports umlauts and retains its query across feature tabs', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: '女儿' });
  const search = screen.getByRole('searchbox', { name: 'Search graph' });
  for (const query of ['nǚ ér', 'nv er', 'nü er', 'nv3 er2']) {
    await user.clear(search);
    await user.type(search, query);
    expect(screen.getByRole('button', { name: '女儿' })).toBeInTheDocument();
  }
  await user.click(screen.getByRole('tab', { name: 'Dictionary' }));
  await user.click(screen.getByRole('tab', { name: 'Graph' }));
  expect(search).toHaveValue('nv3 er2');
  expect(screen.getByRole('button', { name: '女儿' })).toBeInTheDocument();
});


test('requests bounded vocabulary when level and word limit change', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: '爱' });
  expect(getGraphVocabulary).toHaveBeenLastCalledWith(1, 200, expect.any(AbortSignal));
  await user.selectOptions(screen.getByLabelText('HSK level'), '3');
  await waitFor(() => expect(getGraphVocabulary).toHaveBeenLastCalledWith(3, 200, expect.any(AbortSignal)));
  await user.selectOptions(screen.getByLabelText('Word limit'), '50');
  await waitFor(() => expect(getGraphVocabulary).toHaveBeenLastCalledWith(3, 50, expect.any(AbortSignal)));
});

test('expands a selected character in batches, retaining existing nodes', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: '爱' }));
  vi.mocked(getGraphVocabulary).mockResolvedValueOnce({
    entries: [{ text: '爱好', pronunciation: 'ài hào', description: 'hobby' }], has_more: false,
  });
  await user.click(screen.getByRole('button', { name: 'Expand 爱 (+20 words)' }));
  expect(await screen.findByRole('button', { name: '爱好' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '爸爸' })).toBeInTheDocument();
  expect(getGraphVocabulary).toHaveBeenLastCalledWith(1, 20, expect.any(AbortSignal), '爱', expect.arrayContaining(['爱', '爸爸']));
});

test('offers retry after a graph loading failure', async () => {
  vi.mocked(getGraphVocabulary).mockRejectedValueOnce(new Error('Graph unavailable'));
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Graph unavailable');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: '爱' })).toBeInTheDocument();
});

test('ignores an obsolete level response after a newer selection loads', async () => {
  let resolveOld!: (value: { entries: typeof graphEntries; has_more: boolean }) => void;
  vi.mocked(getGraphVocabulary).mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
  const user = userEvent.setup();
  render(<App />);
  await user.selectOptions(screen.getByLabelText('HSK level'), '2');
  await screen.findByRole('button', { name: '爱' });
  await act(async () => resolveOld({ entries: [{ text: '旧', pronunciation: 'jiù', description: 'old' }], has_more: false }));
  expect(screen.queryByRole('button', { name: '旧' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '爱' })).toBeInTheDocument();
});
