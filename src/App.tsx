import { ForceGraph2D } from "react-force-graph";
import React from 'react';
import logo from './logo.svg';
import './App.css';
import  text from "./hsk3.json";
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

const data = toGraph(text);
console.log(data);
console.log(data.nodes);


// TODO: why is there some undefined?
data.nodes = data.nodes.filter(x => x !== undefined);
data.links = data.links.filter(x => x !== undefined);

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <ForceGraph2D
          graphData={ data }
          nodeCanvasObject={ (node, ctx) => {
            if(node.id && node.x && node.y) {
              ctx.fillText(node.id.toString(), node.x, node.y)
            }

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
