const db = require('./db');

exports.handler = async (event) => {
  const { httpMethod, queryStringParameters, body } = event;

  if (httpMethod === 'GET') {
    const res = await db.query('SELECT * FROM coupons ORDER BY id');
    return { statusCode: 200, body: JSON.stringify(res.rows) };
  }

  if (httpMethod === 'POST') {
    const data = JSON.parse(body);
    const { code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active } = data;
    const res = await db.query(
      `INSERT INTO coupons (code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active]
    );
    return { statusCode: 201, body: JSON.stringify(res.rows[0]) };
  }

  if (httpMethod === 'PUT') {
    const id = queryStringParameters?.id;
    const data = JSON.parse(body);
    const { code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active } = data;
    const res = await db.query(
      `UPDATE coupons SET code=$1, discount_type=$2, discount_value=$3, description=$4, min_order_value=$5, max_uses=$6, expires_at=$7, active=$8 WHERE id=$9 RETURNING *`,
      [code, discount_type, discount_value, description, min_order_value, max_uses, expires_at, active, id]
    );
    if (res.rows.length === 0) return { statusCode: 404 };
    return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
  }

  if (httpMethod === 'DELETE') {
    const id = queryStringParameters?.id;
    await db.query('DELETE FROM coupons WHERE id=$1', [id]);
    return { statusCode: 204 };
  }

  return { statusCode: 405 };
};