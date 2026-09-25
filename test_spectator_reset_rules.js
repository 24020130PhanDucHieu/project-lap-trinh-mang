const http = require('http');
const { io } = require('socket.io-client');

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => resolve(JSON.parse(resBody)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testSpectatorAndResetRules() {
  console.log('========================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: QUYỀN KHÁN GIẢ & CƠ CHẾ RESET 4 BÀN');
  console.log('========================================================\n');

  const spectatorClient = io('http://localhost:3000');
  const playerTable1Red = io('http://localhost:3000');

  // 1. Kết nối Khán giả vào Giải đấu
  await new Promise((resolve) => {
    spectatorClient.emit('join_tournament', {
      playerName: 'KhánGiả_VIP',
      role: 'spectator'
    });
    spectatorClient.on('tournament_joined_success', (data) => {
      console.log(`1. Khán giả kết nối thành công: Role = "${data.role}", Số bàn nhận được = ${data.tournament.tables.length}`);
      if (data.role !== 'spectator') throw new Error('Role phải là spectator!');
      resolve();
    });
  });

  // 2. Kiểm tra Khán giả cố tình đi quân -> Server phải chặn
  await new Promise((resolve) => {
    spectatorClient.emit('tournament_client_move', {
      tableId: 1,
      from: { col: 0, row: 1 },
      to: { col: 0, row: 2 }
    });
    spectatorClient.on('move_error', (data) => {
      console.log(`2. Chặn Khán giả đi quân: ✅ Server phản hồi lỗi: "${data.message}"`);
      resolve();
    });
  });

  // 3. Kiểm tra Khán giả cố tình reset giải đấu -> Server phải chặn
  await new Promise((resolve) => {
    spectatorClient.emit('tournament_reset_all');
    spectatorClient.once('move_error', (data) => {
      console.log(`3. Chặn Khán giả reset giải: ✅ Server phản hồi lỗi: "${data.message}"`);
      resolve();
    });
  });

  // 4. Kết nối Tuyển thủ vào Bàn 1
  await new Promise((resolve) => {
    playerTable1Red.emit('join_tournament', {
      playerName: 'TuyểnThủ_Bàn1',
      role: 'player',
      tableId: 1,
      color: 'red'
    });
    playerTable1Red.on('tournament_joined_success', (data) => {
      console.log(`4. Tuyển thủ tham gia Bàn 1: Role = "${data.role}", Bàn = ${data.assignedTableId}, Màu = ${data.assignedColor}`);
      resolve();
    });
  });

  // 5. Tuyển thủ cố tình reset khi giải chưa xong cả 4 bàn -> Server phải chặn và báo số bàn chưa xong
  await new Promise((resolve) => {
    playerTable1Red.emit('tournament_reset_all');
    playerTable1Red.once('move_error', (data) => {
      console.log(`5. Chặn reset khi chưa xong 4 bàn: ✅ Server phản hồi lỗi: "${data.message}"`);
      if (!data.message.includes('Phải thi đấu xong cả 4 bàn')) {
        throw new Error('Thông báo lỗi chưa đúng quy tắc 4 bàn!');
      }
      resolve();
    });
  });

  // 6. Mô phỏng kịch bản 3 bàn xong, 1 bàn chưa xong (bàn 4 chưa xong)
  console.log('\n6. Mô phỏng kịch bản 3 bàn xong, 1 bàn chưa xong...');
  await postJson('/api/tournament/simulate-winner', { tableId: 1, winner: 'red' });
  await postJson('/api/tournament/simulate-winner', { tableId: 2, winner: 'blue' });
  await postJson('/api/tournament/simulate-winner', { tableId: 3, winner: 'red' });
  await postJson('/api/tournament/simulate-winner', { tableId: 4, winner: null });

  await new Promise((resolve) => {
    playerTable1Red.emit('tournament_reset_all');
    playerTable1Red.once('move_error', (data) => {
      console.log(`   3/4 bàn xong (Bàn 4 chưa xong): ✅ Server chặn: "${data.message}"`);
      if (!data.message.includes('3/4 bàn kết thúc')) {
        throw new Error('Server không đếm đúng 3/4 bàn!');
      }
      resolve();
    });
  });

  // 7. Mô phỏng kịch bản CẢ 4 BÀN ĐỀU ĐÃ KẾT THÚC
  console.log('\n7. Mô phỏng kịch bản CẢ 4 BÀN ĐỀU ĐÃ KẾT THÚC...');
  await postJson('/api/tournament/simulate-winner', { tableId: 4, winner: 'blue' });

  await new Promise((resolve) => {
    spectatorClient.once('tournament_all_reset', (data) => {
      console.log(`   Cả 4 bàn xong: ✅ Khán giả nhận thông báo giải đấu được reset thành công!`);
      console.log(`   Số lượng bàn sau reset: ${data.tables.length}, Trạng thái bàn 1 winner: ${data.tables[0].gameState.winner}`);
      if (data.tables[0].gameState.winner !== null) throw new Error('Bàn chưa được reset!');
      resolve();
    });
    playerTable1Red.emit('tournament_reset_all');
  });

  console.log('\n========================================================');
  console.log('🎉 TẤT CẢ CÁC ĐIỀU KIỆN QUYỀN KHÁN GIẢ & RESET 4 BÀN ĐÃ VƯỢT QUA 100%!');
  console.log('========================================================');

  spectatorClient.disconnect();
  playerTable1Red.disconnect();
  process.exit(0);
}

testSpectatorAndResetRules().catch(err => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
