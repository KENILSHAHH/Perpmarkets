// Similar to nitrolite-example websocket service pattern
export type WsStatus = 'Connecting' | 'Connected' | 'Disconnected';

type StatusListener = (status: WsStatus) => void;
type MessageListener = (data: any) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private status: WsStatus = 'Disconnected';
  private statusListeners: Set<StatusListener> = new Set();
  private messageListeners: Set<MessageListener> = new Set();
  private messageQueue: string[] = [];

  public connect(url: string) {
    if (this.socket && this.socket.readyState < 2) return;

    this.updateStatus('Connecting');

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('[websocket] Connected');
      this.updateStatus('Connected');
      this.messageQueue.forEach((msg) => this.socket?.send(msg));
      this.messageQueue = [];
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.messageListeners.forEach((listener) => listener(data));
      } catch (error) {
        console.error('[websocket] Error parsing message:', error);
      }
    };

    this.socket.onclose = () => {
      this.updateStatus('Disconnected');
    };

    this.socket.onerror = () => {
      this.updateStatus('Disconnected');
    };
  }

  public send(payload: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload);
    } else {
      this.messageQueue.push(payload);
    }
  }

  private updateStatus(newStatus: WsStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((listener) => listener(this.status));
  }

  public addStatusListener(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);
  }

  public removeStatusListener(listener: StatusListener) {
    this.statusListeners.delete(listener);
  }

  public addMessageListener(listener: MessageListener) {
    this.messageListeners.add(listener);
  }

  public removeMessageListener(listener: MessageListener) {
    this.messageListeners.delete(listener);
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.updateStatus('Disconnected');
  }
}

export const webSocketService = new WebSocketService();

