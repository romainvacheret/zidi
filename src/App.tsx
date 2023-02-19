import { ForceGraph2D, } from "react-force-graph";
// ForceGraphMethods is only avaialble in react-force-graph-2d??
// TODO delete the full dependency and only use th 2D one
import { ForceGraphMethods } from "react-force-graph-2d";
import React from 'react';
import './App.css';
import  hsk1 from "./hsk1.json";
import  hsk2 from "./hsk2.json";
import  hsk3 from "./hsk3.json";
import { Graph } from "./types";
import { toGraph } from "./graph";
import CustomSideBar from "./components/sidebar";
import { ProSidebarProvider } from "react-pro-sidebar";

// TODO: stop the graph at the limit of the sidebar (at the moment is underneath)

const App = () => {
    const [data, setData] = React.useState<Graph | undefined>(undefined);
    const forceGraphRef = React.useRef<ForceGraphMethods | undefined>(undefined);
    const centerAt = (x: number | undefined, y: number | undefined): void => { 
        forceGraphRef.current?.centerAt(x, y) 
    };
  
    React.useEffect(() => {
        const data = toGraph(hsk1);

        toGraph(hsk2, data);
        toGraph(hsk3, data);
        setData(data);
    }, [])

    return (
        <ProSidebarProvider>
        <div className="App">
            <CustomSideBar graph={data} centerAt={ centerAt } />
            <main>
                <ForceGraph2D
                    graphData={ data }
                    ref={ forceGraphRef }
                    nodeCanvasObject={ ({ id, x, y}, ctx) => {
                        ctx.font = '10px Sans-Serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(id?.toString() || '', x || 0, y || 0);
                    }}
                /> 
            </main>
        </div>
        </ProSidebarProvider>
    );
}

export default App;
