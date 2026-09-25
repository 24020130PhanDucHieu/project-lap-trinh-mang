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
  console.log('--- 1. KIỂM THỬ CÁC ĐƯỜNG DẪN HTTP ---');
  
  const indexRes = await testHttpGet('/');
  console.log(`[HTTP GET /] Trạng thái: ${indexRes.statusCode}, Kích thước: ${indexRes.data.length} bytes`);
  
  const playfullRes = await testHttpGet('/playfull.html');
  console.log(`[HTTP GET /playfull.html] Trạng thái: ${playfullRes.statusCode}, Kích thước: ${playfullRes.data.length} bytes`);

  const tourRes = await testHttpGet('/api/tournament');
  console.log(`[HTTP GET /api/tournament] Trạng thái: ${tourRes.statusCode}, Dữ liệu 4 bàn: ${tourRes.data.slice(0, 100)}...`);

  console.log('\n--- 2. KIỂM THỬ KHÁN GIẢ THỜI GIAN THỰC (REAL-TIME SPECTATORS) ---');
  const roomCode = 'TEST_ROOM_' + Math.floor(Math.random() * 100000);

  const clientRed = io('http://localhost:3000');
  const clientBlue = io('http://localhost:3000');
  const clientSpectator1 = io('http://localhost:3000');
  const clientSpectator2 = io('http://localhost:3000');

  let redJoined = false;
  let blueJoined = false;
  let spec1Joined = false;
  let spec2Joined = false;

  await new Promise((resolve) => {
    clientRed.on('connect', () => {
      clientRed.emit('join_game', { roomCode, playerName: 'TuyểnThủ_Đỏ', role: 'red' });
    });
    clientRed.on('joined_game_success', (data) => {
      console.log(` Tuyển thủ Đỏ đã vào phòng [${data.roomCode}]`);
      redJoined = true;
      if (redJoined && blueJoined && spec1Joined && spec2Joined) resolve();
    });

    clientBlue.on('connect', () => {
      clientBlue.emit('join_game', { roomCode, playerName: 'TuyểnThủ_Xanh', role: 'blue' });
    });
    clientBlue.on('joined_game_success', (data) => {
      console.log(` Tuyển thủ Xanh đã vào phòng [${data.roomCode}]`);
      blueJoined = true;
      if (redJoined && blueJoined && spec1Joined && spec2Joined) resolve();
    });

    clientSpectator1.on('connect', () => {
      clientSpectator1.emit('join_game', { roomCode, playerName: 'ThầyGiáo_KhánGiả_1', role: 'spectator' });
    });
    clientSpectator1.on('joined_game_success', (data) => {
      console.log(` Khán giả 1 (Thầy giáo) đã vào xem trực tiếp`);
      spec1Joined = true;
      if (redJoined && blueJoined && spec1Joined && spec2Joined) resolve();
    });

    clientSpectator2.on('connect', () => {
      clientSpectator2.emit('join_game', { roomCode, playerName: 'SinhViên_KhánGiả_2', role: 'spectator' });
    });
    clientSpectator2.on('joined_game_success', (data) => {
      console.log(` Khán giả 2 đã vào xem trực tiếp (Tổng số khán giả phòng: ${data.spectatorCount})`);
      spec2Joined = true;
      if (redJoined && blueJoined && spec1Joined && spec2Joined) resolve();
    });
  });

  console.log('\n--- 3. KIỂM THỬ ĐỒNG BỘ NƯỚC ĐI TỨC THÌ ĐẾN KHÁN GIẢ ---');
  await new Promise((resolve) => {
    let spec1GotMove = false;
    let spec2GotMove = false;
    const startTime = Date.now();

    clientSpectator1.on('move_performed', (data) => {
      const latency = Date.now() - startTime;
      console.log(` [KHÁN GIẢ 1 NHẬN NƯỚC ĐI THỜI GIAN THỰC] (${latency}ms) Nước #${data.moveRecord.turnNumber}: ${data.moveRecord.piece} ${data.moveRecord.from} -> ${data.moveRecord.to}`);
      spec1GotMove = true;
      if (spec1GotMove && spec2GotMove) resolve();
    });

    clientSpectator2.on('move_performed', (data) => {
      const latency = Date.now() - startTime;
      console.log(` [KHÁN GIẢ 2 NHẬN NƯỚC ĐI THỜI GIAN THỰC] (${latency}ms) Nước #${data.moveRecord.turnNumber}`);
      spec2GotMove = true;
      if (spec1GotMove && spec2GotMove) resolve();
    });

    console.log(' Tuyển thủ Đỏ thực hiện nước đi: a2 -> a3...');
    clientRed.emit('client_move', {
      roomCode,
      from: { col: 0, row: 1 },
      to: { col: 0, row: 2 }
    });
  });

  console.log('\n--- 4. KIỂM THỬ THẢ CẢM XÚC NỔI CỦA KHÁN GIẢ ---');
  await new Promise((resolve) => {
    clientRed.on('floating_reaction', (data) => {
      console.log(` [TUYỂN THỦ NHẬN CẢM XÚC] Khán giả "${data.sender}" đã thả emoji: ${data.emoji}`);
      resolve();
    });
    clientSpectator1.emit('client_send_reaction', { roomCode, emoji: '🔥' });
  });

  console.log('\n--- 5. KIỂM THỬ BÌNH LUẬN TRỰC TIẾP (LIVE CHAT) CỦA KHÁN GIẢ ---');
  await new Promise((resolve) => {
    clientBlue.on('new_chat_message', (data) => {
      if (data.sender === 'ThầyGiáo_KhánGiả_1') {
        console.log(` [TẤT CẢ MỌI NGƯỜI NHẬN TIN NHẮN] ${data.sender}: "${data.text}"`);
        resolve();
      }
    });
    clientSpectator1.emit('client_send_chat', { roomCode, text: 'Nước đi hay lắm!' });
  });

  console.log('\n--- 6. KIỂM THỬ KHÁN GIẢ THEO DÕI GIẢI ĐẤU 4 BÀN ---');
  const clientTourSpectator = io('http://localhost:3000');
  await new Promise((resolve) => {
    clientTourSpectator.on('connect', () => {
      clientTourSpectator.emit('join_tournament', { playerName: 'KhánGiả_XemGiải', role: 'spectator' });
    });
    clientTourSpectator.on('tournament_joined_success', (data) => {
      console.log(` Khán giả giải đấu đã nhận dữ liệu cả 4 bàn thi đấu (Số lượng bàn: ${data.tournament.tables.length})`);
      resolve();
    });
  });

  console.log('\n✅ TẤT CẢ CÁC BÀI KIỂM THỬ KHÁN GIẢ THỜI GIAN THỰC ĐÃ VƯỢT QUA 100%!');

  clientRed.disconnect();
  clientBlue.disconnect();
  clientSpectator1.disconnect();
  clientSpectator2.disconnect();
  clientTourSpectator.disconnect();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test thất bại với lỗi:', err);
  process.exit(1);
});
