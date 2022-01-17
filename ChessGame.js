const Board = require('./Board.js');
const { BITS_VALUES, copyElems } = require('./Utils.js');

const { Piece, King, Pawn, Rook } = require('./Pieces.js');

class ChessGame {
    #history = [];
    #fen;
    #activeSide;
    #board;
    #pieces;
    #castle = { w: 0, b: 0 };
    #enPassantSquare;
    #halfMoves;
    #fullMoves;
    #kings = { w: null, b: null };

    #legalMoves = { w: [], b: [] };

    constructor(fen) {
        if(fen) this.#loadFEN(fen);
    }

    #loadFEN(fen) {
        // Configure game from FEN text

        let fields = fen.split(' ');

        if(fields.length !== 6) return false;

        this.#loadBoard(fields[0]);

        this.#activeSide = fields[1];

        if(fields[2].includes('K')) this.#castle.w |= BITS_VALUES.K_CASTLE;
        if(fields[2].includes('Q')) this.#castle.w |= BITS_VALUES.Q_CASTLE;

        if(fields[2].includes('k')) this.#castle.b |= BITS_VALUES.K_CASTLE;
        if(fields[2].includes('q')) this.#castle.b |= BITS_VALUES.Q_CASTLE;

        if(Board.isValidSquare(fields[3])) this.#enPassantSquare = fields[3];

        this.#halfMoves = Number(fields[4]);
        this.#fullMoves = Number(fields[5]);

        this.#addToHistory();
    }
    #loadBoard(field) {
        this.#board = new Board();

        this.#pieces = this.#generatePiecesFromFEN(field);
        this.#board.load(this.#pieces);
    }
    getPseudoLegalMoves(side = this.#activeSide) {
        // Pseudo legal moves are all the possible moves without checking if there are checks

        let pieces = this.#pieces.filter(p => !p.dead && p.color === side);

        let pseudoLegalMoves = [];

        for(let piece = 0; piece < pieces.length; piece++) {
            pseudoLegalMoves = pseudoLegalMoves.concat(pieces[piece].pseudoLegalMoves(this.#board, { enPassantSquare: this.#enPassantSquare, castle: this.#castle }));
        }

        return pseudoLegalMoves;
    }
    getProtectedCases(side = this.#activeSide) {
        // Get cases that the ennemy can protect

        let pieces = this.#pieces.filter(p => !p.dead && p.color === side);

        let protectedCases = [];

        for(let piece = 0; piece < pieces.length; piece++) {
            protectedCases = protectedCases.concat(pieces[piece].protectedCases(this.#board, { enPassantSquare: this.#enPassantSquare, castle: this.#castle }));
        }

        return protectedCases;
    }
    getLegalMoves(side = this.#activeSide) {
        // Turn pseudo legal moves into legal moves

        let pseudoLegalMoves = this.getPseudoLegalMoves(side);
        let enemyMoves = this.getProtectedCases(side === 'w' ? 'b' : 'w');

        let legal = [];
        let king = this.#kings[side];

        let castle = this.#castle[side];

        if(castle & BITS_VALUES.Q_CASTLE) {
            let number = king.position[1];

            let cases = ['d' + number, 'c' + number, 'b' + number];

            if(!this.#board.get(cases[0]) &&
            !this.#board.get(cases[1]) &&
            !this.#board.get(cases[2]) &&
            !this.isControlled(enemyMoves, king.position) &&
            !this.isControlled(enemyMoves, cases[0]) &&
            !this.isControlled(enemyMoves, cases[1])) {
                legal.push({ from: king.position, to: cases[1], action: BITS_VALUES.Q_CASTLE });
            }
        }
        if(castle & BITS_VALUES.K_CASTLE) {
            let number = king.position[1];

            let cases = ['f' + number, 'g' + number];

            if(!this.#board.get(cases[0]) &&
            !this.#board.get(cases[1]) &&
            !this.isControlled(enemyMoves, king.position) &&
            !this.isControlled(enemyMoves, cases[0]) &&
            !this.isControlled(enemyMoves, cases[1])) {
                legal.push({ from: king.position, to: cases[1], action: BITS_VALUES.K_CASTLE });
            }
        }

        for(let m = 0; m < pseudoLegalMoves.length; m++) {
            let move = pseudoLegalMoves[m];

            this.makeMove(move, false);

            let isKingInCheck = false,
                dangerousPieces = [],
                cPiece;

            if(move.action & BITS_VALUES.CAPTURE || move.action & BITS_VALUES.EP_CAPTURE) {

                if(move.action & BITS_VALUES.EP_CAPTURE) {
                    let letter = move.to[0];
                    let number = Number(move.to[1]);
                    if(side === 'w') cPiece = letter + (number - 1);
                    if(side === 'b') cPiece = letter + (number + 1);
                } else cPiece = move.to;

                dangerousPieces = enemyMoves.filter(enemyMove => enemyMove.to === move.from || enemyMove.to === cPiece || enemyMove.to === king.position);
            } else {
                dangerousPieces = enemyMoves.filter(enemyMove => enemyMove.to === move.from || enemyMove.to === king.position);
            }

            for(let dangerousPiece = 0; dangerousPiece < dangerousPieces.length; dangerousPiece++) {
                let piece = this.#board.get(dangerousPieces[dangerousPiece].from);

                if(cPiece && cPiece === dangerousPieces[dangerousPiece].from) continue;

                let pieceMoves = piece.protectedCases(this.#board, { enPassantSquare: this.#enPassantSquare, castle: this.#castle });

                if(pieceMoves.find(mov => mov.to === king.position)) isKingInCheck = true;
            }

            if(this.#board.get(move.to) instanceof King) {
                if(enemyMoves.find(enemyMove => enemyMove.to === move.to)) isKingInCheck = true;
            }

            if(!isKingInCheck) legal.push(move);

            this.undo();
        }

        this.#legalMoves[side] = legal;

        return legal;
    }
    isControlled(arrayOfMoves, position) {
        let move = arrayOfMoves.find(m => m.to === position);

        if(move) return true;
        return false;
    }
    makeMove(move) {
        this.#addToHistory(move);

        let doCapture = move.action & BITS_VALUES.CAPTURE || move.action & BITS_VALUES.EP_CAPTURE;
        let isPromotion = move.action & BITS_VALUES.PROMOTION;

        let piece = this.#board.get(move.from);

        if(isPromotion && !move.promotion) move.promotion = 'q';

        if(doCapture) {
            let victim;

            if(move.action & BITS_VALUES.EP_CAPTURE) {
                if(piece.color === 'w') victim = this.#board.get(move.to[0] + (Number(move.to[1]) - 1));
                if(piece.color === 'b') victim = this.#board.get(move.to[0] + (Number(move.to[1]) + 1));
            } else victim = this.#board.get(move.to);

            victim.dead = true;

            this.#board.set(victim.position, null);

            if(this.#castle[victim.color] && victim instanceof Rook) {
                if(victim.position[0] === 'a' && this.#castle[victim.color] & BITS_VALUES.Q_CASTLE) this.#castle[victim.color] ^= BITS_VALUES.Q_CASTLE;
                else if(victim.position[0] === 'h' && this.#castle[victim.color] & BITS_VALUES.K_CASTLE) this.#castle[victim.color] ^= BITS_VALUES.K_CASTLE;
            }
        }

        if(move.action & BITS_VALUES.Q_CASTLE) {
            let rook = this.#board.get('a' + move.to[1]);

            this.#board.set(rook.position, null);
            rook.position = 'd' + move.to[1];
            this.#board.set(rook.position, rook);

            this.#castle[piece.color] = 0;
        }
        if(move.action & BITS_VALUES.K_CASTLE) {
            let rook = this.#board.get('h' + move.to[1]);

            this.#board.set(rook.position, null);
            rook.position = 'f' + move.to[1];
            this.#board.set(rook.position, rook);

            this.#castle[piece.color] = 0;
        }

        if(piece instanceof King) this.#castle[piece.color] = 0;

        if(this.#castle[piece.color]) {
            if(piece.position === 'a' + this.#kings[piece.color].position[1]) {
                if(this.#castle[piece.color] & BITS_VALUES.Q_CASTLE) this.#castle[piece.color] ^= BITS_VALUES.Q_CASTLE;
            }
            else if(piece.position === 'h' + this.#kings[piece.color].position[1]) {
                if(this.#castle[piece.color] & BITS_VALUES.K_CASTLE) this.#castle[piece.color] ^= BITS_VALUES.K_CASTLE;
            }
        }

        piece.position = move.to;

        if(isPromotion) {
            let index = this.#pieces.indexOf(piece);

            piece = piece.promote(move.promotion);
            this.#pieces.splice(index, 1, piece);
        }

        this.#board.set(move.to, piece);
        this.#board.set(move.from, null);

        this.#enPassantSquare = null;

        if(piece instanceof Pawn) {
            let hasJumped = Math.abs(Number(move.to[1]) - Number(move.from[1])) === 2;
            if(hasJumped) {
                let toNumber = Number(move.to[1]);
                let square = move.to[0];
                piece.color === 'w' ? square += (toNumber - 1) : square += (toNumber + 1);

                this.#enPassantSquare = square;
            }
        }

        this.#activeSide = this.#activeSide === 'w' ? 'b' : 'w';
        if(this.#activeSide === 'w') this.#fullMoves++;

        return move;
    }
    undo() {
        let old = this.#history.pop();

        this.#activeSide = old.activeSide;
        this.#castle = old.castle;
        this.#enPassantSquare = old.enPassantSquare;
        this.#halfMoves = old.halfMoves;
        this.#fullMoves = old.fullMoves;

        let move = old.move;
        if(!move) return;

        let piece = this.#board.get(move.to);

        if(move.action & BITS_VALUES.Q_CASTLE) {
            let rook = this.#board.get('d' + move.to[1]);

            this.#board.set(rook.position, null);
            rook.position = 'a' + move.to[1];
            this.#board.set(rook.position, rook);
        }
        if(move.action & BITS_VALUES.K_CASTLE) {
            let rook = this.#board.get('f' + move.to[1]);

            this.#board.set(rook.position, null);
            rook.position = 'h' + move.to[1];
            this.#board.set(rook.position, rook);
        }

        piece.position = move.from;

        if(move.action & BITS_VALUES.PROMOTION) {
            let index = this.#pieces.indexOf(piece);

            piece = piece.promote('p');
            this.#pieces.splice(index, 1, piece);
        }

        this.#board.set(move.from, piece);
        this.#board.set(move.to, null);

        if((move.action & BITS_VALUES.CAPTURE) || (move.action & BITS_VALUES.EP_CAPTURE)) {
            let victim;
            let victimPos;

            if(move.action & BITS_VALUES.EP_CAPTURE) {
                if(piece.color === 'w') victimPos = move.to[0] + (Number(move.to[1]) - 1);
                if(piece.color === 'b') victimPos = move.to[0] + (Number(move.to[1]) + 1);

                victim = this.#pieces.filter(p => p.dead && p.notation === 'p' || p.notation === 'P');
                victim = this.#pieces.find(p => p.color !== piece.color && p.position === victimPos);
            } else {
                victimPos = move.to;
                victim = this.#pieces.find(p => p.dead && p.color !== piece.color && p.notation === move.capturedPiece && p.position === victimPos);
            }

            victim.dead = false;

            this.#board.set(victimPos, victim);
        }

        return old;
    }
    verifyMove(move) {
        let piece = this.#board.get(move.from);
        if(!piece) return false;

        let foundMove = this.#legalMoves[piece.color].filter(m => m.from === move.from && m.to === move.to);
        if(move.action & BITS_VALUES.PROMOTION) foundMove = foundMove.find(m => m.promotion === move.promotion);
        else foundMove = foundMove[0];

        if(!foundMove) return false;

        return foundMove;
    }
    isCheckmate(side) {
        let king = this.#kings[side];

        let moves = this.getLegalMoves(side);
        if(moves.length) return false;

        let enemyControl = this.getProtectedCases(side === 'w' ? 'b' : 'w');
        if(enemyControl.find(m => m.to === king.position)) return true;

        return false;
    }
    #generatePiecesFromFEN(fen) {
        if(!fen) return;

        let rows = fen.split('/');
        if(rows.length !== 8) return;

        let pieces = [];

        for(let row in rows) {
            let currentRow = rows[row];

            let numberAddition = 0;

            for(let piece in currentRow) {
                let current = currentRow[piece];

                if(!isNaN(current)) {
                    numberAddition += (Number(currentRow[piece]) - 1);
                    continue;
                }

                let color = current.toLowerCase() === current ? 'b' : 'w';

                let params = [ color, Board.toChessCoords([ String(Number(piece) + numberAddition), row ]) ];

                let pieceElement = Piece.generatePiece(current.toLowerCase(), params);

                if(current.toLowerCase() === 'k') this.#kings[color] = pieceElement;

                pieces.push(pieceElement)
            }
        }

        return pieces;
    }
    #addToHistory(move) {
        let historyPart = {
            activeSide: this.#activeSide,
            move: move,
            castle: { w: this.#castle.w, b: this.#castle.b },
            enPassantSquare: this.#enPassantSquare,
            halfMoves: this.#halfMoves,
            fullMoves: this.#fullMoves
        }

        this.#history.push(historyPart);
    }
    currentFEN() {
        let output,
            side = this.#activeSide,
            castling = '',
            enPassantSquare = this.#enPassantSquare,
            halfMoves = this.#halfMoves,
            fullMoves = this.#fullMoves;

        let whiteCastling = this.#castle.w,
            blackCastling = this.#castle.b;

        if(whiteCastling & BITS_VALUES.K_CASTLE) castling += 'K';
        if(whiteCastling & BITS_VALUES.Q_CASTLE) castling += 'Q';

        if(blackCastling & BITS_VALUES.K_CASTLE) castling += 'k';
        if(blackCastling & BITS_VALUES.Q_CASTLE) castling += 'q';

        let pieces = this.#board.generateFENField();

        if(!castling) castling = '-'
        if(!enPassantSquare) enPassantSquare = '-';

        output = [ pieces, side, castling, enPassantSquare, halfMoves, fullMoves ].join(' ');

        return output;
    }

    set fen(fen) {
        return this.#loadFEN(fen);
    }
    get activeSide() {
        return this.#activeSide;
    }
    get board() {
        return new Board().load(copyElems(this.#pieces));
    }
    get pieces() {
        return copyElems(this.#pieces);
    }
    get histo() {
        return JSON.parse(JSON.stringify(this.#history));
    }
}

module.exports = ChessGame;
