// Production application inventory for the current maintenance site.
// The release ships only what the real HTML entry can reach: ES module imports,
// literal dynamic imports, Worker/URL construction, and local HTML references.
// Images stay a complete licensed set because operation icons are resolved from
// operation names at runtime; excluding one by static text alone is unsafe.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseHtml, elements, attr } from './html.mjs';

const require = createRequire(import.meta.url);
const { parse } = require('acorn');

const MODULE = /^(?:[^/]+\.js|(?:constructive|locales)\/[^/]+\.js)$/;

const clean = spec => spec.split('#')[0].split('?')[0];
const remote = spec => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(spec);
const resolve = (from, spec) => {
  if (!spec || remote(spec)) return null;
  if (spec.startsWith('/')) return path.posix.normalize(clean(spec).slice(1));
  return path.posix.normalize(path.posix.join(path.posix.dirname(from), clean(spec)));
};

function htmlReferences(source) {
  const references = [];
  for (const node of elements(parseHtml(source, 'index.html'))) {
    for (const name of node.tagName === 'script' ? ['src'] : ['src', 'href']) {
      const value = attr(node, name);
      if (value) references.push(resolve('index.html', value));
    }
  }
  return [...new Set(references.filter(Boolean))];
}

function moduleReferences(source, file) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const references = [];
  const add = value => { const resolved = resolve(file, value); if (resolved) references.push(resolved); };
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) add(node.source.value);
    if (node.type === 'ImportExpression') {
      if (node.source.type !== 'Literal') throw Error(`${file}: dynamic import must be statically auditable`);
      add(node.source.value);
    }
    if (node.type === 'NewExpression' && ['URL', 'Worker'].includes(node.callee?.name) && node.arguments[0]?.type === 'Literal') add(node.arguments[0].value);
    if (node.type === 'CallExpression' && node.callee?.name === 'Worker' && node.arguments[0]?.type === 'Literal') add(node.arguments[0].value);
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  };
  visit(ast);
  return references;
}

export async function applicationClosure({ root, files, entry = 'index.html' }) {
  const tracked = new Set(files), reachable = new Set();
  const queue = htmlReferences(await fs.readFile(path.join(root, entry), 'utf8')).filter(f => MODULE.test(f));
  while (queue.length) {
    const file = queue.shift();
    if (reachable.has(file)) continue;
    if (!tracked.has(file)) throw Error(`Application entry references missing module: ${file}`);
    reachable.add(file);
    for (const dependency of moduleReferences(await fs.readFile(path.join(root, file), 'utf8'), file)) {
      if (!MODULE.test(dependency)) throw Error(`${file} references a non-application file: ${dependency}`);
      if (!tracked.has(dependency)) throw Error(`${file} references missing module: ${dependency}`);
      if (!reachable.has(dependency)) queue.push(dependency);
    }
  }
  return [...reachable, ...files.filter(f => f.startsWith('images/'))].sort();
}
