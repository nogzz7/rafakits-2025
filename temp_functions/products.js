const db = require('./db');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    // GET – listar produtos
    if (event.httpMethod === 'GET') {
      const result = await db.query(`
        SELECT id, name, description, price, original_price, inventory,
               collection, image_url, on_sale, available, metadata, created_at
        FROM products ORDER BY created_at DESC
      `);
      const products = result.rows.map(p => ({
        ...p,
        price: parseFloat(p.price),
        original_price: p.original_price ? parseFloat(p.original_price) : null,
        inventory: parseInt(p.inventory)
      }));
      return { statusCode: 200, headers, body: JSON.stringify(products) };
    }

    // POST – criar novo produto
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const { name, description, price, original_price, inventory, collection, image_url, on_sale, available, metadata } = data;
      const result = await db.query(
        `INSERT INTO products 
         (name, description, price, original_price, inventory, collection, image_url, on_sale, available, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [name, description, price, original_price, inventory, collection, image_url, on_sale || false, available !== false, metadata || {}]
      );
      return { statusCode: 201, headers, body: JSON.stringify(result.rows[0]) };
    }

    // PUT – atualizar produto (requer id na query string)
    if (event.httpMethod === 'PUT') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      const data = JSON.parse(event.body);
      const { name, description, price, original_price, inventory, collection, image_url, on_sale, available, metadata } = data;
      await db.query(
        `UPDATE products SET
         name=$1, description=$2, price=$3, original_price=$4, inventory=$5,
         collection=$6, image_url=$7, on_sale=$8, available=$9, metadata=$10
         WHERE id=$11`,
        [name, description, price, original_price, inventory, collection, image_url, on_sale, available, metadata, id]
      );
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // DELETE – remover produto (requer id na query string)
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) throw new Error('ID não informado');
      await db.query('DELETE FROM products WHERE id=$1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (error) {
    console.error('Erro em products:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};