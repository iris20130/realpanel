const { createServer } = require('http')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = Number(process.env.PORT || 3000)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      // 供 /api/network/info 判断访客接入网段（反代场景保留其转发头）
      if (!req.headers['x-forwarded-for'] && !req.headers['x-real-ip']) {
        const ip = req.socket.remoteAddress
        if (ip) req.headers['x-real-ip'] = ip
      }
      handle(req, res)
    })
    server.listen(port, hostname, () => {
      console.log(`[server] http://${hostname}:${port}`)
    })
    server.on('error', (error) => {
      console.error(`[server] 监听 ${port} 失败:`, error.message)
      process.exit(1)
    })
  })
  .catch((error) => {
    console.error('[server] 启动失败:', error)
    process.exit(1)
  })
