// passwordUtils.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const { salt } = require('../config/config');


const hashPassword = async (password) => {
    const saltRounds = await parseInt(salt);
    return await bcrypt.hash(password, saltRounds);

};

const verifyPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

module.exports = {
    hashPassword,
    verifyPassword,
};


