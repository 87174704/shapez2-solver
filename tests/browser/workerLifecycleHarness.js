import { startWorkerTask } from '../../workerLifecycle.js';
import { replaySolution } from '../helpers/shapeSolverOracle.mjs';
import { replay as independentReplay } from '../../tools/release1/replay.mjs';

const workerUrl = new URL('../../shapeSolver.js', import.meta.url);
const busyWorkerUrl = new URL('./busyLifecycleWorker.js', import.meta.url);
const resultElement = document.getElementById('result');
const checks = [];

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function runWorker(payload) {
    return new Promise((resolve) => {
        startWorkerTask({
            workerFactory: () => new Worker(workerUrl, { type: 'module' }),
            payload,
            onResult(result) {
                resolve({ type: 'result', result });
            },
            onError(error) {
                resolve({ type: 'error', error });
            },
        });
    });
}

const tinySolve = {
    action: 'solve',
    data: {
        targetShapeCodes: ['CuCuCuCu'],
        startingShapeCodes: ['CuCuCuCu'],
        enabledOperations: [],
        maxLayers: 4,
        maxStatesPerLevel: 10,
        preventWaste: false,
        orientationSensitive: true,
        allowSplitting: false,
        cleanPainting: false,
    },
};

const tinyExplore = {
    action: 'explore',
    data: {
        startingShapeCodes: ['CuCuCuCu'],
        enabledOperations: [],
        depthLimit: 1,
        maxLayers: 4,
    },
};

const constructiveSolve = {
    action: 'solve',
    data: {
        targetShapeCodes: ['RrcrRrRr:RgcrRgRg:--cr----'],
        startingShapeCodes: Array(4).fill('RuRuRuRu'),
        enabledOperations: [
            'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
            'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
        ],
        maxLayers: 4,
        maxStatesPerLevel: 3000,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: true,
    },
};

async function verifyCancellation(name, action, restartPayload) {
    const events = [];
    await new Promise((resolve, reject) => {
        let task;
        task = startWorkerTask({
            workerFactory: () => new Worker(busyWorkerUrl, { type: 'module' }),
            payload: { action },
            onStatus(data) {
                events.push(`status:${data.phase}`);
                if (data.phase !== 'started') return;
                if (!task.cancel()) {
                    reject(new Error(`${name} did not cancel an active Worker`));
                    return;
                }
                runWorker(restartPayload).then(async restarted => {
                    await new Promise(finishDelay => setTimeout(finishDelay, 50));
                    if (restarted.type !== 'result') {
                        reject(new Error(`${name} could not restart after cancellation`));
                        return;
                    }
                    resolve();
                }, reject);
            },
            onResult: () => events.push('result'),
            onError: () => events.push('error'),
        });
    });

    assert(!events.includes('result'), `${name} delivered a stale result`);
    assert(!events.includes('error'), `${name} delivered a stale error`);
    assert(events.join(',') === 'status:started', `${name} delivered a stale status`);
    checks.push(name);
}

async function main() {
    const solve = await runWorker(tinySolve);
    assert(
        solve.type === 'result' && solve.result?.outcome === 'solved',
        `tiny solve did not complete: ${JSON.stringify(solve)}`,
    );
    checks.push('solve-result');

    const constructive = await runWorker(constructiveSolve);
    assert(
        constructive.type === 'result'
            && constructive.result?.outcome === 'solved'
            && constructive.result?.solverRoute === 'constructive-hybrid'
            && constructive.result?.interiorCrystalStage === 'full-height-column-extraction'
            && Array.isArray(constructive.result?.solutionPath),
        `constructive solve did not complete in the module Worker: ${JSON.stringify(constructive)}`,
    );
    checks.push('constructive-solve-result');

    for (const orientationSensitive of [false, true]) {
        for (const source of ['Cb------', 'Cu------']) {
            const data = { ...constructiveSolve.data, targetShapeCodes: ['Cr------'],
                startingShapeCodes: [source], enabledOperations: ['Painter'], maxStatesPerLevel: 100,
                orientationSensitive };
            const response = await runWorker({ action: 'solve', data });
            assert(response.type === 'result', 'clean paint Worker returned an error');
            const result = response.result;
            if (source === 'Cb------') {
                assert(result.outcome === 'exhausted' && result.solutionPath === null,
                    'Worker accepted illegal recoloring');
            } else {
                assert(result.outcome === 'solved' && replaySolution(data, result.solutionPath, result).valid
                    && independentReplay(data, result.solutionPath).valid, 'Worker clean painting failed dual replay');
            }
        }
    }
    checks.push('constructive-clean-painting-controls');

    const recoveryData = { ...tinySolve.data, targetShapeCodes: ['WuCuRuSu'],
        startingShapeCodes: ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'],
        enabledOperations: ['Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter', 'Stacker'],
        maxStatesPerLevel: 100 };
    const recovery = await runWorker({ action: 'solve', data: recoveryData });
    assert(recovery.type === 'result' && recovery.result.outcome === 'solved'
        && recovery.result.solverRoute === 'strict-ordinary-constructive'
        && recovery.result.generalSearchAttempt?.outcome === 'not-found-pruned'
        && recovery.result.strictConstructiveAttempt.accepted
        && replaySolution(recoveryData, recovery.result.solutionPath, recovery.result).valid
        && independentReplay(recoveryData, recovery.result.solutionPath).valid,
        'unrestricted ordinary recovery failed in the module Worker');
    checks.push('strict-pruned-recovery');

    const explore = await runWorker(tinyExplore);
    assert(
        explore.type === 'result'
            && explore.result?.outcome === 'complete'
            && explore.result?.shapes?.length === 1,
        'tiny explore did not complete',
    );
    checks.push('explore-result');

    const mixedPartExplore = await runWorker({
        action: 'explore',
        data: {
            startingShapeCodes: ['CuCuCuCu', 'HuHuHuHuHuHu', 'RuRuRuRu'],
            enabledOperations: ['Swapper'],
            depthLimit: 1,
            maxLayers: 4,
        },
    });
    assert(
        mixedPartExplore.type === 'result'
            && mixedPartExplore.result?.outcome === 'complete'
            && mixedPartExplore.result?.invalidAttempts > 0,
        'mixed-part invalid Explorer calls were not isolated',
    );
    checks.push('explore-mixed-part-isolation');

    const limitedExplore = await runWorker({
        action: 'explore',
        data: {
            startingShapeCodes: ['Cu------'],
            enabledOperations: ['Painter', 'Stacker'],
            depthLimit: 999,
            maxLayers: 4,
        },
    });
    assert(
        limitedExplore.type === 'result'
            && limitedExplore.result?.outcome === 'limit'
            && limitedExplore.result?.limitReason === 'shapes'
            && limitedExplore.result?.complete === false
            && limitedExplore.result?.shapes?.length === 128,
        'bounded Explorer did not return a classified partial graph',
    );
    checks.push('explore-partial-limit');

    await verifyCancellation('solve-cancel-restart', 'solve', tinySolve);
    await verifyCancellation('explore-cancel-restart', 'explore', tinyExplore);

    const solveError = await runWorker({ action: 'solve', data: {} });
    assert(solveError.type === 'error', 'malformed solve did not return a terminal error');
    assert((await runWorker(tinySolve)).type === 'result', 'solve did not restart after an error');
    checks.push('solve-error-restart');

    const exploreError = await runWorker({
        action: 'explore',
        data: {
            startingShapeCodes: ['CuCuCuCu'],
            enabledOperations: [],
            depthLimit: -1,
            maxLayers: 4,
        },
    });
    assert(exploreError.type === 'error', 'malformed Explorer depth did not return a terminal error');
    assert((await runWorker(tinyExplore)).type === 'result', 'explore did not restart after an error');
    checks.push('explore-error-restart');

    resultElement.dataset.status = 'passed';
    resultElement.textContent = JSON.stringify({ checks });
}

main().catch(error => {
    resultElement.dataset.status = 'failed';
    resultElement.textContent = error?.stack ?? String(error);
});
