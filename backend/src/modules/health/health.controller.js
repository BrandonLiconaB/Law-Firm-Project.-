export function getHealth(_req, res) {
  res.status(200).json({
    data: {
      status: 'ok',
      service: 'gestor-documental-api',
    },
  })
}
