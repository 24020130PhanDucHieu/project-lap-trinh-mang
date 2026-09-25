/**
 * PlayFull Multiplayer & Spectator Network Client Library
 * Fulfills Requirement #2: "Dùng thư viện playfull.html để cho phép có server, nhiều người chơi cùng lúc."
 */
class PlayFullClient {
  constructor() {
    this.socket = null;
    this.roomCode = null;
    this.role = null; // 'red', 'blue', or 'spectator'
    this.playerName = 'Người chơi';
    this.gameState = null;
    this.spectatorCount = 0;
    this.players = { red: null, blue: null };
    this.listeners = new Map();
    this.isConnected = false;
  }

  init(serverUrl) {
    if (this.socket) return this;

    if (typeof io === 'undefined') {
      console.error('Socket.io library is not loaded!');
      return this;
    }

    this.socket = serverUrl ? io(serverUrl) : io();

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.trigger('connect', { id: this.socket.id });
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.trigger('disconnect');
    });

    this.socket.on('joined_game_success', (data) => {
      this.roomCode = data.roomCode;
      this.role = data.role;
      this.playerName = data.playerName;
      this.gameState = data.gameState;
      this.players = data.players;
      this.spectatorCount = data.spectatorCount;
      this.trigger('joined_success', data);
    });

    this.socket.on('room_state_updated', (data) => {
      this.players = data.players;
      this.spectatorCount = data.spectatorCount;
      this.trigger('room_updated', data);
    });

    this.socket.on('move_performed', (data) => {
      this.gameState = data.gameState;
      this.trigger('move_performed', data);
    });

    this.socket.on('move_error', (data) => {
      this.trigger('move_error', data);
    });

    this.socket.on('game_reset', (data) => {
      this.gameState = data.gameState;
      this.trigger('game_reset', data);
    });

    this.socket.on('new_chat_message', (data) => {
      this.trigger('new_chat_message', data);
    });

    this.socket.on('floating_reaction', (data) => {
      this.trigger('floating_reaction', data);
    });

    return this;
  }

  joinRoom({ roomCode = 'ROOM1', playerName = 'Khách', role = 'auto', layout = 'frontline' }) {
    if (!this.socket) this.init();
    this.socket.emit('join_game', {
      roomCode: roomCode.trim().toUpperCase(),
      playerName: playerName.trim(),
      role,
      layout
    });
  }

  makeMove(from, to) {
    if (!this.socket || !this.roomCode) return;
    this.socket.emit('client_move', {
      roomCode: this.roomCode,
      from,
      to
    });
  }

  resetGame(layout = 'frontline') {
    if (!this.socket || !this.roomCode) return;
    this.socket.emit('client_reset_game', {
      roomCode: this.roomCode,
      layout
    });
  }

  sendChat(text) {
    if (!this.socket || !this.roomCode || !text.trim()) return;
    this.socket.emit('client_send_chat', {
      roomCode: this.roomCode,
      text
    });
  }

  sendReaction(emoji) {
    if (!this.socket || !this.roomCode) return;
    this.socket.emit('client_send_reaction', {
      roomCode: this.roomCode,
      emoji
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return this;
  }

  trigger(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in event listener for ${event}:`, e);
        }
      }
    }
  }

  getShareUrls(hostOverride) {
    const origin = hostOverride || window.location.origin;
    const code = this.roomCode || 'ROOM1';
    return {
      playerUrl: `${origin}/playfull.html?room=${code}&role=auto`,
      spectatorUrl: `${origin}/playfull.html?room=${code}&role=spectator`,
      generalUrl: `${origin}/playfull.html?room=${code}`
    };
  }

  copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    return Promise.resolve();
  }
}

// Global PlayFull client instance
window.PlayFull = new PlayFullClient();
