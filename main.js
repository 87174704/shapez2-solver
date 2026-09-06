import { createShapeCanvas, createShapeElement } from './shapeRendering.js';
import { Shape, _extractLayers } from './shapeOperations.js';
import { getCyInstance, copyGraphToClipboard, applyGraphLayout, renderGraph, renderSpaceGraph, renderMixGraph } from './operationGraph.js';
import { showValidationErrors } from './shapeValidation.js';
import { readColorCounts } from './mixingSolver.js';
import { getCurrentColorMode, getMixColor } from './colorMode.js';
import { COLOR_MODES, NON_RENEWABLE_PARTS } from './shapeConstants.js';
import {
    DEFAULT_LOCALE,
    applyTranslations,
    getCurrentLocale,
    getLocaleFromPath,
    getLocaleUrl,
    normalizeLocale,
    setCurrentLocale,
    setStoredLocale,
    t,
} from './i18n.js';

const state = {
    targetShapeCodes: [],
    startingShapeCodes: ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'],
    solverWorker: null,
    explorerWorker: null,
    mixWorker: null,
    mixSolutions: [],
    mixFallbackHaveCounts: null,
    mixResultsRendered: false,
    selectedMixSolutionIndex: 0,
    lastGraph: null,
    statusMessage: { key: 'status.idle' },
    statusTone: 'idle',
};

const byId = (id) => document.getElementById(id);
const qs = (selector, root = document) => root?.querySelector(selector) ?? null;
const qsa = (selector, root = document) => Array.from(root?.querySelectorAll(selector) ?? []);
const readInt = (id, fallback) => Number.parseInt(byId(id)?.value, 10) || fallback;

const statusDescriptor = (key, params = {}) => ({ key, params });

function resolveMessage(message) {
    if (!message) return '';
    if (typeof message === 'string') return message;
    if (message.rawText) return message.rawText;
    if (message.key) return t(message.key, message.params ?? {});
    return '';
}

function renderStatus() {
    const dot = byId('status-dot');
    const label = byId('status-text');

    if (label) label.textContent = resolveMessage(state.statusMessage);
    if (dot) dot.className = `status-dot ${state.statusTone}`;
}

function setStatus(message, status = 'idle') {
    state.statusMessage = typeof message === 'string' ? { rawText: message } : message;
    state.statusTone = status;
    renderStatus();
}

function refreshActionButtons() {
    const solverButton = qs('#panel-solver .btn-primary');
    if (solverButton) solverButton.textContent = state.solverWorker ? t('actions.cancel') : t('actions.solve');

    const explorerButton = qs('#panel-explorer .btn-primary');
    if (explorerButton) explorerButton.textContent = state.explorerWorker ? t('actions.cancel') : t('actions.explore');

    const mixButton = byId('solve-mix');
    if (mixButton) mixButton.textContent = state.mixWorker ? t('actions.cancel') : t('actions.solve');
}

function renderShapeList(containerId, shapeCodes, onRemove) {
    const container = byId(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (shapeCodes.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'shape-empty';
        empty.textContent = t('shape.list.empty');
        container.appendChild(empty);
        return;
    }

    for (const [index, code] of shapeCodes.entries()) {
        const item = document.createElement('div');
        item.className = 'shape-item';
        item.dataset.shapeCode = code;

        const label = document.createElement('span');
        label.className = 'shape-code';
        label.textContent = code;

        const removeButton = document.createElement('button');
        removeButton.className = 'shape-remove';
        removeButton.title = t('common.remove');
        removeButton.textContent = 'x';
        removeButton.addEventListener('click', () => onRemove(index));

        item.append(createShapeElement(code), label, removeButton);
        container.appendChild(item);
    }
}

const refreshTargetList = () =>
    renderShapeList('target-shapes', state.targetShapeCodes, (index) => {
        state.targetShapeCodes.splice(index, 1);
        refreshTargetList();
    });

const refreshStartingList = () =>
    renderShapeList('starting-shapes', state.startingShapeCodes, (index) => {
        state.startingShapeCodes.splice(index, 1);
        refreshStartingList();
    });

function addShapeFromInput(listType) {
    const isTarget = listType === 'target';
    const input = byId(isTarget ? 'target-input' : 'starting-input');
    const code = input?.value.trim() ?? '';
    const context = isTarget ? t('validation.context.targetShape') : t('validation.context.startingShape');

    if (!code || !showValidationErrors(code, context)) return;

    if (isTarget) {
        state.targetShapeCodes.push(code);
        refreshTargetList();
    } else {
        state.startingShapeCodes.push(code);
        refreshStartingList();
    }

    if (input) {
        input.value = '';
        input.focus();
    }
}

function createSolverWorker() {
    return new Worker(new URL('./shapeSolver.js', import.meta.url), { type: 'module' });
}

function createMixWorker() {
    return new Worker(new URL('./mixingSolver.js', import.meta.url), { type: 'module' });
}

function stopWorker(worker) {
    if (!worker) return null;
    worker.postMessage({ action: 'cancel' });
    worker.terminate();
    return null;
}

function toStatusMessage(data) {
    if (data.messageKey) {
        return { key: data.messageKey, params: data.messageParams ?? {} };
    }

    if (data.message) {
        return { rawText: data.message };
    }

    return null;
}

function runWorker({ message, workerFactory = createSolverWorker, payload, onResult, onError }) {
    const worker = workerFactory();
    const startTime = performance.now();

    if (message) setStatus(message, 'running');

    worker.onmessage = ({ data }) => {
        if (data.type === 'status') {
            const statusMessage = toStatusMessage(data);
            if (statusMessage) setStatus(statusMessage, data.status ?? 'running');
            return;
        }

        if (data.type !== 'result') return;

        onResult(data.result, startTime);
        worker.terminate();
    };

    worker.onerror = ({ message: workerMessage }) => {
        setStatus(statusDescriptor('status.workerError', { message: workerMessage }), 'error');
        if (onError) onError();
        worker.terminate();
    };

    worker.postMessage(payload);
    return worker;
}

function collectStartingCodes() {
    return qsa('#starting-shapes .shape-item[data-shape-code]')
        .map((element) => element.dataset.shapeCode)
        .filter(Boolean);
}

function collectEnabledOperations() {
    return qsa('#enabled-operations .operation-item.enabled')
        .map((element) => element.dataset.operation)
        .filter(Boolean);
}

function readSolverOptions() {
    return {
        maxLayers: readInt('max-layers', 4),
        maxStatesPerLevel: readInt('max-states-per-level', 100000),
        preventWaste: byId('prevent-waste')?.checked ?? false,
        orientationSensitive: byId('orientation-sensitive')?.checked ?? false,
        allowSplitting: byId('allow-splitting')?.checked ?? false,
        cleanPainting: byId('clean-painting')?.checked ?? false,
    };
}

function validateSolveInputs(startingCodes) {
    if (!state.targetShapeCodes.length) {
        alert(t('solver.alert.addOutput'));
        return false;
    }

    for (const code of [...state.targetShapeCodes, ...startingCodes]) {
        if (!showValidationErrors(code, t('validation.context.shape'))) return false;
    }

    const nonRenewableSet = new Set(NON_RENEWABLE_PARTS);
    const countPartsByType = (shapeCodes) => {
        const counts = new Map();

        for (const code of shapeCodes) {
            for (const layer of code.split(':')) {
                for (let index = 0; index < layer.length; index += 2) {
                    const part = layer[index];
                    if (!nonRenewableSet.has(part)) continue;
                    counts.set(part, (counts.get(part) ?? 0) + 1);
                }
            }
        }

        return counts;
    };

    const inputPartCounts = countPartsByType(startingCodes);
    const outputPartCounts = countPartsByType(state.targetShapeCodes);
    const shortages = [];

    for (const part of NON_RENEWABLE_PARTS) {
        const inputCount = inputPartCounts.get(part) ?? 0;
        const outputCount = outputPartCounts.get(part) ?? 0;
        if (inputCount < outputCount) {
            shortages.push(t('solver.shortageLine', {
                part,
                need: outputCount,
                have: inputCount,
            }));
        }
    }

    if (shortages.length) {
        alert(t('solver.alert.impossible', { shortages: shortages.join('\n') }));
        return false;
    }

    return true;
}

function rememberGraph(type, data) {
    state.lastGraph = { type, data };
}

function rerenderCurrentGraph() {
    if (!state.lastGraph) return;

    if (state.lastGraph.type === 'solver') {
        renderGraph(state.lastGraph.data);
        byId('placeholder')?.style.setProperty('display', 'none');
        return;
    }

    if (state.lastGraph.type === 'explorer') {
        renderSpaceGraph(state.lastGraph.data);
        byId('placeholder')?.style.setProperty('display', 'none');
        return;
    }

    if (state.lastGraph.type === 'mix') {
        renderSelectedMixSolution();
    }
}

function setupSolverPanel() {
    const button = qs('#panel-solver .btn-primary');
    if (!button) return;

    button.addEventListener('click', () => {
        if (state.solverWorker) {
            state.solverWorker = stopWorker(state.solverWorker);
            refreshActionButtons();
            setStatus(statusDescriptor('status.cancelled'), 'idle');
            return;
        }

        const startingCodes = collectStartingCodes();
        if (!validateSolveInputs(startingCodes)) return;

        state.solverWorker = runWorker({
            message: statusDescriptor('solver.status.solving'),
            payload: {
                action: 'solve',
                data: {
                    targetShapeCodes: [...state.targetShapeCodes],
                    startingShapeCodes: startingCodes,
                    enabledOperations: collectEnabledOperations(),
                    ...readSolverOptions(),
                },
            },
            onResult(result, startTime) {
                state.solverWorker = null;
                refreshActionButtons();

                if (result?.solutionPath) {
                    rememberGraph('solver', result.solutionPath);
                    renderGraph(result.solutionPath);
                    byId('placeholder')?.style.setProperty('display', 'none');

                    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
                    setStatus(statusDescriptor('solver.status.solved', {
                        elapsed,
                        depth: result.depth,
                        statesExplored: result.statesExplored,
                    }), 'done');
                } else if (result?.limitReached) {
                    const message = getCurrentLocale() === 'cn'
                        ? '搜索状态过多，已停止以避免页面崩溃。建议把 Max States Per Level 调到 1000-2000，或关闭不需要的操作。'
                        : 'Search stopped before the tab ran out of memory. Try lowering Max States Per Level to 1000-2000 or disabling unneeded operations.';
                    setStatus({ rawText: message }, 'error');
                } else {
                    setStatus(statusDescriptor('solver.status.noSolution'), 'error');
                }
            },
            onError() {
                state.solverWorker = null;
                refreshActionButtons();
            },
        });

        refreshActionButtons();
    });
}

function setupExplorerPanel() {
    const button = qs('#panel-explorer .btn-primary');
    if (!button) return;

    button.addEventListener('click', () => {
        if (state.explorerWorker) {
            state.explorerWorker = stopWorker(state.explorerWorker);
            refreshActionButtons();
            setStatus(statusDescriptor('status.cancelled'), 'idle');
            return;
        }

        const startingCodes = collectStartingCodes();
        for (const code of startingCodes) {
            if (!showValidationErrors(code, t('validation.context.startingShape'))) return;
        }

        state.explorerWorker = runWorker({
            message: statusDescriptor('explorer.status.exploring'),
            payload: {
                action: 'explore',
                data: {
                    startingShapeCodes: startingCodes,
                    enabledOperations: collectEnabledOperations(),
                    depthLimit: readInt('depth-limit-input', 999),
                    maxLayers: readInt('max-layers', 4),
                },
            },
            onResult(result) {
                state.explorerWorker = null;
                refreshActionButtons();

                if (result) {
                    rememberGraph('explorer', result);
                    renderSpaceGraph(result);
                    byId('placeholder')?.style.setProperty('display', 'none');
                    setStatus(statusDescriptor('explorer.status.complete', {
                        shapeCount: result.shapes?.length ?? 0,
                        opCount: result.ops?.length ?? 0,
                    }), 'done');
                } else {
                    setStatus(statusDescriptor('explorer.status.noneReachable'), 'idle');
                }
            },
            onError() {
                state.explorerWorker = null;
                refreshActionButtons();
            },
        });

        refreshActionButtons();
    });
}

function setupExtractModal() {
    const modal = byId('extract-modal');
    const close = () => {
        if (modal) modal.style.display = 'none';
    };

    byId('extract-shapes-btn')?.addEventListener('click', () => {
        if (!state.targetShapeCodes.length) {
            alert(t('solver.alert.addOutputFirst'));
            return;
        }
        if (modal) modal.style.display = 'flex';
    });

    byId('extract-cancel')?.addEventListener('click', close);
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });

    byId('extract-confirm')?.addEventListener('click', () => {
        close();

        if (!state.targetShapeCodes.length) {
            alert(t('solver.alert.noOutputToExtract'));
            return;
        }

        const mode = qs('input[name="extract-mode"]:checked')?.value ?? 'color';
        const includePins = byId('include-pins')?.checked ?? false;
        const includeCrystals = byId('include-crystals')?.checked ?? false;
        const includeColor = byId('include-color')?.checked ?? false;
        const extracted = [];

        for (const code of state.targetShapeCodes) {
            if (!showValidationErrors(code, t('validation.context.targetShape'))) return;

            try {
                _extractLayers(Shape.fromShapeCode(code), mode, includePins, includeColor, includeCrystals)
                    .forEach((shapeCode) => extracted.push(shapeCode));
            } catch (error) {
                alert(t('solver.alert.failedToExtract', {
                    shapeCode: code,
                    message: error.message,
                }));
                return;
            }
        }

        state.startingShapeCodes.length = 0;
        state.startingShapeCodes.push(...extracted);
        refreshStartingList();
    });
}

function renderSelectedMixSolution() {
    if (!state.mixSolutions.length) return;

    const index = Math.max(0, Math.min(state.selectedMixSolutionIndex, state.mixSolutions.length - 1));
    const steps = state.mixSolutions[index];
    const have = steps.have ?? state.mixFallbackHaveCounts;

    rememberGraph('mix', { selectedIndex: index });
    renderMixGraph(steps, have, { compactMixGraph: byId('mix-compact-graph')?.checked ?? true });
    byId('placeholder')?.style.setProperty('display', 'none');
}

function renderMixSolutionsList(solutions, fallbackHave, options = {}) {
    const { preserveSelection = false, renderGraphOnComplete = true } = options;
    const container = byId('mix-solutions');
    if (!container) return;

    const nextSolutions = solutions ?? [];
    const previousSelection = state.selectedMixSolutionIndex;

    state.mixSolutions = nextSolutions;
    state.mixFallbackHaveCounts = fallbackHave ?? null;
    state.mixResultsRendered = true;
    state.selectedMixSolutionIndex = preserveSelection
        ? Math.max(0, Math.min(previousSelection, Math.max(0, nextSolutions.length - 1)))
        : 0;

    container.innerHTML = '';

    if (!nextSolutions.length) {
        const empty = document.createElement('div');
        empty.className = 'mix-solutions-empty';
        empty.textContent = t('mix.list.empty');
        container.appendChild(empty);
        return;
    }

    const header = document.createElement('div');
    header.className = 'subsection-label';
    header.append(document.createTextNode(t('mix.list.header')));

    const count = document.createElement('span');
    count.className = 'mix-solutions-count';
    count.textContent = String(nextSolutions.length);
    header.appendChild(count);
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'mix-solutions-list scroll-thin';
    container.appendChild(list);

    const showUsage = !(byId('mix-manual-inputs')?.checked ?? false);
    const usageKeys = [
        { key: 'R', cls: 'is-red' },
        { key: 'G', cls: 'is-green' },
        { key: 'B', cls: 'is-blue' },
    ];

    nextSolutions.forEach((steps, index) => {
        const button = document.createElement('button');
        button.className = 'mix-solution-item';

        const indexLabel = Object.assign(document.createElement('span'), {
            className: 'mix-sol-idx',
            textContent: `#${index + 1}`,
        });

        const stepLabel = Object.assign(document.createElement('span'), {
            className: 'mix-sol-steps',
            textContent: t('mix.list.stepCount', { count: steps.length }),
        });

        button.append(indexLabel, stepLabel);

        if (showUsage) {
            const have = steps.have ?? fallbackHave;
            const wrap = document.createElement('span');
            wrap.className = 'mix-sol-usage';

            usageKeys.forEach(({ key, cls }) => {
                const item = Object.assign(document.createElement('span'), {
                    className: `mix-sol-usage-item ${cls}`,
                });
                const swatch = Object.assign(document.createElement('span'), {
                    className: `mix-sol-usage-swatch ${cls}`,
                });
                const amount = Object.assign(document.createElement('span'), {
                    className: `mix-sol-usage-amount ${cls}`,
                    textContent: String(have?.[key] ?? 0),
                });
                item.append(swatch, amount);
                wrap.appendChild(item);
            });

            button.appendChild(wrap);
        }

        button.addEventListener('click', () => {
            state.selectedMixSolutionIndex = index;
            renderSelectedMixSolution();
        });

        list.appendChild(button);
    });

    if (renderGraphOnComplete) renderSelectedMixSolution();
}

function setMixManualMode(enabled) {
    qsa('.mix-input.mix-have').forEach((element) => {
        element.style.display = enabled ? '' : 'none';
    });

    const headers = qs('.mix-col-headers');
    if (headers) headers.style.display = enabled ? '' : 'none';

    qsa('.mix-color-row, .mix-col-headers').forEach((element) => {
        element.style.gridTemplateColumns = enabled ? '1fr 56px 56px' : '1fr 56px';
    });
}

function setupMixingPanel() {
    byId('reset-mix-btn')?.addEventListener('click', () => {
        qsa('.mix-input').forEach((element) => {
            element.value = 0;
        });

        state.mixSolutions = [];
        state.mixFallbackHaveCounts = null;
        state.selectedMixSolutionIndex = 0;
        state.mixResultsRendered = false;

        const container = byId('mix-solutions');
        if (container) container.innerHTML = '';
    });

    byId('mix-manual-inputs')?.addEventListener('change', (event) => {
        setMixManualMode(event.target.checked);
    });
    byId('mix-compact-graph')?.addEventListener('change', renderSelectedMixSolution);

    const button = byId('solve-mix');
    button?.addEventListener('click', () => {
        if (state.mixWorker) {
            state.mixWorker = stopWorker(state.mixWorker);
            refreshActionButtons();
            setStatus(statusDescriptor('status.cancelled'), 'idle');
            return;
        }

        const isManual = byId('mix-manual-inputs')?.checked ?? false;
        const have = isManual ? readColorCounts('mix-have') : null;
        const want = readColorCounts('mix-want');

        state.mixWorker = runWorker({
            message: statusDescriptor(isManual ? 'mix.status.solving' : 'mix.status.optimizing'),
            workerFactory: createMixWorker,
            payload: { action: 'solve', data: { have, want, manualInputs: isManual } },
            onResult(result) {
                state.mixWorker = null;
                refreshActionButtons();

                if (result?.errorKey) {
                    alert(t(result.errorKey, result.errorParams ?? {}));
                    return;
                }

                if (result?.solutions) {
                    renderMixSolutionsList(result.solutions, result.have);
                    return;
                }

                setStatus(statusDescriptor('solver.status.noSolution'), 'error');
            },
            onError() {
                state.mixWorker = null;
                refreshActionButtons();
            },
        });

        refreshActionButtons();
    });

    setMixManualMode(false);
}

function refreshShapeColors() {
    const cy = getCyInstance();
    const colorMode = getCurrentColorMode();

    if (cy) {
        cy.nodes('.shape').forEach((node) => {
            try {
                node.data('shapeCanvas', createShapeCanvas(node.data('label'), 120).toDataURL());
                node.trigger('style');
            } catch {
                /* best-effort */
            }
        });

        cy.nodes('.colored-op').forEach((node) => {
            const token = node.data('colorToken');
            const color = token ? COLOR_MODES?.[colorMode]?.[token] : null;
            if (color) node.style({ 'background-color': color });
        });

        cy.nodes('[colorKey]').forEach((node) => {
            node.style('background-color', getMixColor(node.data('colorKey')));
        });

        cy.edges('[edgeColorKey]').forEach((edge) => {
            edge.style('line-color', getMixColor(edge.data('edgeColorKey')));
        });
    }

    qsa('.shape-canvas').forEach((canvas) => {
        const code = canvas.dataset.shapeCode;
        if (!code) return;

        try {
            const fresh = createShapeCanvas(code, 40);
            Object.assign(fresh, { className: 'shape-canvas' });
            fresh.dataset.shapeCode = code;
            canvas.replaceWith(fresh);
        } catch {
            /* best-effort */
        }
    });
}

function setSidebarCollapsed(collapsed) {
    const sidebar = qs('.sidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed', collapsed);

    const polyline = byId('sidebar-toggle')?.querySelector('svg polyline');
    polyline?.setAttribute('points', collapsed ? '9 18 15 12 9 6' : '15 18 9 12 15 6');

    const floatButton = byId('sidebar-toggle-float');
    if (floatButton) floatButton.style.display = collapsed ? 'flex' : 'none';
}

function setupSidebar() {
    byId('sidebar-toggle')?.addEventListener('click', () => setSidebarCollapsed(true));
    byId('sidebar-toggle-float')?.addEventListener('click', () => setSidebarCollapsed(false));
}

function setupTabGroup(tabSelector, panelSelector) {
    qsa(tabSelector).forEach((tab) => {
        tab.addEventListener('click', () => {
            const name = tab.dataset.panel ?? tab.dataset.mode;
            if (!name) return;

            qsa(tabSelector).forEach((currentTab) => currentTab.classList.remove('active'));
            qsa(panelSelector).forEach((panel) => panel.classList.remove('active'));

            tab.classList.add('active');
            byId(`panel-${name}`)?.classList.add('active');
        });
    });
}

function setupCollapsibleSections() {
    qsa('.section-header').forEach((header) => {
        header.addEventListener('click', () => {
            const body = header.nextElementSibling;
            const isOpen = body?.classList.toggle('open');
            header.classList.toggle('open', isOpen);
        });
    });
}

function switchLanguage(locale, { updateHistory = true } = {}) {
    const normalized = normalizeLocale(locale) ?? DEFAULT_LOCALE;
    const hasLocaleInPath = Boolean(getLocaleFromPath());

    setCurrentLocale(normalized);
    setStoredLocale(normalized);

    if (updateHistory || !hasLocaleInPath) {
        const nextUrl = getLocaleUrl(normalized);
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (nextUrl !== currentUrl) {
            window.history.replaceState({ locale: normalized }, '', nextUrl);
        }
    }

    applyTranslations();
    refreshActionButtons();
    refreshTargetList();
    refreshStartingList();
    renderStatus();

    if (state.mixResultsRendered) {
        renderMixSolutionsList(state.mixSolutions, state.mixFallbackHaveCounts, {
            preserveSelection: true,
            renderGraphOnComplete: state.lastGraph?.type === 'mix',
        });
    }

    if (state.lastGraph?.type && state.lastGraph.type !== 'mix') {
        rerenderCurrentGraph();
    }
}

function setupLanguagePreference() {
    const initialLocale = getLocaleFromPath() ?? getCurrentLocale() ?? DEFAULT_LOCALE;
    switchLanguage(initialLocale, { updateHistory: !getLocaleFromPath() });

    byId('lang-preference')?.addEventListener('change', (event) => {
        switchLanguage(event.target.value);
    });

    window.addEventListener('popstate', () => {
        const locale = getLocaleFromPath() ?? getCurrentLocale() ?? DEFAULT_LOCALE;
        switchLanguage(locale, { updateHistory: !getLocaleFromPath() });
    });
}

function initializeUi() {
    setupLanguagePreference();

    byId('add-target-shape-btn')?.addEventListener('click', () => addShapeFromInput('target'));
    byId('add-starting-shape-btn')?.addEventListener('click', () => addShapeFromInput('starting'));
    byId('target-input')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') addShapeFromInput('target');
    });
    byId('starting-input')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') addShapeFromInput('starting');
    });

    setupSidebar();
    setupCollapsibleSections();
    setupTabGroup('.sidebar-tab', '.sidebar-panel');
    setupTabGroup('.mode-tab', '.mode-panel');

    qsa('.operation-item').forEach((item) => {
        item.addEventListener('click', () => item.classList.toggle('enabled'));
    });

    setupExtractModal();
    setupSolverPanel();
    setupExplorerPanel();
    setupMixingPanel();

    byId('direction-select')?.addEventListener('change', (event) => applyGraphLayout(event.target.value));
    byId('color-mode-select')?.addEventListener('change', refreshShapeColors);
    qs('.snapshot-btn')?.addEventListener('click', copyGraphToClipboard);

    refreshActionButtons();
    setStatus(statusDescriptor('status.idle'), 'idle');
}

document.addEventListener('DOMContentLoaded', initializeUi);
