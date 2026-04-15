import { WS_BASE_URL } from './api';

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const PING_INTERVAL_MS = 25000; // Client-side ping every 25s (server expects within 30s)

class MatchWebSocket {
  constructor() {
    this.ws = null;
    this.matchId = null;
    this.listeners = [];
    this.stateListeners = [];
    this.reconnectTimer = null;
    this._retryCount = 0;
    this._connected = false;
    this._lastPongAt = null;
  }

  get isConnected() {
    return this._connected;
  }

  get retryCount() {
    return this._retryCount;
  }

  connect(matchId) {
    this.matchId = matchId;
    this._notifyState();

    try {
      this.ws = new WebSocket(`${WS_BASE_URL}/ws/match/${matchId}`);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (__DEV__) console.log(`[WS] Connected to match ${matchId}`);
      this._retryCount = 0;
      this._connected = true;
      this._lastPongAt = Date.now();
      this._startPing();
      this._notifyState();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          this._lastPongAt = Date.now();
        } else {
          this.listeners.forEach((fn) => fn(data));
        }
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      if (__DEV__) console.log('[WS] Disconnected');
      this._connected = false;
      this._stopPing();
      this._notifyState();
      this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws.close();
    };
  }

  _scheduleReconnect() {
    // Infinite reconnect with capped exponential backoff
    if (!this.matchId) return;
    const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, this._retryCount), MAX_BACKOFF_MS);
    this._retryCount++;
    if (__DEV__) console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this._retryCount})`);
    this.reconnectTimer = setTimeout(() => {
      if (this.matchId) this.connect(this.matchId);
    }, delay);
  }

  // Manual reconnect (e.g., from UI "Reconnect" button)
  reconnect() {
    if (!this.matchId) return;
    this._retryCount = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.connect(this.matchId);
  }

  disconnect() {
    this.matchId = null;
    this._retryCount = 0;
    this._connected = false;
    this._stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._notifyState();
  }

  addListener(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  // Subscribe to connection state changes (connected, retryCount)
  addStateListener(fn) {
    this.stateListeners.push(fn);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== fn);
    };
  }

  _notifyState() {
    const state = { connected: this._connected, retryCount: this._retryCount, matchId: this.matchId };
    this.stateListeners.forEach((fn) => fn(state));
  }

  _startPing() {
    this._pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
        // Detect zombie connections: if no pong in 2x ping interval, reconnect
        if (this._lastPongAt && Date.now() - this._lastPongAt > PING_INTERVAL_MS * 2) {
          if (__DEV__) console.log('[WS] No pong received — forcing reconnect');
          this.ws.close();
        }
      }
    }, PING_INTERVAL_MS);
  }

  _stopPing() {
    if (this._pingInterval) clearInterval(this._pingInterval);
  }
}

export default new MatchWebSocket();
