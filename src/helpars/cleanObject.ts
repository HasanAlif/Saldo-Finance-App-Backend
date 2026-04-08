export const cleanObject = <T extends Record<string, any>>(
  obj: T,
): Partial<T> => {
  const cleaned: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== "") {
      cleaned[key as keyof T] = value;
    }
  }

  return cleaned;
};

export const filterOptionalFields = <T extends Record<string, any>>(
  fields: T,
): Partial<T> => cleanObject(fields);
