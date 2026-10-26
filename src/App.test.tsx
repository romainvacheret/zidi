import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import type { GraphData, NodeObject } from 'react-force-graph-2d';
import App from './App';

const { centerAt, receivedGraph } = vi.hoisted(() => ({
  centerAt: vi.fn(),
  receivedGraph: vi.fn(),
}));

// jsdom cannot render the canvas or run the force simulation. Keep the real
// application and sidebar, substituting only the renderer's public boundary.
vi.mock('react-force-graph-2d', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    default: forwardRef(function GraphRenderer(
      { graphData }: { graphData?: GraphData },
      ref,
    ) {
      useImperativeHandle(ref, () => ({ centerAt }));
      receivedGraph(graphData);
      graphData?.nodes.forEach((node: NodeObject, index) => {
        node.x = index + 10;
        node.y = index + 20;
      });
      return <canvas aria-label="Character graph" />;
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('loads the vocabulary graph and centers it on a sidebar selection', async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByLabelText('Character graph')).toBeInTheDocument();
  await waitFor(() => {
    expect(receivedGraph).toHaveBeenLastCalledWith(expect.objectContaining({
      nodes: expect.arrayContaining([expect.objectContaining({ id: '爱' })]),
      links: expect.arrayContaining([
        expect.objectContaining({ source: '爸爸', target: '爸' }),
      ]),
    }));
  });

  await user.click(screen.getByText('Characters'));
  await user.click(screen.getByText('爱'));

  const graph: GraphData = receivedGraph.mock.lastCall![0];
  const selected = graph.nodes.find((node) => node.id === '爱')!;
  expect(centerAt).toHaveBeenCalledExactlyOnceWith(selected.x, selected.y);
});
