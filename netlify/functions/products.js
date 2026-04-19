const { Client } = require('pg');

exports.handler = async (event) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { statusCode: 500, body: 'DATABASE_URL not set' };

  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  if (event.httpMethod === 'GET') {
    const result = await client.query('SELECT * FROM products ORDER BY id DESC');
    await client.end();
    return { statusCode: 200, body: JSON.stringify(result.rows) };
  }

  if (event.httpMethod === 'POST') {
    const auth = event.headers['x-admin-password'];
    if (auth !== process.env.ADMIN_PASSWORD) {
      await client.end();
      return { statusCode: 401, body: 'Não autorizado' };
    }
    const { name, price, originalPrice, image, collection, description, sizes } = JSON.parse(event.body);
    const sizesJson = JSON.stringify(sizes || []);
    await client.query(
      `INSERT INTO products (name, price, original_price, image, collection, description, sizes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, price, originalPrice, image, collection, description || '', sizesJson]
    );
    await client.end();
    return { statusCode: 201, body: 'ok' };
  }

  return { statusCode: 405 };
};