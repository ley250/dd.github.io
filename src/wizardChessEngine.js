// ============================================================================
// Wizard Chess 2D — Simple Top-View Graphics Engine
// Clean minimalist top-down graphics, vector piece rendering, complete rules & AI
// ============================================================================

export function initWizardChess() {
  const container = document.getElementById('canvas-container') || document.body;
  if (!container) return;
  container.innerHTML = '';

  // Immediately dismiss loading overlay
  const loader = document.getElementById('loading-overlay');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => {
      if (loader.parentNode) loader.style.display = 'none';
    }, 450);
  }

  // Canvas setup
  const canvas = document.createElement('canvas');
  canvas.id = 'chess-2d-canvas';
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.cursor = 'default';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // =========================================================================
  // Game State
  // =========================================================================
  const PIECE_VALUES = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 20000 };

  // Piece-Square Tables (Midgame) for AI
  const PST_PAWN = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
  ];
  const PST_KNIGHT = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ];
  const PST_BISHOP = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ];
  const PST_ROOK = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [0,  0,  0,  5,  5,  0,  0,  0]
  ];
  const PST_QUEEN = [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [-5,  0,  5,  5,  5,  5,  0, -5],
    [0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ];
  const PST_KING = [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [20, 20,  0,  0,  0,  0, 20, 20],
    [20, 30, 10,  0,  0, 10, 30, 20]
  ];

  let boardState = Array.from({ length: 8 }, () => Array(8).fill(null));
  let currentTurn = 'w';
  let playerColor = 'w'; // 'w' | 'b'
  let selectedSquare = null;
  let validMoves = [];
  let moveHistory = [];
  let enPassantSquare = null; // { r, c }
  let lastMove = null; // { fromR, fromC, toR, toC }
  let gameOver = false;
  let isAnimating = false;
  let aiTimer = null;

  let capturedByWhite = 0;
  let capturedByBlack = 0;
  let capturedListWhite = [];
  let capturedListBlack = [];

  // Top-view orientation: 'w' (White at bottom), 'b' (Black at bottom), 'side' (East/West 90°), 'wide'
  let boardOrientation = 'w'; // 'w' | 'b' | 'east' | 'west'
  let wideMode = false;

  // Active animations
  let activeSlide = null; // { piece, fromR, fromC, toR, toC, startTime, duration, onComplete, secondarySlide }
  let capturePulses = []; // [{ r, c, startTime, duration, color }]

  const checkmateState = {
    active: false,
    winnerColor: null,
    defeatedColor: null,
    bannerVisible: false
  };

  // =========================================================================
  // Board Setup & Reset
  // =========================================================================
  function createPiece(type, color) {
    return { type, color, hasMoved: false };
  }

  function resetChessBoard(alignOrientation = true) {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    boardState = Array.from({ length: 8 }, () => Array(8).fill(null));

    // Black major pieces (rank 8, r=0)
    const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let c = 0; c < 8; c++) {
      boardState[0][c] = createPiece(backRow[c], 'b');
      boardState[1][c] = createPiece('pawn', 'b');
      boardState[6][c] = createPiece('pawn', 'w');
      boardState[7][c] = createPiece(backRow[c], 'w');
    }

    currentTurn = 'w';
    selectedSquare = null;
    validMoves = [];
    enPassantSquare = null;
    lastMove = null;
    gameOver = false;
    isAnimating = false;
    activeSlide = null;
    capturePulses = [];
    moveHistory = [];
    capturedByWhite = 0;
    capturedByBlack = 0;
    capturedListWhite = [];
    capturedListBlack = [];

    checkmateState.active = false;
    checkmateState.bannerVisible = false;
    const overlay = document.getElementById('checkmate-overlay');
    if (overlay) overlay.classList.remove('visible');

    if (alignOrientation) {
      boardOrientation = playerColor;
    }

    updateTurnUI();
    render();

    // If player is Black, AI moves first
    if (playerColor === 'b' && currentTurn === 'w') {
      scheduleAIMove(600);
    }
  }

  // =========================================================================
  // Move Generation & Rules
  // =========================================================================
  function isInside(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function getPseudoMoves(r, c, board, epSq) {
    const piece = board[r]?.[c];
    if (!piece) return [];
    const moves = [];
    const color = piece.color;
    const enemy = color === 'w' ? 'b' : 'w';

    if (piece.type === 'pawn') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;

      // 1 square forward
      const f1 = r + dir;
      if (isInside(f1, c) && !board[f1][c]) {
        moves.push({ r: f1, c, capture: false });
        // 2 squares forward
        const f2 = r + 2 * dir;
        if (r === startRow && !board[f2][c]) {
          moves.push({ r: f2, c, capture: false, isPawnDouble: true });
        }
      }

      // Diagonal captures
      for (const dc of [-1, 1]) {
        const tr = r + dir;
        const tc = c + dc;
        if (isInside(tr, tc)) {
          if (board[tr][tc] && board[tr][tc].color === enemy) {
            moves.push({ r: tr, c: tc, capture: true });
          } else if (epSq && epSq.r === tr && epSq.c === tc) {
            moves.push({ r: tr, c: tc, capture: true, enPassant: true });
          }
        }
      }
    } else if (piece.type === 'knight') {
      const jumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of jumps) {
        const tr = r + dr;
        const tc = c + dc;
        if (isInside(tr, tc)) {
          const occ = board[tr][tc];
          if (!occ) {
            moves.push({ r: tr, c: tc, capture: false });
          } else if (occ.color === enemy) {
            moves.push({ r: tr, c: tc, capture: true });
          }
        }
      }
    } else if (piece.type === 'bishop' || piece.type === 'rook' || piece.type === 'queen') {
      const dirs = [];
      if (piece.type !== 'rook') {
        dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }
      if (piece.type !== 'bishop') {
        dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }
      for (const [dr, dc] of dirs) {
        let tr = r + dr;
        let tc = c + dc;
        while (isInside(tr, tc)) {
          const occ = board[tr][tc];
          if (!occ) {
            moves.push({ r: tr, c: tc, capture: false });
          } else {
            if (occ.color === enemy) {
              moves.push({ r: tr, c: tc, capture: true });
            }
            break;
          }
          tr += dr;
          tc += dc;
        }
      }
    } else if (piece.type === 'king') {
      const dirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      for (const [dr, dc] of dirs) {
        const tr = r + dr;
        const tc = c + dc;
        if (isInside(tr, tc)) {
          const occ = board[tr][tc];
          if (!occ) {
            moves.push({ r: tr, c: tc, capture: false });
          } else if (occ.color === enemy) {
            moves.push({ r: tr, c: tc, capture: true });
          }
        }
      }

      // Castling
      if (!piece.hasMoved && !isSquareAttacked(r, c, enemy, board)) {
        // Kingside (c=6)
        const rookK = board[r][7];
        if (rookK && rookK.type === 'rook' && rookK.color === color && !rookK.hasMoved) {
          if (!board[r][5] && !board[r][6]) {
            if (!isSquareAttacked(r, 5, enemy, board) && !isSquareAttacked(r, 6, enemy, board)) {
              moves.push({ r, c: 6, capture: false, castle: 'k', rookFromC: 7, rookToC: 5 });
            }
          }
        }
        // Queenside (c=2)
        const rookQ = board[r][0];
        if (rookQ && rookQ.type === 'rook' && rookQ.color === color && !rookQ.hasMoved) {
          if (!board[r][1] && !board[r][2] && !board[r][3]) {
            if (!isSquareAttacked(r, 3, enemy, board) && !isSquareAttacked(r, 2, enemy, board)) {
              moves.push({ r, c: 2, capture: false, castle: 'q', rookFromC: 0, rookToC: 3 });
            }
          }
        }
      }
    }

    return moves;
  }

  function isSquareAttacked(targetR, targetC, byColor, board) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== byColor) continue;
        if (p.type === 'pawn') {
          const dir = byColor === 'w' ? -1 : 1;
          if (r + dir === targetR && (c - 1 === targetC || c + 1 === targetC)) {
            return true;
          }
        } else if (p.type === 'knight') {
          const dr = Math.abs(targetR - r);
          const dc = Math.abs(targetC - c);
          if ((dr === 1 && dc === 2) || (dr === 2 && dc === 1)) return true;
        } else if (p.type === 'king') {
          const dr = Math.abs(targetR - r);
          const dc = Math.abs(targetC - c);
          if (dr <= 1 && dc <= 1) return true;
        } else {
          // Sliding: bishop, rook, queen
          const isDiag = Math.abs(targetR - r) === Math.abs(targetC - c);
          const isOrth = targetR === r || targetC === c;
          if ((p.type === 'bishop' && isDiag) ||
              (p.type === 'rook' && isOrth) ||
              (p.type === 'queen' && (isDiag || isOrth))) {
            const stepR = Math.sign(targetR - r);
            const stepC = Math.sign(targetC - c);
            let curR = r + stepR;
            let curC = c + stepC;
            let blocked = false;
            while (curR !== targetR || curC !== targetC) {
              if (board[curR][curC]) {
                blocked = true;
                break;
              }
              curR += stepR;
              curC += stepC;
            }
            if (!blocked) return true;
          }
        }
      }
    }
    return false;
  }

  function isKingInCheck(color, board) {
    let kr = -1;
    let kc = -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'king' && p.color === color) {
          kr = r;
          kc = c;
          break;
        }
      }
      if (kr !== -1) break;
    }
    if (kr === -1) return false;
    const enemy = color === 'w' ? 'b' : 'w';
    return isSquareAttacked(kr, kc, enemy, board);
  }

  function cloneBoard(b) {
    return b.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  function simulateMove(board, fromR, fromC, move) {
    const nextB = cloneBoard(board);
    const piece = nextB[fromR][fromC];
    nextB[fromR][fromC] = null;

    if (move.enPassant) {
      // Capture opposing pawn on same col
      const enemyPawnRow = piece.color === 'w' ? move.r + 1 : move.r - 1;
      nextB[enemyPawnRow][move.c] = null;
    }

    if (move.castle) {
      const rook = nextB[fromR][move.rookFromC];
      nextB[fromR][move.rookFromC] = null;
      nextB[fromR][move.rookToC] = { ...rook, hasMoved: true };
    }

    const isPromo = piece.type === 'pawn' && (move.r === 0 || move.r === 7);
    nextB[move.r][move.c] = {
      ...piece,
      type: isPromo ? 'queen' : piece.type,
      hasMoved: true
    };

    return nextB;
  }

  function getLegalMovesForPiece(r, c) {
    const piece = boardState[r]?.[c];
    if (!piece || piece.color !== currentTurn) return [];

    const pseudos = getPseudoMoves(r, c, boardState, enPassantSquare);
    const legals = [];

    for (const m of pseudos) {
      const simulated = simulateMove(boardState, r, c, m);
      if (!isKingInCheck(piece.color, simulated)) {
        legals.push(m);
      }
    }
    return legals;
  }

  function getAllLegalMoves(color) {
    const all = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = boardState[r][c];
        if (p && p.color === color) {
          const legals = getLegalMovesForPiece(r, c);
          for (const m of legals) {
            all.push({ fromR: r, fromC: c, ...m, piece: p });
          }
        }
      }
    }
    return all;
  }

  // =========================================================================
  // Move Execution
  // =========================================================================
  function executeChessMove(fromR, fromC, toR, toC, options = {}) {
    if (isAnimating || gameOver) return false;
    const piece = boardState[fromR]?.[fromC];
    if (!piece || piece.color !== currentTurn) return false;

    let targetMove = null;
    if (options.force) {
      targetMove = { r: toR, c: toC, capture: Boolean(boardState[toR]?.[toC]) };
    } else {
      const legals = getLegalMovesForPiece(fromR, fromC);
      targetMove = legals.find((m) => m.r === toR && m.c === toC);
      if (!targetMove) return false;
    }

    const capturedPiece = targetMove.enPassant
      ? boardState[piece.color === 'w' ? toR + 1 : toR - 1][toC]
      : boardState[toR][toC];

    // Record history
    moveHistory.push({
      fromR,
      fromC,
      toR,
      toC,
      piece: { ...piece },
      captured: capturedPiece ? { ...capturedPiece } : null,
      enPassantPrev: enPassantSquare ? { ...enPassantSquare } : null
    });

    lastMove = { fromR, fromC, toR, toC };
    selectedSquare = null;
    validMoves = [];

    // Castling secondary rook slide
    let secondary = null;
    if (targetMove.castle) {
      const rf = targetMove.rookFromC;
      const rt = targetMove.rookToC;
      secondary = {
        piece: boardState[fromR][rf],
        fromR,
        fromC: rf,
        toR: fromR,
        toC: rt
      };
    }

    // Start slide animation
    isAnimating = true;
    const slideDuration = 200; // fast & responsive 200ms
    const animStartTime = performance.now();

    if (capturedPiece) {
      capturePulses.push({
        r: toR,
        c: toC,
        startTime: animStartTime,
        duration: 260,
        color: capturedPiece.color
      });
      if (piece.color === 'w') {
        capturedByWhite++;
        capturedListWhite.push(capturedPiece.type);
      } else {
        capturedByBlack++;
        capturedListBlack.push(capturedPiece.type);
      }
    }

    activeSlide = {
      piece,
      fromR,
      fromC,
      toR,
      toC,
      startTime: animStartTime,
      duration: slideDuration,
      secondarySlide: secondary,
      onComplete: () => {
        // Apply final board state
        boardState[fromR][fromC] = null;

        if (targetMove.enPassant) {
          const enemyRow = piece.color === 'w' ? toR + 1 : toR - 1;
          boardState[enemyRow][toC] = null;
        }

        if (targetMove.castle) {
          const rPiece = boardState[fromR][targetMove.rookFromC];
          boardState[fromR][targetMove.rookFromC] = null;
          boardState[fromR][targetMove.rookToC] = { ...rPiece, hasMoved: true };
        }

        // Pawn promotion
        const isPromo = piece.type === 'pawn' && (toR === 0 || toR === 7);
        boardState[toR][toC] = {
          ...piece,
          type: isPromo ? 'queen' : piece.type,
          hasMoved: true
        };

        // Update En Passant square
        if (targetMove.isPawnDouble) {
          enPassantSquare = { r: (fromR + toR) / 2, c: toC };
        } else {
          enPassantSquare = null;
        }

        // Switch turn
        currentTurn = currentTurn === 'w' ? 'b' : 'w';
        isAnimating = false;
        activeSlide = null;

        updateTurnUI();
        render();

        // Check if next turn is AI
        checkGameOverOrNextTurn();
      }
    };

    render();
    return true;
  }

  function checkGameOverOrNextTurn() {
    const legals = getAllLegalMoves(currentTurn);
    const inCheck = isKingInCheck(currentTurn, boardState);

    if (legals.length === 0) {
      gameOver = true;
      if (inCheck) {
        const winner = currentTurn === 'w' ? 'Black' : 'White';
        triggerCheckmateSequence(currentTurn, currentTurn === 'w' ? 'b' : 'w');
      } else {
        const turnText = document.getElementById('turn-text');
        if (turnText) turnText.textContent = 'Stalemate — Draw';
      }
      render();
      return;
    }

    // Single-player AI turn
    const aiColor = playerColor === 'w' ? 'b' : 'w';
    if (!gameOver && currentTurn === aiColor) {
      scheduleAIMove(380);
    }
  }

  function triggerCheckmateSequence(defeatedColor, winnerColor) {
    checkmateState.active = true;
    checkmateState.defeatedColor = defeatedColor;
    checkmateState.winnerColor = winnerColor;
    checkmateState.bannerVisible = true;

    const overlay = document.getElementById('checkmate-overlay');
    const crownEl = document.getElementById('checkmate-crown');
    const titleEl = document.getElementById('checkmate-title');
    const subEl = document.getElementById('checkmate-subtitle');

    const winnerName = winnerColor === 'w' ? 'White' : 'Black';
    const defeatedName = defeatedColor === 'w' ? 'White' : 'Black';

    if (crownEl) crownEl.textContent = winnerColor === 'w' ? '♔' : '♚';
    if (titleEl) titleEl.textContent = 'Checkmate';
    if (subEl) {
      subEl.textContent = `${winnerName} Triumphs • The ${defeatedName} King Has Fallen`;
    }
    if (overlay) {
      overlay.classList.add('visible');
    }
  }

  // =========================================================================
  // AI Opponent (Minimax with Alpha-Beta Pruning)
  // =========================================================================
  function evaluateBoard(board) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;

        let val = PIECE_VALUES[p.type] || 0;
        let posVal = 0;
        const pstRow = p.color === 'w' ? r : 7 - r;

        if (p.type === 'pawn') posVal = PST_PAWN[pstRow][c];
        else if (p.type === 'knight') posVal = PST_KNIGHT[pstRow][c];
        else if (p.type === 'bishop') posVal = PST_BISHOP[pstRow][c];
        else if (p.type === 'rook') posVal = PST_ROOK[pstRow][c];
        else if (p.type === 'queen') posVal = PST_QUEEN[pstRow][c];
        else if (p.type === 'king') posVal = PST_KING[pstRow][c];

        const totalPiece = val + posVal;
        score += p.color === 'w' ? totalPiece : -totalPiece;
      }
    }
    return score;
  }

  function minimax(board, depth, alpha, beta, isMaximizing, epSq) {
    if (depth === 0) {
      return evaluateBoard(board);
    }

    const color = isMaximizing ? 'w' : 'b';
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color) {
          const legals = getPseudoMoves(r, c, board, epSq);
          for (const m of legals) {
            const nextB = simulateMove(board, r, c, m);
            if (!isKingInCheck(color, nextB)) {
              moves.push({ fromR: r, fromC: c, ...m, simB: nextB });
            }
          }
        }
      }
    }

    if (moves.length === 0) {
      if (isKingInCheck(color, board)) {
        return isMaximizing ? -99999 + (4 - depth) : 99999 - (4 - depth);
      }
      return 0; // Stalemate
    }

    // Sort moves to optimize alpha-beta cutoff (captures first)
    moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const m of moves) {
        const nextEp = m.isPawnDouble ? { r: (m.fromR + m.r) / 2, c: m.c } : null;
        const ev = minimax(m.simB, depth - 1, alpha, beta, false, nextEp);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of moves) {
        const nextEp = m.isPawnDouble ? { r: (m.fromR + m.r) / 2, c: m.c } : null;
        const ev = minimax(m.simB, depth - 1, alpha, beta, true, nextEp);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function chooseSmartAIMove(color) {
    const isMaximizing = color === 'w';
    const moves = getAllLegalMoves(color);
    if (moves.length === 0) return null;

    let bestMove = null;
    let bestScore = isMaximizing ? -Infinity : Infinity;

    // Small randomization among equally best moves
    moves.sort(() => Math.random() - 0.5);

    for (const m of moves) {
      const nextB = simulateMove(boardState, m.fromR, m.fromC, m);
      const nextEp = m.isPawnDouble ? { r: (m.fromR + m.r) / 2, c: m.c } : null;
      const score = minimax(nextB, 2, -Infinity, Infinity, !isMaximizing, nextEp);

      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = m;
        }
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = m;
        }
      }
    }

    return bestMove || moves[0];
  }

  function scheduleAIMove(delayMs = 350) {
    if (aiTimer) clearTimeout(aiTimer);
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (gameOver || isAnimating) return;
      const aiColor = currentTurn;
      const move = chooseSmartAIMove(aiColor);
      if (move) {
        executeChessMove(move.fromR, move.fromC, move.r, move.c);
      }
    }, delayMs);
  }

  function triggerAIMoveNow() {
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    if (gameOver || isAnimating) return;
    const move = chooseSmartAIMove(currentTurn);
    if (move) {
      executeChessMove(move.fromR, move.fromC, move.r, move.c);
    }
  }

  // =========================================================================
  // Canvas Geometry & Layout Calculations
  // =========================================================================
  let viewMetrics = {
    canvasW: 0,
    canvasH: 0,
    boardX: 0,
    boardY: 0,
    boardSize: 0,
    sqSize: 0,
    borderWidth: 26
  };

  function updateViewMetrics() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    // Padding for HUD at top (70px) and bottom (60px)
    const availW = w - 32;
    const availH = h - 140;
    const basePadding = wideMode ? 32 : 16;
    const maxBoardDim = Math.min(availW - basePadding, availH - basePadding, 680);
    const boardSize = Math.max(260, Math.floor(maxBoardDim));
    const borderWidth = Math.max(16, Math.floor(boardSize * 0.04));
    const innerSize = boardSize - borderWidth * 2;
    const sqSize = innerSize / 8;

    const boardX = Math.round((w - boardSize) / 2);
    const boardY = Math.round((h - boardSize) / 2) + 6;

    viewMetrics = {
      dpr,
      w,
      h,
      boardX,
      boardY,
      boardSize,
      sqSize,
      borderWidth
    };
  }

  function boardCoordToScreen(r, c) {
    const { boardX, boardY, borderWidth, sqSize } = viewMetrics;
    let visualC = c;
    let visualR = r;

    if (boardOrientation === 'b') {
      visualC = 7 - c;
      visualR = 7 - r;
    } else if (boardOrientation === 'east') {
      visualC = 7 - r;
      visualR = c;
    } else if (boardOrientation === 'west') {
      visualC = r;
      visualR = 7 - c;
    }

    const x = boardX + borderWidth + visualC * sqSize;
    const y = boardY + borderWidth + visualR * sqSize;
    return { x, y, visualR, visualC };
  }

  function screenToBoardCoord(screenX, screenY) {
    const { boardX, boardY, borderWidth, sqSize } = viewMetrics;
    const innerX = screenX - (boardX + borderWidth);
    const innerY = screenY - (boardY + borderWidth);

    if (innerX < 0 || innerY < 0) return null;
    const visualC = Math.floor(innerX / sqSize);
    const visualR = Math.floor(innerY / sqSize);
    if (visualC < 0 || visualC >= 8 || visualR < 0 || visualR >= 8) return null;

    let r = visualR;
    let c = visualC;

    if (boardOrientation === 'b') {
      r = 7 - visualR;
      c = 7 - visualC;
    } else if (boardOrientation === 'east') {
      r = 7 - visualC;
      c = visualR;
    } else if (boardOrientation === 'west') {
      r = visualC;
      c = 7 - visualR;
    }

    return { r, c };
  }

  // =========================================================================
  // Vector Graphics Rendering for Chess Pieces
  // Clean, high-contrast, beautiful top-down silhouettes
  // =========================================================================
  function drawPieceVector(ctx, type, color, cx, cy, radius, alpha = 1.0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);

    // Subtle ambient piece drop shadow for top-view depth
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.arc(0, radius * 0.12, radius * 0.72, 0, Math.PI * 2);
    ctx.fill();

    const isWhite = color === 'w';
    const bodyFill = isWhite ? '#fbf8f0' : '#191d26';
    const bodyStroke = isWhite ? '#20242e' : '#e6be58'; // Gold contour for black pieces on dark tiles!
    const innerAccent = isWhite ? '#d4af37' : '#f5d76e';
    const strokeW = Math.max(1.6, radius * 0.08);

    ctx.fillStyle = bodyFill;
    ctx.strokeStyle = bodyStroke;
    ctx.lineWidth = strokeW;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const r = radius * 0.82;

    switch (type) {
      case 'pawn': {
        // Base pedestal
        ctx.beginPath();
        ctx.ellipse(0, r * 0.65, r * 0.65, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Body cone
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.55);
        ctx.quadraticCurveTo(-r * 0.20, r * 0.05, -r * 0.22, -r * 0.15);
        ctx.lineTo(r * 0.22, -r * 0.15);
        ctx.quadraticCurveTo(r * 0.20, r * 0.05, r * 0.45, r * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Collar ring
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.15, r * 0.36, r * 0.10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Head sphere
        ctx.beginPath();
        ctx.arc(0, -r * 0.42, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Crown highlight pip
        ctx.fillStyle = innerAccent;
        ctx.beginPath();
        ctx.arc(0, -r * 0.42, r * 0.10, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'rook': {
        // Base pedestal
        ctx.beginPath();
        ctx.ellipse(0, r * 0.68, r * 0.72, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Tower body
        ctx.beginPath();
        ctx.moveTo(-r * 0.52, r * 0.60);
        ctx.lineTo(-r * 0.38, -r * 0.25);
        ctx.lineTo(r * 0.38, -r * 0.25);
        ctx.lineTo(r * 0.52, r * 0.60);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Crenellated battlements top
        ctx.beginPath();
        ctx.moveTo(-r * 0.54, -r * 0.25);
        ctx.lineTo(-r * 0.54, -r * 0.65);
        ctx.lineTo(-r * 0.32, -r * 0.65);
        ctx.lineTo(-r * 0.32, -r * 0.45);
        ctx.lineTo(-r * 0.12, -r * 0.45);
        ctx.lineTo(-r * 0.12, -r * 0.65);
        ctx.lineTo(r * 0.12, -r * 0.65);
        ctx.lineTo(r * 0.12, -r * 0.45);
        ctx.lineTo(r * 0.32, -r * 0.45);
        ctx.lineTo(r * 0.32, -r * 0.65);
        ctx.lineTo(r * 0.54, -r * 0.65);
        ctx.lineTo(r * 0.54, -r * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Embrasures / Arrow slits
        ctx.strokeStyle = innerAccent;
        ctx.lineWidth = strokeW * 0.85;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.10);
        ctx.lineTo(0, r * 0.25);
        ctx.moveTo(-r * 0.12, 0);
        ctx.lineTo(r * 0.12, 0);
        ctx.stroke();
        break;
      }

      case 'knight': {
        // Base pedestal
        ctx.beginPath();
        ctx.ellipse(0, r * 0.68, r * 0.70, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Sculpted Steed profile
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.62);
        ctx.quadraticCurveTo(-r * 0.48, r * 0.20, -r * 0.38, -r * 0.15);
        ctx.lineTo(-r * 0.25, -r * 0.65); // Ear tip
        ctx.lineTo(-r * 0.10, -r * 0.50); // Mane crest
        ctx.quadraticCurveTo(r * 0.20, -r * 0.65, r * 0.45, -r * 0.30); // Forehead & snout
        ctx.lineTo(r * 0.50, -r * 0.15); // Nose tip
        ctx.quadraticCurveTo(r * 0.25, -r * 0.10, r * 0.10, r * 0.05); // Jaw
        ctx.quadraticCurveTo(r * 0.35, r * 0.35, r * 0.45, r * 0.62); // Chest
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eye and mane accents
        ctx.fillStyle = innerAccent;
        ctx.beginPath();
        ctx.arc(r * 0.15, -r * 0.30, r * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = innerAccent;
        ctx.lineWidth = strokeW * 0.85;
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, -r * 0.35);
        ctx.quadraticCurveTo(-r * 0.15, -r * 0.05, -r * 0.26, r * 0.25);
        ctx.stroke();
        break;
      }

      case 'bishop': {
        // Base pedestal
        ctx.beginPath();
        ctx.ellipse(0, r * 0.70, r * 0.70, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pedestal neck
        ctx.beginPath();
        ctx.ellipse(0, r * 0.40, r * 0.44, r * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Mitre egg-shaped head
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.62);
        ctx.bezierCurveTo(r * 0.48, -r * 0.45, r * 0.42, r * 0.30, 0, r * 0.38);
        ctx.bezierCurveTo(-r * 0.42, r * 0.30, -r * 0.48, -r * 0.45, 0, -r * 0.62);
        ctx.fill();
        ctx.stroke();

        // Finial ball at apex
        ctx.beginPath();
        ctx.arc(0, -r * 0.70, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cleft / cross cut
        ctx.strokeStyle = innerAccent;
        ctx.lineWidth = strokeW * 0.95;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.45);
        ctx.lineTo(r * 0.22, -r * 0.10);
        ctx.moveTo(-r * 0.15, -r * 0.15);
        ctx.lineTo(r * 0.15, -r * 0.15);
        ctx.stroke();
        break;
      }

      case 'queen': {
        // Base pedestal
        ctx.beginPath();
        ctx.ellipse(0, r * 0.72, r * 0.78, r * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Gown body
        ctx.beginPath();
        ctx.moveTo(-r * 0.58, r * 0.65);
        ctx.quadraticCurveTo(-r * 0.22, r * 0.20, -r * 0.35, -r * 0.15);
        ctx.lineTo(r * 0.35, -r * 0.15);
        ctx.quadraticCurveTo(r * 0.22, r * 0.20, r * 0.58, r * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Radiating 5-spike coronet
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, -r * 0.15);
        ctx.lineTo(-r * 0.55, -r * 0.58); // Left outer point
        ctx.lineTo(-r * 0.28, -r * 0.32);
        ctx.lineTo(-r * 0.28, -r * 0.68); // Left mid point
        ctx.lineTo(0, -r * 0.36);
        ctx.lineTo(0, -r * 0.75);         // Center tall point
        ctx.lineTo(0, -r * 0.36);
        ctx.lineTo(r * 0.28, -r * 0.68);  // Right mid point
        ctx.lineTo(r * 0.28, -r * 0.32);
        ctx.lineTo(r * 0.55, -r * 0.58);  // Right outer point
        ctx.lineTo(r * 0.55, -r * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Golden orbs atop each coronet spike
        ctx.fillStyle = innerAccent;
        const spikePoints = [
          [-r * 0.55, -r * 0.60],
          [-r * 0.28, -r * 0.70],
          [0, -r * 0.77],
          [r * 0.28, -r * 0.70],
          [r * 0.55, -r * 0.60]
        ];
        for (const [ox, oy] of spikePoints) {
          ctx.beginPath();
          ctx.arc(ox, oy, r * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }

        // Royal brooch jewel
        ctx.beginPath();
        ctx.arc(0, r * 0.18, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'king': {
        // Base pedestal
        ctx.beginPath();
        ctx.ellipse(0, r * 0.72, r * 0.80, r * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Robust imperial robes
        ctx.beginPath();
        ctx.moveTo(-r * 0.60, r * 0.65);
        ctx.quadraticCurveTo(-r * 0.25, r * 0.15, -r * 0.40, -r * 0.12);
        ctx.lineTo(r * 0.40, -r * 0.12);
        ctx.quadraticCurveTo(r * 0.25, r * 0.15, r * 0.60, r * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Regal arched crown
        ctx.beginPath();
        ctx.moveTo(-r * 0.50, -r * 0.12);
        ctx.quadraticCurveTo(-r * 0.60, -r * 0.48, -r * 0.25, -r * 0.50);
        ctx.quadraticCurveTo(0, -r * 0.38, 0, -r * 0.52);
        ctx.quadraticCurveTo(0, -r * 0.38, r * 0.25, -r * 0.50);
        ctx.quadraticCurveTo(r * 0.60, -r * 0.48, r * 0.50, -r * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Latin Cross atop crown (+)
        ctx.fillStyle = innerAccent;
        ctx.strokeStyle = innerAccent;
        ctx.lineWidth = strokeW * 1.1;
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.50);
        ctx.lineTo(0, -r * 0.82); // Vertical beam
        ctx.moveTo(-r * 0.16, -r * 0.68);
        ctx.lineTo(r * 0.16, -r * 0.68); // Crossbar
        ctx.stroke();

        // Royal medallion
        ctx.beginPath();
        ctx.arc(0, r * 0.15, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  // =========================================================================
  // Canvas Main Render Loop
  // =========================================================================
  function render() {
    updateViewMetrics();
    const { dpr, w, h, boardX, boardY, boardSize, sqSize, borderWidth } = viewMetrics;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Deep sanctum ambient background
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, Math.max(w, h));
    bgGrad.addColorStop(0, '#0d111a');
    bgGrad.addColorStop(0.65, '#07090f');
    bgGrad.addColorStop(1, '#040508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Board Drop Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 14;

    // Board Frame (Gothic dark slate + gold rim)
    ctx.fillStyle = '#141822';
    ctx.beginPath();
    ctx.roundRect(boardX, boardY, boardSize, boardSize, 8);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Outer gold trim outline
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner gold border enclosing the 64 squares
    const innerX = boardX + borderWidth;
    const innerY = boardY + borderWidth;
    const innerSize = sqSize * 8;
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(innerX - 1, innerY - 1, innerSize + 2, innerSize + 2);

    // Coordinate Labels (ranks 1-8 & files a-h)
    ctx.fillStyle = '#9aa0a6';
    ctx.font = `600 ${Math.max(10, Math.floor(borderWidth * 0.44))}px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < 8; i++) {
      let fileChar = String.fromCharCode(97 + i);
      let rankChar = String(8 - i);

      if (boardOrientation === 'b') {
        fileChar = String.fromCharCode(104 - i);
        rankChar = String(i + 1);
      }

      // File labels along top and bottom border
      const colCenterX = innerX + (i + 0.5) * sqSize;
      ctx.fillText(fileChar, colCenterX, boardY + borderWidth * 0.5);
      ctx.fillText(fileChar, colCenterX, boardY + boardSize - borderWidth * 0.5);

      // Rank labels along left and right border
      const rowCenterY = innerY + (i + 0.5) * sqSize;
      ctx.fillText(rankChar, boardX + borderWidth * 0.5, rowCenterY);
      ctx.fillText(rankChar, boardX + boardSize - borderWidth * 0.5, rowCenterY);
    }

    // 64 Checkered Tiles
    // High-contrast clean styling: Light = warm alabaster/parchment, Dark = slate obsidian
    const lightTileColor = '#d6cebe';
    const darkTileColor = '#242a38';

    for (let visualR = 0; visualR < 8; visualR++) {
      for (let visualC = 0; visualC < 8; visualC++) {
        const sqX = innerX + visualC * sqSize;
        const sqY = innerY + visualR * sqSize;
        const isLight = (visualR + visualC) % 2 === 0;

        ctx.fillStyle = isLight ? lightTileColor : darkTileColor;
        ctx.fillRect(sqX, sqY, sqSize, sqSize);
      }
    }

    // Highlight Last Move (from & to)
    if (lastMove) {
      for (const pt of [
        { r: lastMove.fromR, c: lastMove.fromC },
        { r: lastMove.toR, c: lastMove.toC }
      ]) {
        const s = boardCoordToScreen(pt.r, pt.c);
        ctx.fillStyle = 'rgba(212, 175, 55, 0.28)';
        ctx.fillRect(s.x, s.y, sqSize, sqSize);
      }
    }

    // King in Check Crimson Warning Pulse
    const whiteInCheck = isKingInCheck('w', boardState);
    const blackInCheck = isKingInCheck('b', boardState);
    if (whiteInCheck || blackInCheck) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = boardState[r][c];
          if (p && p.type === 'king' && ((p.color === 'w' && whiteInCheck) || (p.color === 'b' && blackInCheck))) {
            const s = boardCoordToScreen(r, c);
            const pulse = (Math.sin(performance.now() * 0.006) + 1) * 0.5;
            ctx.fillStyle = `rgba(230, 57, 70, ${0.35 + pulse * 0.25})`;
            ctx.fillRect(s.x, s.y, sqSize, sqSize);
            ctx.strokeStyle = '#e63946';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(s.x + 1, s.y + 1, sqSize - 2, sqSize - 2);
          }
        }
      }
    }

    // Selected Square Highlight
    if (selectedSquare) {
      const s = boardCoordToScreen(selectedSquare.r, selectedSquare.c);
      ctx.fillStyle = 'rgba(245, 215, 110, 0.38)';
      ctx.fillRect(s.x, s.y, sqSize, sqSize);
      ctx.strokeStyle = '#f5d76e';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(s.x + 1.5, s.y + 1.5, sqSize - 3, sqSize - 3);
    }

    // Capture Sparkle Pulses
    const now = performance.now();
    for (let i = capturePulses.length - 1; i >= 0; i--) {
      const cp = capturePulses[i];
      const prog = (now - cp.startTime) / cp.duration;
      if (prog >= 1.0) {
        capturePulses.splice(i, 1);
        continue;
      }
      const s = boardCoordToScreen(cp.r, cp.c);
      const cx = s.x + sqSize * 0.5;
      const cy = s.y + sqSize * 0.5;
      const burstR = (sqSize * 0.45) * Math.sin(prog * Math.PI);
      ctx.fillStyle = `rgba(212, 175, 55, ${0.45 * (1 - prog)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, burstR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Stationary Pieces
    const pieceRadius = sqSize * 0.46;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardState[r][c];
        if (!piece) continue;

        // Skip piece currently in mid-air slide
        if (activeSlide && activeSlide.piece === piece) continue;
        if (activeSlide && activeSlide.secondarySlide && activeSlide.secondarySlide.piece === piece) continue;

        const s = boardCoordToScreen(r, c);
        const cx = s.x + sqSize * 0.5;
        const cy = s.y + sqSize * 0.5;
        drawPieceVector(ctx, piece.type, piece.color, cx, cy, pieceRadius);
      }
    }

    // Render Active Move Sliding Piece (interpolated position)
    if (activeSlide) {
      const elapsed = now - activeSlide.startTime;
      const u = Math.min(1.0, elapsed / activeSlide.duration);
      const ease = 1 - Math.pow(1 - u, 3); // ease-out cubic

      const startS = boardCoordToScreen(activeSlide.fromR, activeSlide.fromC);
      const endS = boardCoordToScreen(activeSlide.toR, activeSlide.toC);
      const curX = startS.x + (endS.x - startS.x) * ease + sqSize * 0.5;
      const curY = startS.y + (endS.y - startS.y) * ease + sqSize * 0.5;

      drawPieceVector(ctx, activeSlide.piece.type, activeSlide.piece.color, curX, curY, pieceRadius * 1.04);

      // Secondary sliding piece (e.g. Rook during castling)
      if (activeSlide.secondarySlide) {
        const sec = activeSlide.secondarySlide;
        const sStart = boardCoordToScreen(sec.fromR, sec.fromC);
        const sEnd = boardCoordToScreen(sec.toR, sec.toC);
        const sX = sStart.x + (sEnd.x - sStart.x) * ease + sqSize * 0.5;
        const sY = sStart.y + (sEnd.y - sStart.y) * ease + sqSize * 0.5;
        drawPieceVector(ctx, sec.piece.type, sec.piece.color, sX, sY, pieceRadius);
      }

      if (u >= 1.0) {
        const cb = activeSlide.onComplete;
        activeSlide = null;
        if (cb) cb();
      }
    }

    // Legal Move Destination Markers (clean top-down dots & capture brackets)
    if (selectedSquare && validMoves.length > 0) {
      for (const m of validMoves) {
        const s = boardCoordToScreen(m.r, m.c);
        const cx = s.x + sqSize * 0.5;
        const cy = s.y + sqSize * 0.5;

        if (m.capture) {
          // Distinctive corner brackets / capture ring around enemy piece
          ctx.strokeStyle = '#e63946';
          ctx.lineWidth = Math.max(2.5, sqSize * 0.05);
          ctx.beginPath();
          ctx.arc(cx, cy, sqSize * 0.38, 0, Math.PI * 2);
          ctx.stroke();

          // Inner gold accent
          ctx.strokeStyle = 'rgba(245, 215, 110, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, sqSize * 0.44, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Elegant glowing cyan dot
          ctx.fillStyle = '#4ea8de';
          ctx.shadowColor = 'rgba(78, 168, 222, 0.65)';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(6, sqSize * 0.15), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
      }
    }

    ctx.restore();

    // Continue frame loop if animation is in flight
    if (activeSlide || capturePulses.length > 0 || whiteInCheck || blackInCheck) {
      requestAnimationFrame(render);
    }
  }

  // =========================================================================
  // User Input (Pointer / Click Handling)
  // =========================================================================
  canvas.addEventListener('pointerdown', (e) => {
    if (isAnimating || gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clicked = screenToBoardCoord(clickX, clickY);
    if (!clicked) {
      if (selectedSquare) {
        selectedSquare = null;
        validMoves = [];
        render();
      }
      return;
    }

    const { r, c } = clicked;

    // If already have a selected piece, check if clicking a valid move destination
    if (selectedSquare) {
      const move = validMoves.find((m) => m.r === r && m.c === c);
      if (move) {
        executeChessMove(selectedSquare.r, selectedSquare.c, r, c);
        return;
      }
    }

    // Select piece if matching current turn
    const piece = boardState[r][c];
    if (piece && piece.color === currentTurn) {
      // In single-player, optionally enforce playerColor
      selectedSquare = { r, c };
      validMoves = getLegalMovesForPiece(r, c);
      render();
    } else {
      selectedSquare = null;
      validMoves = [];
      render();
    }
  });

  // =========================================================================
  // UI & HUD Status Updates
  // =========================================================================
  function updateTurnUI() {
    const turnDot = document.getElementById('turn-dot');
    const turnText = document.getElementById('turn-text');
    const modeBadge = document.getElementById('mode-badge');
    const btnSideToggle = document.getElementById('btn-side-toggle');
    const capturedTray = document.getElementById('captured-tray');
    const controlsHint = document.getElementById('controls-hint');

    if (turnDot) {
      turnDot.className = 'turn-dot' + (currentTurn === 'b' ? ' black' : '');
    }

    const legalMoves = getAllLegalMoves(currentTurn);
    const inCheck = isKingInCheck(currentTurn, boardState);

    if (legalMoves.length === 0) {
      gameOver = true;
      if (inCheck) {
        const winner = currentTurn === 'w' ? 'Black' : 'White';
        if (turnText) turnText.textContent = `Checkmate — ${winner} Wins`;
      } else {
        if (turnText) turnText.textContent = 'Stalemate — Draw';
      }
    } else {
      const turnLabel = currentTurn === 'w' ? 'White to Move' : 'Black to Move';
      const aiColor = playerColor === 'w' ? 'b' : 'w';
      const isAiTurn = currentTurn === aiColor;
      if (turnText) {
        if (inCheck) {
          turnText.textContent = `${turnLabel} (Check!)`;
        } else if (isAiTurn) {
          turnText.textContent = `${turnLabel} (AI)...`;
        } else {
          turnText.textContent = turnLabel;
        }
      }
    }

    if (modeBadge) {
      modeBadge.textContent = `Playing as ${playerColor === 'w' ? 'White' : 'Black'}`;
    }

    if (btnSideToggle) {
      btnSideToggle.textContent = playerColor === 'w' ? 'Play as Black' : 'Play as White';
    }

    if (capturedTray) {
      if (capturedByWhite > 0 || capturedByBlack > 0) {
        capturedTray.textContent = `Captured — White: ${capturedByWhite} | Black: ${capturedByBlack}`;
      } else {
        capturedTray.textContent = 'Wizard Chess (Top-View)';
      }
    }

    if (controlsHint) {
      controlsHint.innerHTML =
        '<strong>Controls:</strong> Click Piece to Select &nbsp;•&nbsp; Click Target Dot to Move &nbsp;•&nbsp; Rotate View with Camera Buttons &nbsp;•&nbsp; H: Hide UI';
    }
  }

  // =========================================================================
  // Camera & View Presets
  // =========================================================================
  const camButtons = ['btn-cam-player', 'btn-cam-top', 'btn-cam-side', 'btn-cam-wide'];

  function setActiveCamButton(activeId) {
    for (const id of camButtons) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === activeId);
    }
  }

  function setCameraPreset(preset) {
    if (preset === 'player') {
      const wasPlayerActive = document.getElementById('btn-cam-player')?.classList.contains('active');
      if (wasPlayerActive) {
        boardOrientation = boardOrientation === 'w' ? 'b' : 'w';
      } else {
        boardOrientation = playerColor;
      }
      wideMode = false;
      setActiveCamButton('btn-cam-player');
    } else if (preset === 'top') {
      const wasTopActive = document.getElementById('btn-cam-top')?.classList.contains('active');
      if (wasTopActive) {
        boardOrientation = boardOrientation === 'w' ? 'b' : 'w';
      } else {
        boardOrientation = 'w';
      }
      wideMode = false;
      setActiveCamButton('btn-cam-top');
    } else if (preset === 'side') {
      const wasSideActive = document.getElementById('btn-cam-side')?.classList.contains('active');
      if (wasSideActive) {
        boardOrientation = boardOrientation === 'east' ? 'west' : 'east';
      } else {
        boardOrientation = 'east';
      }
      wideMode = false;
      setActiveCamButton('btn-cam-side');
    } else if (preset === 'wide') {
      wideMode = !wideMode;
      setActiveCamButton('btn-cam-wide');
    }
    render();
  }

  // UI toggle helper
  function toggleUI(forceHidden) {
    const shouldHide =
      typeof forceHidden === 'boolean'
        ? forceHidden
        : !document.body.classList.contains('cinematic-ui-hidden');
    document.body.classList.toggle('cinematic-ui-hidden', shouldHide);
    const btnHide = document.getElementById('btn-hide-ui');
    if (btnHide) {
      btnHide.textContent = shouldHide ? 'Show UI [H]' : 'Hide UI [H]';
    }
    return shouldHide;
  }

  // =========================================================================
  // Hook Up DOM Events
  // =========================================================================
  document.getElementById('btn-cam-player')?.addEventListener('click', () => setCameraPreset('player'));
  document.getElementById('btn-cam-top')?.addEventListener('click', () => setCameraPreset('top'));
  document.getElementById('btn-cam-side')?.addEventListener('click', () => setCameraPreset('side'));
  document.getElementById('btn-cam-wide')?.addEventListener('click', () => setCameraPreset('wide'));
  document.getElementById('btn-hide-ui')?.addEventListener('click', () => toggleUI());

  document.getElementById('btn-side-toggle')?.addEventListener('click', () => {
    playerColor = playerColor === 'w' ? 'b' : 'w';
    resetChessBoard(true);
  });

  document.getElementById('btn-ai-move')?.addEventListener('click', () => {
    triggerAIMoveNow();
  });

  document.getElementById('btn-reset')?.addEventListener('click', () => {
    resetChessBoard(true);
  });

  // Checkmate Dialog Actions
  document.getElementById('btn-checkmate-newgame')?.addEventListener('click', () => {
    resetChessBoard(true);
  });

  document.getElementById('btn-checkmate-dismiss')?.addEventListener('click', () => {
    const overlay = document.getElementById('checkmate-overlay');
    if (overlay) overlay.classList.remove('visible');
    checkmateState.bannerVisible = false;
  });

  document.getElementById('btn-checkmate-replay')?.addEventListener('click', () => {
    const defCol = checkmateState.defeatedColor || currentTurn;
    const winCol = checkmateState.winnerColor || (defCol === 'w' ? 'b' : 'w');
    triggerCheckmateSequence(defCol, winCol);
  });

  // Keyboard shortcut 'H' to toggle UI
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      toggleUI();
    }
  });

  window.addEventListener('resize', () => {
    render();
  });

  // =========================================================================
  // Public Programmatic API on window.wizardChess
  // =========================================================================
  window.wizardChess = {
    setCameraPreset,
    toggleUI,
    executeChessMove,
    triggerAIMoveNow,
    resetChessBoard,
    setSinglePlayerSide: (color) => {
      playerColor = color === 'b' ? 'b' : 'w';
      resetChessBoard(true);
    },
    setupCustomScenario: (pieces, turn = 'w') => {
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
      }
      boardState = Array.from({ length: 8 }, () => Array(8).fill(null));
      for (const p of pieces) {
        boardState[p.r][p.c] = {
          type: p.type,
          color: p.color,
          hasMoved: Boolean(p.hasMoved)
        };
      }
      currentTurn = turn;
      gameOver = false;
      isAnimating = false;
      activeSlide = null;
      selectedSquare = null;
      validMoves = [];
      updateTurnUI();
      render();
    },
    getState: () => ({
      gameMode: 'single',
      playerColor,
      currentTurn,
      boardOrientation,
      gameOver,
      capturedByWhite,
      capturedByBlack,
      capturedListWhite: [...capturedListWhite],
      capturedListBlack: [...capturedListBlack],
      checkmateState: { ...checkmateState },
      selectedSquare,
      validMovesCount: validMoves.length,
      uiHidden: document.body.classList.contains('cinematic-ui-hidden')
    })
  };

  // Initial startup
  const params = new URLSearchParams(window.location.search);
  const urlSide = params.get('side');
  if (urlSide === 'b' || urlSide === 'black') {
    playerColor = 'b';
  }
  resetChessBoard(true);
}
