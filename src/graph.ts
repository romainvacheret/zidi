import { Graph, Vertice, Edge, VocabularyElement } from "./types";

const _getEdgeId = (source: string, target: string): string => `${source}-${target}`;

export const toGraph = (vocabulary: Array<VocabularyElement>, graph?: Graph): Graph => {
    const texts = vocabulary.map(vocab => vocab.text);
    const vertices: Array<Vertice> = graph === undefined ? new Array() : graph.nodes;
    const edges: Array<Edge> = graph === undefined ? new Array() : graph.links;
    const verticesSet: Set<string> = new Set(vertices.map(v => v.id));
    const edgesSet: Set<string> = new Set(edges.map(e=> _getEdgeId(e.source, e.target)));

    texts.map(text => {
        if(!verticesSet.has(text)) {
            verticesSet.add(text);
            vertices.push({id: text});
        }
        Array.from(text).forEach(char => {
            const edgeId: string = _getEdgeId(text, char);

            if(!verticesSet.has(char)) {
                verticesSet.add(char);
                vertices.push({id: char});
            }

            // Do not create an edge between a single character word and itself
            if(text.length !== 1 && !edgesSet.has(edgeId))  {
                edgesSet.add(edgeId);
                edges.push({source: text, target: char});
            }
        });
    });

    return graph === undefined ? {nodes: vertices, links: edges} : graph;
}
