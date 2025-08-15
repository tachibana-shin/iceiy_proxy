export function cleanHeaders(headers: Record<string, string>, protocol: string, domain: string) {
  delete headers["host"]
  delete headers["via"]
  delete headers["traceparent"]
  delete headers["user-agent"]

  headers["host"] = domain
  headers["origin"] = `${protocol}://${domain}`
  headers["referer"] = `${protocol}://${domain}`

  return headers
}

export function cleanHeadersResponse(
  headers: Record<string, string>,
  protocol: string,
  domain: string
) {
  if (headers.location) {
    console.log("location = ", headers.location)
    headers.location = new URL(headers.location, `${protocol}://${domain}`)
      .toString()
      .replace(`${protocol}://${domain}`, `/proxy/${protocol}/${domain}`)
  }

  return headers
}
