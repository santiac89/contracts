export function tryCatch(promise: Promise<any>) {
  promise
    .then(() => process.exit(0))
    .catch((error: any) => {
      console.error(error)
      process.exit(1)
    })
}
