export function cleanHeaders(headers: Record<string, string>) {
  delete headers["host"]

  console.log(headers)

  return headers
}
