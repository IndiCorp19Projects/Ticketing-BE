'use strict';

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const process = require('process');

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(path.join(__dirname, '/../config/config.json'))[env];

const db = {};

// ✅ Initialize Sequelize instance
let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], { ...config });
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, { ...config });
}

// ✅ Dynamically import all models
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 && // skip hidden files
      file !== basename &&       // skip index.js
      file.slice(-3) === '.js' && // only .js files
      !file.endsWith('.test.js') // skip test files
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, DataTypes);
    db[model.name] = model;
  });

// ✅ Run associations if defined
Object.keys(db).forEach((modelName) => {
  if (typeof db[modelName].associate === 'function') {
    db[modelName].associate(db);
  }
});

// ✅ Expose Sequelize + Models
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
