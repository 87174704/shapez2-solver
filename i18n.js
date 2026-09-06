export const DEFAULT_LOCALE = 'cn';
export const SUPPORTED_LOCALES = Object.freeze(['cn', 'en']);
export const LANGUAGE_STORAGE_KEY = 'shapez2-solver-locale';

const COLOR_LABEL_KEYS = Object.freeze({
    r: 'colors.red',
    red: 'colors.red',
    g: 'colors.green',
    green: 'colors.green',
    b: 'colors.blue',
    blue: 'colors.blue',
    c: 'colors.cyan',
    cyan: 'colors.cyan',
    m: 'colors.magenta',
    magenta: 'colors.magenta',
    y: 'colors.yellow',
    yellow: 'colors.yellow',
    w: 'colors.white',
    white: 'colors.white',
    u: 'colors.gray',
    gray: 'colors.gray',
    grey: 'colors.gray',
    k: 'colors.black',
    black: 'colors.black',
});

const OPERATION_LABEL_KEYS = Object.freeze({
    'Rotator CW': 'operations.rotatorCw',
    'Rotator CCW': 'operations.rotatorCcw',
    'Rotator 180': 'operations.rotator180',
    'Half Destroyer': 'operations.halfDestroyer',
    Cutter: 'operations.cutter',
    Swapper: 'operations.swapper',
    Stacker: 'operations.stacker',
    Painter: 'operations.painter',
    'Pin Pusher': 'operations.pinPusher',
    'Crystal Generator': 'operations.crystalGenerator',
    Splitter: 'operations.splitter',
});

function formatTemplate(template, params = {}) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(params[key] ?? ''));
}

function pluralizeEn(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

const TRANSLATIONS = {
    en: {
        'page.title': 'Shapez 2 Solver',
        'header.source': 'Source on GitHub',
        'language.label': 'Language',
        'language.option.cn': 'Chinese',
        'language.option.en': 'English',
        'sidebar.toggle.collapse': 'Collapse sidebar',
        'sidebar.toggle.expand': 'Expand sidebar',
        'sidebar.tab.shapes': 'Shapes',
        'sidebar.tab.mixing': 'Mixing',
        'sections.shapes': 'Shapes',
        'sections.settings': 'Settings',
        'sections.solve': 'Solve',
        'subsections.outputs': 'Outputs',
        'subsections.inputs': 'Inputs',
        'subsections.operations': 'Operations',
        'subsections.shapeRules': 'Shape Rules',
        'subsections.solverOptions': 'Solver Options',
        'subsections.explorerOptions': 'Explorer Options',
        'subsections.colors': 'Colors',
        'explorer.help': 'Explore all shapes reachable from the current inputs and enabled operations within the depth limit. The explorer renders a relationship graph instead of finding an optimal recipe.',
        'shape.list.empty': 'None added yet.',
        'shape.input.placeholder': 'Shape code...',
        'common.add': 'Add',
        'common.remove': 'Remove',
        'common.cancel': 'Cancel',
        'buttons.extractFromOutputs': 'Extract from Outputs',
        'buttons.resetAll': 'Reset All',
        'buttons.copyGraph': 'Copy Graph',
        'buttons.copySnapshot': 'Copy snapshot',
        'buttons.extract': 'Extract',
        'actions.solve': 'Solve',
        'actions.explore': 'Explore',
        'actions.cancel': 'Cancel',
        'modes.solver': 'Solver',
        'modes.explorer': 'Explorer',
        'operations.rotatorCw': 'Clockwise Rotate',
        'operations.rotatorCcw': 'Counterclockwise Rotate',
        'operations.rotator180': 'Rotate 180°',
        'operations.halfDestroyer': 'Half Destroyer',
        'operations.cutter': 'Cutter',
        'operations.swapper': 'Swapper',
        'operations.stacker': 'Stacker',
        'operations.painter': 'Painter',
        'operations.pinPusher': 'Pin Pusher',
        'operations.crystalGenerator': 'Crystal Generator',
        'operations.splitter': 'Splitter',
        'operations.short.rotatorCw': 'CW',
        'operations.short.rotatorCcw': 'CCW',
        'operations.short.rotator180': '180°',
        'operations.short.halfDestroyer': 'Destroy',
        'operations.short.cutter': 'Cut',
        'operations.short.swapper': 'Swap',
        'operations.short.stacker': 'Stack',
        'operations.short.painter': 'Paint',
        'operations.short.pinPusher': 'Pin',
        'operations.short.crystalGenerator': 'Crystal',
        'operations.labelWithColor': '{{name}} ({{color}})',
        'settings.maxLayers': 'Max Layers',
        'settings.maxLayersDesc': 'The layer limit for shapes.\nThe default game limit is 4 layers (5 in the Insane scenario).',
        'settings.maxStatesPerLevel': 'Max States Per Level',
        'settings.maxStatesDesc': 'Smaller = faster but may fail.\nLarger = slower but more efficient.',
        'settings.preventWaste': 'Prevent Waste',
        'settings.orientationSensitive': 'Orientation-Sensitive',
        'settings.allowSplitting': 'Allow Shape Splitting',
        'settings.cleanPainting': 'Clean Painting',
        'settings.depthLimit': 'Depth Limit',
        'settings.depthLimitDesc': 'Explore all shapes reachable within this many operation steps.',
        'placeholders.infinity': 'Infinity',
        'mix.manualInputs': 'Manual Inputs',
        'mix.have': 'Have',
        'mix.want': 'Want',
        'mix.compactGraph': 'Compact Mix Graph',
        'mix.list.header': 'Solutions',
        'mix.list.empty': 'No solutions found.',
        'mix.list.stepCount': ({ count }) => pluralizeEn(count, 'step'),
        'mix.status.solving': 'Solving mix...',
        'mix.status.optimizing': 'Optimizing mix...',
        'mix.status.optimizingTryingInputs': ({ inputCount }) => `Optimizing mix · trying ${pluralizeEn(inputCount, 'input')}...`,
        'mix.status.solved': ({ solutionCount }) => `Mix solved · ${pluralizeEn(solutionCount, 'solution')} found`,
        'mix.status.optimized': ({ solutionCount, inputCount }) =>
            `Mix optimized · ${pluralizeEn(solutionCount, 'solution')} · ${pluralizeEn(inputCount, 'input')}`,
        'mix.status.noManualSolution': 'No solution found. Try adding more input colors.',
        'mix.status.noSolutionWithinLimit': 'No solution found within search limit.',
        'mix.alert.noManualSolution': 'No solution found. Try adding more input colors.',
        'mix.alert.noSolutionWithinLimit': 'No solution found within the search limit. Try adding more output colors.',
        'mix.mixer': 'Mixer',
        'colors.red': 'Red',
        'colors.green': 'Green',
        'colors.blue': 'Blue',
        'colors.cyan': 'Cyan',
        'colors.magenta': 'Magenta',
        'colors.yellow': 'Yellow',
        'colors.white': 'White',
        'colors.gray': 'Gray',
        'colors.black': 'Black',
        'placeholder.noGraph': 'No graph generated yet',
        'status.idle': 'Idle',
        'status.cancelled': 'Cancelled.',
        'status.workerError': ({ message }) => `Worker error: ${message}`,
        'status.errorMessage': ({ message }) => `Error: ${message}`,
        'controls.colorMode': 'Color Mode',
        'controls.direction': 'Direction',
        'controls.direction.lr': 'Left to Right',
        'controls.direction.tb': 'Top to Bottom',
        'controls.direction.rl': 'Right to Left',
        'controls.direction.bt': 'Bottom to Top',
        'solver.status.solving': 'Solving...',
        'solver.status.progress': ({ depth, queueLength, totalStates, prunedCount }) => {
            const prunedText = prunedCount > 0 ? ` · pruned ${prunedCount}` : '';
            return `Solving at depth ${depth} · ${queueLength} states queued · ${totalStates} total states${prunedText}`;
        },
        'solver.status.solved': ({ elapsed, depth, statesExplored }) =>
            `Solved in ${elapsed}s · depth ${depth} · ${statesExplored} states`,
        'solver.status.noSolution': 'No solution found.',
        'solver.alert.addOutput': 'Add at least one output shape.',
        'solver.alert.addOutputFirst': 'Add at least one output shape first.',
        'solver.alert.noOutputToExtract': 'No output shapes to extract from.',
        'solver.alert.failedToExtract': ({ shapeCode, message }) => `Failed to extract shapes from "${shapeCode}": ${message}`,
        'solver.alert.impossible': ({ shortages }) =>
            `Impossible solution: not enough non-renewable parts in inputs to satisfy outputs.\n\nShortages:\n${shortages}`,
        'solver.shortageLine': ({ part, need, have }) => `${part}: need ${need}, have ${have}`,
        'explorer.status.exploring': 'Exploring...',
        'explorer.status.complete': ({ shapeCount, opCount }) => `Exploration complete. Shapes: ${shapeCount}, ops: ${opCount}`,
        'explorer.status.noneReachable': 'No shapes reachable.',
        'explorer.popup.copy': 'Copy',
        'explorer.popup.goesTo': 'Goes To',
        'explorer.popup.comesFrom': 'Comes From',
        'explorer.popup.noOutgoing': 'No outgoing operations',
        'explorer.popup.noIncoming': 'No incoming operations',
        'explorer.popup.fromShape': ({ shapeCode }) => `from ${shapeCode}`,
        'explorer.popup.toShape': ({ shapeCode }) => `to ${shapeCode}`,
        'graph.alert.copySuccess': 'Graph image copied to clipboard!',
        'graph.alert.copyFailure': 'Failed to copy image to clipboard.',
        'graph.alert.export3dFailure': 'Failed to export 3D graph.',
        'graph.alert.noGraph': 'No graph to copy.',
        'modal.extraction.title': 'Shape Extraction Options',
        'modal.extraction.description': 'Automatically set input shapes by splitting the output shapes into smaller components based on a certain property.',
        'modal.extraction.uniqueBy': 'Extract by Unique:',
        'modal.extraction.layer': 'Layer',
        'modal.extraction.shape': 'Shape',
        'modal.extraction.color': 'Color',
        'modal.extraction.shapeColor': 'Shape & Color',
        'modal.extraction.part': 'Part',
        'modal.extraction.includePins': 'Include Pins?',
        'modal.extraction.includeCrystals': 'Include Crystals?',
        'modal.extraction.includeColor': 'Include Color?',
        'validation.context.shape': 'shape',
        'validation.context.targetShape': 'target shape',
        'validation.context.startingShape': 'starting shape',
        'validation.context.outputShape': 'output shape',
        'validation.mustBeString': 'The shape code must be a string.',
        'validation.cannotBeEmpty': 'The shape code cannot be empty.',
        'validation.mustContainLayer': 'The shape code must contain at least one layer.',
        'validation.layerEmpty': ({ layerNumber }) => `Layer ${layerNumber} is empty. Each layer must contain shape-color pairs.`,
        'validation.layerEvenChars': ({ layerNumber }) =>
            `Layer ${layerNumber} must contain an even number of characters (each shape must have a color).`,
        'validation.invalidShape': ({ layerNumber, partNumber, shape }) =>
            `Layer ${layerNumber}, Part ${partNumber}: '${shape}' is not a valid shape.`,
        'validation.invalidColor': ({ layerNumber, partNumber, color }) =>
            `Layer ${layerNumber}, Part ${partNumber}: '${color}' is not a valid color.`,
        'validation.nothingHasNoColor': ({ layerNumber, partNumber }) =>
            `Layer ${layerNumber}, Part ${partNumber}: A 'Nothing' shape cannot have a color.`,
        'validation.pinHasNoColor': ({ layerNumber, partNumber }) =>
            `Layer ${layerNumber}, Part ${partNumber}: A 'Pin' shape cannot have a color.`,
        'validation.inconsistentParts': ({ layerNumber, actualParts, expectedParts }) =>
            `Layer ${layerNumber} has ${actualParts} parts, but expected ${expectedParts}. All layers must have the same number of parts.`,
        'validation.invalidCode': ({ context, shapeCode, errors }) => `Invalid ${context} code: ${shapeCode}\n\nErrors:\n${errors}`,
    },
    cn: {
        'page.title': 'Shapez 2 求解器',
        'header.source': 'GitHub 源码',
        'language.label': '语言',
        'language.option.cn': '中文',
        'language.option.en': 'English',
        'sidebar.toggle.collapse': '收起侧边栏',
        'sidebar.toggle.expand': '展开侧边栏',
        'sidebar.tab.shapes': '形状',
        'sidebar.tab.mixing': '调色',
        'sections.shapes': '形状',
        'sections.settings': '设置',
        'sections.solve': '求解',
        'subsections.outputs': '输出',
        'subsections.inputs': '输入',
        'subsections.operations': '操作',
        'subsections.shapeRules': '形状规则',
        'subsections.solverOptions': '求解选项',
        'subsections.explorerOptions': '探索选项',
        'subsections.colors': '颜色',
        'explorer.help': '在深度上限内，从当前输入形状和启用操作出发，枚举全部可达形状。探索器展示的是关系图，不会像求解器那样寻找最优配方。',
        'shape.list.empty': '还没有添加任何内容。',
        'shape.input.placeholder': '形状代码...',
        'common.add': '添加',
        'common.remove': '移除',
        'common.cancel': '取消',
        'buttons.extractFromOutputs': '从输出中提取',
        'buttons.resetAll': '全部重置',
        'buttons.copyGraph': '复制图表',
        'buttons.copySnapshot': '复制快照',
        'buttons.extract': '提取',
        'actions.solve': '求解',
        'actions.explore': '探索',
        'actions.cancel': '取消',
        'modes.solver': '求解器',
        'modes.explorer': '探索器',
        'operations.rotatorCw': '顺时针旋转',
        'operations.rotatorCcw': '逆时针旋转',
        'operations.rotator180': '旋转 180°',
        'operations.halfDestroyer': '半破',
        'operations.cutter': '分割',
        'operations.swapper': '交换',
        'operations.stacker': '堆垛',
        'operations.painter': '染色',
        'operations.pinPusher': '顶针',
        'operations.crystalGenerator': '晶体生成',
        'operations.splitter': '分裂',
        'operations.short.rotatorCw': '顺时针',
        'operations.short.rotatorCcw': '逆时针',
        'operations.short.rotator180': '180°',
        'operations.short.halfDestroyer': '半破',
        'operations.short.cutter': '分割',
        'operations.short.swapper': '交换',
        'operations.short.stacker': '堆垛',
        'operations.short.painter': '染色',
        'operations.short.pinPusher': '顶针',
        'operations.short.crystalGenerator': '晶体',
        'operations.labelWithColor': '{{name}}（{{color}}）',
        'settings.maxLayers': '最大层数',
        'settings.maxLayersDesc': '限制形状可用的最大层数。\n游戏默认上限是 4 层（Insane 场景为 5 层）。',
        'settings.maxStatesPerLevel': '每层最大状态数',
        'settings.maxStatesDesc': '值越小速度越快，但可能失败。\n值越大速度越慢，但更容易找到方案。',
        'settings.preventWaste': '避免浪费',
        'settings.orientationSensitive': '区分朝向',
        'settings.allowSplitting': '允许形状分裂',
        'settings.cleanPainting': '纯净染色',
        'settings.depthLimit': '深度上限',
        'settings.depthLimitDesc': '枚举在指定操作步数内可达的全部形状。',
        'placeholders.infinity': '无限',
        'mix.manualInputs': '手动输入',
        'mix.have': '已有',
        'mix.want': '目标',
        'mix.compactGraph': '紧凑调色图',
        'mix.list.header': '方案',
        'mix.list.empty': '未找到方案。',
        'mix.list.stepCount': ({ count }) => `${count} 步`,
        'mix.status.solving': '正在求解调色...',
        'mix.status.optimizing': '正在优化调色...',
        'mix.status.optimizingTryingInputs': ({ inputCount }) => `调色优化中 · 尝试 ${inputCount} 份输入...`,
        'mix.status.solved': ({ solutionCount }) => `调色求解完成 · 找到 ${solutionCount} 个方案`,
        'mix.status.optimized': ({ solutionCount, inputCount }) => `调色优化完成 · ${solutionCount} 个方案 · ${inputCount} 份输入`,
        'mix.status.noManualSolution': '未找到方案，请尝试增加输入颜色。',
        'mix.status.noSolutionWithinLimit': '在搜索上限内未找到方案。',
        'mix.alert.noManualSolution': '未找到方案，请尝试增加输入颜色。',
        'mix.alert.noSolutionWithinLimit': '在搜索上限内未找到方案，请尝试增加输出颜色。',
        'mix.mixer': '混色器',
        'colors.red': '红',
        'colors.green': '绿',
        'colors.blue': '蓝',
        'colors.cyan': '青',
        'colors.magenta': '紫',
        'colors.yellow': '黄',
        'colors.white': '白',
        'colors.gray': '灰',
        'colors.black': '黑',
        'placeholder.noGraph': '还没有生成图表',
        'status.idle': '空闲',
        'status.cancelled': '已取消。',
        'status.workerError': ({ message }) => `工作线程错误：${message}`,
        'status.errorMessage': ({ message }) => `错误：${message}`,
        'controls.colorMode': '配色模式',
        'controls.direction': '方向',
        'controls.direction.lr': '从左到右',
        'controls.direction.tb': '从上到下',
        'controls.direction.rl': '从右到左',
        'controls.direction.bt': '从下到上',
        'solver.status.solving': '正在求解...',
        'solver.status.progress': ({ depth, queueLength, totalStates, prunedCount }) => {
            const prunedText = prunedCount > 0 ? ` · 剪枝 ${prunedCount}` : '';
            return `求解中：深度 ${depth} · 队列 ${queueLength} · 总状态 ${totalStates}${prunedText}`;
        },
        'solver.status.solved': ({ elapsed, depth, statesExplored }) =>
            `${elapsed} 秒求解完成 · 深度 ${depth} · ${statesExplored} 个状态`,
        'solver.status.noSolution': '未找到方案。',
        'solver.alert.addOutput': '请至少添加一个输出形状。',
        'solver.alert.addOutputFirst': '请先至少添加一个输出形状。',
        'solver.alert.noOutputToExtract': '没有可提取的输出形状。',
        'solver.alert.failedToExtract': ({ shapeCode, message }) => `无法从“${shapeCode}”提取形状：${message}`,
        'solver.alert.impossible': ({ shortages }) =>
            `该方案不可能完成：输入中的不可再生部件不足以满足输出需求。\n\n缺少的部件：\n${shortages}`,
        'solver.shortageLine': ({ part, need, have }) => `${part}：需要 ${need}，当前 ${have}`,
        'explorer.status.exploring': '正在探索...',
        'explorer.status.complete': ({ shapeCount, opCount }) => `探索完成。形状：${shapeCount}，操作：${opCount}`,
        'explorer.status.noneReachable': '没有可达形状。',
        'explorer.popup.copy': '复制',
        'explorer.popup.goesTo': '可到达',
        'explorer.popup.comesFrom': '来源',
        'explorer.popup.noOutgoing': '没有后续操作',
        'explorer.popup.noIncoming': '没有前置操作',
        'explorer.popup.fromShape': ({ shapeCode }) => `来自 ${shapeCode}`,
        'explorer.popup.toShape': ({ shapeCode }) => `到 ${shapeCode}`,
        'graph.alert.copySuccess': '图表图片已复制到剪贴板！',
        'graph.alert.copyFailure': '复制图片到剪贴板失败。',
        'graph.alert.export3dFailure': '导出 3D 图表失败。',
        'graph.alert.noGraph': '当前没有可复制的图表。',
        'modal.extraction.title': '形状提取选项',
        'modal.extraction.description': '按指定属性将输出形状拆分成更小的组件，并自动填充输入形状。',
        'modal.extraction.uniqueBy': '按以下唯一属性提取：',
        'modal.extraction.layer': '层',
        'modal.extraction.shape': '形状',
        'modal.extraction.color': '颜色',
        'modal.extraction.shapeColor': '形状和颜色',
        'modal.extraction.part': '部件',
        'modal.extraction.includePins': '包含针脚？',
        'modal.extraction.includeCrystals': '包含晶体？',
        'modal.extraction.includeColor': '保留颜色？',
        'validation.context.shape': '形状',
        'validation.context.targetShape': '目标形状',
        'validation.context.startingShape': '起始形状',
        'validation.context.outputShape': '输出形状',
        'validation.mustBeString': '形状代码必须是字符串。',
        'validation.cannotBeEmpty': '形状代码不能为空。',
        'validation.mustContainLayer': '形状代码至少需要包含一层。',
        'validation.layerEmpty': ({ layerNumber }) => `第 ${layerNumber} 层为空。每一层都必须包含“形状-颜色”成对数据。`,
        'validation.layerEvenChars': ({ layerNumber }) => `第 ${layerNumber} 层必须包含偶数字符（每个形状都需要对应一个颜色）。`,
        'validation.invalidShape': ({ layerNumber, partNumber, shape }) => `第 ${layerNumber} 层，第 ${partNumber} 个部件：'${shape}' 不是有效的形状。`,
        'validation.invalidColor': ({ layerNumber, partNumber, color }) => `第 ${layerNumber} 层，第 ${partNumber} 个部件：'${color}' 不是有效的颜色。`,
        'validation.nothingHasNoColor': ({ layerNumber, partNumber }) =>
            `第 ${layerNumber} 层，第 ${partNumber} 个部件：“Nothing” 形状不能带颜色。`,
        'validation.pinHasNoColor': ({ layerNumber, partNumber }) =>
            `第 ${layerNumber} 层，第 ${partNumber} 个部件：“Pin” 形状不能带颜色。`,
        'validation.inconsistentParts': ({ layerNumber, actualParts, expectedParts }) =>
            `第 ${layerNumber} 层包含 ${actualParts} 个部件，但应为 ${expectedParts} 个。所有层的部件数量必须一致。`,
        'validation.invalidCode': ({ context, shapeCode, errors }) => `${context}代码无效：${shapeCode}\n\n错误：\n${errors}`,
    },
};

let currentLocale = normalizeLocale(getLocaleFromPath()) ?? getStoredLocale() ?? DEFAULT_LOCALE;

export function normalizeLocale(locale) {
    if (typeof locale !== 'string') return null;
    const normalized = locale.toLowerCase();
    return SUPPORTED_LOCALES.includes(normalized) ? normalized : null;
}

export function getLocaleFromPath(pathname = globalThis.location?.pathname ?? '/') {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    const last = segments.at(-1);
    if (normalizeLocale(last)) return last.toLowerCase();

    if (last === 'index.html') {
        const parent = segments.at(-2);
        return normalizeLocale(parent);
    }

    return null;
}

function getBasePathSegments(pathname = globalThis.location?.pathname ?? '/') {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.at(-1) === 'index.html') segments.pop();
    if (normalizeLocale(segments.at(-1))) segments.pop();
    return segments;
}

export function getLocalePath(locale, pathname = globalThis.location?.pathname ?? '/') {
    const normalized = normalizeLocale(locale) ?? DEFAULT_LOCALE;
    const segments = [...getBasePathSegments(pathname), normalized];
    return `/${segments.join('/')}/`;
}

export function getLocaleUrl(locale, locationLike = globalThis.location) {
    const path = getLocalePath(locale, locationLike?.pathname ?? '/');
    const search = locationLike?.search ?? '';
    const hash = locationLike?.hash ?? '';
    return `${path}${search}${hash}`;
}

export function getStoredLocale() {
    try {
        return normalizeLocale(globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY));
    } catch {
        return null;
    }
}

export function setStoredLocale(locale) {
    const normalized = normalizeLocale(locale) ?? DEFAULT_LOCALE;
    try {
        globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch {
        /* best-effort */
    }
}

export function getCurrentLocale() {
    return currentLocale;
}

export function setCurrentLocale(locale) {
    currentLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
    if (globalThis.document?.documentElement) {
        globalThis.document.documentElement.lang = currentLocale === 'cn' ? 'zh-CN' : 'en';
    }
    return currentLocale;
}

export function t(key, params = {}, locale = currentLocale) {
    const normalized = normalizeLocale(locale) ?? DEFAULT_LOCALE;
    const dict = TRANSLATIONS[normalized] ?? TRANSLATIONS.en;
    const fallback = TRANSLATIONS.en;
    const value = dict[key] ?? fallback[key] ?? key;

    if (typeof value === 'function') return value(params, normalized);
    if (typeof value === 'string') return formatTemplate(value, params);
    return String(value);
}

export function getColorDisplayName(colorToken, locale = currentLocale) {
    const normalized = String(colorToken ?? '').toLowerCase();
    const key = COLOR_LABEL_KEYS[normalized];
    return key ? t(key, {}, locale) : String(colorToken ?? '');
}

export function getOperationDisplayName(operationName, locale = currentLocale) {
    const key = OPERATION_LABEL_KEYS[operationName];
    return key ? t(key, {}, locale) : operationName;
}

export function getOperationLabel(operationName, params = {}, locale = currentLocale) {
    const name = getOperationDisplayName(operationName, locale);
    if (!params?.color) return name;
    return t('operations.labelWithColor', { name, color: getColorDisplayName(params.color, locale) }, locale);
}

export function applyTranslations(root = globalThis.document) {
    if (!root?.querySelectorAll) return;

    if ('title' in globalThis.document) {
        globalThis.document.title = t('page.title');
    }

    root.querySelectorAll('[data-i18n]').forEach((element) => {
        element.textContent = t(element.dataset.i18n);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
        element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
    });

    root.querySelectorAll('[data-i18n-title]').forEach((element) => {
        element.setAttribute('title', t(element.dataset.i18nTitle));
    });

    const languageSelect = root.querySelector('#lang-preference');
    if (languageSelect) languageSelect.value = getCurrentLocale();
}
