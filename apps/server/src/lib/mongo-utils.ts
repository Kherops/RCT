export function stripMongoId<T extends Record<string, any>>(doc: T): Omit<T, '_id'> {
  const { _id: _ignored, ...rest } = doc;
  return rest as Omit<T, '_id'>;
}
