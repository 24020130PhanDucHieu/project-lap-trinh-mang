/**
 * OTTv2 Interactive UI Controller & Board Renderer
 */
class GameUI {
  constructor() {
    this.mode = 'online'; // 'online', 'local', or 'ai'
    this.localState = null;
    this.selectedCell = null; // { col, row }
    this.legalMoves = [];
    this.myRole = 'spectator'; // 'red', 'blue', or 'spectator'
    this.aiBot = null;
    this.boardElement = null;
    this.isAiThinking = false;
  }

  init(mode = 'online') {
    const urlParams = new URLSearchParams(window.location.search);
    const paramMode = urlParams.get('mode');
    this.mode = paramMode || mode;

    this.boardElement = document.getElementById('board-grid');
    if (!this.boardElement) return;

    if (this.mode === 'ai') {
      this.aiBot = new window.AIBot('blue');
      this.initLocalGame();
    } else if (this.mode === 'local') {
      this.initLocalGame();
    } else {
      this.initOnlineGame();
    }

    this.bindEvents();
  }

  initLocalGame() {
    const board = window.OTT.createInitialBoard('frontline');
    const pieceCounts = window.OTT.countPieces(board);

    this.localState = {
      board,
      turn: window.OTT.PLAYERS.RED,
      pieceCounts,
      winner: null,
      winReason: null,
      winDescription: '',
      history: []
    };

    this.myRole = (this.mode === 'ai') ? 'red' : 'both';
    this.renderBoard(this.localState);
    this.updateHUD(this.localState);

    const redName = 'Người chơi 1 (Đỏ)';
    const blueName = (this.mode === 'ai') ? '🤖 Máy (AI Bot)' : 'Người chơi 2 (Xanh)';
    this.updatePlayersUI({
      red: { name: redName, connected: true },
      blue: { name: blueName, connected: true }
    });

    const roleBadge = document.getElementById('badge-my-role');
    if (roleBadge) {
      roleBadge.textContent = (this.mode === 'ai') ? 'Đấu với Máy (AI)' : 'Chơi 2 Người Cục Bộ';
      roleBadge.style.color = 'var(--color-green)';
      roleBadge.style.borderColor = 'var(--color-green)';
    }

    const specCount = document.getElementById('spectator-count-text');
    if (specCount) {
      specCount.textContent = 'Cục bộ';
    }

    this.showToast(`Bắt đầu trận đấu ${this.mode === 'ai' ? 'Đấu với Máy (AI)' : '2 Người Chơi Cục Bộ'}!`);
  }

  initOnlineGame() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room') || 'OTT-' + Math.floor(1000 + Math.random() * 9000);
    const roleParam = urlParams.get('role') || 'auto';
    const playerName = urlParams.get('name') || `Người chơi ${Math.floor(Math.random() * 100)}`;

    // Set share links in modal
    this.updateShareLinks(roomCode);

    window.PlayFull.on('connect', () => {
      console.log('Connected to OTTv2 Game Server via Socket.io');
    });

    window.PlayFull.on('joined_success', (data) => {
      this.myRole = data.role;
      this.updateRoleBadge(data.role);
      this.renderBoard(data.gameState);
      this.updateHUD(data.gameState);
      this.updatePlayersUI(data.players);
      this.updateSpectatorsUI(data.spectatorCount);
      this.renderChatHistory(data.chatHistory || []);
      this.showToast(`Tham gia phòng ${data.roomCode} thành công!`);
    });

    window.PlayFull.on('room_updated', (data) => {
      this.updatePlayersUI(data.players);
      this.updateSpectatorsUI(data.spectatorCount);
    });

    window.PlayFull.on('move_performed', (data) => {
      if (data.capturedPiece) {
        window.soundEngine.playCapture();
      } else {
        window.soundEngine.playMove();
      }

      this.selectedCell = null;
      this.legalMoves = [];
      this.renderBoard(data.gameState);
      this.updateHUD(data.gameState);
      this.addHistoryRecord(data.moveRecord);

      if (data.gameState.winner) {
        window.soundEngine.playVictory();
        this.showVictoryModal(data.gameState);
      }
    });

    window.PlayFull.on('move_error', (data) => {
      this.showToast(data.message, 'warning');
    });

    window.PlayFull.on('game_reset', (data) => {
      this.selectedCell = null;
      this.legalMoves = [];
      this.renderBoard(data.gameState);
      this.updateHUD(data.gameState);
      this.clearHistoryUI();
      this.closeVictoryModal();
      this.showToast('Ván đấu đã được làm mới!');
    });

    window.PlayFull.on('new_chat_message', (data) => {
      this.appendChatMessage(data);
      if (data.role !== 'system') {
        window.soundEngine.playChat();
      }
    });

    window.PlayFull.on('floating_reaction', (data) => {
      this.spawnFloatingReaction(data.emoji);
      window.soundEngine.playReaction();
    });

    // Connect and join
    window.PlayFull.init();
    window.PlayFull.joinRoom({
      roomCode,
      playerName,
      role: roleParam
    });
  }

  bindEvents() {
    // Sound toggle
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = window.soundEngine.toggleMute();
        soundBtn.innerHTML = isMuted ? '🔇' : '🔊';
        this.showToast(isMuted ? 'Đã tắt âm thanh' : 'Đã bật âm thanh');
      });
    }

    // Share room button
    const shareBtn = document.getElementById('btn-share-room');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const modal = document.getElementById('share-modal');
        if (modal) modal.classList.add('active');
      });
    }

    // Rules button
    const rulesBtn = document.getElementById('btn-rules');
    if (rulesBtn) {
      rulesBtn.addEventListener('click', () => {
        const modal = document.getElementById('rules-modal');
        if (modal) modal.classList.add('active');
      });
    }

    // Close modals
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
      });
    });

    // Chat form
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;
        if (this.mode === 'online') {
          window.PlayFull.sendChat(text);
        } else {
          this.appendChatMessage({
            sender: 'Bạn',
            role: 'player',
            text,
            timestamp: Date.now()
          });
        }
        chatInput.value = '';
      });
    }

    // Floating reaction buttons
    document.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji || btn.textContent.trim();
        if (this.mode === 'online') {
          window.PlayFull.sendReaction(emoji);
        } else {
          this.spawnFloatingReaction(emoji);
          window.soundEngine.playReaction();
        }
      });
    });

    // Rematch button
    const rematchBtn = document.getElementById('btn-rematch');
    if (rematchBtn) {
      rematchBtn.addEventListener('click', () => {
        if (this.mode === 'online') {
          window.PlayFull.resetGame();
        } else {
          this.initLocalGame();
          this.closeVictoryModal();
        }
      });
    }

    // Copy buttons in Share modal
    document.querySelectorAll('.btn-copy-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          window.PlayFull.copyToClipboard(input.value).then(() => {
            this.showToast('✅ Đã sao chép liên kết vào clipboard!');
          });
        }
      });
    });
  }

  getCurrentGameState() {
    if (this.mode === 'online') {
      return window.PlayFull.gameState;
    }
    return this.localState;
  }

  renderBoard(gameState) {
    if (!gameState || !this.boardElement) return;
    this.boardElement.innerHTML = '';

    const board = gameState.board;

    // 9 rows (from row 8 down to 0 so Row 9 is top, Row 1 is bottom)
    for (let r = 8; r >= 0; r--) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell ' + ((r + c) % 2 === 0 ? 'cell-dark' : 'cell-light');
        cell.dataset.col = c;
        cell.dataset.row = r;

        // Check if this is a victory base sanctuary
        if (c === 0 && r === 0) {
          cell.classList.add('sanctuary-a1');
          cell.title = 'Căn cứ Mục tiêu a1 (Cần chiếm bởi Quân XANH để thắng)';
        } else if (c === 8 && r === 8) {
          cell.classList.add('sanctuary-i9');
          cell.title = 'Căn cứ Mục tiêu i9 (Cần chiếm bởi Quân ĐỎ để thắng)';
        }

        // Selection highlight
        if (this.selectedCell && this.selectedCell.col === c && this.selectedCell.row === r) {
          cell.classList.add('selected-piece');
        }

        // Legal move indicators
        const matchedMove = this.legalMoves.find(m => m.col === c && m.row === r);
        if (matchedMove) {
          if (matchedMove.isCapture) {
            cell.classList.add('legal-capture');
            cell.title = `Ăn quân đối phương bằng ${matchedMove.targetPiece ? matchedMove.targetPiece.type : 'quân cờ'}`;
          } else {
            cell.classList.add('legal-move');
            cell.title = 'Di chuyển vào ô trống';
          }
        }

        // Render piece
        const piece = board[r][c];
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = `piece ${piece.player === 'red' ? 'red-piece' : 'blue-piece'}`;
          
          let icon = '✊';
          let name = 'ĐẤM';
          if (piece.type === window.OTT.PIECE_TYPES.PAPER) {
            icon = '✋';
            name = 'LÁ';
          } else if (piece.type === window.OTT.PIECE_TYPES.SCISSORS) {
            icon = '✌️';
            name = 'KÉO';
          }

          pieceEl.innerHTML = icon;
          pieceEl.title = `Quân ${name} (${piece.player === 'red' ? 'Đỏ' : 'Xanh'})`;
          cell.appendChild(pieceEl);
        }

        // Click handler
        cell.addEventListener('click', () => this.handleCellClick(c, r));

        this.boardElement.appendChild(cell);
      }
    }
  }

  handleCellClick(col, row) {
    const gameState = this.getCurrentGameState();
    if (!gameState || gameState.winner) return;

    if (this.isAiThinking) return;

    // Online permission check: can current player move?
    if (this.mode === 'online') {
      if (this.myRole === 'spectator') {
        this.showToast('Bạn đang ở chế độ Người xem (Spectator), chỉ có thể theo dõi trận đấu!', 'info');
        return;
      }
      if (this.myRole !== gameState.turn) {
        this.showToast(`Chưa đến lượt của bạn! Đang là lượt của bên ${gameState.turn === 'red' ? 'Đỏ' : 'Xanh'}.`, 'warning');
        return;
      }
    } else if (this.mode === 'ai') {
      if (gameState.turn !== 'red') return;
    }

    const clickedPiece = gameState.board[row][col];

    // If already selected a piece and clicked on a legal move target
    if (this.selectedCell) {
      const isLegal = this.legalMoves.find(m => m.col === col && m.row === row);
      if (isLegal) {
        this.executeMove(this.selectedCell, { col, row });
        return;
      }
    }

    // Selecting a piece of the active player
    if (clickedPiece && (this.mode === 'local' ? clickedPiece.player === gameState.turn : clickedPiece.player === this.myRole)) {
      this.selectedCell = { col, row };
      this.legalMoves = window.OTT.getLegalMoves(gameState.board, col, row);
      window.soundEngine.playSelect();
      this.renderBoard(gameState);
    } else {
      // Clicked on empty or non-movable square
      this.selectedCell = null;
      this.legalMoves = [];
      this.renderBoard(gameState);
    }
  }

  executeMove(from, to) {
    if (this.mode === 'online') {
      window.PlayFull.makeMove(from, to);
      this.selectedCell = null;
      this.legalMoves = [];
    } else {
      // Local or AI mode
      const result = window.OTT.makeMove(this.localState, from, to);
      if (!result.valid) {
        this.showToast(result.error, 'warning');
        return;
      }

      this.localState = result.newState;
      this.selectedCell = null;
      this.legalMoves = [];

      if (result.capturedPiece) {
        window.soundEngine.playCapture();
      } else {
        window.soundEngine.playMove();
      }

      this.renderBoard(this.localState);
      this.updateHUD(this.localState);
      this.addHistoryRecord(result.moveRecord);

      if (this.localState.winner) {
        window.soundEngine.playVictory();
        this.showVictoryModal(this.localState);
        return;
      }

      // If AI mode and now it's Blue's turn
      if (this.mode === 'ai' && this.localState.turn === 'blue') {
        this.isAiThinking = true;
        this.updateTurnBanner('Máy (AI) đang tính nước đi...');
        setTimeout(() => {
          this.executeAiTurn();
        }, 600);
      }
    }
  }

  executeAiTurn() {
    if (this.localState.winner) {
      this.isAiThinking = false;
      return;
    }

    const aiMove = this.aiBot.getBestMove(this.localState);
    if (!aiMove) {
      this.isAiThinking = false;
      return;
    }

    const result = window.OTT.makeMove(this.localState, aiMove.from, aiMove.to);
    this.isAiThinking = false;

    if (result.valid) {
      this.localState = result.newState;
      if (result.capturedPiece) {
        window.soundEngine.playCapture();
      } else {
        window.soundEngine.playMove();
      }
      this.renderBoard(this.localState);
      this.updateHUD(this.localState);
      this.addHistoryRecord(result.moveRecord);

      if (this.localState.winner) {
        window.soundEngine.playVictory();
        this.showVictoryModal(this.localState);
      }
    }
  }

  updateHUD(gameState) {
    if (!gameState) return;

    // Update Turn Banner
    const isRed = gameState.turn === 'red';
    let bannerText = isRed ? '🔴 LƯỢT CỦA BÊN ĐỎ (Player 1)' : '🔵 LƯỢT CỦA BÊN XANH (Player 2)';

    if (this.mode === 'online') {
      if (this.myRole === gameState.turn) {
        bannerText = `⚡ ĐẾN LƯỢT CỦA BẠN (${this.myRole === 'red' ? 'ĐỎ' : 'XANH'})!`;
      } else if (this.myRole === 'spectator') {
        bannerText = `👁️ LƯỢT: BÊN ${isRed ? 'ĐỎ' : 'XANH'}`;
      } else {
        bannerText = `⏳ ĐANG CHỜ BÊN ${isRed ? 'ĐỎ' : 'XANH'} ĐI QUÂN...`;
      }
    }

    this.updateTurnBanner(bannerText);

    // Update Active Card Glow
    const redCard = document.getElementById('card-player-red');
    const blueCard = document.getElementById('card-player-blue');
    if (redCard && blueCard) {
      if (isRed) {
        redCard.classList.add('active-turn');
        blueCard.classList.remove('active-turn');
      } else {
        blueCard.classList.add('active-turn');
        redCard.classList.remove('active-turn');
      }
    }

    // Update piece inventories
    const counts = gameState.pieceCounts;
    this.updateInventoryCount('red', 'ROCK', counts.red.ROCK);
    this.updateInventoryCount('red', 'PAPER', counts.red.PAPER);
    this.updateInventoryCount('red', 'SCISSORS', counts.red.SCISSORS);

    this.updateInventoryCount('blue', 'ROCK', counts.blue.ROCK);
    this.updateInventoryCount('blue', 'PAPER', counts.blue.PAPER);
    this.updateInventoryCount('blue', 'SCISSORS', counts.blue.SCISSORS);
  }

  updateTurnBanner(text) {
    const banner = document.getElementById('turn-status-banner');
    if (banner) banner.textContent = text;
  }

  updateInventoryCount(player, type, count) {
    const el = document.getElementById(`inv-${player}-${type.toLowerCase()}`);
    if (!el) return;

    el.textContent = `${count}/3`;
    const parent = el.closest('.inv-item');
    if (parent) {
      if (count === 1) {
        parent.classList.add('danger-low');
        parent.classList.remove('extinct');
        parent.title = 'CẢNH BÁO: Mất nốt quân này sẽ thua trận ngay lập tức!';
      } else if (count === 0) {
        parent.classList.remove('danger-low');
        parent.classList.add('extinct');
        parent.title = 'Đã tuyệt diệt hoàn toàn!';
      } else {
        parent.classList.remove('danger-low');
        parent.classList.remove('extinct');
        parent.title = '';
      }
    }
  }

  updateRoleBadge(role) {
    const badge = document.getElementById('badge-my-role');
    if (!badge) return;

    if (role === 'red') {
      badge.textContent = 'Quân ĐỎ (Player 1)';
      badge.style.color = 'var(--color-red)';
      badge.style.borderColor = 'var(--color-red)';
    } else if (role === 'blue') {
      badge.textContent = 'Quân XANH (Player 2)';
      badge.style.color = 'var(--color-blue)';
      badge.style.borderColor = 'var(--color-blue)';
    } else {
      badge.textContent = 'Khán Giả (Spectator)';
      badge.style.color = 'var(--color-gold)';
      badge.style.borderColor = 'var(--color-gold)';
    }
  }

  updatePlayersUI(players) {
    if (!players) return;
    const redNameEl = document.getElementById('name-player-red');
    const blueNameEl = document.getElementById('name-player-blue');

    if (redNameEl) {
      redNameEl.textContent = players.red ? players.red.name : 'Đang chờ người chơi...';
    }
    if (blueNameEl) {
      blueNameEl.textContent = players.blue ? players.blue.name : 'Đang chờ người chơi...';
    }
  }

  updateSpectatorsUI(count) {
    const countEl = document.getElementById('spectator-count-text');
    if (countEl) {
      countEl.textContent = `${count} Khán giả`;
    }
  }

  addHistoryRecord(record) {
    const historyList = document.getElementById('history-list');
    if (!historyList || !record) return;

    const item = document.createElement('div');
    item.className = 'history-item' + (record.captured ? ' capture' : '');

    let pieceIcon = '✊';
    if (record.piece === 'PAPER') pieceIcon = '✋';
    if (record.piece === 'SCISSORS') pieceIcon = '✌️';

    let captureText = '';
    if (record.captured) {
      captureText = ` ⚔️ (Ăn ${record.captured})`;
    }

    const playerColor = record.player === 'red' ? 'ĐỎ' : 'XANH';
    item.innerHTML = `
      <span><strong>#${record.turnNumber}</strong> [${playerColor}] ${pieceIcon} ${record.from} ➔ ${record.to}${captureText}</span>
      <span style="font-size: 10px; color: var(--text-dim)">${new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    `;

    historyList.appendChild(item);
    historyList.scrollTop = historyList.scrollHeight;
  }

  clearHistoryUI() {
    const historyList = document.getElementById('history-list');
    if (historyList) historyList.innerHTML = '';
  }

  appendChatMessage(msg) {
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer || !msg) return;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + (msg.role || '');

    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (msg.role === 'system') {
      bubble.innerHTML = `<span>${msg.text}</span>`;
    } else {
      bubble.innerHTML = `
        <span class="sender" style="color: ${msg.role === 'red' ? 'var(--color-red)' : msg.role === 'blue' ? 'var(--color-blue)' : 'var(--color-gold)'}">
          ${msg.sender}:
        </span>
        <span>${msg.text}</span>
        <span style="float: right; font-size: 10px; color: var(--text-dim); margin-left: 8px;">${timeStr}</span>
      `;
    }

    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  renderChatHistory(history) {
    const chatContainer = document.getElementById('chat-messages');
    if (!chatContainer) return;
    chatContainer.innerHTML = '';
    history.forEach(msg => this.appendChatMessage(msg));
  }

  spawnFloatingReaction(emoji) {
    const layer = document.getElementById('floating-reactions-layer');
    if (!layer) return;

    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.textContent = emoji;
    el.style.left = `${Math.floor(Math.random() * 80)}px`;

    layer.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2600);
  }

  showVictoryModal(gameState) {
    const modal = document.getElementById('victory-modal');
    const titleEl = document.getElementById('victory-title');
    const descEl = document.getElementById('victory-desc');

    if (!modal) return;

    const isRed = gameState.winner === 'red';
    if (titleEl) {
      titleEl.innerHTML = `🏆 BÊN ${isRed ? '<span style="color:var(--color-red)">ĐỎ</span>' : '<span style="color:var(--color-blue)">XANH</span>'} CHIẾN THẮNG!`;
    }
    if (descEl) {
      descEl.textContent = gameState.winDescription;
    }

    modal.classList.add('active');
  }

  closeVictoryModal() {
    const modal = document.getElementById('victory-modal');
    if (modal) modal.classList.remove('active');
  }

  updateShareLinks(roomCode) {
    fetch('/api/network-ip')
      .then(res => res.json())
      .then(data => {
        const primaryHost = data.primaryUrl || window.location.origin;
        const playerUrl = `${primaryHost}/playfull.html?room=${roomCode}&role=auto`;
        const spectatorUrl = `${primaryHost}/playfull.html?room=${roomCode}&role=spectator`;

        const playerInput = document.getElementById('share-player-url');
        const spectatorInput = document.getElementById('share-spectator-url');

        if (playerInput) playerInput.value = playerUrl;
        if (spectatorInput) spectatorInput.value = spectatorUrl;

        // Render QR Code image
        const qrImg = document.getElementById('share-qr-image');
        if (qrImg) {
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(playerUrl)}`;
        }
      })
      .catch(() => {
        const origin = window.location.origin;
        const playerUrl = `${origin}/playfull.html?room=${roomCode}&role=auto`;
        const spectatorUrl = `${origin}/playfull.html?room=${roomCode}&role=spectator`;

        const playerInput = document.getElementById('share-player-url');
        const spectatorInput = document.getElementById('share-spectator-url');

        if (playerInput) playerInput.value = playerUrl;
        if (spectatorInput) spectatorInput.value = spectatorUrl;
      });
  }

  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = 'ℹ️';
    if (type === 'warning') icon = '⚠️';
    if (type === 'success') icon = '✅';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }
}

window.GameUI = new GameUI();
