// export function stripMongoId<T extends { _id?: unknown }>(doc: T): Omit<T, '_id'>;
// export function stripMongoId<T extends object>(doc: T): T;
export function stripMongoId<T extends object>(doc: T): T {
  const { _id: _ignored, ...rest } = doc as { _id?: unknown } & Record<string, unknown>;
  return rest as T;
}
