require('dotenv').config();            // chỉ cần khi chạy local với .env
const express = require('express');
const { Client } = require('pg');
const redis = require('redis');

const app = express();
const port = process.env.PORT || 3000;

// Body parser
app.use(express.json());

// --- PostgreSQL setup ---
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false     // nếu DB yêu cầu SSL tự ký
  }
});

pgClient.connect()
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch(err => console.error('❌ PostgreSQL connection error', err.stack));

// Tạo bảng users nếu chưa tồn tại
pgClient.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  );
`).catch(err => console.error('Error creating users table', err.stack));

// --- Redis setup ---
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', err => console.error('❌ Redis Client Error', err));
redisClient.connect()
  .then(() => console.log('✅ Connected to Redis'))
  .catch(err => console.error('❌ Redis connection error', err));

// --- ROUTES ---
// GET all users (with optional cache refresh)
app.get('/data', async (req, res) => {
  try {
    if (req.query.refresh === 'true') {
      await redisClient.del('data');
    }

    const cache = await redisClient.get('data');
    if (cache) {
      return res.json(JSON.parse(cache));
    }

    const result = await pgClient.query('SELECT * FROM users');
    await redisClient.setEx('data', 60, JSON.stringify(result.rows));
    res.json(result.rows);

  } catch (err) {
    console.error('Error fetching data', err.stack || err);
    res.status(500).send('Error fetching data');
  }
});

// CREATE user
app.post('/data', async (req, res) => {
  const { name, email } = req.body;
  try {
    await pgClient.query(
      'INSERT INTO users (name, email) VALUES ($1, $2)',
      [name, email]
    );
    await redisClient.del('data');
    res.status(201).send('Data added successfully');
  } catch (err) {
    console.error('Error inserting data', err.stack || err);
    res.status(500).send('Error inserting data');
  }
});

// UPDATE user
app.put('/data/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  try {
    await pgClient.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3',
      [name, email, id]
    );
    await redisClient.del('data');
    res.send('Data updated successfully');
  } catch (err) {
    console.error('Error updating data', err.stack || err);
    res.status(500).send('Error updating data');
  }
});

// DELETE user
app.delete('/data/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pgClient.query('DELETE FROM users WHERE id = $1', [id]);
    await redisClient.del('data');
    res.send('Data deleted successfully');
  } catch (err) {
    console.error('Error deleting data', err.stack || err);
    res.status(500).send('Error deleting data');
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
