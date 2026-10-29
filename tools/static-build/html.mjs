import * as html from 'parse5';
export const parseHtml = (text, file = 'HTML') => {
  const errors = []; const doc = html.parse(text, { onParseError: e => errors.push(e.code) });
  if (errors.length) throw Error(`${file}: ${errors.join(', ')}`);
  return doc;
};
export const serialize = html.serialize;
export const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
export function setAttr(node, name, value) {
  const a = node.attrs.find(a => a.name === name);
  if (a) a.value = value; else node.attrs.push({ name, value });
}
export function elements(node) {
  return [node, ...(node.childNodes ?? []).flatMap(elements)].filter(n => n.tagName);
}
export function tag(name, attributes) {
  return { nodeName: name, tagName: name, attrs: Object.entries(attributes).map(([name, value]) => ({ name, value })), namespaceURI: 'http://www.w3.org/1999/xhtml', childNodes: [] };
}
export function prepend(parent, node) { node.parentNode = parent; parent.childNodes.unshift(node); }
export const textContent = node => (node.childNodes ?? []).map(n => n.value ?? textContent(n)).join('');
