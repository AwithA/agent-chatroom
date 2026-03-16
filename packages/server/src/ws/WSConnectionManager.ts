import WebSocket from 'ws';

export class WSConnectionManager {
  private connections: Map<string, WebSocket> = new Map();

  addConnection(connectionId: string, ws: WebSocket): void {
    this.connections.set(connectionId, ws);
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  getConnection(connectionId: string): WebSocket | undefined {
    return this.connections.get(connectionId);
  }

  sendToConnection(connectionId: string, data: any): boolean {
    const ws = this.connections.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  broadcast(connectionIds: string[], data: any): void {
    const message = JSON.stringify(data);
    connectionIds.forEach(connectionId => {
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  getAllConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }
}
