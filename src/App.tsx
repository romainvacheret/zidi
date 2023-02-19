import { ForceGraph2D } from "react-force-graph";
import React from 'react';
import logo from './logo.svg';
import './App.css';
import  hsk1 from "./hsk1.json";
import  hsk2 from "./hsk2.json";
import  hsk3 from "./hsk3.json";
import { Graph, Vertice, Edge, VocabularyElement } from "./types";

// const toGraph = (someSentences: Array<VocabularyElement>): Graph => {
// 	const set = new Set();
// 	const length = someSentences.length;
// 	const nodes: Array<Vertice> = new Array(length);
// 	const links: Array<Edge> = new Array(length);
//
//   console.log(length);
//
//   someSentences.forEach((sentence: VocabularyElement) => {
//     nodes.push( {id : sentence.text } );
// 		[...sentence.text].forEach((character: string) => {
// 			if(!set.has(character)) {
//         let y = { id: character };
//         console.log(y);
// 				nodes.push(y);
// 				set.add(character);
// 			}
//
//       if(character !== sentence.text) 
//         links.push({ 'source': character, 'target': sentence.text });
// 		});
//   });
//
// 	return { vertices: nodes, edges: links };
// }
//
// const graphToMaps = (graph:Graph): [Map<string, Vertice>, Map<string, Edge>] => {
//     const vertices = graph.nodes.map
// }
//
const getEdgeId = (source: string, target: string): string => `${source}-${target}`;


const toGraph = (vocabulary: Array<VocabularyElement>, graph?: Graph): Graph => {
    const texts = vocabulary.map(vocab => vocab.text);
    const vertices: Array<Vertice> = graph === undefined ? new Array() : graph.nodes;
    const edges: Array<Edge> = graph === undefined ? new Array() : graph.links;
    const verticesSet: Set<string> = new Set(vertices.map(v => v.id));
    const edgesSet: Set<string> = new Set(edges.map(e=> getEdgeId(e.source, e.target)));

    texts.map(text => {
        if(!verticesSet.has(text)) {
            verticesSet.add(text);
            vertices.push({id: text});
        }
        Array.from(text).forEach(char => {
            const edgeId: string = getEdgeId(text, char);

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

// const data = toGraph(hsk1);
// const data2 = toGraph(hsk2);
// const data3 = toGraph(hsk3);

// data.links = [...data.links, ...data2.links];
// data.nodes = [...data.nodes, ...data2.nodes];
// data.links = [...data.links, ...data3.links];
// data.nodes = [...data.nodes, ...data3.nodes];
// console.log(data);
// console.log(data.nodes);


// // TODO: why is there some undefined?
// data.nodes = data.nodes.filter(x => x !== undefined);
// data.links = data.links.filter(x => x !== undefined);

function App() {
  const [data, setData] = React.useState<Graph | undefined>(undefined);
  
React.useEffect(() => {
const data = toGraph(hsk1);
toGraph(hsk2, data);
toGraph(hsk3, data);

// TODO delete duplicates
// data.links = [...data.links, ...data2.links];
// data.nodes = [...data.nodes, ...data2.nodes];
// data.links = [...data.links, ...data3.links];
// data.nodes = [...data.nodes, ...data3.nodes];
console.log(data);
console.log(data.nodes);
console.log(data.nodes.filter(x => x === undefined).length)
console.log(data.links.filter(x => x === undefined).length)


// TODO: why is there some undefined?
// Is there still some undefined values?
data.nodes = data.nodes.filter(x => x !== undefined);
data.links = data.links.filter(x => x !== undefined);
setData(data);
}, [])
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />

        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
        <ForceGraph2D
          graphData={ data }
          nodeCanvasObject={ ({ id, x, y}, ctx) => {
            ctx.font = '10px Sans-Serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(id?.toString() || '', x || 0, y || 0);
            // if(node.id && node.x && node.y) {
            //   ctx.fillText(node.id.toString(), node.x, node.y)
            // } else {
            //   console.log(node);
            // }

          }}

        />
    </div>
  );
}

export default App;
