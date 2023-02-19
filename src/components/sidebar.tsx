import React, { useEffect } from "react";
import { GraphData } from "react-force-graph-2d";
import { Sidebar, Menu, MenuItem, useProSidebar, SubMenu } from "react-pro-sidebar";
import { Graph, Vertice } from "../types";


interface SidebarProps {
    graph?: GraphData
    // TODO why does the passed reference is null but using the function directly works fine? 
    ref: any
    centerAt(x: number | undefined, y:number | undefined): void
}

// const FCWithRef
// type FCWithRec<GraphData>
// type 
// type FCWithRef<GraphData

const CustomSideBar: React.FC<SidebarProps> = ({ graph, ref, centerAt}) => {
    console.log('ici', graph?.nodes);
    console.log(ref);
    const result: Array<JSX.Element>= graph !== undefined ? 
        graph.nodes.map(node => 
            <MenuItem
            onClick={() => centerAt(node.x, node.y)}>
            <p> { node.id }</p>
            </MenuItem>
        ) : [<></>];

    return <Sidebar style={{ height: "100vh", position: "absolute" }}>
        <Menu>
            <SubMenu label="Characters">
                {  result }
            </SubMenu>
        </Menu>
    </Sidebar>
};

export default CustomSideBar;
