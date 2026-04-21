/**
 * Helper to get current Ethiopian Calendar year
 * Ethiopian New Year is typically Sept 11 (or Sept 12 in leap years).
 * For simplicity, we use Sept 11 as the boundary.
 */
const getCurrentECYear = () => {
  const d = new Date();
  // d.getMonth() is 0-indexed (8 = September)
  const isBeforeNewYear = d.getMonth() < 8 || (d.getMonth() === 8 && d.getDate() < 11);
  return (d.getFullYear() - (isBeforeNewYear ? 8 : 7)).toString();
};

/**
 * Formats the current EC year as a term string (e.g., "2018 E.C")
 */
const getCurrentECTerm = () => {
  return `${getCurrentECYear()} E.C`;
};

module.exports = {
  getCurrentECYear,
  getCurrentECTerm
};
