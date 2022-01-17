# TChess
**Date**: July 2021  
**Language**: JavaScript  
This library is used for chess moves generation, validation, checkmates, etc ...

## Special moves
These special moves are included:  
    - "En passant"  
    - Castling  
    - Promotions

## Usage

Creating a game
```js
const Game = require('tchess/ChessGame');

const game = new Game(/* start FEN */'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

let legalMoves = game.getLegalMoves();
/*
legalMoves is an Array of objects like this:
{ from: 'a1', to: 'a2', action?: value defining the action, promotion?: either q for queen, r for rook, n for knight or b for bishop }

action values:
    Q_CASTLE: 1,
    K_CASTLE: 2,

    CAPTURE: 4,
    PROMOTION: 8,
    EP_CAPTURE: 16
*/

let move = { from: 'a2', to: 'a1' };

let isValid = game.verifyMove(move);
if(isValid) game.makeMove(move);

let isCheckmate = game.isCheckmate(/* side */'b');
if(isCheckmate) game.undo();
```