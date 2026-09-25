/**
 * OTTv2 (Oẳn Tù Tì v2) - Game Logic Engine
 * Board: 9x9 Grid (Columns a-i [0-8], Rows 1-9 [0-8])
 * Rules:
 *  - 3 Piece types: ROCK (Đấm ✊), PAPER (Lá ✋), SCISSORS (Kéo ✌️)
 *  - Each piece moves 1 square in any of the 8 directions (like a King in Chess)
 *  - Combat: Rock beats Scissors, Scissors beats Paper, Paper beats Rock.
 *    Same type cannot capture each other ("chỉ đứng chặn đường nhau").
 *    Inferior type cannot attack superior type.
 *  - Win Conditions:
 *    1. Capture ALL pieces of any ONE type of the opponent (0 Rocks, 0 Papers, or 0 Scissors).
 *    2. Move any piece into the designated victory square:
 *       - Player RED (Bottom) wins by reaching 'i9' (col 8, row 8).
 *       - Player BLUE (Top) wins by reaching 'a1' (col 0, row 0).
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

/**
 * Creates initial 9x9 board
 * Layout:
 * Frontline (Row 2 [row 1] for Red, Row 8 [row 7] for Blue)
 * Leaving a1 (0,0) and i9 (8,8) clearly marked as target base sanctuaries!
 */
function createInitialBoard(layout = 'frontline') {
  const board = Array(9).fill(null).map(() => Array(9).fill(null));

  const standardSequence = [
    PIECE_TYPES.ROCK,     // col a
    PIECE_TYPES.PAPER,    // col b
    PIECE_TYPES.SCISSORS, // col c
    PIECE_TYPES.ROCK,     // col d
    PIECE_TYPES.PAPER,    // col e
    PIECE_TYPES.SCISSORS, // col f
    PIECE_TYPES.ROCK,     // col g
    PIECE_TYPES.PAPER,    // col h
    PIECE_TYPES.SCISSORS  // col i
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
    // Baseline: Row 1 (index 0) and Row 9 (index 8)
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

/**
 * Returns array of legal target squares { col, row, isCapture, targetPiece }
 * for piece at (fromCol, fromRow)
 */
function getLegalMoves(board, fromCol, fromRow) {
  if (fromCol < 0 || fromCol > 8 || fromRow < 0 || fromRow > 8) return [];
  const piece = board[fromRow][fromCol];
  if (!piece) return [];

  const moves = [];
  // 8 King directions: dx, dy in [-1, 0, 1]
  const directions = [
    { dc: -1, dr: -1 }, { dc: 0, dr: -1 }, { dc: 1, dr: -1 },
    { dc: -1, dr: 0 },                     { dc: 1, dr: 0 },
    { dc: -1, dr: 1 },  { dc: 0, dr: 1 },  { dc: 1, dr: 1 }
  ];

  for (const { dc, dr } of directions) {
    const toCol = fromCol + dc;
    const toRow = fromRow + dr;

    // Check bounds
    if (toCol < 0 || toCol > 8 || toRow < 0 || toRow > 8) continue;

    const target = board[toRow][toCol];

    if (!target) {
      // Empty square is always valid
      moves.push({ col: toCol, row: toRow, isCapture: false, targetPiece: null });
    } else if (target.player !== piece.player) {
      // Opponent piece: check combat rule
      if (canBeat(piece.type, target.type)) {
        // Can capture!
        moves.push({ col: toCol, row: toRow, isCapture: true, targetPiece: target });
      }
      // If same type or inferior: blocked, cannot move here!
    }
    // Friendly piece: blocked
  }

  return moves;
}

/**
 * Checks if a player has any valid moves on the board
 */
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

/**
 * Executes a move, validates rules, updates board, checks win conditions
 * Returns { valid: boolean, error?: string, newState?: object }
 */
function makeMove(gameState, from, to) {
  const { board, turn, history = [] } = gameState;
  const fromCol = from.col;
  const fromRow = from.row;
  const toCol = to.col;
  const toRow = to.row;

  if (gameState.winner) {
    return { valid: false, error: 'Trận đấu đã kết thúc!' };
  }

  // Bounds check
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

  // Deep clone board
  const newBoard = board.map(row => row.map(cell => (cell ? { ...cell } : null)));
  const capturedPiece = matchedMove.isCapture ? { ...matchedMove.targetPiece } : null;

  // Move piece
  newBoard[toRow][toCol] = { ...piece };
  newBoard[fromRow][fromCol] = null;

  // Count remaining pieces
  const pieceCounts = countPieces(newBoard);

  // Check Win Conditions:
  let winner = null;
  let winReason = null;
  let winDescription = '';

  const opponent = (turn === PLAYERS.RED) ? PLAYERS.BLUE : PLAYERS.RED;

  // 1. Victory Square Check (Goal Sanctuary):
  // Red reaches i9 (col 8, row 8) -> Red wins!
  if (turn === PLAYERS.RED && toCol === 8 && toRow === 8) {
    winner = PLAYERS.RED;
    winReason = 'SANCTUARY';
    winDescription = 'Quân ĐỎ đã đột kích thành công vào căn cứ i9 của đối phương! CHIẾN THẮNG!';
  }
  // Blue reaches a1 (col 0, row 0) -> Blue wins!
  else if (turn === PLAYERS.BLUE && toCol === 0 && toRow === 0) {
    winner = PLAYERS.BLUE;
    winReason = 'SANCTUARY';
    winDescription = 'Quân XANH đã đột kích thành công vào căn cứ a1 của đối phương! CHIẾN THẮNG!';
  }

  // 2. Extinction Check (Eliminated all pieces of ANY single type of opponent):
  if (!winner) {
    const oppCounts = pieceCounts[opponent];
    if (oppCounts[PIECE_TYPES.ROCK] === 0) {
      winner = turn;
      winReason = 'EXTINCTION';
      winDescription = `Bên ${turn === PLAYERS.RED ? 'ĐỎ' : 'XANH'} đã tiêu diệt toàn bộ quân ĐẤM ✊ của đối phương! CHIẾN THẮNG!`;
    } else if (oppCounts[PIECE_TYPES.PAPER] === 0) {
      winner = turn;
      winReason = 'EXTINCTION';
      winDescription = `Bên ${turn === PLAYERS.RED ? 'ĐỎ' : 'XANH'} đã tiêu diệt toàn bộ quân LÁ ✋ của đối phương! CHIẾN THẮNG!`;
    } else if (oppCounts[PIECE_TYPES.SCISSORS] === 0) {
      winner = turn;
      winReason = 'EXTINCTION';
      winDescription = `Bên ${turn === PLAYERS.RED ? 'ĐỎ' : 'XANH'} đã tiêu diệt toàn bộ quân KÉO ✌️ của đối phương! CHIẾN THẮNG!`;
    }
  }

  // 3. Stalemate Check (Opponent has no legal moves)
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

// Export for Node.js CommonJS and browser window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
} else if (typeof window !== 'undefined') {
  window.OTTGameLogic = {
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
}
