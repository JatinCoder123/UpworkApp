// Guards for data from the CRM, Upwork or browser storage, which can arrive missing or in the wrong shape
// (null, {} instead of [], a string instead of a list). Use them wherever outside data is read.

/** The value if it is an array, otherwise an empty array. Safe to call .map / .filter / .length on. */
export const asArray = (value) => (Array.isArray(value) ? value : [])

/** The value if it is a plain object, otherwise an empty object. Safe to read properties from. */
export const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

/** The value as a string; null and undefined become ''. Safe to call .trim / .split / .toLowerCase on. */
export const asText = (value) => (value == null ? '' : String(value))
