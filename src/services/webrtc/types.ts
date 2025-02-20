
export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: string;
  to: string;
}

export interface FileChunkMessage {
  type: 'file-chunk';
  filename: string;
  chunk: string;
  chunkIndex: number;
  totalChunks: number;
}
