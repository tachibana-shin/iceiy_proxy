// biome-ignore assist/source/organizeImports: <false>
import { Hono } from "hono"
import { etag } from "hono/etag"
import { logger } from "hono/logger"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { decrypt } from "./logic/decrypt.ts"
import { cleanHeaders, cleanHeadersResponse } from "./logic/clean-headers.ts"

const app = new Hono()

app.use(etag(), logger())

const cookieStore = new Map<string, { value: string; created: number }>()

app.all("/proxy/:protocol/:domain/*", async (c) => {
  const protocol = c.req.param("protocol")
  const domain = c.req.param("domain")

  const path = `/${c.req.path.split("/").slice(4).join("/")}`

  const url = new URL(path, `${protocol}://${domain}`)
  url.search = new URL(c.req.url).search
  url.searchParams.set("i", "1")

  console.log(`Request to URL: ${url}`)
  console.log(`Request method: ${c.req.method}`)

  const body = [
    "GET",
    "HEAD",
    "DELETE",
    "TRACE",
    "OPTIONS",
    "CONNECT"
  ].includes(c.req.method)
    ? null
    : await c.req.arrayBuffer()

  const cookie = cookieStore.get(
    `${protocol}://${domain}${c.req.raw.headers.get("cookie")}`
  )
  const client = Deno.createHttpClient({
    allowHost: true
  })
  let res = await fetch(url, {
    method: c.req.method,
    client,
    body,
    redirect: "manual",
    headers: {
      cookie: [
        c.req.header("cookie") ?? "",
        cookie && cookie.created + 21600 * 1e3 > Date.now() ? cookie.value : ""
      ]
        .filter(Boolean)
        .join("; "),
      ...cleanHeaders(
        Object.fromEntries(c.req.raw.headers.entries()),
        protocol,
        domain
      )
    }
  })

  if (!res.ok || res.status === 302)
    return c.body(
      await res.arrayBuffer(),
      res.status as ContentfulStatusCode,
      cleanHeadersResponse(
        Object.fromEntries(res.headers.entries()),
        protocol,
        domain
      )
    )

  let buffer = await res.arrayBuffer()
  let lastCookie: string = "",
    i = 0
  while (i++ < 6) {
    const text = new TextDecoder().decode(buffer)

    if (text.includes("aes.js")) {
      console.log("detecttttt")
      const cookie = `__test=${decrypt(text)}`
      console.log(cookie)
      cookieStore.set(
        `${protocol}://${domain}${c.req.raw.headers.get("cookie")}`,
        { value: cookie, created: Date.now() }
      )

      const client = Deno.createHttpClient({
        allowHost: true
      })
      res = await fetch(url, {
        method: c.req.method,
        client,
        body,
        redirect: "manual",
        headers: {
          cookie: [c.req.header("cookie") ?? "", lastCookie, cookie]
            .filter(Boolean)
            .join("; "),
          ...cleanHeaders(
            Object.fromEntries(c.req.raw.headers.entries()),
            protocol,
            domain
          )
        }
      })

      lastCookie = res.headers.getSetCookie().join("; ")

      buffer = await res.arrayBuffer()
      if (
        !new TextDecoder().decode(buffer).includes("aes.js") &&
        (!res.ok || res.status === 302)
      )
        return c.body(buffer, res.status as ContentfulStatusCode, {
          ...cleanHeadersResponse(
            Object.fromEntries(res.headers.entries()),
            protocol,
            domain
          ),
          "Set-Cookie": res.headers.getSetCookie().join("; ")
        })
    } else {
      break
    }
  }

  if (res.headers.get("content-type")?.includes("html")) {
    const html = await new TextDecoder().decode(buffer)

    return c.html(
      html
        .replace(/action="\//, `action="/proxy/${protocol}/${domain}/`)
        .replace(/href="\//, `href="/proxy/${protocol}/${domain}/`)
        .replace(/src="\//, `src="/proxy/${protocol}/${domain}/`)
    )
  }

  console.log(res)

  return c.body(buffer, res.status as ContentfulStatusCode, {
    ...cleanHeadersResponse(
      Object.fromEntries(res.headers.entries()),
      protocol,
      domain
    ),
    "Set-Cookie": res.headers.getSetCookie().join("; ")
  })
})

Deno.serve(app.fetch)
