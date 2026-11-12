export interface VocabularyElement {
  readonly text: string;
  readonly pronunciation: string;
  readonly description: string;
}

export interface GraphNode {
  readonly id: string;
  readonly entries: readonly VocabularyElement[];
}

export interface GraphLink {
  readonly source: string;
  readonly target: string;
}

// Vocabulary relationships contain no force simulation or canvas state.
export interface Graph {
  readonly nodes: readonly GraphNode[];
  readonly links: readonly GraphLink[];
}

