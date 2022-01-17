const BITS_VALUES = {
    Q_CASTLE: 1,
    K_CASTLE: 2,

    CAPTURE: 4,
    PROMOTION: 8,
    EP_CAPTURE: 16
}

function copyElems(elems) {
    let output = [];
    for(let elem = 0; elem < elems.length; elem++) output.push(elems[elem].clone());

    return output;
}

module.exports.BITS_VALUES = BITS_VALUES;
module.exports.copyElems = copyElems;
