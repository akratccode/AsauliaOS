import type messages from '../messages/en.json';

declare global {
  // next-intl infers the shape of all message keys from this interface.
  // Canonical source: messages/en.json (mirrored in messages/es.json).
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Omit<typeof messages, never> {}
}

export {};
