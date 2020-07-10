/* eslint-disable import/prefer-default-export */
/**
 * @param {{ [category: string]: { [subcategory: string]: boolean } }} categories categories object
 * @returns {string[]} returns an array conaining the tags of the contact as strings (if any)
 */
const retrieveCategories = categories => {
  const cats = Object.entries(categories);
  const subcats = cats.flatMap(([cat, subs]) => {
    const subsWithCat = {
      ...subs,
      [`Unspecified/Other - ${cat}`]: subs['Unspecified/Other'],
    };

    delete subsWithCat['Unspecified/Other'];

    return Object.entries(subsWithCat);
  });

  const flattened = subcats.map(([subcat, bool]) => {
    if (bool) return subcat;
    return null;
  });

  const tags = flattened.reduce((acc, curr) => {
    if (curr) return [...acc, curr];
    return acc;
  }, []);

  return tags;
};

module.exports = {
  retrieveCategories,
};
