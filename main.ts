import { Hono } from "hono"
import { etag } from "hono/etag"
import { logger } from "hono/logger"
import { ContentfulStatusCode } from "hono/utils/http-status"
import { decrypt } from "./logic/decrypt.ts"
import { cleanHeaders } from "./logic/clean-headers.ts"

const app = new Hono()

app.use(etag(), logger())

const cookieStore = new Map<string, { value: string; created: number }>()

app.all("/proxy/:protocol/:domain/*", async (c) => {
  const domain = c.req.param("protocol") + "://" + c.req.param("domain")
  const path = "/" + c.req.path.split("/").slice(4).join("/")

  const url = new URL(path, domain)
  url.search = new URL(c.req.url).search

  console.log("Request to URL: " + url)

  const cookie = cookieStore.get(domain)
  let res = await fetch(url, {
    method: c.req.method,
    body: ["GET", "HEAD", "DELETE", "TRACE", "OPTIONS", "CONNECT"].includes(
      c.req.method
    )
      ? null
      : await c.req.arrayBuffer(),
    headers: {
      ...(cookie && cookie.created + 21600 * 1e3 > Date.now()
        ? {
            cookie: [c.req.header("cookie") ?? "", cookie]
              .filter(Boolean)
              .join("; ")
          }
        : {}),
      ...cleanHeaders(Object.fromEntries(c.req.raw.headers.entries()))
    }
  })
  if (!res.ok)
    return c.body(
      await res.arrayBuffer(),
      res.status as ContentfulStatusCode,
      Object.fromEntries(res.headers.entries())
    )

  let buffer = await res.arrayBuffer()
  const text = new TextDecoder().decode(buffer)

  if (text.includes('<script type="text/javascript" src="/aes.js"')) {
    const cookie = `__test=${decrypt(text)}`

    cookieStore.set(domain, { value: cookie, created: Date.now() })

    res = await fetch(url, {
      method: c.req.method,
      body: ["GET", "HEAD", "DELETE", "TRACE", "OPTIONS", "CONNECT"].includes(
        c.req.method
      )
        ? null
        : await c.req.arrayBuffer(),
      headers: {
        ...(cookieStore.has(domain)
          ? {
              cookie: [c.req.header("cookie") ?? "", cookie]
                .filter(Boolean)
                .join("; ")
            }
          : {}),
        ...cleanHeaders(Object.fromEntries(c.req.raw.headers.entries()))
      }
    })

    console.log({ res_cookie: Object.fromEntries(res.headers.entries()) })
    if (!res.ok)
      return c.body(
        await res.arrayBuffer(),
        res.status as ContentfulStatusCode,
        {
          ...Object.fromEntries(res.headers.entries()),
          "Set-Cookie": res.headers.getSetCookie().join("; ")
        }
      )

    buffer = await res.arrayBuffer()
  }

  console.log({ res_cookie: Object.fromEntries(res.headers.entries()) })
  return c.body(buffer, res.status as ContentfulStatusCode, {
    ...Object.fromEntries(res.headers.entries()),
    "Set-Cookie": res.headers.getSetCookie().join("; ")
  })
})

Deno.serve(app.fetch)
