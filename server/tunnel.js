const localtunnel = require('localtunnel');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

async function startTunnel() {
  console.log('Đang khởi tạo đường link công khai Internet qua localtunnel...');
  try {
    const tunnel = await localtunnel({ port: PORT });

    console.log('========================================================');
    console.log('🎉 ĐÃ TẠO THÀNH CÔNG ĐƯỜNG LINK ONLINE TOÀN CẦU (KHÔNG DÙNG LOCALHOST):');
    console.log(`👉 Link Trang Chủ:      ${tunnel.url}`);
    console.log(`👉 Link Đấu Trường 9x9: ${tunnel.url}/playfull.html`);
    console.log('========================================================');
    console.log('📌 BẠN CÓ THỂ GỬI LINK NÀY CHO THẦY GIÁO HOẶC BẠN BÈ Ở BẤT CỨ ĐÂU ĐỂ VÀO ĐẤU HOẶC XEM!');

    // Save to public-url.txt for convenience
    fs.writeFileSync(path.join(__dirname, '../public-url.txt'), `LINK ONLINE CÔNG KHAI: ${tunnel.url}\nLINK ĐẤU TRƯỜNG: ${tunnel.url}/playfull.html\n`);

    tunnel.on('close', () => {
      console.log('Tunnel đã đóng.');
    });

    tunnel.on('error', (err) => {
      console.error('Lỗi Tunnel:', err);
    });
  } catch (err) {
    console.error('Không thể tạo tunnel:', err);
  }
}

startTunnel();
