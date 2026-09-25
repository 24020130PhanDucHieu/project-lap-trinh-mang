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
console.log('Sanctuary Goal i9 Test:');
console.log('  Valid:', resGoal.valid);
console.log('  Winner:', resGoal.newState.winner);
console.log('  Reason:', resGoal.newState.winReason);
console.log('  Desc:', resGoal.newState.winDescription);
if (resGoal.newState.winner !== 'red' || resGoal.newState.winReason !== 'SANCTUARY') {
  throw new Error('Sanctuary goal test failed!');
}

// Test 2: Extinction Win (All Rocks of opponent eliminated)
let state2 = {
  board: Array(9).fill(null).map(() => Array(9).fill(null)),
  turn: gameLogic.PLAYERS.RED,
  pieceCounts: null,
  history: []
};
// Red Paper at d4 (3, 3)
state2.board[3][3] = { id: 'red_p', type: gameLogic.PIECE_TYPES.PAPER, player: gameLogic.PLAYERS.RED };
// Blue has ONLY ONE Rock at e4 (4, 3) and 3 scissors
state2.board[3][4] = { id: 'blue_r', type: gameLogic.PIECE_TYPES.ROCK, player: gameLogic.PLAYERS.BLUE };
state2.board[8][0] = { id: 'blue_s1', type: gameLogic.PIECE_TYPES.SCISSORS, player: gameLogic.PLAYERS.BLUE };
state2.board[8][1] = { id: 'blue_s2', type: gameLogic.PIECE_TYPES.SCISSORS, player: gameLogic.PLAYERS.BLUE };
state2.pieceCounts = gameLogic.countPieces(state2.board);

console.log('\nExtinction Test:');
console.log('  Blue pieces before move:', state2.pieceCounts.blue);
// Red Paper attacks Blue Rock at e4 (Paper beats Rock!)
const resExtinct = gameLogic.makeMove(state2, { col: 3, row: 3 }, { col: 4, row: 3 });
console.log('  Valid:', resExtinct.valid);
console.log('  Captured:', resExtinct.capturedPiece ? resExtinct.capturedPiece.type : 'none');
console.log('  Winner:', resExtinct.newState.winner);
console.log('  Reason:', resExtinct.newState.winReason);
console.log('  Desc:', resExtinct.newState.winDescription);
if (resExtinct.newState.winner !== 'red' || resExtinct.newState.winReason !== 'EXTINCTION') {
  throw new Error('Extinction test failed!');
}

// Test 3: Same-type block test (Two Rocks cannot eat each other)
let state3 = {
  board: Array(9).fill(null).map(() => Array(9).fill(null)),
  turn: gameLogic.PLAYERS.RED,
  pieceCounts: null,
  history: []
};
state3.board[3][3] = { id: 'red_r', type: gameLogic.PIECE_TYPES.ROCK, player: gameLogic.PLAYERS.RED };
state3.board[3][4] = { id: 'blue_r', type: gameLogic.PIECE_TYPES.ROCK, player: gameLogic.PLAYERS.BLUE };
state3.pieceCounts = gameLogic.countPieces(state3.board);

const resSame = gameLogic.makeMove(state3, { col: 3, row: 3 }, { col: 4, row: 3 });
console.log('\nSame Type Block Test:');
console.log('  Valid:', resSame.valid);
console.log('  Error:', resSame.error);
if (resSame.valid !== false) {
  throw new Error('Same type block test failed!');
}

console.log('\n✅ ALL GAME RULES AND WIN CONDITION TESTS PASSED 100%!');
