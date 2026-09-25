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

// In-memory room storage
const rooms = new Map();

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

// Explicit route for playfull.html
app.get('/playfull.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/playfull.html'));
});

// Helper: create or get room
function getOrCreateRoom(code, options = {}) {
  const normalizedCode = (code || 'GLOBAL').trim().toUpperCase();
  if (!rooms.has(normalizedCode)) {
    const layout = options.layout || 'frontline';
    const initialBoard = gameLogic.createInitialBoard(layout);
    const pieceCounts = gameLogic.countPieces(initialBoard);

    rooms.set(normalizedCode, {
      code: normalizedCode,
      title: options.title || `Trận Đấu ${normalizedCode}`,
      layout,
      createdAt: Date.now(),
      players: {
        red: null,   // { id, name, connected }
        blue: null   // { id, name, connected }
      },
      spectators: new Map(), // socketId -> { name, joinedAt }
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

// Socket.IO real-time multiplayer & 100+ spectator engine
io.on('connection', (socket) => {
  let currentRoomCode = null;
  let currentRole = null; // 'red', 'blue', or 'spectator'
  let currentName = 'Khách';

  // Join Room Event
  socket.on('join_game', ({ roomCode = 'GLOBAL', playerName = 'Người chơi', role = 'auto', layout = 'frontline' }) => {
    const normalizedCode = roomCode.trim().toUpperCase();
    const room = getOrCreateRoom(normalizedCode, { layout });
    currentRoomCode = normalizedCode;
    currentName = playerName.trim() || `Khách_${socket.id.slice(0, 4)}`;

    socket.join(normalizedCode);

    // Determine Role
    let assignedRole = 'spectator';

    if (role === 'red') {
      if (!room.players.red || !room.players.red.connected) {
        assignedRole = 'red';
      }
    } else if (role === 'blue') {
      if (!room.players.blue || !room.players.blue.connected) {
        assignedRole = 'blue';
      }
    } else if (role === 'spectator') {
      assignedRole = 'spectator';
    } else {
      // 'auto' mode: join as player if slot free, else spectator
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

    // System announcement message
    const roleText = assignedRole === 'red' ? 'Cầm quân ĐỎ (Player 1)' :
                     assignedRole === 'blue' ? 'Cầm quân XANH (Player 2)' :
                     'Khán giả theo dõi trận đấu (Spectator)';
    
    const sysMsg = {
      id: `sys_${Date.now()}_${Math.random()}`,
      sender: 'HỆ THỐNG',
      role: 'system',
      text: `👋 ${currentName} đã tham gia phòng với vai trò: ${roleText}`,
      timestamp: Date.now()
    };
    room.chatHistory.push(sysMsg);
    if (room.chatHistory.length > 100) room.chatHistory.shift();

    // Send full room state to the newly connected user
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

    // Broadcast room update to all participants and 100+ spectators
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

  // Client Make Move Event
  socket.on('client_move', ({ roomCode, from, to }) => {
    const normalizedCode = (roomCode || currentRoomCode || 'GLOBAL').trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) {
      socket.emit('move_error', { message: 'Phòng không tồn tại!' });
      return;
    }

    // Role check: Only player whose turn it is can move!
    const activePlayer = room.gameState.turn;
    const isRedTurn = activePlayer === gameLogic.PLAYERS.RED;
    const isCurrentSocketTurn = (isRedTurn && room.players.red && room.players.red.id === socket.id) ||
                                (!isRedTurn && room.players.blue && room.players.blue.id === socket.id);

    if (!isCurrentSocketTurn) {
      if (currentRole === 'spectator') {
        socket.emit('move_error', { message: 'Bạn đang ở chế độ Người xem (Spectator), không thể di chuyển quân!' });
      } else {
        socket.emit('move_error', { message: 'Chưa đến lượt của bạn!' });
      }
      return;
    }

    // Validate and process move with game logic engine
    const result = gameLogic.makeMove(room.gameState, from, to);
    if (!result.valid) {
      socket.emit('move_error', { message: result.error });
      return;
    }

    // Update room game state
    room.gameState = result.newState;

    // Broadcast move to ALL participants & 100+ spectators simultaneously
    io.to(normalizedCode).emit('move_performed', {
      moveRecord: result.moveRecord,
      capturedPiece: result.capturedPiece,
      gameState: room.gameState
    });

    // If game ended, broadcast victory announcement to chat
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

  // Client Reset / Rematch Event
  socket.on('client_reset_game', ({ roomCode, layout = 'frontline' }) => {
    const normalizedCode = (roomCode || currentRoomCode || 'GLOBAL').trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) return;

    // Only players can reset
    const isPlayer = (room.players.red && room.players.red.id === socket.id) ||
                     (room.players.blue && room.players.blue.id === socket.id);
    if (!isPlayer) {
      socket.emit('move_error', { message: 'Chỉ tuyển thủ mới có thể khởi động lại bàn cờ!' });
      return;
    }

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

    io.to(normalizedCode).emit('game_reset', {
      gameState: room.gameState
    });
    io.to(normalizedCode).emit('new_chat_message', resetMsg);
  });

  // Chat message event
  socket.on('client_send_chat', ({ roomCode, text }) => {
    const normalizedCode = (roomCode || currentRoomCode || 'GLOBAL').trim().toUpperCase();
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

  // Floating Emoji Reaction Event (for players and 100+ spectators)
  socket.on('client_send_reaction', ({ roomCode, emoji }) => {
    const normalizedCode = (roomCode || currentRoomCode || 'GLOBAL').trim().toUpperCase();
    const validEmojis = ['👏', '🔥', '😱', '🤯', '👑', '🎯', '🚀', '❤️', '⚔️', '🛡️'];
    if (!validEmojis.includes(emoji)) return;

    io.to(normalizedCode).emit('floating_reaction', {
      emoji,
      sender: currentName,
      role: currentRole,
      id: Math.random().toString(36).substring(2, 9)
    });
  });

  // Disconnection handler
  socket.on('disconnect', () => {
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

    // Update spectator & player status for room
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
    console.log(`📱 Truy cập trong cùng mạng Wi-Fi / LAN:`);
    localIps.forEach(ip => {
      console.log(`   👉 http://${ip}:${PORT}`);
      console.log(`   👉 http://${ip}:${PORT}/playfull.html`);
    });
  }
  console.log(`👥 Hỗ trợ phòng chơi 2 người & lên tới 100+ khán giả trực tiếp!`);
  console.log('========================================================');
});
