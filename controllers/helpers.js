/* eslint-disable import/prefer-default-export */

/**
 * @param {string[]} accumulator
 * @param {[string, boolean]} currentValue
 */
const subcatsReducer = (accumulator, [subcat, bool]) =>
  bool ? [...accumulator, subcat] : accumulator;

/**
 * @param {{ [category: string]: string[] }} accumulator
 * @param {[string, { [subcategory: string]: boolean }]} currentValue
 */
const catsReducer = (accumulator, [cat, subcats]) => {
  const subcatsList = Object.entries(subcats).reduce(subcatsReducer, []);

  if (!subcatsList.length) return accumulator;

  return { ...accumulator, [cat]: subcatsList };
};

/**
 * @param {{ [category: string]: { [subcategory: string]: boolean } }} categories categories object
 * @returns {{ [category: string]: string[] }} returns an object containing each truthy subcategory under the category name
 */
const retrieveCategories = categories => {
  if (!categories) return {};

  return Object.entries(categories).reduce(catsReducer, {});
};

const getPaginationElements = query => {
  const queryLimit =
    query.limit && !Number.isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : Infinity;
  const limit = Math.min(queryLimit, 1000);
  const offset = (query.offset && parseInt(query.offset, 10)) || 0;

  return { limit, offset };
};

module.exports = {
  retrieveCategories,
  getPaginationElements,
};
