/* eslint-disable import/prefer-default-export */

const { OrderByDirection } = require('../case/sql/case-search-sql');
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
  const sortBy = query.sortBy || 'id';
  const sortDirection =
    (query.sortDirection ?? 'desc').toLowerCase() === 'asc'
      ? OrderByDirection.ascendingNullsLast
      : OrderByDirection.descendingNullsLast;

  return { limit, offset, sortBy, sortDirection };
};

const isEmptySearchParams = body => {
  const {
    helpline,
    firstName,
    lastName,
    counselor,
    phoneNumber,
    dateFrom,
    dateTo,
    contactNumber,
  } = body;

  const anyValue =
    helpline ||
    firstName ||
    lastName ||
    counselor ||
    phoneNumber ||
    dateFrom ||
    dateTo ||
    contactNumber;

  return !anyValue;
};

const orUndefined = value => value || undefined;

function formatNumber(number) {
  if (number === undefined || number == null || number === 'Anonymous' || number === 'Customer') {
    return number;
  }

  const len = number.length;
  return number.slice(0, 4) + 'X'.repeat(Math.max(0, len - 7)) + number.slice(len - 3);
}

module.exports = {
  retrieveCategories,
  getPaginationElements,
  isEmptySearchParams,
  orUndefined,
  formatNumber,
};
