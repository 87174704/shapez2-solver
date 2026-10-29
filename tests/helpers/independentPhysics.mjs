// Analytical R1/R2/R3 model, not game-certified operation outputs. No production imports.
export const decode = code => code.split(':').map(row => row.match(/../g));
export const encode = rows => rows.map(row => row.join('')).join(':');
const occupied = p => p[0] !== '-';
const crystal = p => p[0] === 'c';
const joined = (a, b) => occupied(a) && occupied(b) && a[0] !== 'P' && b[0] !== 'P';
const clone = rows => rows.map(row => [...row]);
const trim = rows => { while (rows.length > 1 && rows.at(-1).every(p => !occupied(p))) rows.pop(); return rows; };

// Independently search FROM every cell TO a floor anchor. Failures are root-local.
export function supportModel(rows, reverse = false) {
    const width = rows[0].length;
    return rows.map((row, l) => row.map((part, q) => {
        if (!occupied(part)) return false;
        const pending = [[l, q]], seen = new Set([`${l},${q}`]);
        for (const [a, b] of pending) {
            if (a === 0) return true;
            const next = [[a - 1, b]];
            for (const d of [(b + 1) % width, (b + width - 1) % width]) {
                if (joined(rows[a][b], rows[a][d])) next.push([a, d]);
            }
            if (a + 1 < rows.length && crystal(rows[a][b]) && crystal(rows[a + 1][b])) next.push([a + 1, b]);
            if (reverse) next.reverse();
            for (const [c, d] of next) {
                const key = `${c},${d}`;
                if (occupied(rows[c][d]) && !seen.has(key)) { seen.add(key); pending.push([c, d]); }
            }
        }
        return false;
    }));
}

// A second algorithm: all-pairs transitive closure, including only occupied cells.
export function supportClosure(rows) {
    const width = rows[0].length, size = rows.length * width;
    const reach = Array.from({ length: size }, () => Array(size).fill(false));
    for (let a = 0; a < size; a++) {
        const l = Math.floor(a / width), q = a % width;
        if (!occupied(rows[l][q])) continue;
        reach[a][a] = true;
        if (l && occupied(rows[l - 1][q])) reach[a][a - width] = true;
        for (const p of [(q + 1) % width, (q + width - 1) % width]) if (joined(rows[l][q], rows[l][p])) reach[a][l * width + p] = true;
        if (l + 1 < rows.length && crystal(rows[l][q]) && crystal(rows[l + 1][q])) reach[a][a + width] = true;
    }
    for (let k = 0; k < size; k++) for (let i = 0; i < size; i++) if (reach[i][k]) {
        for (let j = 0; j < size; j++) reach[i][j] ||= reach[k][j];
    }
    return rows.map((row, l) => row.map((_, q) => reach[l * width + q].slice(0, width).some(Boolean)));
}

export function components(rows, crystalsOnly = true) {
    const width = rows[0].length, seen = new Set(), groups = [];
    for (let l = 0; l < rows.length; l++) for (let q = 0; q < width; q++) {
        if (!(crystalsOnly ? crystal(rows[l][q]) : occupied(rows[l][q])) || seen.has(`${l},${q}`)) continue;
        const group = [[l, q]]; seen.add(`${l},${q}`);
        for (const [a, b] of group) {
            const next = [[a, (b + 1) % width], [a, (b + width - 1) % width]];
            if (crystalsOnly) next.push([a - 1, b], [a + 1, b]);
            for (const [c, d] of next) {
                if (c < 0 || c >= rows.length || seen.has(`${c},${d}`)) continue;
                if (!(crystalsOnly ? crystal(rows[c][d]) : joined(rows[a][b], rows[c][d]))) continue;
                seen.add(`${c},${d}`); group.push([c, d]);
            }
        }
        groups.push(group);
    }
    return groups;
}

export function breakSelected(rows, selected) {
    // Membership determined against an immutable event graph, independent of color.
    const before = components(rows);
    for (const group of before) if (group.some(([l, q]) => selected(l, q))) {
        for (const [l, q] of group) rows[l][q] = '--';
    }
    return rows;
}

export function gravity(input) {
    const rows = clone(input), first = supportModel(rows);
    breakSelected(rows, (l, q) => !first[l][q]);
    const second = supportModel(rows);
    // Independent coordinate groups, then collision-limited vertical translation.
    for (const group of components(rows, false)) {
        const l = group[0][0];
        if (!l || group.some(([a, b]) => second[a][b])) continue;
        let distance = 0;
        while (distance < l && group.every(([, q]) => !occupied(rows[l - distance - 1][q]))) distance++;
        if (!distance) continue;
        for (const [, q] of group) { rows[l - distance][q] = rows[l][q]; rows[l][q] = '--'; }
    }
    return rows;
}

export function transform(code, turns = 0, mirror = false) {
    return encode(decode(code).map(row => {
        let result = mirror ? [row[0], ...row.slice(1).reverse()] : [...row];
        for (let k = 0; k < turns; k++) result = [result.at(-1), ...result.slice(0, -1)];
        return result;
    }));
}

export function physicalOutputs(operation, inputs, params = {}, maxLayers = 4) {
    const rows = decode(inputs[0]), width = rows[0].length;
    const blank = () => Array(width).fill('--');
    const finish = r => encode(trim(r));
    if (operation.startsWith('Rotator')) {
        const turns = { 'Rotator CW': 1, 'Rotator CCW': width - 1, 'Rotator 180': Math.floor(width / 2) }[operation];
        return [transform(inputs[0], turns)];
    }
    if (operation === 'Painter') {
        // Repository material contract: refined X and exotic Y are also unpaintable.
        rows[rows.length - 1] = rows.at(-1).map(p => ['-', 'P', 'c', 'X', 'Y'].includes(p[0]) ? p : p[0] + params.color);
        return [encode(rows)];
    }
    if (operation === 'Crystal Generator') return [encode(rows.map(row => row.map(p => ['-', 'P'].includes(p[0]) ? 'c' + params.color : p)))];
    if (operation === 'Pin Pusher') {
        const pins = rows[0].map(p => occupied(p) ? 'P-' : '--');
        const kept = [pins, ...rows.slice(0, maxLayers - 1)];
        if (rows.length >= maxLayers) breakSelected(kept, (l, q) => l === kept.length - 1 && crystal(rows[maxLayers - 1][q]) && crystal(kept[l][q]));
        return [finish(gravity(kept))];
    }
    if (operation === 'Stacker') return [finish(gravity([...rows, blank(), ...decode(inputs[1])])).split(':').slice(0, maxLayers).join(':')];
    if (['Cutter', 'Half Destroyer', 'Swapper'].includes(operation)) {
        const cut = code => {
            const r = decode(code), split = width - Math.ceil(width / 2);
            breakSelected(r, (l, q) => (q === 0 && crystal(r[l][width - 1])) || (q === split && crystal(r[l][split - 1])));
            return [r.map(row => row.map((p, q) => q < split ? '--' : p)), r.map(row => row.map((p, q) => q < split ? p : '--'))].map(x => trim(gravity(x)));
        };
        const [right, left] = cut(inputs[0]);
        if (operation === 'Half Destroyer') return [encode(left)];
        if (operation === 'Cutter') return [encode(right), encode(left)];
        const [otherRight, otherLeft] = cut(inputs[1]), count = Math.max(rows.length, decode(inputs[1]).length), split = width - Math.ceil(width / 2);
        const merge = (a, b) => finish(Array.from({ length: count }, (_, l) => [...(a[l] ?? blank()).slice(0, split), ...(b[l] ?? blank()).slice(split)]));
        return [merge(left, otherRight), merge(otherLeft, right)];
    }
    throw Error('unsupported operation ' + operation);
}
