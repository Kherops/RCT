export function stripMongoId<T extends { _id?: unknown }>(doc: T): Omit<T, '_id'> {
  const { _id: _ignored, ...rest } = doc;
  return rest as Omit<T, '_id'>;
}
