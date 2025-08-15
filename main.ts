import { Hono } from "hono"
import { etag } from "hono/etag"
import { logger } from "hono/logger"
import { ContentfulStatusCode } from "hono/utils/http-status"
import { decrypt } from "./logic/decrypt.ts"

const app = new Hono()

app.use(etag(), logger())

app.get("/proxy/:protocol/:domain/*", async (c) => {
  const domain = c.req.param("protocol") + ":" + c.req.param("domain")
  const path = "/" + c.req.path.split("/").slice(4).join("/")

  console.log({domain, path})
  console.log(c.req.path)

  const url = new URL(path, domain)
  url.search = new URL(c.req.url).search

  console.log("Request to URL: " + url)

  let res = await fetch(url)
  if (!res.ok)
    return c.body(
      await res.arrayBuffer(),
      res.status as ContentfulStatusCode,
      Object.fromEntries(res.headers.entries())
    )

  let buffer = await res.arrayBuffer()
  const text = new TextDecoder().decode(buffer)
  if (text.includes('<script type="text/javascript" src="/aes.js" >')) {
    const cookie = `__test=${decrypt(text)}`

    res = await fetch(url, {
      headers: {
        cookie
      }
    })

    if (!res.ok)
      return c.body(
        await res.arrayBuffer(),
        res.status as ContentfulStatusCode,
        Object.fromEntries(res.headers.entries())
      )

    buffer = await res.arrayBuffer()
  }

  return c.body(
    buffer,
    res.status as ContentfulStatusCode,
    Object.fromEntries(res.headers.entries())
  )
})

Deno.serve(app.fetch)
