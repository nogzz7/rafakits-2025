const db = require('./db');

exports.handler = async (event) => {
  const { httpMethod, queryStringParameters, body } = event;

  if (httpMethod === 'GET') {
    const res = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    return { statusCode: 200, body: JSON.stringify(res.rows) };
  }

  if (httpMethod === 'PUT') {
    const id = queryStringParameters?.id;
    const { status } = JSON.parse(body);
    const res = await db.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [status, id]);
    if (res.rows.length === 0) return { statusCode: 404 };
    return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
  }

  return { statusCode: 405 };
};