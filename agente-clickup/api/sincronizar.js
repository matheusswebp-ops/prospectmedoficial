require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { executar } = require('../index');

module.exports = async function handler(req, res) {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const resumo = await executar();
    res.status(200).json({ ok: true, resumo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
