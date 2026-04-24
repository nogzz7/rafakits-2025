const db = require('./db');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET - listar categorias
    if (event.httpMethod === 'GET') {
      const result = await db.query('SELECT * FROM categories ORDER BY name');
      return { statusCode: 200, headers, body: JSON.stringify(result.rows) };
    }

    // POST - criar categoria
    if (event.httpMethod === 'POST') {
      const { name, slug, icon } = JSON.parse(event.body);
      if (!name || !slug) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nome e slug são obrigatórios' }) };
      }
      const result = await db.query(
        'INSERT INTO categories (name, slug, icon) VALUES ($1, $2, $3) RETURNING *',
        [name, slug, icon || null]
      );
      return { statusCode: 201, headers, body: JSON.stringify(result.rows[0]) };
    }

    // PUT - atualizar categoria
    if (event.httpMethod === 'PUT') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID não informado' }) };
      const { name, slug, icon } = JSON.parse(event.body);
      const result = await db.query(
        'UPDATE categories SET name=$1, slug=$2, icon=$3 WHERE id=$4 RETURNING *',
        [name, slug, icon, id]
      );
      if (result.rows.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Categoria não encontrada' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(result.rows[0]) };
    }

    // DELETE - deletar categoria
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID não informado' }) };
      await db.query('DELETE FROM categories WHERE id=$1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (error) {
    console.error('Categories error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};