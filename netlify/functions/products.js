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
    // GET - listar produtos
    if (event.httpMethod === 'GET') {
      const result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
      const products = result.rows.map(row => ({
        ...row,
        price: parseFloat(row.price) || 0,
        cost_price: row.cost_price ? parseFloat(row.cost_price) : 0,
        original_price: row.original_price ? parseFloat(row.original_price) : null,
        inventory: parseInt(row.inventory) || 0,
      }));
      return { statusCode: 200, headers, body: JSON.stringify(products) };
    }

    // POST - criar produto
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      // Garante valores padrão para campos obrigatórios
      const name = data.name || 'Produto sem nome';
      const price = parseFloat(data.price) || 0;
      const cost_price = data.cost_price !== undefined && data.cost_price !== '' && data.cost_price !== null 
        ? parseFloat(data.cost_price) 
        : 0;
      const inventory = parseInt(data.inventory) || 0;
      const collection = data.collection || null;
      const image_url = data.image_url || data.image_1 || null; // compatibilidade com admin
      const on_sale = data.on_sale === true || data.on_sale === 'true';
      const available = data.available !== false && data.available !== 'false';
      const description = data.description || null;
      const original_price = data.original_price ? parseFloat(data.original_price) : null;
      const metadata = data.metadata || {};

      const result = await db.query(
        `INSERT INTO products 
         (name, description, cost_price, price, original_price, inventory, collection, image_url, on_sale, available, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [name, description, cost_price, price, original_price, inventory, collection, image_url, on_sale, available, metadata]
      );
      const newProduct = result.rows[0];
      newProduct.price = parseFloat(newProduct.price);
      newProduct.cost_price = parseFloat(newProduct.cost_price) || 0;
      return { statusCode: 201, headers, body: JSON.stringify(newProduct) };
    }

    // PUT - atualizar produto
    if (event.httpMethod === 'PUT') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers, body: 'ID required' };
      const data = JSON.parse(event.body);
      
      const name = data.name || 'Produto sem nome';
      const price = parseFloat(data.price) || 0;
      const cost_price = data.cost_price !== undefined && data.cost_price !== '' && data.cost_price !== null 
        ? parseFloat(data.cost_price) 
        : 0;
      const inventory = parseInt(data.inventory) || 0;
      const collection = data.collection || null;
      const image_url = data.image_url || data.image_1 || null;
      const on_sale = data.on_sale === true || data.on_sale === 'true';
      const available = data.available !== false && data.available !== 'false';
      const description = data.description || null;
      const original_price = data.original_price ? parseFloat(data.original_price) : null;
      const metadata = data.metadata || {};

      await db.query(
        `UPDATE products SET
         name=$1, description=$2, cost_price=$3, price=$4, original_price=$5,
         inventory=$6, collection=$7, image_url=$8, on_sale=$9, available=$10, metadata=$11
         WHERE id=$12`,
        [name, description, cost_price, price, original_price, inventory, collection, image_url, on_sale, available, metadata, id]
      );
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    // DELETE - deletar produto
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers, body: 'ID required' };
      await db.query('DELETE FROM products WHERE id=$1', [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (error) {
    console.error('Products error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, stack: error.stack }),
    };
  }
};