// utils/apiKeyGenerator.js
const crypto = require('crypto');

const generateApiKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

const hashApiKey = (apiKey) => {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
};

module.exports = {
  generateApiKey,
  hashApiKey
};