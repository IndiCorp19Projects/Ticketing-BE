'use strict';

require('dotenv').config(); // ✅ Load .env variables
const express = require('express');
const bodyParser = require('body-parser');
const db = require('./models'); // Sequelize index.js

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Simple test route
app.get('/', (req, res) => {
  res.send('Server is running 🚀');
});

// ✅ Example route using User model
app.get('/users', async (req, res) => {
  try {
    const users = await db.User.findAll();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ✅ Sync database & start server
db.sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected...');
    return db.sequelize.sync(); // create tables if they don’t exist
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Unable to connect to the database:', err);
  });
