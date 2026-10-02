import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { readJson } from './benchmark-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function createBenchmarkSchemaValidator() {
    const schemaPaths = [
        'benchmarks/schema/input-catalog.v2.schema.json',
        'benchmarks/schema/benchmark-instance.v2.schema.json',
        'benchmarks/schema/benchmark-artifact.v2.schema.json',
        'benchmarks/schema/benchmark-instance.v3.schema.json',
        'benchmarks/schema/benchmark-artifact.v3.schema.json',
        'benchmarks/schema/release-manifest.v1.schema.json',
        'benchmarks/schema/release-manifest.v2.schema.json',
        'benchmarks/schema/official-policy.v1.schema.json',
    ];
    const schemas = await Promise.all(schemaPaths.map(relativePath => readJson(path.join(ROOT, relativePath))));
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, formats: { 'date-time': true } });
    for (const schema of schemas) ajv.addSchema(schema);
    return {
        validateCatalog: ajv.getSchema('https://shapez2-solver.local/schema/input-catalog.v2.schema.json'),
        validateInstance: ajv.getSchema('https://shapez2-solver.local/schema/benchmark-instance.v2.schema.json'),
        validateArtifact: ajv.getSchema('https://shapez2-solver.local/schema/benchmark-artifact.v2.schema.json'),
        instanceValidator(version) {
            return ajv.getSchema(`https://shapez2-solver.local/schema/benchmark-instance.v${version}.schema.json`);
        },
        artifactValidator(version) {
            return ajv.getSchema(`https://shapez2-solver.local/schema/benchmark-artifact.v${version}.schema.json`);
        },
        releaseValidator(version) {
            return ajv.getSchema(`https://shapez2-solver.local/schema/release-manifest.v${version}.schema.json`);
        },
        validatePolicy: ajv.getSchema('https://shapez2-solver.local/schema/official-policy.v1.schema.json'),
        formatErrors(validate) {
            return (validate.errors ?? []).map(error => `${error.instancePath || '/'} ${error.message}`);
        },
    };
}
