export function stripMongoId<T extends object>(doc: T & { _id?: unknown }): Omit<T, '_id'> {
  const { _id: _ignored, ...rest } = doc as Record<string, unknown>;
  return rest as Omit<T, '_id'>;
}