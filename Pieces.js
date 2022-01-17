const { BITS_VALUES } = require('./Utils.js');
const Board = require('./Board.js');

const DIAGONAL_MOVE = [ { letters: -1, numbers: -1, repetition: 0 }, { letters: -1, numbers: 1, repetition: 0 }, { letters: 1, numbers: -1, repetition: 0 }, { letters: 1, numbers: 1, repetition: 0 } ];
const STRAIGHT_MOVE = [ { letters: 1, numbers: 0, repetition: 0 }, { letters: -1, numbers: 0, repetition: 0 }, { letters: 0, numbers: 1, repetition: 0 }, { letters: 0, numbers: -1, repetition: 0 } ];

class Piece {
    constructor(color, movePatterns, position, eatPatterns, dead) {
        this.color = color;
        this.movePatterns = movePatterns;
        this.eatPatterns = eatPatterns;
        this.position = position;
        this.dead = dead;

        this.notation = '-';

        let keys = Object.keys(Piece.equivalents);

        for(let key = 0; key < keys.length; key++) {
            if(!(this instanceof Piece.equivalents[keys[key]])) continue;
            this.notation = this.color === 'w' ? keys[key].toUpperCase() : keys[key];
        }
    }
    pseudoLegalMoves(board, params) {
        if(!board) return null;

        if(this.dead) return [];
        if(!Board.isValidSquare(this.position)) return [];

        let pseudoLegalMoves = [];

        let movePatterns = this.movePatterns.filter(p => !p.color || p.color === this.color);

        if(this.eatPatterns) {
            let eatPatterns = this.eatPatterns.filter(p => !p.color || p.color === this.color);
            for(let pattern = 0; pattern < movePatterns.length; pattern++) pseudoLegalMoves = pseudoLegalMoves.concat(this.getMovesFromPattern(movePatterns[pattern], board, [ 'movable' ], params));
            for(let pattern = 0; pattern < eatPatterns.length; pattern++) pseudoLegalMoves = pseudoLegalMoves.concat(this.getMovesFromPattern(eatPatterns[pattern], board, [ 'eatable' ], params));
        } else {
            for(let pattern = 0; pattern < movePatterns.length; pattern++) pseudoLegalMoves = pseudoLegalMoves.concat(this.getMovesFromPattern(movePatterns[pattern], board, [ 'movable', 'eatable' ], params));
        }

        return pseudoLegalMoves;
    }
    protectedCases(board, params) {
        if(!board) return null;

        if(this.dead) return [];
        if(!Board.isValidSquare(this.position)) return [];

        let protectedCases = [];

        if(!params) params = {};
        params.protection = true;

        if(this.eatPatterns) {
            let eatPatterns = this.eatPatterns.filter(p => !p.color || p.color === this.color);
            for(let pattern = 0; pattern < eatPatterns.length; pattern++) protectedCases = protectedCases.concat(this.getMovesFromPattern(eatPatterns[pattern], board, [ 'eatable' ], params));
        } else {
            let movePatterns = this.movePatterns.filter(p => !p.color || p.color === this.color);
            for(let pattern = 0; pattern < movePatterns.length; pattern++) protectedCases = protectedCases.concat(this.getMovesFromPattern(movePatterns[pattern], board, [ 'movable', 'eatable' ], params));
        }

        return protectedCases;
    }
    getMovesFromPattern(pattern, board, values, params) {
        let movable = values.includes('movable');
        let eatable = values.includes('eatable');

        let isPawn = this instanceof Pawn;

        let repetition = pattern.repetition;

        if(!repetition) repetition = 7;

        if(isPawn && movable) {
            let twoCases = this.position[1] === '7' || this.position[1] === '2';

            if(twoCases) repetition = 2;
        }

        let letters = 'abcdefgh';

        let pseudoLegal = [];

        let lastPos = this.position;

        for(let x = 0; x < repetition; x++) {
            lastPos = letters[letters.indexOf(lastPos[0]) + pattern.letters] + (Number(lastPos[1]) + pattern.numbers)

            if(!lastPos || !Board.isValidSquare(lastPos)) break;

            let onBoard = board.get(lastPos);
            let promotion = false;

            if(isPawn) promotion = lastPos[1] === '8' || lastPos[1] === '1';

            if(onBoard && !eatable) break;

            if(onBoard && onBoard.color === this.color) {
                if(params.protection) pseudoLegal.push({ from: this.position, to: lastPos });
                break;
            }

            if(params.protection && !onBoard && eatable) pseudoLegal.push({ from: this.position, to: lastPos });

            if(!onBoard && movable) {
                let move = { from: this.position, to: lastPos };

                if(promotion) pseudoLegal = pseudoLegal.concat(this.generatePromotionsMoves(move));
                else pseudoLegal.push(move);
            }

            if(isPawn && eatable && params.enPassantSquare === lastPos) {
                pseudoLegal.push({ from: this.position, to: lastPos, action: BITS_VALUES.EP_CAPTURE });
            }
            if(eatable && onBoard) {
                let move = { from: this.position, to: lastPos, action: BITS_VALUES.CAPTURE, capturedPiece: onBoard.notation };

                if(promotion) pseudoLegal = pseudoLegal.concat(this.generatePromotionsMoves(move));
                else pseudoLegal.push(move);

                break;
            }
        }

        return pseudoLegal;
    }
    generatePromotionsMoves(move) {
        move.action |= BITS_VALUES.PROMOTION;

        let moves = [];

        let promotions = ['q', 'r', 'n', 'b'];

        for(let promotion = 0; promotion < promotions.length; promotion++) {
            move.promotion = promotions[promotion];
            moves.push({ ...move });
        }

        return moves;
    }
    promote(identifier) {
        let NewClass = Piece.equivalents[identifier];
        if(!NewClass) return this;

        return new NewClass(this.color, this.position, this.dead);
    }
    static generatePiece(notation, params) {
        let pieceElement;

        let ClassType = Piece.equivalents[notation];

        if(!ClassType) return null;

        return new ClassType(...params);
    }
    clone() {
        let Type = Object.values(Piece.equivalents).find(value => this instanceof value);

        if(!Type) return;

        let output = new Type(this.color, this.position, this.dead);

        return output;
    }
}

class Pawn extends Piece {
    constructor(color, position, dead = false) {
        let movePatterns = [ { letters: 0, numbers: -1, repetition: 1, color: 'b' }, { letters: 0, numbers: 1, repetition: 1, color: 'w' } ];
        let eatPatterns = [ { letters: -1, numbers: -1, repetition: 1, color: 'b' }, { letters: 1, numbers: -1, repetition: 1, color: 'b' }, { letters: -1, numbers: 1, repetition: 1, color: 'w' }, { letters: 1, numbers: 1, repetition: 1, color: 'w' } ];

        super(color, movePatterns, position, eatPatterns, dead);
    }
}
class Rook extends Piece {
    constructor(color, position, dead = false) {
        let movePatterns = STRAIGHT_MOVE;

        super(color, movePatterns, position, undefined, dead);
    }
}
class Bishop extends Piece {
    constructor(color, position, dead = false) {
        let movePatterns = DIAGONAL_MOVE;

        super(color, movePatterns, position, undefined, dead);
    }
}
class Knight extends Piece {
    constructor(color, position, dead = false) {
        let movePatterns = [
            { letters: -1, numbers: 2, repetition: 1 },
            { letters: -1, numbers: -2, repetition: 1 },
            { letters: 1, numbers: -2, repetition: 1 },
            { letters: 1, numbers: 2, repetition: 1 },
            { letters: 2, numbers: -1, repetition: 1 },
            { letters: -2, numbers: -1, repetition: 1 },
            { letters: 2, numbers: 1, repetition: 1 },
            { letters: -2, numbers: 1, repetition: 1 }
        ];

        super(color, movePatterns, position, undefined, dead);
    }
}
class Queen extends Piece {
    constructor(color, position, dead = false) {
        let movePatterns = DIAGONAL_MOVE.concat(STRAIGHT_MOVE);

        super(color, movePatterns, position, undefined, dead);
    }
}
class King extends Piece {
    constructor(color, position, dead = false) {
        let movePatterns = [ { letters: 0, numbers: -1, repetition: 1 }, { letters: 0, numbers: 1, repetition: 1 }, { letters: -1, numbers: 0, repetition: 1 }, { letters: 1, numbers: 0, repetition: 1 }, { letters: -1, numbers: -1, repetition: 1 }, { letters: -1, numbers: 1, repetition: 1 }, { letters: 1, numbers: -1, repetition: 1 }, { letters: 1, numbers: 1, repetition: 1 } ]

        super(color, movePatterns, position, undefined, dead);
    }
}

Piece.equivalents = {
    'p': Pawn,
    'r': Rook,
    'n': Knight,
    'b': Bishop,
    'q': Queen,
    'k': King
}

module.exports = {
    Piece: Piece,
    Pawn: Pawn,
    Rook: Rook,
    Bishop: Bishop,
    Knight: Knight,
    Queen: Queen,
    King: King
}
