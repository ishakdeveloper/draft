import type { ListingContent } from "@draft/shared";

/** Shopify's translatable product keys and the listing field each one comes from. */
const KEY_TO_FIELD: Record<string, keyof ListingContent> = {
  title: "title",
  body_html: "description_html",
  meta_title: "seo_title",
  meta_description: "seo_description",
};

export interface TranslatableContent {
  key: string;
  digest: string | null;
}

export interface TranslationInput {
  locale: string;
  key: string;
  value: string;
  translatableContentDigest: string;
}

/**
 * Build translationsRegister inputs. Shopify needs the digest of the current source value for
 * each key, and only accepts locales the shop has enabled; the rest are reported as skipped.
 */
export function buildTranslationInputs(
  translations: Record<string, ListingContent>,
  translatable: readonly TranslatableContent[],
  enabledLocales: readonly string[],
): { inputs: TranslationInput[]; skippedLocales: string[] } {
  const inputs: TranslationInput[] = [];
  const skippedLocales: string[] = [];
  for (const [locale, content] of Object.entries(translations)) {
    if (!enabledLocales.includes(locale)) {
      skippedLocales.push(locale);
      continue;
    }
    for (const item of translatable) {
      const field = KEY_TO_FIELD[item.key];
      if (!field || !item.digest) continue;
      inputs.push({
        locale,
        key: item.key,
        value: content[field] as string,
        translatableContentDigest: item.digest,
      });
    }
  }
  return { inputs, skippedLocales: skippedLocales.toSorted() };
}

export const TRANSLATABLE_QUERY = /* GraphQL */ `
  query DraftTranslatable($id: ID!) {
    shopLocales {
      locale
    }
    translatableResource(resourceId: $id) {
      translatableContent {
        key
        digest
      }
    }
  }
`;

export const TRANSLATIONS_REGISTER = /* GraphQL */ `
  mutation DraftTranslations($id: ID!, $translations: [TranslationInput!]!) {
    translationsRegister(resourceId: $id, translations: $translations) {
      translations {
        key
        locale
      }
      userErrors {
        field
        message
      }
    }
  }
`;
