const db = require('./db');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      const result = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
      return { statusCode: 200, headers, body: JSON.stringify(result.rows) };
    }

    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const { code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active } = data;
      const result = await db.query(
        `INSERT INTO coupons (code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active]
      );
      return { statusCode: 201, headers, body: JSON.stringify(result.rows[0]) };
    }

    if (event.httpMethod === 'PUT') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      const data = JSON.parse(event.body);
      const { code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active } = data;
      await db.query(
        `UPDATE coupons SET code=$1, discount_type=$2, discount_value=$3, description=$4, min_order_value=$5, max_uses=$6, expires_at=$7, active=$8 WHERE id=$9`,
        [code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active, id]
      );
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      await db.query('DELETE FROM coupons WHERE id=$1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: 'Método não permitido' };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};