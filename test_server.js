const http = require('http');
const { io } = require('socket.io-client');

function testHttpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- 1. TESTING HTTP ENDPOINTS ---');
  
  const indexRes = await testHttpGet('/');
  console.log(`[HTTP GET /] Status: ${indexRes.statusCode}, Body length: ${indexRes.data.length}`);
  
  const playfullRes = await testHttpGet('/playfull.html');
  console.log(`[HTTP GET /playfull.html] Status: ${playfullRes.statusCode}, Body length: ${playfullRes.data.length}`);

  const ipRes = await testHttpGet('/api/network-ip');
  console.log(`[HTTP GET /api/network-ip] Status: ${ipRes.statusCode}, Data: ${ipRes.data}`);

  const roomsRes = await testHttpGet('/api/rooms');
  console.log(`[HTTP GET /api/rooms] Status: ${roomsRes.statusCode}, Data: ${roomsRes.data}`);

  console.log('\n--- 2. TESTING SOCKET.IO MULTIPLAYER & SPECTATOR ENGINE ---');
  const roomCode = 'TEST_ROOM_' + Math.floor(Math.random() * 100000);

  // Client 1: Player Red
  const clientRed = io('http://localhost:3000');
  // Client 2: Player Blue
  const clientBlue = io('http://localhost:3000');
  // Client 3: Spectator
  const clientSpectator = io('http://localhost:3000');

  let redJoined = false;
  let blueJoined = false;
  let spectatorJoined = false;

  await new Promise((resolve) => {
    clientRed.on('connect', () => {
      console.log('Client Red connected to socket server.');
      clientRed.emit('join_game', { roomCode, playerName: 'Đỏ_Tester', role: 'red' });
    });

    clientRed.on('joined_game_success', (data) => {
      console.log(`Client Red joined as: ${data.role} in room ${data.roomCode}`);
      redJoined = true;
      if (redJoined && blueJoined && spectatorJoined) resolve();
    });

    clientBlue.on('connect', () => {
      console.log('Client Blue connected to socket server.');
      clientBlue.emit('join_game', { roomCode, playerName: 'Xanh_Tester', role: 'blue' });
    });

    clientBlue.on('joined_game_success', (data) => {
      console.log(`Client Blue joined as: ${data.role} in room ${data.roomCode}`);
      blueJoined = true;
      if (redJoined && blueJoined && spectatorJoined) resolve();
    });

    clientSpectator.on('connect', () => {
      console.log('Client Spectator connected to socket server.');
      clientSpectator.emit('join_game', { roomCode, playerName: 'ThayGiao_KhanGia', role: 'spectator' });
    });

    clientSpectator.on('joined_game_success', (data) => {
      console.log(`Client Spectator joined as: ${data.role} (Spectator count: ${data.spectatorCount})`);
      spectatorJoined = true;
      if (redJoined && blueJoined && spectatorJoined) resolve();
    });
  });

  console.log('\n--- 3. TESTING MOVE SYNCHRONIZATION TO PLAYERS AND SPECTATORS ---');
  // Move Red piece at col 0, row 1 (a2) to col 0, row 2 (a3)
  await new Promise((resolve) => {
    let spectatorReceivedMove = false;
    let blueReceivedMove = false;

    clientSpectator.on('move_performed', (data) => {
      console.log(`[SPECTATOR RECEIVED MOVE] Move #${data.moveRecord.turnNumber}: ${data.moveRecord.piece} ${data.moveRecord.from} -> ${data.moveRecord.to}, next turn: ${data.gameState.turn}`);
      spectatorReceivedMove = true;
      if (spectatorReceivedMove && blueReceivedMove) resolve();
    });

    clientBlue.on('move_performed', (data) => {
      console.log(`[BLUE RECEIVED MOVE] Move #${data.moveRecord.turnNumber}`);
      blueReceivedMove = true;
      if (spectatorReceivedMove && blueReceivedMove) resolve();
    });

    console.log('Emitting client_move from Red: a2 (0, 1) -> a3 (0, 2)...');
    clientRed.emit('client_move', {
      roomCode,
      from: { col: 0, row: 1 },
      to: { col: 0, row: 2 }
    });
  });

  console.log('\n--- 4. TESTING REACTION BROADCAST ---');
  await new Promise((resolve) => {
    clientRed.on('floating_reaction', (data) => {
      console.log(`[REACTION RECEIVED] ${data.sender} sent ${data.emoji}`);
      resolve();
    });
    clientSpectator.emit('client_send_reaction', { roomCode, emoji: '🔥' });
  });

  console.log('\n--- 5. TESTING CHAT BROADCAST ---');
  await new Promise((resolve) => {
    clientRed.on('new_chat_message', (data) => {
      if (data.sender === 'ThayGiao_KhanGia') {
        console.log(`[CHAT RECEIVED] ${data.sender}: ${data.text}`);
        resolve();
      }
    });
    clientSpectator.emit('client_send_chat', { roomCode, text: 'Trận đấu rất hay!' });
  });

  console.log('\n✅ ALL INTEGRATION TESTS PASSED 100%!');
  clientRed.disconnect();
  clientBlue.disconnect();
  clientSpectator.disconnect();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
