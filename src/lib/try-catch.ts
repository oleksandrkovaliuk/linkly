type TSuccess<T> = readonly [null, T];
type TFailure<E> = readonly [E, null];
type TResult<E, T> = TSuccess<T> | TFailure<E>;
type TResultAsync<E, T> = Promise<TResult<E, T>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tryCatch<E = Error, T = any>(
  operation: Promise<T>
): TResultAsync<E, T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tryCatch<E = Error, T = any>(operation: () => T): TResult<E, T>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tryCatch<E = Error, T = any>(
  operation: Promise<T> | (() => T)
) {
  if (operation instanceof Promise) {
    return operation
      .then((value: T) => [null, value] as const)
      .catch((error: E) => [error, null] as const);
  }

  try {
    const data = operation();
    return [null, data] as const;
  } catch (error) {
    return [error as E, null] as const;
  }
}
