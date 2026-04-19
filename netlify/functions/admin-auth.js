exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '' };
  const { password } = JSON.parse(event.body);
  const isValid = (password === process.env.ADMIN_PASSWORD);
  return {
    statusCode: 200,
    body: JSON.stringify({ authenticated: isValid }),
  };
};