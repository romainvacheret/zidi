import React from "react";
import { GraphData } from "react-force-graph-2d";
import { Sidebar, Menu, MenuItem, SubMenu } from "react-pro-sidebar";

interface SidebarProps {
    graph?: GraphData
    centerAt(x: number | undefined, y:number | undefined): void
}

const CustomSideBar: React.FC<SidebarProps> = ({ graph, centerAt }) => {
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
                { result }
            </SubMenu>
        </Menu>
    </Sidebar>
};

export default CustomSideBar;
