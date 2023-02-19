import { ForceGraph2D, } from "react-force-graph";
// ForceGraphMethods is only avaialble in react-force-graph-2d??
// TODO delete the full dependency and only use th 2D one
import { ForceGraphMethods } from "react-force-graph-2d";
import React from 'react';
import logo from './logo.svg';
import './App.css';
import  hsk1 from "./hsk1.json";
import  hsk2 from "./hsk2.json";
import  hsk3 from "./hsk3.json";
import { Graph } from "./types";
import { toGraph } from "./graph";
import CustomSideBar from "./components/sidebar";
import { ProSidebarProvider } from "react-pro-sidebar";

// ForceGraph2D.propTypes?.ref?.prototype
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
  const forceGraphRef = React.useRef<ForceGraphMethods | undefined>(undefined);
  
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
// data.nodes = data.nodes.filter(x => x !== undefined);
// data.links = data.links.filter(x => x !== undefined);
setData(data);

// TODO: stop the graph at the limit of the sidebar (at the moment is underneath)


}, [])
    forceGraphRef.current?.centerAt(100, 100);
console.log('laaa', forceGraphRef);
const centerAt =(x: number | undefined, y: number | undefined) => { forceGraphRef.current?.centerAt(x, y) } ;
  return (
  <ProSidebarProvider>
    <div className="App">
        <button onClick={ () => forceGraphRef.current?.centerAt(100, 100) }> HERE </button>
        <CustomSideBar graph={data} ref={forceGraphRef} centerAt={ centerAt } />
        <main>
            <ForceGraph2D
              graphData={ data }
              ref={ forceGraphRef }
              nodeCanvasObject={ ({ id, x, y}, ctx) => {
                ctx.font = '10px Sans-Serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(id?.toString() || '', x || 0, y || 0);
                // if(node.id && node.x && node.y) {
                //   ctx.fillText(node.id.toString(), node.x, node.y)
                // } else {
                //   console.log(node);
                // }

              }}

            /> 
        </main>
    </div>
    </ProSidebarProvider>
  );
}

export default App;
