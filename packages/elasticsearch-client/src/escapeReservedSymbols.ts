const nonEscapableSymbols = ['>', '<'];

const escapableSymbols = [
  '+',
  '-',
  '=',
  '&',
  '|',
  '!',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  '^',
  '"',
  '~',
  '*',
  '?',
  ':',
  '\\',
  '/',
];

const nonEscapableSymbolsRegex = new RegExp(`[${nonEscapableSymbols.join('')}]`, 'g');

const escapableSymbolsRegex = new RegExp(
  `([${escapableSymbols.map(s => `\\${s}`).join('')}])`,
  'g',
);

export const escapeReservedSymbols = (s: string) => {
  const withoutNonEscapable = s.replace(nonEscapableSymbolsRegex, '');

  return withoutNonEscapable.replace(escapableSymbolsRegex, '\\$1');
};
