const { Client } = require('pg');

exports.handler = async (event) => {
  const method = event.httpMethod;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { statusCode: 500, body: 'DATABASE_URL not set' };
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    if (method === 'GET') {
      const res = await client.query('SELECT * FROM products ORDER BY id DESC');
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(res.rows) };
    }
    if (method === 'POST') {
      const auth = event.headers['x-admin-password'];
      if (auth !== process.env.ADMIN_PASSWORD) return { statusCode: 401, body: 'Unauthorized' };
      const { name, price, originalPrice, image, collection, inventory } = JSON.parse(event.body);
      const result = await client.query(
        `INSERT INTO products (name, price, original_price, image, collection, inventory)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [name, price, originalPrice || null, image || '', collection || 'colecao-30-1', inventory || 0]
      );
      return { statusCode: 201, body: JSON.stringify(result.rows[0]) };
    }
    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};