export interface Vertice {
	id: string
	index?: number
}

export interface Edge {
	source: string
	target: string
}

export interface Graph {
	nodes: Array<Vertice>
	links: Array<Edge>
}

export interface VocabularyElement {
	text: string,
	pronunciation: string,
	description: string
}

