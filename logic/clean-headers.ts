export function cleanHeaders(headers: Record<string, string>) {
  delete headers["host"]
  delete headers["via"]
  delete headers["traceparent"]
  delete headers["user-agent"]

  console.log(headers)

  return headers
}
