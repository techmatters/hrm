/**
 * @param {string[]} accumulator
 * @param {[string, boolean]} currentValue
 */
const subcatsReducer = (accumulator: string[], [subcat, bool]: [string, boolean]): string[] =>
  bool ? [...accumulator, subcat] : accumulator;

/**
 * @param {{ [category: string]: string[] }} accumulator
 * @param {[string, { [subcategory: string]: boolean }]} currentValue
 */
const catsReducer = (
  accumulator: { [category: string]: string[] },
  [cat, subcats]: [string, { [subcategory: string]: boolean }],
) => {
  const subcatsList = Object.entries(subcats).reduce(subcatsReducer, []);

  if (!subcatsList.length) return accumulator;

  return { ...accumulator, [cat]: subcatsList };
};

/**
 * @param {{ [category: string]: { [subcategory: string]: boolean } }} categories categories object
 * @returns {{ [category: string]: string[] }} returns an object containing each truthy subcategory under the category name
 */
export const retrieveCategories = (categories: {
  [category: string]: { [subcategory: string]: boolean };
}) => {
  if (!categories) return {};

  return Object.entries(categories).reduce(catsReducer, {});
};
