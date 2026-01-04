export interface SearchResult {
  text: string;
  groundingMetadata?: GroundingMetadata;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  groundingSupports?: any[];
  webSearchQueries?: string[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface SearchState {
  query: string;
  loading: boolean;
  result: SearchResult | null;
  error: string | null;
}
