# 🎮 ĐỒ ÁN LẬP TRÌNH MẠNG: GAME OẲN TÙ TÌ v2

## 1. Mục tiêu dự án

Xây dựng game **Oẳn Tù Tì v2 (OTTv2)** trên bàn cờ **9x9**, hỗ trợ chơi trực tuyến nhiều người và chế độ khán giả theo thời gian thực.

### Luật chơi

* Bàn cờ 9x9, tọa độ từ `a1` đến `i9`.
* Mỗi bên có 9 quân:

  * 3 ✊ Đấm
  * 3 ✋ Lá
  * 3 ✌️ Kéo
* Mỗi quân được di chuyển **1 ô theo 8 hướng**.
* Quy tắc ăn quân:

  * ✊ ăn ✌️
  * ✌️ ăn ✋
  * ✋ ăn ✊
  * Hai quân cùng loại không thể ăn nhau.
* Điều kiện thắng:

  1. Tiêu diệt toàn bộ một loại quân của đối phương.
  2. Đỏ chiếm căn cứ `i9`.
  3. Xanh chiếm căn cứ `a1`.

## 2. Chức năng chính

### Multiplayer Server

* Sử dụng **Node.js + Express + Socket.IO**.
* Hỗ trợ nhiều phòng đấu.
* Đồng bộ nước đi và trạng thái trận đấu theo thời gian thực.
* Hỗ trợ **100+ khán giả** theo dõi một trận đấu.

### Spectator Mode

* Khán giả xem trận đấu trực tiếp.
* Hiển thị số lượng người đang xem.
* Live Chat.
* Reaction thời gian thực: 👏 🔥 😱 🤯 👑 🎯 🚀 ❤️.

### Chia sẻ trận đấu

* Tự động nhận diện IP mạng LAN.
* Tạo link tham gia và link khán giả.
* Hỗ trợ tạo mã QR.

### Chế độ bổ sung

* 🤖 **AI Practice:** chơi với máy.
* 👥 **Pass & Play:** hai người chơi trên cùng thiết bị.

## 3. Cấu trúc dự án

```text
project_lap_trinh_mang/
├── package.json
├── README.md
├── .gitignore
├── server/
│   ├── app.js
│   ├── rules.js
│   ├── tunnel.js
│   ├── server.js
│   └── gameLogic.js
├── public/
│   ├── index.html
│   ├── arena.html
│   ├── playfull.html
│   ├── css/
│   │   ├── app.css
│   │   └── style.css
│   └── js/
│       ├── engine.js
│       ├── network.js
│       ├── app.js
│       ├── sound.js
│       └── bot.js
└── tests/
    ├── rules.test.js
    ├── server.test.js
    └── tournament.test.js
```

## 4. Cài đặt và chạy

### Cài thư viện

```bash
npm install
```

### Khởi động server

```bash
npm start
```

Server chạy tại:

```text
http://localhost:3000
```

Các thiết bị trong cùng mạng LAN có thể truy cập:

```text
http://<IP-LAN>:3000
```

### Chạy kiểm thử

```bash
npm test
```

Kiểm thử các chức năng:

* HTTP Server.
* Kết nối Socket.IO.
* Đồng bộ người chơi và khán giả.
* Luật di chuyển và ăn quân.
* Điều kiện thắng.
* Quản lý phòng đấu và Spectator.

## 5. Chia sẻ qua Internet

Có thể sử dụng Localtunnel:

```bash
npx localtunnel --port 3000
```

Sau đó sử dụng đường link được cung cấp để người khác truy cập.

## 6. Nộp bài GitHub

```bash
git init
git add .
git commit -m "feat: complete OTTv2 multiplayer game"
git branch -M main
git remote add origin https://github.com/<username>/<repository>.git
git push -u origin main
```

Sau khi push thành công, gửi **link repository GitHub** cho giảng viên.
