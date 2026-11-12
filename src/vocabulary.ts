import hsk1 from './hsk1.json';
import hsk2 from './hsk2.json';
import hsk3 from './hsk3.json';
import { toGraph } from './graph';

export const vocabularyGraph = toGraph([...hsk1, ...hsk2, ...hsk3]);
export const vocabularyNodes = new Map(vocabularyGraph.nodes.map(node => [node.id, node]));
