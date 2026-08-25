type LegacyImage = {
  keyword: string;
  imageUrl: string;
};

export type ClassTypeImageCandidate = {
  name: string;
  imageUrl?: string | null;
};

type ImageAwareClass = {
  title: string;
  imageUrl?: string | null;
  classType?: {
    name: string;
    imageUrl?: string | null;
  } | null;
};

export function normalizeClassImageKeyword(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function keywordAliases(value: string) {
  const normalized = normalizeClassImageKeyword(value);
  const aliases = new Set([normalized]);
  if (normalized === "functional" || normalized === "entrenamiento funcional") {
    aliases.add("functional");
    aliases.add("entrenamiento funcional");
  }
  return [...aliases].filter(Boolean);
}

type NamedImage = {
  keyword: string;
  imageUrl?: string | null;
};

type RankedImage = {
  imageUrl: string;
  exact: number;
  wordCount: number;
  keywordLength: number;
  canonical: number;
};

function hasWholePhrase(title: string, keyword: string) {
  return title === keyword || ` ${title} `.includes(` ${keyword} `);
}

function compareRank(left: RankedImage, right: RankedImage) {
  return right.exact - left.exact
    || right.wordCount - left.wordCount
    || right.keywordLength - left.keywordLength
    || right.canonical - left.canonical;
}

function hasSameRank(left: RankedImage, right: RankedImage) {
  return left.exact === right.exact
    && left.wordCount === right.wordCount
    && left.keywordLength === right.keywordLength
    && left.canonical === right.canonical;
}

/**
 * Matches complete normalized words/phrases only. Exact matches win, followed by
 * the longest phrase; equally ranked candidates with different images are ignored.
 */
function bestNamedImageForTitle(title: string, images: NamedImage[]) {
  const normalizedTitle = normalizeClassImageKeyword(title);
  if (!normalizedTitle) return null;

  const matches = images.flatMap<RankedImage>((image) => {
    if (!image.imageUrl) return [];
    const canonicalKeyword = normalizeClassImageKeyword(image.keyword);
    if (!canonicalKeyword || canonicalKeyword === "general") return [];

    return keywordAliases(image.keyword).flatMap((keyword) => {
      if (keyword === "general" || !hasWholePhrase(normalizedTitle, keyword)) return [];
      return [{
        imageUrl: image.imageUrl!,
        exact: Number(normalizedTitle === keyword),
        wordCount: keyword.split(" ").length,
        keywordLength: keyword.length,
        canonical: Number(keyword === canonicalKeyword)
      }];
    });
  }).sort(compareRank);

  const best = matches[0];
  if (!best) return null;
  const topImages = new Set(matches.filter((match) => hasSameRank(match, best)).map((match) => match.imageUrl));
  return topImages.size === 1 ? best.imageUrl : null;
}

function classTypeImageForTitle(title: string, classTypeImages: ClassTypeImageCandidate[]) {
  return bestNamedImageForTitle(title, classTypeImages.map((classType) => ({
    keyword: classType.name,
    imageUrl: classType.imageUrl
  })));
}

function legacyImageForClass(gymClass: ImageAwareClass, imageBank: LegacyImage[]) {
  return bestNamedImageForTitle(gymClass.title, imageBank)
    ?? bestNamedImageForTitle(gymClass.classType?.name ?? "", imageBank)
    ?? imageBank.find((image) => normalizeClassImageKeyword(image.keyword) === "general")?.imageUrl
    ?? null;
}

/**
 * Resolves the image shown by clients without mutating the per-class override.
 * Precedence: class override -> assigned class-type image -> best named
 * class-type title match -> legacy image bank.
 */
export function effectiveClassImage(
  gymClass: ImageAwareClass,
  classTypeImages: ClassTypeImageCandidate[],
  imageBank: LegacyImage[]
) {
  return gymClass.imageUrl
    ?? gymClass.classType?.imageUrl
    ?? classTypeImageForTitle(gymClass.title, classTypeImages)
    ?? legacyImageForClass(gymClass, imageBank);
}
