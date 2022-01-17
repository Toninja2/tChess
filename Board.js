class Board {
    #board;
    constructor() {
        this.createBoard();
    }
    load(pieces) {
        this.createBoard();

        let p = pieces.filter(p => !p.dead);

        for(let piece = 0; piece < p.length; piece++) this.set(p[piece].position, p[piece]);

        return this;
    }
    createBoard() {
        this.#board = [];
        for(let x = 0; x < 8; x++) this.#board.push(Array(8).fill(null));

        return this;
    }
    get(position) {
        if(!Board.isValidSquare(position)) return null;

        let arrayPos = Board.toArrayCoords(position);
        return this.#board[arrayPos[1]][arrayPos[0]];
    }
    set(position, object) {
        if(!Board.isValidSquare(position)) return null;

        let arrayPos = Board.toArrayCoords(position);
        this.#board[arrayPos[1]][arrayPos[0]] = object;

        return object;
    }

    get board() {
        return this.#board;
    }

    generateFENField() {
        let output = '';

        for(let row = 0; row < 8; row++) {
            let emptyCombo = 0;
            for(let column = 0; column < 8; column++) {
                let current = this.#board[row][column];

                if(current) {
                    if(emptyCombo) output += String(emptyCombo);
                    emptyCombo = 0;
                    output += current.notation;
                } else emptyCombo++;
            }
            if(emptyCombo) output += String(emptyCombo);

            output += '/';
        }

        return output.slice(0, output.length - 1);
    }

    static toChessCoords(arrayPos) {
        if(arrayPos[0] < 0 || arrayPos[0] > 8 || arrayPos[1] < 0 || arrayPos[1] > 8) return false;
        const letters = 'abcdefgh';
        let letter = letters[arrayPos[0]];
        let number = 8 - arrayPos[1];

        return letter + number;
    }
    static toArrayCoords(position) {
        if(!Board.isValidSquare(position)) return null;

        let letters = 'abcdefgh';
        let letter = letters.indexOf(position[0]);
        let number = 8 - position[1];

        return [ letter, number ];
    }

    static isValidSquare(position) {
        return position.length === 2 && position.match(/[a-h][1-8]/g);
    }
}

module.exports = Board;
