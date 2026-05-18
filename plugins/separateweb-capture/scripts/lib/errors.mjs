export const fail = (message, code = 1) => {
  console.error(`Error: ${message}`)
  process.exit(code)
}
