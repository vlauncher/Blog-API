import slugify from "slugify";

export const generateSlug = (text: string): string => {
  return slugify(text, {
    lower: true,
    strict: true,
    trim: true,
    locale: "en",
  });
};

export const generateUniqueSlug = async (
  title: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> => {
  const baseSlug = generateSlug(title) || "post";
  let slug = baseSlug;
  let counter = 1;

  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};
