import {
    combineDisjoint, parseParts, partitionIntoColumns, rotateColumnToQuadrant, stackLayers,
} from '../constructiveSolverRuntime.js';

const EMPTY = Object.freeze({ shape: '-', color: '-' });
const partCode = part => `${part.shape}${part.color}`;
const layerCode = parts => parts.map(partCode).join('');
const isEmptyLayer = parts => parts.every(part => part.shape === '-');

function shapeFromLayers(layers) {
    let length = layers.length;
    while (length > 1 && isEmptyLayer(layers[length - 1])) length -= 1;
    return layers.slice(0, length).map(layerCode).join(':');
}

function buildConcreteLayers(builder, code, buildPart) {
    const layers = parseParts(code);
    const layerIds = layers.map(parts => combineDisjoint(
        builder,
        parts.map((part, quadrant) => part.shape === '-' ? null : buildPart(part, quadrant))
            .filter(id => id !== null),
    ));
    const resultId = stackLayers(builder, layerIds);
    if (builder.shape(resultId) !== code) {
        throw new Error(`Interior ordinary component changed ${builder.shape(resultId)} instead of ${code}`);
    }
    return resultId;
}

/**
 * Builds monochrome Crystal columns that cannot be represented by the frozen
 * one-cut half scaffold. Each selected spatial column is generated inside a
 * full-height all-solid-minus-one-column scaffold, then losslessly partitioned
 * with canonical Cutter/rotation mechanics. The ordinary remainder is built
 * independently and overlaid only after the Crystal skeleton is complete.
 */
export function buildInteriorCrystalColumnSubassembly(
    builder, target, { buildPart, buildSacrificialPart },
) {
    const layers = parseParts(target);
    const crystals = layers.flat().filter(part => part.shape === 'c');
    if (!crystals.length) throw new Error('Interior Crystal-column construction requires Crystal');
    if (layers.flat().some(part => part.shape === 'P')) {
        throw new Error('Interior Crystal-column construction does not claim mixed Pin/Crystal targets');
    }
    const colors = [...new Set(crystals.map(part => part.color))];
    if (colors.length !== 1) {
        throw new Error('Interior Crystal-column construction requires one Crystal color');
    }
    const color = colors[0];
    const crystalQuadrants = Array.from({ length: 4 }, (_, quadrant) => quadrant)
        .filter(quadrant => layers.some(layer => layer[quadrant].shape === 'c'));
    if (crystalQuadrants.some(quadrant => layers.some(layer => (
        layer[quadrant].shape !== 'c' || layer[quadrant].color !== color
    )))) {
        throw new Error('Interior Crystal-column construction requires full-height Crystal columns');
    }

    const crystalIds = [];
    for (const crystalQuadrant of crystalQuadrants) {
        const scaffoldLayers = layers.map(() => combineDisjoint(
            builder,
            Array.from({ length: 4 }, (_, quadrant) => (
                quadrant === crystalQuadrant ? null : buildSacrificialPart(quadrant)
            )).filter(id => id !== null),
        ));
        let generated = stackLayers(builder, scaffoldLayers);
        generated = builder.operate('Crystal Generator', [generated], { color })[0];
        const columns = partitionIntoColumns(builder, generated);
        const expected = shapeFromLayers(layers.map(layer => layer.map((part, quadrant) => (
            quadrant === crystalQuadrant ? part : EMPTY
        ))));
        const isolated = columns.find(id => parseParts(builder.shape(id)).flat()
            .filter(part => part.shape !== '-')
            .every(part => part.shape === 'c' && part.color === color));
        if (isolated === undefined) {
            throw new Error(`Interior Crystal-column isolation did not produce ${expected}`);
        }
        const crystalId = rotateColumnToQuadrant(builder, isolated, crystalQuadrant);
        if (builder.shape(crystalId) !== expected) {
            throw new Error(`Interior Crystal-column rotation produced ${builder.shape(crystalId)} instead of ${expected}`);
        }
        crystalIds.push(crystalId);
    }
    const crystalSkeleton = combineDisjoint(builder, crystalIds);
    const crystalTarget = shapeFromLayers(layers.map(layer => layer.map(part => (
        part.shape === 'c' ? part : EMPTY
    ))));
    if (builder.shape(crystalSkeleton) !== crystalTarget) {
        throw new Error(`Interior Crystal skeleton ${builder.shape(crystalSkeleton)} != ${crystalTarget}`);
    }

    const ordinaryTarget = shapeFromLayers(layers.map(layer => layer.map(part => (
        part.shape === 'c' ? EMPTY : part
    ))));
    let resultId = crystalSkeleton;
    if (ordinaryTarget !== '--------') {
        const ordinary = buildConcreteLayers(builder, ordinaryTarget, buildPart);
        resultId = builder.operate('Stacker', [crystalSkeleton, ordinary])[0];
    }
    if (builder.shape(resultId) !== target) {
        throw new Error(`Interior Crystal-column result ${builder.shape(resultId)} != ${target}`);
    }
    return {
        resultId,
        plan: {
            kind: 'interior-crystal-column-decomposition',
            color,
            crystalQuadrants,
            crystalTarget,
            ordinaryTarget,
        },
    };
}

