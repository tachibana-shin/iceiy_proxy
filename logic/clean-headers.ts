export function cleanHeaders(headers: Record<string, string>) {
  delete headers["host"]
  delete headers["via"]

  console.log(headers)

  return headers
}
