const db = require('./db');

exports.handler = async (event) => {
  const { httpMethod, queryStringParameters, body } = event;

  if (httpMethod === 'GET') {
    const res = await db.query('SELECT * FROM products ORDER BY id');
    return { statusCode: 200, body: JSON.stringify(res.rows) };
  }

  if (httpMethod === 'POST') {
    const data = JSON.parse(body);
    const { name, description, price, original_price, cost_price, inventory, collection, image_1, image_2, image_3, on_sale, available, metadata } = data;
    const res = await db.query(
      `INSERT INTO products 
       (name, description, price, original_price, cost_price, inventory, collection, image_1, image_2, image_3, on_sale, available, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [name, description, price, original_price, cost_price, inventory, collection, image_1, image_2, image_3, on_sale, available, metadata]
    );
    return { statusCode: 201, body: JSON.stringify(res.rows[0]) };
  }

  if (httpMethod === 'PUT') {
    const id = queryStringParameters?.id;
    const data = JSON.parse(body);
    const { name, description, price, original_price, cost_price, inventory, collection, image_1, image_2, image_3, on_sale, available, metadata } = data;
    const res = await db.query(
      `UPDATE products SET name=$1, description=$2, price=$3, original_price=$4, cost_price=$5, inventory=$6, collection=$7, image_1=$8, image_2=$9, image_3=$10, on_sale=$11, available=$12, metadata=$13 WHERE id=$14 RETURNING *`,
      [name, description, price, original_price, cost_price, inventory, collection, image_1, image_2, image_3, on_sale, available, metadata, id]
    );
    if (res.rows.length === 0) return { statusCode: 404 };
    return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
  }

  if (httpMethod === 'DELETE') {
    const id = queryStringParameters?.id;
    await db.query('DELETE FROM products WHERE id=$1', [id]);
    return { statusCode: 204 };
  }

  return { statusCode: 405 };
};