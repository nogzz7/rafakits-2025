const db = require('./db');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    if (event.httpMethod === 'GET') {
      const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
      return { statusCode: 200, headers, body: JSON.stringify(result.rows) };
    }
    if (event.httpMethod === 'POST') {
      const { customer_name, customer_phone, items, total_amount, status } = JSON.parse(event.body);
      const result = await db.query(
        `INSERT INTO orders (customer_name, customer_phone, items, total_amount, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [customer_name, customer_phone, JSON.stringify(items), total_amount, status || 'pending']
      );
      return { statusCode: 201, headers, body: JSON.stringify(result.rows[0]) };
    }
    if (event.httpMethod === 'PUT') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      const { status } = JSON.parse(event.body);
      await db.query('UPDATE orders SET status=$1 WHERE id=$2', [status, id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      await db.query('DELETE FROM orders WHERE id=$1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};