import { COLOR_MODES, PART_CODES, SHAPE_LAYER_SEPARATOR } from './shapeConstants.js';
import { t } from './i18n.js';

const VALID_SHAPES = new Set(Object.values(PART_CODES));
const VALID_COLORS = new Set([PART_CODES.NOTHING, ...Object.keys(COLOR_MODES.rgb)]);

function validateLayer(layer, layerIndex) {
    const errors = [];
    const layerNumber = layerIndex + 1;

    if (layer.length === 0) {
        errors.push(t('validation.layerEmpty', { layerNumber }));
        return errors;
    }

    if (layer.length % 2 !== 0) {
        errors.push(t('validation.layerEvenChars', { layerNumber }));
        return errors;
    }

    for (let i = 0; i < layer.length; i += 2) {
        const shape = layer[i];
        const color = layer[i + 1];
        const partNumber = (i / 2) + 1;

        if (!VALID_SHAPES.has(shape)) {
            errors.push(t('validation.invalidShape', { layerNumber, partNumber, shape }));
        }

        if (!VALID_COLORS.has(color)) {
            errors.push(t('validation.invalidColor', { layerNumber, partNumber, color }));
        }

        if (shape === PART_CODES.NOTHING && color !== PART_CODES.NOTHING) {
            errors.push(t('validation.nothingHasNoColor', { layerNumber, partNumber }));
        }

        if (shape === PART_CODES.PIN && color !== PART_CODES.NOTHING) {
            errors.push(t('validation.pinHasNoColor', { layerNumber, partNumber }));
        }
    }

    return errors;
}

export function validateShapeCode(shapeCode) {
    if (typeof shapeCode !== 'string') {
        return { isValid: false, errors: [t('validation.mustBeString')] };
    }

    if (!shapeCode.length) {
        return { isValid: false, errors: [t('validation.cannotBeEmpty')] };
    }

    const layers = shapeCode.split(SHAPE_LAYER_SEPARATOR);
    if (!layers.length) {
        return { isValid: false, errors: [t('validation.mustContainLayer')] };
    }

    const errors = [];
    let expectedParts = null;

    for (let i = 0; i < layers.length; i++) {
        errors.push(...validateLayer(layers[i], i));

        const numParts = layers[i].length / 2;
        if (expectedParts === null) {
            expectedParts = numParts;
        } else if (numParts !== expectedParts) {
            errors.push(t('validation.inconsistentParts', {
                layerNumber: i + 1,
                actualParts: numParts,
                expectedParts,
            }));
        }
    }

    return { isValid: errors.length === 0, errors };
}

export function showValidationErrors(shapeCode, context = t('validation.context.shape')) {
    const { isValid, errors } = validateShapeCode(shapeCode);
    if (isValid) return true;

    alert(t('validation.invalidCode', {
        context,
        shapeCode,
        errors: errors.join('\n'),
    }));

    return false;
}
