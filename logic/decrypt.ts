// deno-lint-ignore-file

import { slowAES } from "./aes.ts"

function toNumbers(d: string) {
  const e: number[] = []
  d.replace(/(..)/g, (d: string) => {
    e.push(parseInt(d, 16))
    return ""
  })
  return e
}
/**
 * Convert an array of numbers (0–255) to a lowercase hex string.
 * Example: [255, 16, 0] -> "ff1000"
 * You can pass numbers as separate arguments or as a single array.
 */
function toHex(numbers: number[]) {
  let hexString = ""

  for (let i = 0; i < numbers.length; i++) {
    const value = numbers[i]
    const hex = value < 16 ? "0" + value.toString(16) : value.toString(16)

    hexString += hex
  }

  return hexString.toLowerCase()
}

export function decrypt(html: string) {
  let [a, b, c] = html.match(/toNumbers\("([a-z0-9]+)"\)/g)!

  a = a.match(/toNumbers\("([a-z0-9]+)"\)/)![1]
  b = b.match(/toNumbers\("([a-z0-9]+)"\)/)![1]
  c = c.match(/toNumbers\("([a-z0-9]+)"\)/)![1]

  console.log({ a, b, c })

  return toHex(slowAES.decrypt(toNumbers(c), 2, toNumbers(a), toNumbers(b)))
}
