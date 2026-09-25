/**
 * OTTv2 Interactive UI Controller & Board Renderer
 * Supports:
 *  1. Quick 2-Player Room Code Mode (Nhập Mã Phòng Nhanh)
 *  2. Tournament Arena Mode (4 Bàn - 8 Tuyển Thủ - Khán Giả)
 *  3. Single-Player vs AI & Local 2P
 */
class GameUI {
  constructor() {
    this.mode = 'online'; // 'online', 'tournament', 'local', or 'ai'
    this.localState = null;
    this.selectedCell = null;
    this.legalMoves = [];
    this.myRole = 'spectator';
    this.aiBot = null;
    this.boardElement = null;
    this.isAiThinking = false;
    this.tournamentActiveTableId = 1;
    this.tournamentViewMode = 'quad'; // 'quad' (4 bàn đồng thời) or 'single' (1 bàn chi tiết)
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
    } else if (this.mode === 'tournament') {
      this.initTournamentGame();
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

    const roomCodeBadge = document.getElementById('header-room-code');
    if (roomCodeBadge) {
      roomCodeBadge.textContent = (this.mode === 'ai') ? 'LUYỆN TẬP AI' : 'CỤC BỘ';
    }

    this.showToast(`Bắt đầu trận đấu ${this.mode === 'ai' ? 'Đấu với Máy (AI)' : '2 Người Chơi Cục Bộ'}!`);
  }

  // ==========================================
  // 1. STANDARD ROOM (NHẬP MÃ PHÒNG NHANH)
  // ==========================================
  initOnlineGame() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room') || Math.floor(1000 + Math.random() * 9000).toString();
    const roleParam = urlParams.get('role') || 'auto';
    const playerName = urlParams.get('name') || `Người chơi ${Math.floor(Math.random() * 100)}`;

    const roomCodeBadge = document.getElementById('header-room-code');
    if (roomCodeBadge) roomCodeBadge.textContent = roomCode;

    window.PlayFull.on('connect', () => {
      console.log('Connected to OTTv2 Game Server');
    });

    window.PlayFull.on('joined_success', (data) => {
      this.myRole = data.role;
      this.updateRoleBadge(data.role);
      this.renderBoard(data.gameState);
      this.updateHUD(data.gameState);
      this.updatePlayersUI(data.players);
      this.updateSpectatorsUI(data.spectatorCount);
      this.renderChatHistory(data.chatHistory || []);
      
      const copyBtn = document.getElementById('btn-quick-copy-code');
      if (copyBtn) {
        copyBtn.style.display = 'inline-flex';
        copyBtn.onclick = () => {
          window.PlayFull.copyToClipboard(data.roomCode).then(() => {
            this.showToast(`✅ Đã sao chép Mã Phòng: ${data.roomCode}`);
          });
        };
      }

      const rematchBtn = document.getElementById('btn-rematch');
      if (rematchBtn) {
        rematchBtn.style.display = (this.myRole === 'spectator') ? 'none' : 'inline-flex';
      }

      this.showToast(`Đã vào phòng [${data.roomCode}]. Gửi mã này cho bạn bè để cùng chơi!`);
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

    window.PlayFull.init();
    window.PlayFull.joinRoom({
      roomCode,
      playerName,
      role: roleParam
    });
  }

  // ========================================================
  // 2. TOURNAMENT ARENA MODE (4 BÀN - 8 TUYỂN THỦ - KHÁN GIẢ)
  // ========================================================
  initTournamentGame() {
    const urlParams = new URLSearchParams(window.location.search);
    const roleParam = urlParams.get('role') || 'spectator';
    const tableParam = parseInt(urlParams.get('table')) || 1;
    const colorParam = urlParams.get('color') || 'auto';
    const playerName = urlParams.get('name') || `Tuyển thủ ${Math.floor(Math.random() * 100)}`;

    const roomCodeBadge = document.getElementById('header-room-code');
    if (roomCodeBadge) roomCodeBadge.textContent = 'GIẢI ĐẤU (4 BÀN)';

    // Show tournament table navigation bar
    const tourNav = document.getElementById('tournament-nav-bar');
    if (tourNav) tourNav.style.display = 'flex';

    window.PlayFull.on('tournament_joined_success', (data) => {
      this.myRole = data.role;
      this.tournamentActiveTableId = data.assignedTableId || 1;
      this.updateTournamentRoleBadge(data);
      this.renderTournamentTablesNav(data.tournament.tables);

      // Spectators default to Quad-View (watching all 4 tables simultaneously)
      // Players default to Single-Table focus (playing on their assigned board)
      if (this.myRole === 'spectator') {
        this.tournamentViewMode = 'quad';
      } else {
        this.tournamentViewMode = 'single';
      }

      const toggleBtn = document.getElementById('btn-toggle-view-mode');
      if (toggleBtn) toggleBtn.style.display = 'inline-flex';

      this.applyTournamentViewMode();
      this.renderQuadView(data.tournament.tables);
      this.displayTournamentTable(this.tournamentActiveTableId);
      this.updateTourResetButtonState(data.tournament.tables);

      this.updateSpectatorsUI(data.tournament.spectatorCount);
      this.renderChatHistory(data.tournament.chatHistory || []);

      if (this.myRole === 'spectator') {
        this.showToast(`👁️ Chào mừng Khán Giả ${data.playerName}! Đang phát sóng toàn cảnh 4 bàn thi đấu.`);
      } else {
        this.showToast(`⚔️ Chào mừng ${data.playerName} (Tuyển thủ Bàn ${this.tournamentActiveTableId})!`);
      }
    });

    window.PlayFull.on('tournament_state_updated', (data) => {
      this.renderTournamentTablesNav(data.tables);
      this.renderQuadView(data.tables);
      this.updateSpectatorsUI(data.spectatorCount);
      this.updateTourResetButtonState(data.tables);

      // Re-render currently viewed table
      const currentTable = data.tables.find(t => t.id === this.tournamentActiveTableId);
      if (currentTable) {
        this.updatePlayersUI(currentTable.players);
        this.updateHUD(currentTable.gameState);
      }
    });

    window.PlayFull.on('tournament_move_performed', (data) => {
      // Update mini-board in Quad-View in real time
      this.updateQuadTable(data.tableId, data.gameState);
      this.updateTableNavStatus(data.tableId, data.gameState);

      if (window.PlayFull.tournamentData && window.PlayFull.tournamentData.tables) {
        this.updateTourResetButtonState(window.PlayFull.tournamentData.tables);
      }

      if (data.tableId === this.tournamentActiveTableId) {
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
      } else if (data.gameState.winner) {
        // Notification for spectators viewing other tables
        const winnerColor = data.gameState.winner === 'red' ? 'ĐỎ' : 'XANH';
        this.showToast(`🏆 Bàn ${data.tableId} đã có kết quả: Bên ${winnerColor} giành chiến thắng!`, 'success');
      }
    });

    window.PlayFull.on('tournament_table_reset', (data) => {
      this.updateQuadTable(data.tableId, data.gameState);
      if (data.tableId === this.tournamentActiveTableId) {
        this.selectedCell = null;
        this.legalMoves = [];
        this.renderBoard(data.gameState);
        this.updateHUD(data.gameState);
        this.clearHistoryUI();
        this.closeVictoryModal();
        this.showToast(`Bàn ${data.tableId} đã được khởi động lại!`);
      }
    });

    window.PlayFull.on('tournament_all_reset', (data) => {
      this.renderQuadView(data.tables);
      this.renderTournamentTablesNav(data.tables);
      this.updateTourResetButtonState(data.tables);

      const currentTable = data.tables.find(t => t.id === this.tournamentActiveTableId);
      if (currentTable) {
        this.selectedCell = null;
        this.legalMoves = [];
        this.renderBoard(currentTable.gameState);
        this.updateHUD(currentTable.gameState);
      }
      this.clearHistoryUI();
      this.closeVictoryModal();
      this.showToast('🔄 Toàn bộ 4 bàn thi đấu đã được reset sau khi cả 4 trận kết thúc! Vòng mới bắt đầu.', 'success');
    });

    window.PlayFull.on('tournament_new_chat', (data) => {
      this.appendChatMessage(data);
      if (data.role !== 'system') window.soundEngine.playChat();
    });

    window.PlayFull.on('tournament_floating_reaction', (data) => {
      this.spawnFloatingReaction(data.emoji);
      window.soundEngine.playReaction();
    });

    window.PlayFull.init();
    window.PlayFull.joinTournament({
      playerName,
      role: roleParam,
      tableId: tableParam,
      color: colorParam
    });
  }

  renderTournamentTablesNav(tables) {
    const nav = document.getElementById('tournament-nav-bar');
    if (!nav || !tables) return;
    nav.innerHTML = '';

    tables.forEach(t => {
      const btn = document.createElement('button');
      btn.className = `btn btn-glass tour-tab-btn ${t.id === this.tournamentActiveTableId ? 'active-tab' : ''}`;
      
      const red = t.players.red ? t.players.red.name : 'Trống';
      const blue = t.players.blue ? t.players.blue.name : 'Trống';
      const isPlaying = t.players.red && t.players.blue && !t.gameState.winner;
      const isFinished = !!t.gameState.winner;

      let statusIcon = '⏳';
      if (isPlaying) statusIcon = '⚔️';
      if (isFinished) statusIcon = '🏆';

      btn.innerHTML = `
        <span style="font-weight: 800;">${statusIcon} Bàn ${t.id}</span>
        <span style="font-size: 11px; opacity: 0.85;">(${red} vs ${blue})</span>
      `;

      btn.onclick = () => {
        this.focusTable(t.id);
      };

      nav.appendChild(btn);
    });
  }

  updateTableNavStatus(tableId, gameState) {
    if (window.PlayFull.tournamentData && window.PlayFull.tournamentData.tables) {
      this.renderTournamentTablesNav(window.PlayFull.tournamentData.tables);
    }
  }

  displayTournamentTable(tableId) {
    if (!window.PlayFull.tournamentData) return;
    const table = window.PlayFull.tournamentData.tables.find(t => t.id === tableId);
    if (!table) return;

    this.selectedCell = null;
    this.legalMoves = [];
    this.renderBoard(table.gameState);
    this.updateHUD(table.gameState);
    this.updatePlayersUI(table.players);

    // Update Turn Banner with Table Name
    const banner = document.getElementById('turn-status-banner');
    if (banner) {
      const isRed = table.gameState.turn === 'red';
      const status = table.gameState.winner
        ? `🏆 ĐÃ KẾT THÚC (${table.gameState.winner === 'red' ? 'ĐỎ' : 'XANH'} THẮNG)`
        : `LƯỢT: ${isRed ? '🔴 QUÂN ĐỎ' : '🔵 QUÂN XANH'}`;
      banner.innerHTML = `<strong>[Bàn ${table.id}]</strong> ${status}`;
    }
  }

  updateTournamentRoleBadge(data) {
    const badge = document.getElementById('badge-my-role');
    if (!badge) return;

    if (data.role === 'player') {
      badge.textContent = `Tuyển thủ: Bàn ${data.assignedTableId} (${data.assignedColor === 'red' ? 'ĐỎ' : 'XANH'})`;
      badge.style.color = data.assignedColor === 'red' ? 'var(--color-red)' : 'var(--color-blue)';
      badge.style.borderColor = data.assignedColor === 'red' ? 'var(--color-red)' : 'var(--color-blue)';
    } else {
      badge.textContent = 'Khán Giả Toàn Cảnh (Spectator)';
      badge.style.color = 'var(--color-gold)';
      badge.style.borderColor = 'var(--color-gold)';
    }
  }

  // ========================================================
  // QUAD-VIEW (4 BÀN CÙNG 1 TRANG WEB CHO KHÁN GIẢ)
  // ========================================================
  toggleTournamentViewMode() {
    this.tournamentViewMode = (this.tournamentViewMode === 'quad') ? 'single' : 'quad';
    this.applyTournamentViewMode();
  }

  applyTournamentViewMode() {
    const quadContainer = document.getElementById('tournament-quad-container');
    const singleContainer = document.getElementById('single-arena-container');
    const toggleBtn = document.getElementById('btn-toggle-view-mode');

    if (!quadContainer || !singleContainer) return;

    if (this.tournamentViewMode === 'quad') {
      quadContainer.style.display = 'flex';
      singleContainer.style.display = 'none';
      if (toggleBtn) {
        toggleBtn.innerHTML = '🎯 Xem Cận Cảnh Bàn';
        toggleBtn.title = 'Phóng to 1 bàn cụ thể';
      }
      if (window.PlayFull.tournamentData && window.PlayFull.tournamentData.tables) {
        this.renderQuadView(window.PlayFull.tournamentData.tables);
      }
    } else {
      quadContainer.style.display = 'none';
      singleContainer.style.display = 'grid';
      if (toggleBtn) {
        toggleBtn.innerHTML = '📺 Xem Toàn Cảnh 4 Bàn';
        toggleBtn.title = 'Theo dõi đồng thời 4 bàn thi đấu trên 1 màn hình';
      }
      this.displayTournamentTable(this.tournamentActiveTableId);
    }
  }

  focusTable(tableId) {
    this.tournamentActiveTableId = tableId;
    this.tournamentViewMode = 'single';
    this.applyTournamentViewMode();
    this.displayTournamentTable(tableId);

    document.querySelectorAll('.tour-tab-btn').forEach((btn, idx) => {
      if (idx + 1 === tableId) btn.classList.add('active-tab');
      else btn.classList.remove('active-tab');
    });
    this.showToast(`Đã chuyển sang xem Bàn ${tableId}`);
  }

  renderQuadView(tables) {
    const quadGrid = document.getElementById('quad-view-grid');
    if (!quadGrid || !tables) return;
    quadGrid.innerHTML = '';

    tables.forEach(t => {
      const card = document.createElement('div');
      card.className = 'quad-table-card glass-panel';
      card.id = `quad-card-table-${t.id}`;

      const red = t.players.red ? t.players.red.name : 'Chờ tuyển thủ';
      const blue = t.players.blue ? t.players.blue.name : 'Chờ tuyển thủ';
      const isFinished = !!t.gameState.winner;
      const isPlaying = t.players.red && t.players.blue && !isFinished;

      let statusBadge = '<span style="color: var(--color-green); font-size: 11px;">● Sẵn sàng</span>';
      if (isPlaying) {
        statusBadge = '<span style="color: var(--color-gold); font-weight: 700; font-size: 11px;">⚔️ Đang thi đấu</span>';
      } else if (isFinished) {
        const winColor = t.gameState.winner === 'red' ? 'var(--color-red)' : 'var(--color-blue)';
        const winName = t.gameState.winner === 'red' ? red : blue;
        statusBadge = `<span style="color: ${winColor}; font-weight: 800; font-size: 11px;">🏆 ${winName} Thắng!</span>`;
      }

      const turnText = isFinished
        ? `<span style="color: var(--color-gold); font-weight:700;">Đã xong</span>`
        : (isPlaying
            ? `Lượt: ${t.gameState.turn === 'red' ? '<strong style="color:var(--color-red)">ĐỎ</strong>' : '<strong style="color:var(--color-blue)">XANH</strong>'}`
            : 'Chờ ghép cặp');

      card.innerHTML = `
        <div class="quad-table-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 800; font-size: 15px; color: var(--color-gold);">🏆 BÀN ${t.id}</span>
            ${statusBadge}
          </div>
          <button class="btn btn-glass btn-sm" onclick="window.GameUI.focusTable(${t.id})" style="padding: 3px 10px; font-size: 11px;">
            🔍 Xem Chi Tiết
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; width: 100%; font-size: 11px; padding: 4px 8px; background: rgba(0,0,0,0.3); border-radius: 6px;">
          <div style="color: var(--color-red); font-weight: 700;">
            🔴 ${red} <span id="quad-red-count-${t.id}">(${t.gameState.pieceCounts ? t.gameState.pieceCounts.red.total : 9}/9)</span>
          </div>
          <div id="quad-turn-${t.id}" style="color: var(--text-dim); font-size: 11px;">
            ${turnText}
          </div>
          <div style="color: var(--color-blue); font-weight: 700;">
            🔵 ${blue} <span id="quad-blue-count-${t.id}">(${t.gameState.pieceCounts ? t.gameState.pieceCounts.blue.total : 9}/9)</span>
          </div>
        </div>

        <div class="quad-board-outer">
          <div class="quad-board-grid" id="quad-board-${t.id}"></div>
        </div>
      `;

      quadGrid.appendChild(card);
      this.populateQuadBoardGrid(t.id, t.gameState);
    });
  }

  populateQuadBoardGrid(tableId, gameState) {
    const boardEl = document.getElementById(`quad-board-${tableId}`);
    if (!boardEl || !gameState) return;
    boardEl.innerHTML = '';

    const board = gameState.board;
    for (let r = 8; r >= 0; r--) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'quad-cell ' + ((r + c) % 2 === 0 ? 'cell-dark' : 'cell-light');

        if (c === 0 && r === 0) {
          cell.classList.add('sanctuary-a1');
          cell.title = 'a1 (Căn cứ mục tiêu của XANH)';
        } else if (c === 8 && r === 8) {
          cell.classList.add('sanctuary-i9');
          cell.title = 'i9 (Căn cứ mục tiêu của ĐỎ)';
        }

        const piece = board[r][c];
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = `quad-piece ${piece.player === 'red' ? 'red-piece' : 'blue-piece'}`;

          let icon = '✊';
          if (piece.type === window.OTT.PIECE_TYPES.PAPER) icon = '✋';
          else if (piece.type === window.OTT.PIECE_TYPES.SCISSORS) icon = '✌️';

          pieceEl.textContent = icon;
          cell.appendChild(pieceEl);
        }

        boardEl.appendChild(cell);
      }
    }
  }

  updateQuadTable(tableId, gameState) {
    this.populateQuadBoardGrid(tableId, gameState);

    const redCount = document.getElementById(`quad-red-count-${tableId}`);
    const blueCount = document.getElementById(`quad-blue-count-${tableId}`);
    const turnEl = document.getElementById(`quad-turn-${tableId}`);

    if (gameState.pieceCounts) {
      if (redCount) redCount.textContent = `(${gameState.pieceCounts.red.total}/9)`;
      if (blueCount) blueCount.textContent = `(${gameState.pieceCounts.blue.total}/9)`;
    }

    if (turnEl) {
      if (gameState.winner) {
        const winColor = gameState.winner === 'red' ? 'var(--color-red)' : 'var(--color-blue)';
        turnEl.innerHTML = `<strong style="color:${winColor}">🏆 Đã xong</strong>`;
      } else {
        turnEl.innerHTML = `Lượt: ${gameState.turn === 'red' ? '<strong style="color:var(--color-red)">ĐỎ</strong>' : '<strong style="color:var(--color-blue)">XANH</strong>'}`;
      }
    }
  }

  updateTourResetButtonState(tables) {
    const btn = document.getElementById('btn-tour-reset-all');
    if (!btn) return;

    if (this.mode !== 'tournament' || this.myRole === 'spectator') {
      btn.style.display = 'none';
      return;
    }

    btn.style.display = 'inline-flex';
    if (!tables || tables.length === 0) return;

    const finishedCount = tables.filter(t => !!t.gameState.winner).length;
    if (finishedCount === 4) {
      btn.innerHTML = '🔄 Reset Toàn Bộ Giải (Cả 4 bàn đã xong!)';
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.boxShadow = '0 0 15px rgba(255, 51, 102, 0.6)';
    } else {
      btn.innerHTML = `⏳ Chưa thể Reset (${finishedCount}/4 bàn xong)`;
      btn.disabled = false;
      btn.style.opacity = '0.75';
      btn.style.boxShadow = 'none';
    }
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
        if (this.mode === 'online' || this.mode === 'tournament') {
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
        if (this.mode === 'online' || this.mode === 'tournament') {
          window.PlayFull.sendReaction(emoji);
        } else {
          this.spawnFloatingReaction(emoji);
          window.soundEngine.playReaction();
        }
      });
    });

    // Toggle View Mode: Quad-View vs Single Focus
    const toggleViewBtn = document.getElementById('btn-toggle-view-mode');
    if (toggleViewBtn) {
      toggleViewBtn.addEventListener('click', () => {
        this.toggleTournamentViewMode();
      });
    }

    // Tournament Reset All Button (For players after all 4 finished)
    const tourResetBtn = document.getElementById('btn-tour-reset-all');
    if (tourResetBtn) {
      tourResetBtn.addEventListener('click', () => {
        if (this.myRole === 'spectator') {
          this.showToast('Khán giả không có quyền reset giải đấu! Bạn chỉ có quyền theo dõi giải.', 'warning');
          return;
        }
        const tables = (window.PlayFull.tournamentData && window.PlayFull.tournamentData.tables) || [];
        const allDone = tables.length === 4 && tables.every(t => !!t.gameState.winner);
        if (!allDone) {
          const finishedCount = tables.filter(t => !!t.gameState.winner).length;
          this.showToast(`Chưa thể reset giải đấu! Hiện tại mới có ${finishedCount}/4 bàn kết thúc. Phải thi đấu xong cả 4 bàn mới được phép reset!`, 'warning');
          return;
        }
        window.PlayFull.resetTournamentAll();
      });
    }

    // Rematch button
    const rematchBtn = document.getElementById('btn-rematch');
    if (rematchBtn) {
      rematchBtn.addEventListener('click', () => {
        if (this.myRole === 'spectator') {
          this.showToast('Khán giả chỉ có quyền xem, không được quyền reset lại ván đấu!', 'warning');
          return;
        }
        if (this.mode === 'tournament') {
          window.PlayFull.resetTournamentAll();
        } else if (this.mode === 'online') {
          window.PlayFull.resetGame();
        } else {
          this.initLocalGame();
          this.closeVictoryModal();
        }
      });
    }
  }

  getCurrentGameState() {
    if (this.mode === 'tournament') {
      if (!window.PlayFull.tournamentData) return null;
      const table = window.PlayFull.tournamentData.tables.find(t => t.id === this.tournamentActiveTableId);
      return table ? table.gameState : null;
    }
    if (this.mode === 'online') {
      return window.PlayFull.gameState;
    }
    return this.localState;
  }

  renderBoard(gameState) {
    if (!gameState || !this.boardElement) return;
    this.boardElement.innerHTML = '';

    const board = gameState.board;

    for (let r = 8; r >= 0; r--) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell ' + ((r + c) % 2 === 0 ? 'cell-dark' : 'cell-light');
        cell.dataset.col = c;
        cell.dataset.row = r;

        if (c === 0 && r === 0) {
          cell.classList.add('sanctuary-a1');
          cell.title = 'Căn cứ Mục tiêu a1 (Quân XANH đột kích để thắng)';
        } else if (c === 8 && r === 8) {
          cell.classList.add('sanctuary-i9');
          cell.title = 'Căn cứ Mục tiêu i9 (Quân ĐỎ đột kích để thắng)';
        }

        if (this.selectedCell && this.selectedCell.col === c && this.selectedCell.row === r) {
          cell.classList.add('selected-piece');
        }

        const matchedMove = this.legalMoves.find(m => m.col === c && m.row === r);
        if (matchedMove) {
          if (matchedMove.isCapture) {
            cell.classList.add('legal-capture');
          } else {
            cell.classList.add('legal-move');
          }
        }

        const piece = board[r][c];
        if (piece) {
          const pieceEl = document.createElement('div');
          pieceEl.className = `piece ${piece.player === 'red' ? 'red-piece' : 'blue-piece'}`;
          
          let icon = '✊';
          if (piece.type === window.OTT.PIECE_TYPES.PAPER) icon = '✋';
          else if (piece.type === window.OTT.PIECE_TYPES.SCISSORS) icon = '✌️';

          pieceEl.innerHTML = icon;
          cell.appendChild(pieceEl);
        }

        cell.addEventListener('click', () => this.handleCellClick(c, r));
        this.boardElement.appendChild(cell);
      }
    }
  }

  handleCellClick(col, row) {
    const gameState = this.getCurrentGameState();
    if (!gameState || gameState.winner) return;

    if (this.isAiThinking) return;

    // Check move permission
    if (this.mode === 'tournament') {
      if (this.myRole !== 'player') {
        this.showToast('Bạn đang là Khán giả tại giải đấu, không thể di chuyển quân!', 'info');
        return;
      }
      if (window.PlayFull.myTableId !== this.tournamentActiveTableId) {
        this.showToast(`Bạn là tuyển thủ tại Bàn ${window.PlayFull.myTableId}, không thể đi quân ở Bàn ${this.tournamentActiveTableId}!`, 'warning');
        return;
      }
      if (window.PlayFull.myColor !== gameState.turn) {
        this.showToast(`Chưa đến lượt của bạn! Đang là lượt của bên ${gameState.turn === 'red' ? 'Đỏ' : 'Xanh'}.`, 'warning');
        return;
      }
    } else if (this.mode === 'online') {
      if (this.myRole === 'spectator') {
        this.showToast('Bạn đang ở chế độ Khán giả (Spectator), chỉ có thể theo dõi trận đấu!', 'info');
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

    if (this.selectedCell) {
      const isLegal = this.legalMoves.find(m => m.col === col && m.row === row);
      if (isLegal) {
        this.executeMove(this.selectedCell, { col, row });
        return;
      }
    }

    const currentMoverColor = (this.mode === 'tournament') ? window.PlayFull.myColor : (this.mode === 'local' ? gameState.turn : this.myRole);

    if (clickedPiece && clickedPiece.player === currentMoverColor) {
      this.selectedCell = { col, row };
      this.legalMoves = window.OTT.getLegalMoves(gameState.board, col, row);
      window.soundEngine.playSelect();
      this.renderBoard(gameState);
    } else {
      this.selectedCell = null;
      this.legalMoves = [];
      this.renderBoard(gameState);
    }
  }

  executeMove(from, to) {
    if (this.mode === 'online' || this.mode === 'tournament') {
      window.PlayFull.makeMove(from, to);
      this.selectedCell = null;
      this.legalMoves = [];
    } else {
      const result = window.OTT.makeMove(this.localState, from, to);
      if (!result.valid) {
        this.showToast(result.error, 'warning');
        return;
      }

      this.localState = result.newState;
      this.selectedCell = null;
      this.legalMoves = [];

      if (result.capturedPiece) window.soundEngine.playCapture();
      else window.soundEngine.playMove();

      this.renderBoard(this.localState);
      this.updateHUD(this.localState);
      this.addHistoryRecord(result.moveRecord);

      if (this.localState.winner) {
        window.soundEngine.playVictory();
        this.showVictoryModal(this.localState);
        return;
      }

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
      if (result.capturedPiece) window.soundEngine.playCapture();
      else window.soundEngine.playMove();
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

    const isRed = gameState.turn === 'red';
    let bannerText = isRed ? '🔴 LƯỢT CỦA BÊN ĐỎ (Player 1)' : '🔵 LƯỢT CỦA BÊN XANH (Player 2)';

    if (this.mode === 'tournament') {
      const isMyTurn = (this.myRole === 'player' && window.PlayFull.myColor === gameState.turn && window.PlayFull.myTableId === this.tournamentActiveTableId);
      bannerText = isMyTurn ? '⚡ ĐẾN LƯỢT CỦA BẠN ĐI QUÂN!' : `LƯỢT: BÊN ${isRed ? 'ĐỎ' : 'XANH'}`;
    } else if (this.mode === 'online') {
      if (this.myRole === gameState.turn) {
        bannerText = `⚡ ĐẾN LƯỢT CỦA BẠN (${this.myRole === 'red' ? 'ĐỎ' : 'XANH'})!`;
      } else if (this.myRole === 'spectator') {
        bannerText = `👁️ LƯỢT: BÊN ${isRed ? 'ĐỎ' : 'XANH'}`;
      } else {
        bannerText = `⏳ ĐANG CHỜ BÊN ${isRed ? 'ĐỎ' : 'XANH'} ĐI QUÂN...`;
      }
    }

    this.updateTurnBanner(bannerText);

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

    const counts = gameState.pieceCounts;
    const totalRed = document.getElementById('total-count-red');
    if (totalRed) totalRed.textContent = `Còn ${counts.red.total}/9 quân`;
    const totalBlue = document.getElementById('total-count-blue');
    if (totalBlue) totalBlue.textContent = `Còn ${counts.blue.total}/9 quân`;

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
      } else if (count === 0) {
        parent.classList.remove('danger-low');
        parent.classList.add('extinct');
      } else {
        parent.classList.remove('danger-low');
        parent.classList.remove('extinct');
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

    if (redNameEl) redNameEl.textContent = players.red ? players.red.name : 'Đang chờ đối thủ...';
    if (blueNameEl) blueNameEl.textContent = players.blue ? players.blue.name : 'Đang chờ đối thủ...';
  }

  updateSpectatorsUI(count) {
    const countEl = document.getElementById('spectator-count-text');
    if (countEl) countEl.textContent = `${count} Khán giả`;
  }

  addHistoryRecord(record) {
    const historyList = document.getElementById('history-list');
    if (!historyList || !record) return;

    const item = document.createElement('div');
    item.className = 'history-item' + (record.captured ? ' capture' : '');

    let pieceIcon = '✊';
    if (record.piece === 'PAPER') pieceIcon = '✋';
    if (record.piece === 'SCISSORS') pieceIcon = '✌️';

    let captureText = record.captured ? ` ⚔️ (Ăn ${record.captured})` : '';
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
    const rematchBtn = document.getElementById('btn-rematch');

    if (!modal) return;

    const isRed = gameState.winner === 'red';
    if (titleEl) {
      titleEl.innerHTML = `🏆 BÊN ${isRed ? '<span style="color:var(--color-red)">ĐỎ</span>' : '<span style="color:var(--color-blue)">XANH</span>'} CHIẾN THẮNG!`;
    }
    if (descEl) descEl.textContent = gameState.winDescription;

    // SPECTATORS CANNOT RESET MATCHES
    if (rematchBtn) {
      if (this.myRole === 'spectator') {
        rematchBtn.style.display = 'none';
      } else {
        rematchBtn.style.display = 'inline-flex';
      }
    }

    modal.classList.add('active');
  }

  closeVictoryModal() {
    const modal = document.getElementById('victory-modal');
    if (modal) modal.classList.remove('active');
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
