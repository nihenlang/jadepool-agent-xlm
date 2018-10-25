
export default class NBError extends Error {
  public code: number
  public date: Date

  constructor (code: number, ...params: any) {
    super(...params)

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NBError)
    }

    // Custom debugging information
    this.code = code
    this.date = new Date()
  }
}
