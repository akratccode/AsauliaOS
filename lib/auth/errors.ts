export class Unauthorized extends Error {
  readonly status = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'Unauthorized';
  }
}

export class Forbidden extends Error {
  readonly status = 403;
  constructor(message = 'You do not have access to this resource') {
    super(message);
    this.name = 'Forbidden';
  }
}
