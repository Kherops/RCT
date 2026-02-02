export function stripMongoId<T extends object>(
  doc: T,
): Omit<T, "_id"> {
  const { _id: _ignored, ...rest } = doc as T & { _id?: unknown };
  return rest as Omit<T, "_id">;
}
