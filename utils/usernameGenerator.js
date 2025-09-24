const { User } = require('../models');

/**
 * Generate unique username from first and last name
 */
const generateUniqueUsername = async (firstName, lastName) => {
  let baseUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
  let username = baseUsername;
  let counter = 1;

  // Check uniqueness
  while (await User.findOne({ where: { username } })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  return username;
};

module.exports = generateUniqueUsername;
