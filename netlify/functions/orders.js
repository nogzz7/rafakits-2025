// netlify/functions/orders.js
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
    // POST - criar pedido e atualizar estoque
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const { customer_name, customer_phone, items, total_amount, status } = data;

      // Atualiza estoque de cada produto
      for (const item of items) {
        const productQuery = await db.query(
          'SELECT id, inventory FROM products WHERE name = $1',
          [item.name]
        );
        if (productQuery.rows.length === 0) {
          throw new Error(`Produto ${item.name} não encontrado`);
        }
        const product = productQuery.rows[0];
        const newInventory = product.inventory - item.quantity;
        if (newInventory < 0) {
          throw new Error(`Estoque insuficiente para ${item.name}`);
        }
        await db.query(
          'UPDATE products SET inventory = $1, available = $2 WHERE id = $3',
          [newInventory, newInventory > 0, product.id]
        );
      }

      // Insere pedido
      const result = await db.query(
        `INSERT INTO orders 
         (customer_name, customer_phone, items, total_amount, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [customer_name, customer_phone, JSON.stringify(items), total_amount, status || 'pending']
      );
      const newOrder = result.rows[0];
      newOrder.total_amount = parseFloat(newOrder.total_amount);
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(newOrder)
      };
    }

    // GET - listar pedidos
    if (event.httpMethod === 'GET') {
      const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
      const orders = result.rows.map(row => ({
        ...row,
        total_amount: parseFloat(row.total_amount),
        items: row.items
      }));
      return { statusCode: 200, headers, body: JSON.stringify(orders) };
    }

    // PUT - atualizar status do pedido
    if (event.httpMethod === 'PUT') {
      const id = event.queryStringParameters?.id;
      if (!id) return { statusCode: 400, headers, body: 'ID required' };
      const { status } = JSON.parse(event.body);
      await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (error) {
    console.error('Orders error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};