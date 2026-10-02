import { Shape, cut } from './shapeOperations.js';

/** Browser-safe shape-code parsing shared by the production constructive planners. */
export function parseParts(shapeCode) {
    return shapeCode.split(':').map(layer => {
        const parts = [];
        for (let index = 0; index < layer.length; index += 2) {
            parts.push({ shape: layer[index], color: layer[index + 1] });
        }
        return parts;
    });
}

function occupiedCount(shapeCode) {
    return parseParts(shapeCode).flat().filter(part => part.shape !== '-').length;
}

/** Partition a non-crystal shape into spatial columns while preserving every
 * non-empty Cutter output. Returning every leaf keeps resource use linear. */
export function partitionIntoColumns(builder, tokenId) {
    const pending = [tokenId];
    const result = [];
    while (pending.length) {
        let current = pending.pop();
        const occupiedQuadrants = new Set(parseParts(builder.shape(current)).flatMap(layer => layer
            .map((part, quadrant) => part.shape === '-' ? null : quadrant)
            .filter(value => value !== null)));
        if (occupiedQuadrants.size <= 1) {
            result.push(current);
            continue;
        }
        let split = null;
        for (let turns = 0; turns < 4 && !split; turns += 1) {
            const preview = cut(Shape.fromShapeCode(builder.shape(current)), builder.config)
                .filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
            if (preview.length === 2
                && preview.reduce((sum, code) => sum + occupiedCount(code), 0)
                    === occupiedCount(builder.shape(current))) {
                split = builder.operate('Cutter', [current]);
                break;
            }
            current = builder.operate('Rotator CW', [current])[0];
        }
        if (!split) throw new Error(`cannot losslessly partition ${builder.shape(current)} into columns`);
        pending.push(...split);
    }
    return result;
}

export function selectColumn(builder, ids, predicate, context) {
    const index = ids.findIndex(id => predicate(builder.shape(id)));
    if (index < 0) throw new Error(`missing column for ${context}`);
    return ids.splice(index, 1)[0];
}

export function rotateColumnToQuadrant(builder, id, quadrant) {
    const layers = parseParts(builder.shape(id));
    const current = layers[0].findIndex(part => part.shape !== '-');
    if (current < 0 || layers.some(layer => layer.findIndex(part => part.shape !== '-') !== current)) {
        throw new Error('expected a single spatial column');
    }
    const turns = (quadrant - current + 4) % 4;
    for (let index = 0; index < turns; index += 1) {
        id = builder.operate('Rotator CW', [id])[0];
    }
    return id;
}

export function combineDisjoint(builder, ids) {
    if (!ids.length) throw new Error('cannot combine an empty component list');
    let result = ids[0];
    for (let index = 1; index < ids.length; index += 1) {
        result = builder.operate('Stacker', [result, ids[index]])[0];
    }
    return result;
}

export function stackLayers(builder, ids) {
    if (!ids.length) throw new Error('cannot stack an empty layer list');
    let result = ids[0];
    for (let index = 1; index < ids.length; index += 1) {
        result = builder.operate('Stacker', [result, ids[index]])[0];
    }
    return result;
}
