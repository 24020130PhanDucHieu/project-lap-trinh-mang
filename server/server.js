const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const gameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// In-memory standard rooms storage
const rooms = new Map();

// Tournament State: 4 Tables, 8 Players max, unlimited Spectators
const tournament = {
  id: 'TOURNAMENT_2026',
  title: 'GIẢI ĐẤU VÔ ĐỊCH OTTv2 - 4 BÀN THI ĐẤU CHUYÊN NGHIỆP',
  tables: [
    createTable(1, 'Bàn 1 (Trận 1)'),
    createTable(2, 'Bàn 2 (Trận 2)'),
    createTable(3, 'Bàn 3 (Trận 3)'),
    createTable(4, 'Bàn 4 (Trận 4 - Chung Kết)')
  ],
  spectators: new Map(), // socketId -> { name, joinedAt }
  chatHistory: []
};

function createTable(id, name) {
  const initialBoard = gameLogic.createInitialBoard('frontline');
  const pieceCounts = gameLogic.countPieces(initialBoard);
  return {
    id,
    name,
    players: {
      red: null,
      blue: null
    },
    gameState: {
      board: initialBoard,
      turn: gameLogic.PLAYERS.RED,
      pieceCounts,
      winner: null,
      winReason: null,
      winDescription: '',
      history: []
    }
  };
}

// Helper: Get local network IP addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// REST APIs
app.get('/api/network-ip', (req, res) => {
  const localIps = getLocalIpAddresses();
  res.json({
    port: PORT,
    localIps,
    primaryUrl: localIps.length > 0 ? `http://${localIps[0]}:${PORT}` : `http://localhost:${PORT}`
  });
});

app.get('/api/rooms', (req, res) => {
  const roomList = [];
  for (const [code, room] of rooms.entries()) {
    roomList.push({
      code,
      title: room.title || `Phòng ${code}`,
      hasRed: !!room.players.red,
      hasBlue: !!room.players.blue,
      spectatorCount: room.spectators.size,
      status: room.gameState.winner ? 'finished' : (room.players.red && room.players.blue ? 'playing' : 'waiting'),
      turn: room.gameState.turn,
      createdAt: room.createdAt
    });
  }
  res.json({ rooms: roomList });
});

// Tournament status API
app.get('/api/tournament', (req, res) => {
  const tableSummaries = tournament.tables.map(t => ({
    id: t.id,
    name: t.name,
    redPlayer: t.players.red ? t.players.red.name : null,
    bluePlayer: t.players.blue ? t.players.blue.name : null,
    winner: t.gameState.winner,
    turn: t.gameState.turn,
    moveCount: t.gameState.history.length
  }));

  const allFinished = tournament.tables.every(t => !!t.gameState.winner);
  const finishedCount = tournament.tables.filter(t => !!t.gameState.winner).length;

  res.json({
    title: tournament.title,
    spectatorCount: tournament.spectators.size,
    allFinished,
    finishedCount,
    tables: tableSummaries
  });
});

// Test helper to simulate table winners
app.post('/api/tournament/simulate-winner', (req, res) => {
  const { tableId, winner } = req.body;
  const table = tournament.tables.find(t => t.id === parseInt(tableId));
  if (!table) return res.status(404).json({ error: 'Table not found' });
  table.gameState.winner = winner;
  table.gameState.winReason = winner ? 'TOTAL_ELIMINATION' : null;
  table.gameState.winDescription = winner ? `Bên ${winner} đã thắng ván đấu!` : '';
  res.json({ success: true, tableId, winner });
});

// Explicit route for playfull.html
app.get('/playfull.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/playfull.html'));
});

// Helper: create or get standard room
function getOrCreateRoom(code, options = {}) {
  const normalizedCode = (code || '1000').trim().toUpperCase();
  if (!rooms.has(normalizedCode)) {
    const layout = options.layout || 'frontline';
    const initialBoard = gameLogic.createInitialBoard(layout);
    const pieceCounts = gameLogic.countPieces(initialBoard);

    rooms.set(normalizedCode, {
      code: normalizedCode,
      title: options.title || `Phòng ${normalizedCode}`,
      layout,
      createdAt: Date.now(),
      players: {
        red: null,
        blue: null
      },
      spectators: new Map(),
      gameState: {
        board: initialBoard,
        turn: gameLogic.PLAYERS.RED,
        pieceCounts,
        winner: null,
        winReason: null,
        winDescription: '',
        history: []
      },
      chatHistory: []
    });
  }
  return rooms.get(normalizedCode);
}

// Socket.IO real-time multiplayer & tournament engine
io.on('connection', (socket) => {
  let currentRoomCode = null;
  let currentRole = null; // 'red', 'blue', or 'spectator'
  let currentName = 'Khách';
  let isTournamentMode = false;
  let tournamentTableId = null;

  // ==========================================
  // 1. STANDARD 2-PLAYER ROOM (MÃ PHÒNG NHANH)
  // ==========================================
  socket.on('join_game', ({ roomCode = '1000', playerName = 'Người chơi', role = 'auto', layout = 'frontline' }) => {
    isTournamentMode = false;
    const normalizedCode = roomCode.trim().toUpperCase();
    const room = getOrCreateRoom(normalizedCode, { layout });
    currentRoomCode = normalizedCode;
    currentName = playerName.trim() || `NgườiChơi_${socket.id.slice(0, 4)}`;

    socket.join(normalizedCode);

    let assignedRole = 'spectator';
    if (role === 'red') {
      if (!room.players.red || !room.players.red.connected) assignedRole = 'red';
    } else if (role === 'blue') {
      if (!room.players.blue || !room.players.blue.connected) assignedRole = 'blue';
    } else if (role === 'spectator') {
      assignedRole = 'spectator';
    } else {
      if (!room.players.red || !room.players.red.connected) {
        assignedRole = 'red';
      } else if (!room.players.blue || !room.players.blue.connected) {
        assignedRole = 'blue';
      } else {
        assignedRole = 'spectator';
      }
    }

    currentRole = assignedRole;

    if (assignedRole === 'red') {
      room.players.red = { id: socket.id, name: currentName, connected: true };
    } else if (assignedRole === 'blue') {
      room.players.blue = { id: socket.id, name: currentName, connected: true };
    } else {
      room.spectators.set(socket.id, { name: currentName, joinedAt: Date.now() });
    }

    const roleText = assignedRole === 'red' ? 'Quân ĐỎ (Player 1)' :
                     assignedRole === 'blue' ? 'Quân XANH (Player 2)' :
                     'Khán giả theo dõi (Spectator)';
    
    const sysMsg = {
      id: `sys_${Date.now()}_${Math.random()}`,
      sender: 'HỆ THỐNG',
      role: 'system',
      text: `👋 ${currentName} đã vào phòng [${normalizedCode}] với vai trò: ${roleText}`,
      timestamp: Date.now()
    };
    room.chatHistory.push(sysMsg);
    if (room.chatHistory.length > 100) room.chatHistory.shift();

    socket.emit('joined_game_success', {
      roomCode: normalizedCode,
      role: assignedRole,
      playerName: currentName,
      gameState: room.gameState,
      players: {
        red: room.players.red ? { name: room.players.red.name, connected: room.players.red.connected } : null,
        blue: room.players.blue ? { name: room.players.blue.name, connected: room.players.blue.connected } : null
      },
      spectatorCount: room.spectators.size,
      chatHistory: room.chatHistory
    });

    io.to(normalizedCode).emit('room_state_updated', {
      players: {
        red: room.players.red ? { name: room.players.red.name, connected: room.players.red.connected } : null,
        blue: room.players.blue ? { name: room.players.blue.name, connected: room.players.blue.connected } : null
      },
      spectatorCount: room.spectators.size,
      status: room.gameState.winner ? 'finished' : (room.players.red && room.players.blue ? 'playing' : 'waiting')
    });

    io.to(normalizedCode).emit('new_chat_message', sysMsg);
  });

  socket.on('client_move', ({ roomCode, from, to }) => {
    const normalizedCode = (roomCode || currentRoomCode || '1000').trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) {
      socket.emit('move_error', { message: 'Phòng không tồn tại!' });
      return;
    }

    // Role check: Spectators cannot move!
    if (currentRole === 'spectator') {
      socket.emit('move_error', { message: 'Bạn đang là Khán giả (Spectator), chỉ được xem trận đấu, không thể di chuyển quân!' });
      return;
    }

    const activePlayer = room.gameState.turn;
    const isRedTurn = activePlayer === gameLogic.PLAYERS.RED;
    const isCurrentSocketTurn = (isRedTurn && room.players.red && room.players.red.id === socket.id) ||
                                (!isRedTurn && room.players.blue && room.players.blue.id === socket.id);

    if (!isCurrentSocketTurn) {
      socket.emit('move_error', { message: 'Chưa đến lượt của bạn!' });
      return;
    }

    const result = gameLogic.makeMove(room.gameState, from, to);
    if (!result.valid) {
      socket.emit('move_error', { message: result.error });
      return;
    }

    room.gameState = result.newState;

    io.to(normalizedCode).emit('move_performed', {
      moveRecord: result.moveRecord,
      capturedPiece: result.capturedPiece,
      gameState: room.gameState
    });

    if (room.gameState.winner) {
      const winnerName = room.gameState.winner === gameLogic.PLAYERS.RED
        ? (room.players.red ? room.players.red.name : 'Quân ĐỎ')
        : (room.players.blue ? room.players.blue.name : 'Quân XANH');

      const victoryMsg = {
        id: `sys_win_${Date.now()}`,
        sender: 'TRỌNG TÀI',
        role: 'system',
        text: `🏆 TRẬN ĐẤU KẾT THÚC! ${winnerName} CHIẾN THẮNG! (${room.gameState.winDescription})`,
        timestamp: Date.now()
      };
      room.chatHistory.push(victoryMsg);
      io.to(normalizedCode).emit('new_chat_message', victoryMsg);
    }
  });

  socket.on('client_reset_game', ({ roomCode, layout = 'frontline' }) => {
    // SPECTATORS CANNOT RESET
    if (currentRole === 'spectator') {
      socket.emit('move_error', { message: 'Khán giả không có quyền reset ván đấu! Chỉ tuyển thủ đang thi đấu mới có quyền.' });
      return;
    }

    const normalizedCode = (roomCode || currentRoomCode || '1000').trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) return;

    const initialBoard = gameLogic.createInitialBoard(layout);
    const pieceCounts = gameLogic.countPieces(initialBoard);

    room.gameState = {
      board: initialBoard,
      turn: gameLogic.PLAYERS.RED,
      pieceCounts,
      winner: null,
      winReason: null,
      winDescription: '',
      history: []
    };

    const resetMsg = {
      id: `sys_reset_${Date.now()}`,
      sender: 'HỆ THỐNG',
      role: 'system',
      text: `🔄 Bàn cờ đã được cài đặt lại! Ván đấu mới bắt đầu, bên ĐỎ đi trước.`,
      timestamp: Date.now()
    };
    room.chatHistory.push(resetMsg);

    io.to(normalizedCode).emit('game_reset', { gameState: room.gameState });
    io.to(normalizedCode).emit('new_chat_message', resetMsg);
  });

  socket.on('client_send_chat', ({ roomCode, text }) => {
    const normalizedCode = (roomCode || currentRoomCode || '1000').trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room || !text || !text.trim()) return;

    const chatMsg = {
      id: `msg_${Date.now()}_${Math.random()}`,
      sender: currentName,
      role: currentRole,
      text: text.trim().slice(0, 200),
      timestamp: Date.now()
    };
    room.chatHistory.push(chatMsg);
    if (room.chatHistory.length > 100) room.chatHistory.shift();

    io.to(normalizedCode).emit('new_chat_message', chatMsg);
  });

  socket.on('client_send_reaction', ({ roomCode, emoji }) => {
    const normalizedCode = (roomCode || currentRoomCode || '1000').trim().toUpperCase();
    const validEmojis = ['👏', '🔥', '😱', '🤯', '👑', '🎯', '🚀', '❤️', '⚔️', '🛡️'];
    if (!validEmojis.includes(emoji)) return;

    io.to(normalizedCode).emit('floating_reaction', {
      emoji,
      sender: currentName,
      role: currentRole,
      id: Math.random().toString(36).substring(2, 9)
    });
  });

  // ========================================================
  // 2. TOURNAMENT ARENA MODE (4 BÀN - 8 TUYỂN THỦ - KHÁN GIẢ)
  // ========================================================
  socket.on('join_tournament', ({ playerName = 'Tuyển thủ', role = 'spectator', tableId = 1, color = 'auto' }) => {
    isTournamentMode = true;
    currentName = playerName.trim() || `KhánGiả_${socket.id.slice(0, 4)}`;
    socket.join('ROOM_TOURNAMENT');

    let assignedRole = 'spectator';
    let assignedTableId = parseInt(tableId) || 1;
    let assignedColor = null;

    // SPECTATORS CANNOT PARTICIPATE IN MATCHES
    if (role === 'player') {
      const table = tournament.tables.find(t => t.id === assignedTableId);
      if (table) {
        if (color === 'red' && (!table.players.red || !table.players.red.connected)) {
          assignedColor = 'red';
          assignedRole = 'player';
          table.players.red = { id: socket.id, name: currentName, connected: true };
        } else if (color === 'blue' && (!table.players.blue || !table.players.blue.connected)) {
          assignedColor = 'blue';
          assignedRole = 'player';
          table.players.blue = { id: socket.id, name: currentName, connected: true };
        } else if (color === 'auto') {
          if (!table.players.red || !table.players.red.connected) {
            assignedColor = 'red';
            assignedRole = 'player';
            table.players.red = { id: socket.id, name: currentName, connected: true };
          } else if (!table.players.blue || !table.players.blue.connected) {
            assignedColor = 'blue';
            assignedRole = 'player';
            table.players.blue = { id: socket.id, name: currentName, connected: true };
          } else {
            assignedRole = 'spectator';
          }
        }
      }
    }

    if (assignedRole === 'spectator') {
      tournament.spectators.set(socket.id, { name: currentName, joinedAt: Date.now() });
    }

    currentRole = assignedRole;
    tournamentTableId = (assignedRole === 'player') ? assignedTableId : null;

    const roleNotice = assignedRole === 'player'
      ? `Tuyển thủ ${assignedColor === 'red' ? 'ĐỎ' : 'XANH'} tại Bàn ${assignedTableId}`
      : 'Khán giả xem giải (Chế độ xem toàn cảnh 4 bàn)';

    const tourSysMsg = {
      id: `tour_sys_${Date.now()}`,
      sender: 'BAN TỔ CHỨC',
      role: 'system',
      text: `🏆 [Giải Đấu] ${currentName} đã tham gia: ${roleNotice}`,
      timestamp: Date.now()
    };
    tournament.chatHistory.push(tourSysMsg);
    if (tournament.chatHistory.length > 100) tournament.chatHistory.shift();

    socket.emit('tournament_joined_success', {
      role: assignedRole,
      assignedColor,
      assignedTableId,
      playerName: currentName,
      tournament: {
        title: tournament.title,
        tables: tournament.tables.map(t => ({
          id: t.id,
          name: t.name,
          players: {
            red: t.players.red ? { name: t.players.red.name, connected: t.players.red.connected } : null,
            blue: t.players.blue ? { name: t.players.blue.name, connected: t.players.blue.connected } : null
          },
          gameState: t.gameState
        })),
        spectatorCount: tournament.spectators.size,
        chatHistory: tournament.chatHistory
      }
    });

    io.to('ROOM_TOURNAMENT').emit('tournament_state_updated', {
      tables: tournament.tables.map(t => ({
        id: t.id,
        name: t.name,
        players: {
          red: t.players.red ? { name: t.players.red.name, connected: t.players.red.connected } : null,
          blue: t.players.blue ? { name: t.players.blue.name, connected: t.players.blue.connected } : null
        },
        gameState: t.gameState
      })),
      spectatorCount: tournament.spectators.size
    });

    io.to('ROOM_TOURNAMENT').emit('tournament_new_chat', tourSysMsg);
  });

  // Tournament Player Move (SPECTATORS CANNOT MOVE)
  socket.on('tournament_client_move', ({ tableId, from, to }) => {
    if (currentRole !== 'player') {
      socket.emit('move_error', { message: 'Khán giả chỉ có quyền xem, không được tham gia đi quân!' });
      return;
    }

    const table = tournament.tables.find(t => t.id === parseInt(tableId));
    if (!table) return;

    if (tournamentTableId !== table.id) {
      socket.emit('move_error', { message: `Bạn là tuyển thủ Bàn ${tournamentTableId}, không được đi quân tại Bàn ${table.id}!` });
      return;
    }

    const activePlayer = table.gameState.turn;
    const isRedTurn = activePlayer === gameLogic.PLAYERS.RED;
    const isTurn = (isRedTurn && table.players.red && table.players.red.id === socket.id) ||
                   (!isRedTurn && table.players.blue && table.players.blue.id === socket.id);

    if (!isTurn) {
      socket.emit('move_error', { message: 'Chưa đến lượt của bạn tại bàn này!' });
      return;
    }

    const result = gameLogic.makeMove(table.gameState, from, to);
    if (!result.valid) {
      socket.emit('move_error', { message: result.error });
      return;
    }

    table.gameState = result.newState;

    // Broadcast move to ALL viewers & players so all 4 tables update in real time!
    io.to('ROOM_TOURNAMENT').emit('tournament_move_performed', {
      tableId: table.id,
      moveRecord: result.moveRecord,
      capturedPiece: result.capturedPiece,
      gameState: table.gameState
    });

    if (table.gameState.winner) {
      const winnerName = table.gameState.winner === gameLogic.PLAYERS.RED
        ? (table.players.red ? table.players.red.name : 'Quân ĐỎ')
        : (table.players.blue ? table.players.blue.name : 'Quân XANH');

      const vicMsg = {
        id: `tour_win_${Date.now()}`,
        sender: 'TRỌNG TÀI BÀN ' + table.id,
        role: 'system',
        text: `🏆 [Bàn ${table.id}] ${winnerName} CHIẾN THẮNG! (${table.gameState.winDescription})`,
        timestamp: Date.now()
      };
      tournament.chatHistory.push(vicMsg);
      io.to('ROOM_TOURNAMENT').emit('tournament_new_chat', vicMsg);

      // Check if all 4 tables are now finished
      const allDone = tournament.tables.every(t => !!t.gameState.winner);
      if (allDone) {
        const grandFinishMsg = {
          id: `tour_all_done_${Date.now()}`,
          sender: 'BAN TỔ CHỨC',
          role: 'system',
          text: `🎉 CẢ 4 BÀN THI ĐẤU ĐÃ HOÀN TẤT! Bây giờ các tuyển thủ có thể reset để bắt đầu giải đấu mới.`,
          timestamp: Date.now()
        };
        tournament.chatHistory.push(grandFinishMsg);
        io.to('ROOM_TOURNAMENT').emit('tournament_new_chat', grandFinishMsg);
      }
    }
  });

  // Tournament Reset Mechanism:
  // MUST FINISH ALL 4 TABLES TO RESET!
  // SPECTATORS CANNOT RESET!
  socket.on('tournament_reset_all', () => {
    // 1. Spectator check
    if (currentRole !== 'player') {
      socket.emit('move_error', { message: 'Khán giả không có quyền reset giải đấu! Bạn chỉ có quyền theo dõi giải.' });
      return;
    }

    // 2. All 4 tables must be finished check
    const allFinished = tournament.tables.every(t => !!t.gameState.winner);
    if (!allFinished) {
      const finishedCount = tournament.tables.filter(t => !!t.gameState.winner).length;
      socket.emit('move_error', {
        message: `Chưa thể reset giải đấu! Hiện tại mới có ${finishedCount}/4 bàn kết thúc. Phải thi đấu xong cả 4 bàn mới được phép reset!`
      });
      return;
    }

    // Reset all 4 tables
    tournament.tables.forEach(t => {
      const initialBoard = gameLogic.createInitialBoard('frontline');
      const pieceCounts = gameLogic.countPieces(initialBoard);
      t.gameState = {
        board: initialBoard,
        turn: gameLogic.PLAYERS.RED,
        pieceCounts,
        winner: null,
        winReason: null,
        winDescription: '',
        history: []
      };
    });

    const resetMsg = {
      id: `tour_reset_${Date.now()}`,
      sender: 'BAN TỔ CHỨC',
      role: 'system',
      text: `🔄 Toàn bộ 4 bàn thi đấu đã được reset sau khi hoàn tất cả 4 trận! Vòng đấu mới bắt đầu.`,
      timestamp: Date.now()
    };
    tournament.chatHistory.push(resetMsg);

    io.to('ROOM_TOURNAMENT').emit('tournament_all_reset', {
      tables: tournament.tables.map(t => ({
        id: t.id,
        name: t.name,
        players: t.players,
        gameState: t.gameState
      }))
    });
    io.to('ROOM_TOURNAMENT').emit('tournament_new_chat', resetMsg);
  });

  // Tournament Chat & Reaction
  socket.on('tournament_send_chat', ({ text, tableId }) => {
    if (!text || !text.trim()) return;
    const chatMsg = {
      id: `tour_msg_${Date.now()}_${Math.random()}`,
      sender: currentName,
      role: currentRole,
      tableId: tableId || null,
      text: text.trim().slice(0, 200),
      timestamp: Date.now()
    };
    tournament.chatHistory.push(chatMsg);
    if (tournament.chatHistory.length > 100) tournament.chatHistory.shift();

    io.to('ROOM_TOURNAMENT').emit('tournament_new_chat', chatMsg);
  });

  socket.on('tournament_send_reaction', ({ emoji, tableId }) => {
    const validEmojis = ['👏', '🔥', '😱', '🤯', '👑', '🎯', '🚀', '❤️', '⚔️', '🛡️'];
    if (!validEmojis.includes(emoji)) return;

    io.to('ROOM_TOURNAMENT').emit('tournament_floating_reaction', {
      emoji,
      sender: currentName,
      role: currentRole,
      tableId: tableId || 1,
      id: Math.random().toString(36).substring(2, 9)
    });
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    if (isTournamentMode) {
      if (tournamentTableId) {
        const table = tournament.tables.find(t => t.id === tournamentTableId);
        if (table) {
          if (table.players.red && table.players.red.id === socket.id) table.players.red.connected = false;
          if (table.players.blue && table.players.blue.id === socket.id) table.players.blue.connected = false;
        }
      }
      tournament.spectators.delete(socket.id);

      io.to('ROOM_TOURNAMENT').emit('tournament_state_updated', {
        tables: tournament.tables.map(t => ({
          id: t.id,
          name: t.name,
          players: {
            red: t.players.red ? { name: t.players.red.name, connected: t.players.red.connected } : null,
            blue: t.players.blue ? { name: t.players.blue.name, connected: t.players.blue.connected } : null
          },
          gameState: t.gameState
        })),
        spectatorCount: tournament.spectators.size
      });
      return;
    }

    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    if (currentRole === 'red' && room.players.red && room.players.red.id === socket.id) {
      room.players.red.connected = false;
      const leaveMsg = {
        id: `sys_leave_${Date.now()}`,
        sender: 'HỆ THỐNG',
        role: 'system',
        text: `⚠️ Tuyển thủ ĐỎ (${room.players.red.name}) đã ngắt kết nối.`,
        timestamp: Date.now()
      };
      io.to(currentRoomCode).emit('new_chat_message', leaveMsg);
    } else if (currentRole === 'blue' && room.players.blue && room.players.blue.id === socket.id) {
      room.players.blue.connected = false;
      const leaveMsg = {
        id: `sys_leave_${Date.now()}`,
        sender: 'HỆ THỐNG',
        role: 'system',
        text: `⚠️ Tuyển thủ XANH (${room.players.blue.name}) đã ngắt kết nối.`,
        timestamp: Date.now()
      };
      io.to(currentRoomCode).emit('new_chat_message', leaveMsg);
    } else {
      room.spectators.delete(socket.id);
    }

    io.to(currentRoomCode).emit('room_state_updated', {
      players: {
        red: room.players.red ? { name: room.players.red.name, connected: room.players.red.connected } : null,
        blue: room.players.blue ? { name: room.players.blue.name, connected: room.players.blue.connected } : null
      },
      spectatorCount: room.spectators.size,
      status: room.gameState.winner ? 'finished' : (room.players.red && room.players.blue ? 'playing' : 'waiting')
    });
  });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log('========================================================');
  console.log(`🚀 OTTv2 MULTIPLAYER SERVER ĐANG CHẠY TẠI PORT ${PORT}`);
  console.log(`🌐 Truy cập cục bộ: http://localhost:${PORT}`);
  if (localIps.length > 0) {
    console.log(`📱 Truy cập qua mạng Wi-Fi / LAN:`);
    localIps.forEach(ip => {
      console.log(`   👉 http://${ip}:${PORT}`);
      console.log(`   👉 http://${ip}:${PORT}/playfull.html`);
    });
  }
  console.log(`🏆 Hỗ trợ: Mã phòng 2 người & Giải Đấu 4 Bàn (8 Tuyển thủ) + Khán Giả Xem Toàn Cảnh!`);
  console.log('========================================================');
});
