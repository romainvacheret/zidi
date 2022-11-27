import { ForceGraph2D } from "react-force-graph";
import React from 'react';
import logo from './logo.svg';
import './App.css';
import  hsk1 from "./hsk1.json";
import  hsk2 from "./hsk2.json";
import  hsk3 from "./hsk3.json";
import { Data, Node, Link, Sentence } from "./types";


const myData = {
  nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  links: [
    { source: 'a', target: 'b' },
    { source: 'c', target: 'a' }
  ]
};



const toGraph = (someSentences: Array<Sentence>): Data => {
	const set = new Set();
	const length = someSentences.length;
	const nodes: Array<Node> = new Array(length);
	const links: Array<Link> = new Array(length);

  console.log(length);

  someSentences.forEach((sentence: Sentence) => {
    nodes.push( {id : sentence.text } );
		[...sentence.text].forEach((character: string) => {
			if(!set.has(character)) {
        let y = { id: character };
        console.log(y);
				nodes.push(y);
				set.add(character);
			}

      if(character !== sentence.text) 
        links.push({ 'source': character, 'target': sentence.text });
		});
  });

	return { nodes, links };
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
  const [data, setData] = React.useState<Data | undefined>(undefined);
  
React.useEffect(() => {
const data = toGraph(hsk1);
const data2 = toGraph(hsk2);
const data3 = toGraph(hsk3);

// TODO delete duplicates
data.links = [...data.links, ...data2.links];
data.nodes = [...data.nodes, ...data2.nodes];
data.links = [...data.links, ...data3.links];
data.nodes = [...data.nodes, ...data3.nodes];
console.log(data);
console.log(data.nodes);


// TODO: why is there some undefined?
data.nodes = data.nodes.filter(x => x !== undefined);
data.links = data.links.filter(x => x !== undefined);
setData(data);
}, [])
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />

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
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
