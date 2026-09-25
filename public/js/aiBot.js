/**
 * AI Bot Engine for OTTv2
 * Implements tactical heuristic evaluation for Single Player vs AI mode.
 */
class AIBot {
  constructor(playerColor = 'blue') {
    this.color = playerColor;
    this.opponentColor = (playerColor === 'blue') ? 'red' : 'blue';
  }

  getBestMove(gameState) {
    const allMoves = window.OTT.getAllLegalMovesForPlayer(gameState.board, this.color);
    if (!allMoves || allMoves.length === 0) return null;

    let bestScore = -Infinity;
    let candidates = [];

    // Target sanctuary for Blue is a1 (0, 0), for Red is i9 (8, 8)
    const targetGoal = (this.color === 'blue') ? { col: 0, row: 0 } : { col: 8, row: 8 };

    for (const move of allMoves) {
      let score = 0;

      // 1. Immediate Win: Reach Goal Sanctuary (+5000)
      if (move.to.col === targetGoal.col && move.to.row === targetGoal.row) {
        return move;
      }

      // 2. Extinction Win Check (+4000)
      if (move.isCapture && move.targetPiece) {
        const oppPieceType = move.targetPiece.type;
        const currentOppCount = gameState.pieceCounts[this.opponentColor][oppPieceType];
        if (currentOppCount === 1) {
          // Capturing this last piece of this type triggers immediate extinction victory!
          return move;
        }

        // Regular capture: value based on how few opponent has (+300 to +800)
        score += 350 + (3 - currentOppCount) * 150;
      }

      // 3. Distance to Goal Sanctuary: Closer is better (+10 to +80)
      const currentDist = Math.max(Math.abs(move.from.col - targetGoal.col), Math.abs(move.from.row - targetGoal.row));
      const newDist = Math.max(Math.abs(move.to.col - targetGoal.col), Math.abs(move.to.row - targetGoal.row));
      if (newDist < currentDist) {
        score += 45 * (8 - newDist);
      }

      // 4. Safety Check: Will moving to (to.col, to.row) put this piece in immediate danger of being captured?
      // Simulate move on cloned board
      const simulatedBoard = gameState.board.map(r => r.map(c => (c ? { ...c } : null)));
      simulatedBoard[move.to.row][move.to.col] = simulatedBoard[move.from.row][move.from.col];
      simulatedBoard[move.from.row][move.from.col] = null;

      // Check if any opponent piece can capture our piece at this new position
      const oppLegalMoves = window.OTT.getAllLegalMovesForPlayer(simulatedBoard, this.opponentColor);
      const inDanger = oppLegalMoves.some(oppM => oppM.to.col === move.to.col && oppM.to.row === move.to.row && oppM.isCapture);
      if (inDanger) {
        // Penalty for putting piece in danger
        const myPieceCount = gameState.pieceCounts[this.color][move.piece.type];
        if (myPieceCount === 1) {
          score -= 3000; // Never suicide our last piece of a type!
        } else {
          score -= 350;
        }
      }

      // 5. Threatening Opponent Pieces: bonus if our new position threatens enemy pieces
      const newLegalMoves = window.OTT.getLegalMoves(simulatedBoard, move.to.col, move.to.row);
      const threats = newLegalMoves.filter(m => m.isCapture).length;
      score += threats * 30;

      // 6. Tiny randomness to break ties naturally
      score += Math.random() * 15;

      if (score > bestScore) {
        bestScore = score;
        candidates = [move];
      } else if (Math.abs(score - bestScore) < 5) {
        candidates.push(move);
      }
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}

window.AIBot = AIBot;
