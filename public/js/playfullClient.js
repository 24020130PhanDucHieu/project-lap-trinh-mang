/**
 * PlayFull Multiplayer & Tournament Client SDK
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

    // Tournament state
    this.isTournament = false;
    this.tournamentData = null;
    this.activeTableId = 1;
    this.myTableId = null;
    this.myColor = null;
  }

  init(serverUrl) {
    if (this.socket) return this;

    if (typeof io === 'undefined') {
      console.warn('Socket.io library is not loaded!');
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

    // Standard Room Events
    this.socket.on('joined_game_success', (data) => {
      this.isTournament = false;
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

    // ==========================================
    // Tournament Events (4 Bàn - 8 Tuyển thủ)
    // ==========================================
    this.socket.on('tournament_joined_success', (data) => {
      this.isTournament = true;
      this.role = data.role;
      this.myColor = data.assignedColor;
      this.myTableId = data.assignedTableId;
      this.activeTableId = data.assignedTableId || 1;
      this.playerName = data.playerName;
      this.tournamentData = data.tournament;
      this.spectatorCount = data.tournament.spectatorCount;
      this.trigger('tournament_joined_success', data);
    });

    this.socket.on('tournament_state_updated', (data) => {
      if (this.tournamentData) {
        this.tournamentData.tables = data.tables;
        this.tournamentData.spectatorCount = data.spectatorCount;
      }
      this.spectatorCount = data.spectatorCount;
      this.trigger('tournament_state_updated', data);
    });

    this.socket.on('tournament_move_performed', (data) => {
      if (this.tournamentData) {
        const table = this.tournamentData.tables.find(t => t.id === data.tableId);
        if (table) table.gameState = data.gameState;
      }
      this.trigger('tournament_move_performed', data);
    });

    this.socket.on('tournament_table_reset', (data) => {
      if (this.tournamentData) {
        const table = this.tournamentData.tables.find(t => t.id === data.tableId);
        if (table) table.gameState = data.gameState;
      }
      this.trigger('tournament_table_reset', data);
    });

    this.socket.on('tournament_new_chat', (data) => {
      this.trigger('tournament_new_chat', data);
    });

    this.socket.on('tournament_floating_reaction', (data) => {
      this.trigger('tournament_floating_reaction', data);
    });

    return this;
  }

  // Standard Room
  joinRoom({ roomCode = '1000', playerName = 'Khách', role = 'auto', layout = 'frontline' }) {
    if (!this.socket) this.init();
    this.socket.emit('join_game', {
      roomCode: roomCode.trim().toUpperCase(),
      playerName: playerName.trim(),
      role,
      layout
    });
  }

  makeMove(from, to) {
    if (!this.socket) return;
    if (this.isTournament) {
      this.socket.emit('tournament_client_move', {
        tableId: this.myTableId || this.activeTableId,
        from,
        to
      });
    } else {
      this.socket.emit('client_move', {
        roomCode: this.roomCode,
        from,
        to
      });
    }
  }

  resetGame(layout = 'frontline') {
    if (!this.socket) return;
    if (this.isTournament) {
      this.socket.emit('tournament_reset_table', {
        tableId: this.activeTableId
      });
    } else {
      this.socket.emit('client_reset_game', {
        roomCode: this.roomCode,
        layout
      });
    }
  }

  sendChat(text) {
    if (!this.socket || !text.trim()) return;
    if (this.isTournament) {
      this.socket.emit('tournament_send_chat', {
        text,
        tableId: this.activeTableId
      });
    } else {
      this.socket.emit('client_send_chat', {
        roomCode: this.roomCode,
        text
      });
    }
  }

  sendReaction(emoji) {
    if (!this.socket) return;
    if (this.isTournament) {
      this.socket.emit('tournament_send_reaction', {
        emoji,
        tableId: this.activeTableId
      });
    } else {
      this.socket.emit('client_send_reaction', {
        roomCode: this.roomCode,
        emoji
      });
    }
  }

  // Tournament
  joinTournament({ playerName = 'Tuyển thủ', role = 'spectator', tableId = 1, color = 'auto' }) {
    if (!this.socket) this.init();
    this.socket.emit('join_tournament', {
      playerName: playerName.trim(),
      role,
      tableId,
      color
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

window.PlayFull = new PlayFullClient();
