declare global {
  // Node18+ has fetch in global scope; kept here for TS.
  // eslint-disable-next-line no-var
  var fetch: typeof fetch;
}

export {};
