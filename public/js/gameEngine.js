/**
 * OTTv2 (Oẳn Tù Tì v2) - Game Engine (Client Side)
 */
const PIECE_TYPES = {
  ROCK: 'ROCK',         // Đấm ✊
  PAPER: 'PAPER',       // Lá ✋
  SCISSORS: 'SCISSORS'  // Kéo ✌️
};

const PLAYERS = {
  RED: 'red',   // Player 1 (Bottom, moves toward i9)
  BLUE: 'blue'  // Player 2 (Top, moves toward a1)
};

const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
const ROWS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function posToCoord(col, row) {
  return `${COLS[col]}${ROWS[row]}`;
}

function coordToPos(coord) {
  if (!coord || coord.length < 2) return null;
  const colChar = coord[0].toLowerCase();
  const rowChar = coord.slice(1);
  const col = COLS.indexOf(colChar);
  const row = ROWS.indexOf(rowChar);
  if (col === -1 || row === -1) return null;
  return { col, row };
}

function canBeat(attackerType, defenderType) {
  if (attackerType === PIECE_TYPES.ROCK && defenderType === PIECE_TYPES.SCISSORS) return true;
  if (attackerType === PIECE_TYPES.SCISSORS && defenderType === PIECE_TYPES.PAPER) return true;
  if (attackerType === PIECE_TYPES.PAPER && defenderType === PIECE_TYPES.ROCK) return true;
  return false;
}

function isSameType(typeA, typeB) {
  return typeA === typeB;
}

function createInitialBoard(layout = 'frontline') {
  const board = Array(9).fill(null).map(() => Array(9).fill(null));

  const standardSequence = [
    PIECE_TYPES.ROCK,     // a
    PIECE_TYPES.PAPER,    // b
    PIECE_TYPES.SCISSORS, // c
    PIECE_TYPES.ROCK,     // d
    PIECE_TYPES.PAPER,    // e
    PIECE_TYPES.SCISSORS, // f
    PIECE_TYPES.ROCK,     // g
    PIECE_TYPES.PAPER,    // h
    PIECE_TYPES.SCISSORS  // i
  ];

  if (layout === 'frontline') {
    // Red on Row 2 (index 1)
    for (let c = 0; c < 9; c++) {
      board[1][c] = {
        id: `red_${standardSequence[c]}_${c}`,
        type: standardSequence[c],
        player: PLAYERS.RED
      };
    }
    // Blue on Row 8 (index 7)
    for (let c = 0; c < 9; c++) {
      board[7][c] = {
        id: `blue_${standardSequence[c]}_${c}`,
        type: standardSequence[c],
        player: PLAYERS.BLUE
      };
    }
  } else {
    // Baseline: Row 1 (index 0) & Row 9 (index 8)
    for (let c = 0; c < 9; c++) {
      board[0][c] = {
        id: `red_${standardSequence[c]}_${c}`,
        type: standardSequence[c],
        player: PLAYERS.RED
      };
      board[8][c] = {
        id: `blue_${standardSequence[c]}_${c}`,
        type: standardSequence[c],
        player: PLAYERS.BLUE
      };
    }
  }

  return board;
}

function countPieces(board) {
  const counts = {
    red: { [PIECE_TYPES.ROCK]: 0, [PIECE_TYPES.PAPER]: 0, [PIECE_TYPES.SCISSORS]: 0, total: 0 },
    blue: { [PIECE_TYPES.ROCK]: 0, [PIECE_TYPES.PAPER]: 0, [PIECE_TYPES.SCISSORS]: 0, total: 0 }
  };

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece) {
        counts[piece.player][piece.type]++;
        counts[piece.player].total++;
      }
    }
  }

  return counts;
}

function getLegalMoves(board, fromCol, fromRow) {
  if (fromCol < 0 || fromCol > 8 || fromRow < 0 || fromRow > 8) return [];
  const piece = board[fromRow][fromCol];
  if (!piece) return [];

  const moves = [];
  const directions = [
    { dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 },
    { dc: -1, dr: 0 },                     { dc: 1, dr: 0 },
    { dc: -1, dr: 1 },  { dc: 0, dr: 1 },  { dc: 1, dr: 1 }
  ];

  for (const { dc, dr } of directions) {
    const toCol = fromCol + dc;
    const toRow = fromRow + dr;

    if (toCol < 0 || toCol > 8 || toRow < 0 || toRow > 8) continue;

    const target = board[toRow][toCol];

    if (!target) {
      moves.push({ col: toCol, row: toRow, isCapture: false, targetPiece: null });
    } else if (target.player !== piece.player) {
      if (canBeat(piece.type, target.type)) {
        moves.push({ col: toCol, row: toRow, isCapture: true, targetPiece: target });
      }
    }
  }

  return moves;
}

function getAllLegalMovesForPlayer(board, player) {
  const allMoves = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece && piece.player === player) {
        const moves = getLegalMoves(board, c, r);
        for (const m of moves) {
          allMoves.push({
            from: { col: c, row: r },
            to: { col: m.col, row: m.row },
            isCapture: m.isCapture,
            piece,
            targetPiece: m.targetPiece
          });
        }
      }
    }
  }
  return allMoves;
}

function makeMove(gameState, from, to) {
  const { board, turn, history = [] } = gameState;
  const fromCol = from.col;
  const fromRow = from.row;
  const toCol = to.col;
  const toRow = to.row;

  if (gameState.winner) {
    return { valid: false, error: 'Trận đấu đã kết thúc!' };
  }

  if (fromCol < 0 || fromCol > 8 || fromRow < 0 || fromRow > 8 ||
      toCol < 0 || toCol > 8 || toRow < 0 || toRow > 8) {
    return { valid: false, error: 'Tọa độ ngoài phạm vi bàn cờ (9x9)!' };
  }

  const piece = board[fromRow][fromCol];
  if (!piece) {
    return { valid: false, error: 'Không có quân cờ ở ô được chọn!' };
  }

  if (piece.player !== turn) {
    return { valid: false, error: `Chưa đến lượt của bên ${piece.player === PLAYERS.RED ? 'Đỏ' : 'Xanh'}!` };
  }

  const legalMoves = getLegalMoves(board, fromCol, fromRow);
  const matchedMove = legalMoves.find(m => m.col === toCol && m.row === toRow);

  if (!matchedMove) {
    const target = board[toRow][toCol];
    if (target && target.player === piece.player) {
      return { valid: false, error: 'Không thể đi vào ô có quân cùng phe!' };
    }
    if (target && isSameType(piece.type, target.type)) {
      return { valid: false, error: 'Hai quân cùng loại không thể ăn nhau, chỉ đứng chặn đường nhau!' };
    }
    if (target && !canBeat(piece.type, target.type)) {
      return { valid: false, error: `${piece.type} không thể ăn ${target.type} theo luật Oẳn Tù Tì!` };
    }
    return { valid: false, error: 'Nước đi không hợp lệ! Quân cờ chỉ được di chuyển 1 ô theo 8 hướng.' };
  }

  const newBoard = board.map(row => row.map(cell => (cell ? { ...cell } : null)));
  const capturedPiece = matchedMove.isCapture ? { ...matchedMove.targetPiece } : null;

  newBoard[toRow][toCol] = { ...piece };
  newBoard[fromRow][fromCol] = null;

  const pieceCounts = countPieces(newBoard);

  let winner = null;
  let winReason = null;
  let winDescription = '';

  const opponent = (turn === PLAYERS.RED) ? PLAYERS.BLUE : PLAYERS.RED;

  // 1. Victory Square Check
  if (turn === PLAYERS.RED && toCol === 8 && toRow === 8) {
    winner = PLAYERS.RED;
    winReason = 'SANCTUARY';
    winDescription = 'Quân ĐỎ đã đột kích thành công vào căn cứ i9 của đối phương! CHIẾN THẮNG!';
  } else if (turn === PLAYERS.BLUE && toCol === 0 && toRow === 0) {
    winner = PLAYERS.BLUE;
    winReason = 'SANCTUARY';
    winDescription = 'Quân XANH đã đột kích thành công vào căn cứ a1 của đối phương! CHIẾN THẮNG!';
  }

  // 2. Total Elimination Check (Ăn sạch toàn bộ quân trên bàn cờ của đối thủ):
  if (!winner) {
    const oppCounts = pieceCounts[opponent];
    if (oppCounts.total === 0) {
      winner = turn;
      winReason = 'TOTAL_ELIMINATION';
      winDescription = `Bên ${turn === PLAYERS.RED ? 'ĐỎ' : 'XANH'} đã ăn sạch toàn bộ quân trên bàn cờ của đối thủ! CHIẾN THẮNG TUYỆT ĐỐI!`;
    }
  }

  // 3. Stalemate Check
  if (!winner) {
    const opponentMoves = getAllLegalMovesForPlayer(newBoard, opponent);
    if (opponentMoves.length === 0) {
      winner = turn;
      winReason = 'STALEMATE';
      winDescription = `Đối phương bị chặn hết mọi hướng đi (hết nước đi hợp lệ)! Bên ${turn === PLAYERS.RED ? 'ĐỎ' : 'XANH'} THẮNG!`;
    }
  }

  const nextTurn = winner ? turn : opponent;

  const moveRecord = {
    turnNumber: (history.length + 1),
    player: turn,
    piece: piece.type,
    from: posToCoord(fromCol, fromRow),
    to: posToCoord(toCol, toRow),
    captured: capturedPiece ? capturedPiece.type : null,
    timestamp: Date.now()
  };

  return {
    valid: true,
    moveRecord,
    capturedPiece,
    newState: {
      ...gameState,
      board: newBoard,
      turn: nextTurn,
      pieceCounts,
      winner,
      winReason,
      winDescription,
      history: [...history, moveRecord]
    }
  };
}

window.OTT = {
  PIECE_TYPES,
  PLAYERS,
  COLS,
  ROWS,
  posToCoord,
  coordToPos,
  canBeat,
  isSameType,
  createInitialBoard,
  countPieces,
  getLegalMoves,
  getAllLegalMovesForPlayer,
  makeMove
};
