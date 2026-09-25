const gameLogic = require('./server/gameLogic');

console.log('--- TESTING GAME RULES & WIN CONDITIONS ---');

// Test 1: Red Reaching i9 (Sanctuary Win)
let state = {
  board: gameLogic.createInitialBoard('frontline'),
  turn: gameLogic.PLAYERS.RED,
  pieceCounts: null,
  history: []
};
state.pieceCounts = gameLogic.countPieces(state.board);

// Place a red piece at h8 (col 7, row 7)
state.board[7][7] = { id: 'red_h8', type: gameLogic.PIECE_TYPES.ROCK, player: gameLogic.PLAYERS.RED };
// Move red piece from h8 (7,7) to i9 (8,8)
const resGoal = gameLogic.makeMove(state, { col: 7, row: 7 }, { col: 8, row: 8 });
console.log('1. Sanctuary Goal i9 Test:');
console.log('  Valid:', resGoal.valid);
console.log('  Winner:', resGoal.newState.winner);
console.log('  Reason:', resGoal.newState.winReason);
console.log('  Desc:', resGoal.newState.winDescription);
if (resGoal.newState.winner !== 'red' || resGoal.newState.winReason !== 'SANCTUARY') {
  throw new Error('Sanctuary goal test failed!');
}

// Test 2: Eliminating 1 type does NOT prematurely end the game if opponent still has other pieces
let state2 = {
  board: Array(9).fill(null).map(() => Array(9).fill(null)),
  turn: gameLogic.PLAYERS.RED,
  pieceCounts: null,
  history: []
};
// Red Paper at d4 (3, 3)
state2.board[3][3] = { id: 'red_p', type: gameLogic.PIECE_TYPES.PAPER, player: gameLogic.PLAYERS.RED };
// Blue has ONLY ONE Rock at e4 (4, 3) AND TWO Scissors at (8, 0) and (8, 1)
state2.board[3][4] = { id: 'blue_r', type: gameLogic.PIECE_TYPES.ROCK, player: gameLogic.PLAYERS.BLUE };
state2.board[8][0] = { id: 'blue_s1', type: gameLogic.PIECE_TYPES.SCISSORS, player: gameLogic.PLAYERS.BLUE };
state2.board[8][1] = { id: 'blue_s2', type: gameLogic.PIECE_TYPES.SCISSORS, player: gameLogic.PLAYERS.BLUE };
state2.pieceCounts = gameLogic.countPieces(state2.board);

console.log('\n2. Single Type Extinction (Does NOT end game while opponent has pieces):');
console.log('  Blue pieces before move: total =', state2.pieceCounts.blue.total);
// Red Paper attacks Blue Rock at e4 (Paper beats Rock!)
const resNonEnd = gameLogic.makeMove(state2, { col: 3, row: 3 }, { col: 4, row: 3 });
console.log('  Valid:', resNonEnd.valid);
console.log('  Captured:', resNonEnd.capturedPiece ? resNonEnd.capturedPiece.type : 'none');
console.log('  Winner (should be null):', resNonEnd.newState.winner);
console.log('  Blue pieces remaining total:', resNonEnd.newState.pieceCounts.blue.total);
if (resNonEnd.newState.winner !== null) {
  throw new Error('Game ended prematurely after only 1 type was eaten!');
}

// Test 3: Total Elimination (Eating the last remaining piece on the board)
let state3 = {
  board: Array(9).fill(null).map(() => Array(9).fill(null)),
  turn: gameLogic.PLAYERS.RED,
  pieceCounts: null,
  history: []
};
// Red Paper at d4 (3, 3)
state3.board[3][3] = { id: 'red_p', type: gameLogic.PIECE_TYPES.PAPER, player: gameLogic.PLAYERS.RED };
// Blue has ONLY ONE Rock at e4 (4, 3) and NO OTHER PIECES
state3.board[3][4] = { id: 'blue_r', type: gameLogic.PIECE_TYPES.ROCK, player: gameLogic.PLAYERS.BLUE };
state3.pieceCounts = gameLogic.countPieces(state3.board);

console.log('\n3. Total Elimination Test (Eating clean all pieces on opponent board):');
console.log('  Blue pieces before move: total =', state3.pieceCounts.blue.total);
const resTotalEnd = gameLogic.makeMove(state3, { col: 3, row: 3 }, { col: 4, row: 3 });
console.log('  Valid:', resTotalEnd.valid);
console.log('  Captured:', resTotalEnd.capturedPiece ? resTotalEnd.capturedPiece.type : 'none');
console.log('  Winner:', resTotalEnd.newState.winner);
console.log('  Reason:', resTotalEnd.newState.winReason);
console.log('  Desc:', resTotalEnd.newState.winDescription);
if (resTotalEnd.newState.winner !== 'red' || resTotalEnd.newState.winReason !== 'TOTAL_ELIMINATION') {
  throw new Error('Total elimination win test failed!');
}

// Test 4: Same Type Block Test (Two Rocks cannot eat each other)
let state4 = {
  board: Array(9).fill(null).map(() => Array(9).fill(null)),
  turn: gameLogic.PLAYERS.RED,
  pieceCounts: null,
  history: []
};
state4.board[3][3] = { id: 'red_r', type: gameLogic.PIECE_TYPES.ROCK, player: gameLogic.PLAYERS.RED };
state4.board[3][4] = { id: 'blue_r', type: gameLogic.PIECE_TYPES.ROCK, player: gameLogic.PLAYERS.BLUE };
state4.pieceCounts = gameLogic.countPieces(state4.board);

const resSame = gameLogic.makeMove(state4, { col: 3, row: 3 }, { col: 4, row: 3 });
console.log('\n4. Same Type Block Test:');
console.log('  Valid:', resSame.valid);
console.log('  Error:', resSame.error);
if (resSame.valid !== false) {
  throw new Error('Same type block test failed!');
}

console.log('\n✅ ALL RULES & WIN CONDITION TESTS PASSED 100%!');
