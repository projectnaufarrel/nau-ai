import { createRootRoute, Outlet } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  component: () => (
    <html lang="id">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Naufarrel — KM ITB Knowledge Bot</title>
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  )
})
