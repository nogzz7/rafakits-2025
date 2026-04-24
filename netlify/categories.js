const db = require('./db');

exports.handler = async (event) => {
  const { httpMethod, queryStringParameters, body } = event;
  const client = await db.getClient();

  try {
    // GET all
    if (httpMethod === 'GET') {
      const res = await client.query('SELECT * FROM categories ORDER BY id');
      return { statusCode: 200, body: JSON.stringify(res.rows) };
    }

    // POST create
    if (httpMethod === 'POST') {
      const { name, slug, icon } = JSON.parse(body);
      const res = await client.query(
        'INSERT INTO categories (name, slug, icon) VALUES ($1, $2, $3) RETURNING *',
        [name, slug, icon]
      );
      return { statusCode: 201, body: JSON.stringify(res.rows[0]) };
    }

    // PUT update
    if (httpMethod === 'PUT') {
      const id = queryStringParameters?.id;
      if (!id) return { statusCode: 400, body: 'ID necessário' };
      const { name, slug, icon } = JSON.parse(body);
      const res = await client.query(
        'UPDATE categories SET name=$1, slug=$2, icon=$3 WHERE id=$4 RETURNING *',
        [name, slug, icon, id]
      );
      if (res.rows.length === 0) return { statusCode: 404, body: 'Categoria não encontrada' };
      return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
    }

    // DELETE
    if (httpMethod === 'DELETE') {
      const id = queryStringParameters?.id;
      if (!id) return { statusCode: 400, body: 'ID necessário' };
      await client.query('DELETE FROM categories WHERE id=$1', [id]);
      return { statusCode: 204, body: '' };
    }

    return { statusCode: 405 };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};