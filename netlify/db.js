const { Client } = require('pg');

let client = null;

const getClient = async () => {
  if (!client) {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
  }
  return client;
};

exports.query = async (text, params) => {
  const client = await getClient();
  try {
    const res = await client.query(text, params);
    return res;
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
};