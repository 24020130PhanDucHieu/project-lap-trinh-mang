# 🎮 ĐỒ ÁN LẬP TRÌNH MẠNG: GAME OẲN TÙ TÌ v2 (OTTv2) 9x9
## 🌐 MULTIPLAYER SERVER & LIVESTREAM SPECTATOR ROOM (100+ KHÁN GIẢ)

---

## 👥 THÔNG TIN NHÓM THỰC HIỆN (Tối đa 4 Sinh viên)

| STT | Họ và Tên Sinh Viên | Mã Sinh Viên (MSSV) | Lớp / Khóa | Vai trò & Nhiệm vụ chính |
|:---:|:---|:---:|:---:|:---|
| 1 | **[Điền tên Trưởng nhóm]** | [Điền MSSV] | Lập trình Mạng | Kiến trúc Server WebSocket, Phòng đấu & Đồng bộ 100+ Spectator |
| 2 | **[Điền tên Thành viên 2]** | [Điền MSSV] | Lập trình Mạng | Luật OTTv2 9x9, Động cơ Game Logic (gameLogic.js & gameEngine.js) |
| 3 | **[Điền tên Thành viên 3]** | [Điền MSSV] | Lập trình Mạng | Giao diện Cyber Esports Glassmorphism (HTML5/CSS3, animations) |
| 4 | **[Điền tên Thành viên 4]** | [Điền MSSV] | Lập trình Mạng | Phát triển AI Bot luyện tập, Web Audio SFX & Thử nghiệm tự động |

---

## 📋 MỤC TIÊU & ĐÁP ỨNG ĐẦY ĐỦ YÊU CẦU ĐỀ BÀI

### 1. Bài Tập 1: Web 2 Người Chơi Oẳn Tù Tì v2 (OTTv2)
- **Bàn cờ chuẩn 9x9**: Tọa độ các cột `a` đến `i` (0 đến 8) và các hàng `1` đến `9` (0 đến 8).
- **Lực lượng mỗi bên**: 9 quân cờ gồm 3 Đấm (✊), 3 Lá (✋), 3 Kéo (✌️).
- **Quy tắc di chuyển**: Mỗi quân cờ được di chuyển **1 ô theo mọi hướng trong 8 hướng** (ngang, dọc, chéo - tương tự quân Vua trong cờ vua).
- **Quy tắc ăn quân**:
  - ✊ **Đấm** ăn ✌️ **Kéo**.
  - ✌️ **Kéo** ăn ✋ **Lá**.
  - ✋ **Lá** ăn ✊ **Đấm**.
  - **Hai quân cùng loại**: Tuyệt đối *không thể ăn nhau mà chỉ đứng chặn đường nhau*.
  - Quân yếu thế không thể tấn công quân khắc chế mình.
- **Điều kiện thắng cuộc**:
  1. **Tuyệt diệt 1 loại quân**: Ăn sạch hoàn toàn 1 loại quân bất kỳ của đối phương (hết toàn bộ 3 Đấm, hoặc hết 3 Lá, hoặc hết 3 Kéo) ➔ **Thắng ngay lập tức**!
  2. **Chiếm cứ điểm căn cứ**:
     - Quân ĐỎ (Player 1) đưa bất kỳ 1 quân cờ nào đột kích vào ô căn cứ **`i9`** ➔ **ĐỎ THẮNG**!
     - Quân XANH (Player 2) đưa bất kỳ 1 quân cờ nào đột kích vào ô căn cứ **`a1`** ➔ **XANH THẮNG**!

### 2. Bài Tập 2: Thư viện `playfull.html` & Máy chủ hỗ trợ 100+ người cùng lúc
- Xây dựng file đấu trường chuyên dụng **`public/playfull.html`** và thư viện SDK **`public/js/playfullClient.js`** (`window.PlayFull`).
- **Máy chủ Node.js & Socket.io**: Quản lý đa phòng đấu thời gian thực, đồng bộ nước đi không có độ trễ.
- **Chế độ Khán giả (Spectator Mode)**: Hỗ trợ **hơn 100 người xem đồng thời** trên một trận đấu. Khán giả được cập nhật bàn cờ theo thời gian thực (real-time live streaming), có huy hiệu số lượng người xem trực tiếp.
- **Tương tác trực tiếp**:
  - Hộp thoại bình luận trận đấu (Live Chat) dành cho cả tuyển thủ và khán giả.
  - Thanh thả cảm xúc nổi (Floating Emoji Reactions: 👏, 🔥, 😱, 🤯, 👑, 🎯, 🚀, ❤️) hiển thị trên màn hình mọi người theo thời gian thực.
- **Chia sẻ đường link & Mã QR**:
  - Tự động nhận diện địa chỉ mạng cục bộ (LAN IP).
  - Tích hợp tính năng tạo mã QR và sao chép đường link 1-click dành riêng cho Tuyển thủ và dành riêng cho Khán giả. Thầy giáo có thể quét mã QR bằng điện thoại hoặc nhấp link để vào chơi/xem ngay lập tức!
- **Chế độ bổ trợ**:
  - 🤖 **Chơi với Máy (AI Practice)**: Đấu tập với AI Bot thông minh.
  - 👥 **Chơi Cục Bộ (Pass & Play)**: Chơi 2 người trên cùng 1 thiết bị.

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN (GỌN GÀNG, SẠCH SẼ)

```
project_lap_trinh_mang/
├── package.json              # Khai báo cấu hình, thư viện (Express, Socket.io) & scripts
├── README.md                 # Tài liệu thuyết minh đồ án và hướng dẫn sử dụng
├── .gitignore                # Bỏ qua node_modules và file tạm khi commit Git
├── test_rules.js             # Bộ kiểm thử đơn vị tự động kiểm tra toàn bộ luật OTTv2
├── test_server.js            # Bộ kiểm thử tích hợp HTTP, Socket.io, Sync & Khán giả
├── server/
│   ├── server.js             # Máy chủ Node.js Express + Socket.io đa phòng & 100+ Spectator
│   └── gameLogic.js          # Module xử lý luật OTTv2 phía server (chống gian lận)
└── public/
    ├── index.html            # Cổng sảnh chính (Lobby, Danh sách phòng, Chọn chế độ)
    ├── playfull.html         # Đấu trường trực tuyến & Chế độ khán giả (Đáp ứng Bài tập 2)
    ├── css/
    │   ├── style.css         # Hệ thống giao diện Cyber Esports Glassmorphism cao cấp
    │   └── animations.css    # Hiệu ứng chuyển động, nhịp đập, cảm xúc nổi & thông báo
    └── js/
        ├── audio.js          # Bộ phát âm thanh tự tạo bằng Web Audio API (không cần file mp3 ngoài)
        ├── gameEngine.js     # Động cơ bàn cờ và kiểm tra nước đi OTTv2 phía client
        ├── playfullClient.js # Thư viện SDK PlayFull kết nối mạng, phòng đấu & khán giả
        ├── aiBot.js          # Trí tuệ nhân tạo (AI Bot) phục vụ chế độ luyện tập 1 người
        └── ui.js             # Điều khiển render 9x9, tương tác ô cờ, HUD và Modal
```

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN

### 1. Yêu cầu môi trường
- Đã cài đặt **Node.js** (Khuyên dùng phiên bản >= 18.x, 20.x, hoặc 22.x/24.x).

### 2. Cài đặt các thư viện phụ thuộc
Mở terminal (PowerShell hoặc Command Prompt) tại thư mục dự án và chạy:
```bash
npm install
```

### 3. Khởi chạy Server
Chạy lệnh:
```bash
npm start
```
Khi khởi chạy thành công, console sẽ hiển thị thông tin như sau:
```text
========================================================
🚀 OTTv2 MULTIPLAYER SERVER ĐANG CHẠY TẠI PORT 3000
🌐 Truy cập cục bộ: http://localhost:3000
📱 Truy cập trong cùng mạng Wi-Fi / LAN:
   👉 http://192.168.1.15:3000
   👉 http://192.168.1.15:3000/playfull.html
👥 Hỗ trợ phòng chơi 2 người & lên tới 100+ khán giả trực tiếp!
========================================================
```

### 4. Chạy kiểm thử tự động (Unit Test & Integration Test)
Dự án có sẵn kịch bản kiểm thử tự động toàn diện:
```bash
npm test
```
*Kết quả sẽ kiểm tra tự động:*
- Phục vụ file `index.html` và `playfull.html` (HTTP 200).
- Kết nối đồng thời Tuyển thủ Đỏ, Tuyển thủ Xanh và Khán giả qua Socket.io.
- Đồng bộ nước đi tức thời đến tất cả người chơi và khán giả.
- Cơ chế ăn quân chuẩn Oẳn Tù Tì & kiểm tra chặn đường quân cùng loại.
- Điều kiện thắng khi chiếm ô căn cứ `i9` / `a1`.
- Điều kiện thắng khi tuyệt diệt 1 loại quân của đối phương.

---

## 🌐 HƯỚNG DẪN ĐỂ THẦY GIÁO VÀ NGƯỜI KHÁC VÀO CHƠI / XEM

### Cách 1: Chơi trong cùng mạng Wi-Fi / Phòng thực hành (Mạng LAN)
1. Bạn khởi chạy server bằng `npm start`.
2. Quan sát địa chỉ IP mạng LAN hiển thị trên terminal (ví dụ: `http://192.168.1.15:3000`).
3. Gửi link này cho Thầy giáo hoặc các bạn trong phòng máy:
   - **Link đấu**: `http://<IP_CỦA_BẠN>:3000/playfull.html?room=OTT-2026&role=auto`
   - **Link khán giả**: `http://<IP_CỦA_BẠN>:3000/playfull.html?room=OTT-2026&role=spectator`
4. Hoặc tại màn hình trận đấu, nhấn nút **"🔗 Chia Sẻ Phòng"** để Thầy giáo dùng camera điện thoại quét mã QR và tham gia ngay!

### Cách 2: Chia sẻ ra Internet qua Ngrok hoặc Localtunnel (Miễn phí 100%)
Nếu Thầy giáo hoặc bạn bè không ngồi cùng mạng Wi-Fi, bạn có thể tạo đường link Internet công khai chỉ với 1 dòng lệnh:
- Dùng `localtunnel` (không cần đăng ký):
  ```bash
  npx localtunnel --port 3000
  ```
  Terminal sẽ in ra một đường link công khai dạng `https://happy-frog-42.loca.lt`. Gửi link này cho Thầy giáo là có thể truy cập thi đấu từ bất cứ đâu trên thế giới!

---

## 📦 HƯỚNG DẪN NỘP BÀI LÊN GITHUB

Để nộp link bài làm lên Git theo yêu cầu của Thầy, nhóm thực hiện các bước sau:

1. Khởi tạo Git và thêm toàn bộ mã nguồn:
   ```bash
   git init
   git add .
   git commit -m "feat: hoan thien web game OTTv2 multiplayer server va spectator room playfull.html"
   ```
2. Đẩy lên kho lưu trữ GitHub của nhóm:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repository>.git
   git push -u origin main
   ```
3. Copy đường link GitHub của repository này để nộp vào hệ thống của nhà trường.

---
*Chúc nhóm sinh viên đạt điểm số tối đa với sản phẩm đồ án chất lượng cao này!* 🚀
