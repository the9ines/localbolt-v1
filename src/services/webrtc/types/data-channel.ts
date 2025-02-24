
export interface DataChannel extends RTCDataChannel {
  send(data: string): void;
}
