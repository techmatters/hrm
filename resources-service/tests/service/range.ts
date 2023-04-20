const range = (elements: number | string): string[] =>
  Array.from(Array(typeof elements === 'number' ? elements : parseInt(elements)).keys()).map(i =>
    i.toString(),
  );

export default range;
