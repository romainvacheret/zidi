export interface Node {
	id: string
	index?: number
}

export interface Link {
	source: string
	target: string
}

export interface Data {
	nodes: Array<Node>
	links: Array<Link>
}

export interface Sentence {
	text: string,
	pronunciation: string,
	description: string
}