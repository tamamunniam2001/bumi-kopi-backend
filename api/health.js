const { handleCors } = require('../../lib/helpers')

module.exports = (req, res) => {
  if (handleCors(req, res)) return
  res.json({ status: 'ok', app: 'Bumi Kopi API' })
}
