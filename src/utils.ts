export function parseDuration(input: string): number | null {
  const match = /^(\d+)(s|m|h|d)$/i.exec(input);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase() as 's' | 'm' | 'h' | 'd';
  const milliseconds = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  const duration = amount * milliseconds;
  return Number.isSafeInteger(duration) && duration > 0 ? duration : null;
}

export function calculate(expression: string): number {
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/%]/g);
  if (!tokens || tokens.join('') !== expression.replace(/\s+/g, '')) throw new Error('Use numbers and + - * / % with parentheses.');
  let position = 0;
  const primary = (): number => {
    const token = tokens[position++];
    if (token === '+' || token === '-') { const value = primary(); return token === '-' ? -value : value; }
    if (token === '(') {
      const value = expressionValue();
      if (tokens[position++] !== ')') throw new Error('Missing closing parenthesis.');
      return value;
    }
    if (!token || !/^\d/.test(token)) throw new Error('Invalid expression.');
    return Number(token);
  };
  const term = (): number => {
    let value = primary();
    while (['*', '/', '%'].includes(tokens[position] ?? '')) {
      const operator = tokens[position++]; const right = primary();
      if ((operator === '/' || operator === '%') && right === 0) throw new Error('Cannot divide by zero.');
      value = operator === '*' ? value * right : operator === '/' ? value / right : value % right;
    }
    return value;
  };
  const expressionValue = (): number => {
    let value = term();
    while (tokens[position] === '+' || tokens[position] === '-') {
      const operator = tokens[position++]; const right = term();
      value = operator === '+' ? value + right : value - right;
    }
    return value;
  };
  const result = expressionValue();
  if (position !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid expression.');
  return result;
}
