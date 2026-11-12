import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import type { ForceGraphProps } from 'react-force-graph-2d';
import type { GraphNode } from './types';
import App from './App';

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
      useImperativeHandle(ref, () => ({ centerAt, zoomToFit }));
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

const observers = new Map<Element, { callback: ResizeObserverCallback; observer: ResizeObserver }>();

beforeEach(() => {
  vi.clearAllMocks();
  observers.clear();
  simulation.ready = true;
  vi.stubGlobal('ResizeObserver', class implements ResizeObserver {
    constructor(private callback: ResizeObserverCallback) {}
    observe(target: Element) {
      observers.set(target, { callback: this.callback, observer: this });
      this.callback([resizeEntry(target, 1000, 700)], this);
    }
    unobserve(target: Element) { observers.delete(target); }
    disconnect() { observers.clear(); }
  });
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
  await screen.findByLabelText('Character graph');
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
  await screen.findByLabelText('Character graph');
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

// App holds a module-level vocabulary graph. A fresh mount must not inherit
// the old renderer's mutated coordinates or link endpoints.
test('isolates renderer mutations across application mounts', async () => {
  const first = render(<App />);
  await screen.findByLabelText('Character graph');
  const previous = rendererProps().graphData!;
  first.unmount();
  simulation.ready = false;
  render(<App />);
  await screen.findByLabelText('Character graph');
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
  await user.type(screen.getByLabelText('Character or pinyin'), 'shi');
  screen.getByRole('tab', { name: 'Dictionary' }).focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab', { name: 'Graph' })).toHaveFocus();
  expect(screen.getByRole('button', { name: '爱' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('tab', { name: 'Dictionary' }));
  expect(screen.getByLabelText('Character or pinyin')).toHaveValue('shi');
});
