/* Restricted Bytebeat evaluator - no eval, no Function constructor for user code */
'use strict';

self.onmessage = function (e) {
  const { expr, sampleRate, duration } = e.data;
  try {
    const samples = evaluate(expr, sampleRate, duration);
    self.postMessage({ samples: samples });
  } catch (err) {
    self.postMessage({ error: err.message || String(err) });
  }
};

function evaluate(expr, sampleRate, durationSec) {
  const tokens = tokenize(expr);
  const ast = parse(tokens);
  const numSamples = Math.floor(sampleRate * durationSec);
  if (numSamples > 48000 * 30) throw new Error('Too many samples');
  const out = new Uint8Array(numSamples);
  for (let t = 0; t < numSamples; t++) {
    let v = evalNode(ast, t);
    v = v | 0; // force int
    out[t] = (v & 255);
  }
  return out;
}

function tokenize(src) {
  const tokens = [];
  let i = 0;
  src = src.replace(/\s+/g, '');
  while (i < src.length) {
    const c = src[i];
    if (/[0-9]/.test(c)) {
      let num = '';
      while (i < src.length && /[0-9]/.test(src[i])) num += src[i++];
      tokens.push({ type: 'num', value: parseInt(num, 10) });
      continue;
    }
    if (c === 't') {
      tokens.push({ type: 't' });
      i++;
      continue;
    }
    if ('+-*/%&|^~()<>'.includes(c)) {
      // multi-char operators
      if (c === '>' && src[i + 1] === '>') {
        tokens.push({ type: 'op', value: '>>' });
        i += 2;
        continue;
      }
      if (c === '<' && src[i + 1] === '<') {
        tokens.push({ type: 'op', value: '<<' });
        i += 2;
        continue;
      }
      tokens.push({ type: 'op', value: c });
      i++;
      continue;
    }
    throw new Error('Unexpected character: ' + c);
  }
  return tokens;
}

function parse(tokens) {
  let pos = 0;
  function peek() { return tokens[pos]; }
  function next() { return tokens[pos++]; }
  function parseExpr() {
    return parseBitwiseOr();
  }
  function parseBitwiseOr() {
    let left = parseBitwiseXor();
    while (peek() && peek().type === 'op' && peek().value === '|') {
      next();
      left = { type: 'bin', op: '|', left, right: parseBitwiseXor() };
    }
    return left;
  }
  function parseBitwiseXor() {
    let left = parseBitwiseAnd();
    while (peek() && peek().type === 'op' && peek().value === '^') {
      next();
      left = { type: 'bin', op: '^', left, right: parseBitwiseAnd() };
    }
    return left;
  }
  function parseBitwiseAnd() {
    let left = parseShift();
    while (peek() && peek().type === 'op' && peek().value === '&') {
      next();
      left = { type: 'bin', op: '&', left, right: parseShift() };
    }
    return left;
  }
  function parseShift() {
    let left = parseAdd();
    while (peek() && peek().type === 'op' && (peek().value === '>>' || peek().value === '<<')) {
      const op = next().value;
      left = { type: 'bin', op, left, right: parseAdd() };
    }
    return left;
  }
  function parseAdd() {
    let left = parseMul();
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = next().value;
      left = { type: 'bin', op, left, right: parseMul() };
    }
    return left;
  }
  function parseMul() {
    let left = parseUnary();
    while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
      const op = next().value;
      left = { type: 'bin', op, left, right: parseUnary() };
    }
    return left;
  }
  function parseUnary() {
    if (peek() && peek().type === 'op' && (peek().value === '-' || peek().value === '~' || peek().value === '+')) {
      const op = next().value;
      return { type: 'unary', op, arg: parseUnary() };
    }
    return parsePrimary();
  }
  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end');
    if (tok.type === 'num') {
      next();
      return { type: 'num', value: tok.value };
    }
    if (tok.type === 't') {
      next();
      return { type: 't' };
    }
    if (tok.type === 'op' && tok.value === '(') {
      next();
      const node = parseExpr();
      if (!peek() || peek().value !== ')') throw new Error('Missing )');
      next();
      return node;
    }
    throw new Error('Unexpected token: ' + (tok.value || tok.type));
  }
  const ast = parseExpr();
  if (pos < tokens.length) throw new Error('Trailing tokens');
  return ast;
}

function evalNode(node, t) {
  if (!node) return 0;
  switch (node.type) {
    case 'num': return node.value | 0;
    case 't': return t | 0;
    case 'unary':
      const a = evalNode(node.arg, t) | 0;
      if (node.op === '-') return -a | 0;
      if (node.op === '~') return ~a | 0;
      if (node.op === '+') return a | 0;
      throw new Error('Unknown unary: ' + node.op);
    case 'bin':
      const l = evalNode(node.left, t) | 0;
      const r = evalNode(node.right, t) | 0;
      switch (node.op) {
        case '+': return (l + r) | 0;
        case '-': return (l - r) | 0;
        case '*': return (l * r) | 0;
        case '/': return r === 0 ? 0 : (l / r) | 0;
        case '%': return r === 0 ? 0 : (l % r) | 0;
        case '&': return (l & r) | 0;
        case '|': return (l | r) | 0;
        case '^': return (l ^ r) | 0;
        case '>>': return (l >> (r & 31)) | 0;
        case '<<': return (l << (r & 31)) | 0;
        default: throw new Error('Unknown op: ' + node.op);
      }
    default:
      throw new Error('Unknown node');
  }
}
