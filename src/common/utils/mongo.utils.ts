/**
 * Serializes a single MongoDB document (or plain object from lean())
 * to a plain object with 'id' instead of '_id'.
 */
export function serializeMongo<T>(doc: any): T {
  if (!doc) return doc;

  // If it's a Mongoose document, convert to plain object
  const obj = doc.toObject ? doc.toObject() : { ...doc };

  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }

  if (obj.__v !== undefined) {
    delete obj.__v;
  }

  return obj as T;
}

/**
 * Serializes an array of MongoDB documents (or plain objects from lean())
 */
export function serializeMongoArray<T>(docs: any[]): T[] {
  return docs.map((doc) => serializeMongo<T>(doc));
}
