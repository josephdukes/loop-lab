// Shared validation error: carries a list of plain-English problems for the form to show.
export class ValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(' '))
    this.name = 'ValidationError'
  }
}
