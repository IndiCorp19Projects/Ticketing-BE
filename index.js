const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const cors = require("cors");
const cookieParser = require("cookie-parser");

const { sequelize } = require('./models');
const authRoutes = require('./routes/authRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());


// ✅ Allow frontend (http://localhost:5173 for Vite)
app.use(
  cors({
    origin: "http://localhost:3000", // frontend URL
    credentials: true, // ✅ allow cookies
  })
);


app.get("/api/check", (req, res) => {
  console.log(req.cookies); // should log { token: "..." }
  res.json({ cookies: req.cookies });
});


app.use('/api/auth', authRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => res.send('Ticketing system API running'));

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

sequelize
  .sync({ alter: false })
  .then(() => {
    console.log('Database synced');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB sync error', err);
  });
