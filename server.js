const express = require('express');
const { Client } = require('pg');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// Cấu hình PostgreSQL
const client = new Client({
  host: 'localhost',      // hoặc IP DB
  port: 5432,              // mặc định PostgreSQL
  user: 'postgres',       // thay bằng user thật
  password: '1234',   // thay bằng pass thật
  database: 'huongle'      // thay bằng DB name
});

client.connect()
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch(err => console.error('❌ Connection error', err.stack));

// Tạo bảng ví dụ nếu chưa có (users)
client.query(`
  CREATE TABLE IF NOT EXISTS actual_table_name (
    id SERIAL PRIMARY KEY,
    column1 TEXT NOT NULL,
    column2 TEXT UNIQUE NOT NULL
  );
`);

// --------- ROUTES -----------
// GET all users
app.get('/data', async (req, res) => {
  try {
      if (req.query.refresh === 'true') {
          await redisClient.del('data');
      }

      const cacheResults = await redisClient.get('data');

      if (cacheResults) {
          return res.status(200).json(JSON.parse(cacheResults));
      }

      client.query('SELECT * FROM users', (err, result) => {
          if (err) {
              console.error('Error executing query', err.stack);
              return res.status(500).send('Error executing query');
          }

          // Lưu dữ liệu vào Redis trong 60 giây
          redisClient.setEx('data', 60, JSON.stringify(result.rows));
          res.status(200).json(result.rows);
      });
  } catch (error) {
      console.error('Error fetching data', error);
      res.status(500).send('Error fetching data');
  }
});


// CREATE user
app.post('/data', (req, res) => {
  const { name, email } = req.body;
  client.query('INSERT INTO users (name, email) VALUES ($1, $2)', [name, email], async (err, result) => {

    if (err) {
      console.error('Error inserting data', err.stack);
      res.status(500).send('Error inserting data');
    } else {
      await redisClient.del('data'); // 🔥 Xoá cache
      res.status(201).send('Data added successfully');
    }
  });
});

// UPDATE user
app.put('/data/:id', (req, res) => {
  const { id } = req.params; // Lấy id từ URL
  const { name, email } = req.body;
  // Lấy dữ liệu từ body

  // Cập nhật dữ liệu trong PostgreSQL
  client.query('UPDATE users SET name = $1, email = $2 WHERE id = $3', [name, email, id], async (err, result) => {
    if (err) {
          console.error('Error updating data', err.stack);
          return res.status(500).send('Error updating data');
      } else {
          // Sau khi cập nhật dữ liệu, xóa cache Redis để đảm bảo dữ liệu mới được truy xuất
          await redisClient.del('data'); // Xóa cache dữ liệu cũ
          console.log('Cache deleted after update');
          return res.status(200).send('Data updated successfully');
      }
  });
});


/// DELETE user
app.delete('/data/:id', (req, res) => {
  const { id } = req.params; // Lấy id từ URL

  // Xóa dữ liệu khỏi PostgreSQL
  client.query('DELETE FROM users WHERE id = $1', [id], async (err, result) => {
    if (err) {
          console.error('Error deleting data', err.stack);
          return res.status(500).send('Error deleting data');
      } else {
          // Sau khi xóa dữ liệu, xóa cache Redis
          await redisClient.del('data'); // Xóa cache dữ liệu cũ
          console.log('Cache deleted after delete');
          return res.status(200).send('Data deleted successfully');
      }
  });
});

const redis = require('redis');

const redisClient = redis.createClient({
  url: 'rediss://red-d0adb2juibrs73bqh690:fmeSsqjIvGs40Xseowg6SaDJzJP98CDW@oregon-keyvalue.render.com:6379'
});


redisClient.connect()
    .then(() => console.log('Connected to Key Value Store'))
    .catch(err => console.error('Key Value connection error', err));
  // Lưu trữ dữ liệu
redisClient.set('myKey', 'myValue')
.then(() => console.log('Value set successfully'))
.catch(err => console.error('Error setting value', err));

// Truy xuất dữ liệu
redisClient.get('myKey')
.then(value => console.log('Retrieved value:', value))
.catch(err => console.error('Error retrieving value', err));
process.on('exit', () => {
  redisClient.quit();
});
app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
