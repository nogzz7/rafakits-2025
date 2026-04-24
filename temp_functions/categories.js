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
      const result = await db.query('SELECT * FROM categories ORDER BY name');
      return { statusCode: 200, headers, body: JSON.stringify(result.rows) };
    }
    if (event.httpMethod === 'POST') {
      const { name, slug, icon } = JSON.parse(event.body);
      const result = await db.query(
        'INSERT INTO categories (name, slug, icon) VALUES ($1, $2, $3) RETURNING *',
        [name, slug, icon]
      );
      return { statusCode: 201, headers, body: JSON.stringify(result.rows[0]) };
    }
    if (event.httpMethod === 'PUT') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      const { name, slug, icon } = JSON.parse(event.body);
      await db.query('UPDATE categories SET name=$1, slug=$2, icon=$3 WHERE id=$4', [name, slug, icon, id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      await db.query('DELETE FROM categories WHERE id=$1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};