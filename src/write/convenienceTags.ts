export type ConvenienceBrand =
  'seven-eleven' | 'familymart' | 'lawson' | 'ministop' | 'other';

export interface BrandOption {
  value: ConvenienceBrand;
  label: string;
}

export const CONVENIENCE_BRANDS: readonly BrandOption[] = [
  { value: 'seven-eleven', label: 'セブン-イレブン' },
  { value: 'familymart', label: 'ファミリーマート' },
  { value: 'lawson', label: 'ローソン' },
  { value: 'ministop', label: 'ミニストップ' },
  { value: 'other', label: 'その他' },
];

const BRAND_TAGS: Record<
  Exclude<ConvenienceBrand, 'other'>,
  Record<string, string>
> = {
  'seven-eleven': {
    brand: '7-ELEVEN',
    'brand:en': '7-ELEVEN',
    'brand:ja': 'セブン-イレブン',
    'brand:wikidata': 'Q259340',
    name: 'セブン-イレブン',
    'name:en': '7-Eleven',
    'name:ja': 'セブン-イレブン',
    'official_name:en': 'Seven-Eleven',
  },
  familymart: {
    brand: 'FamilyMart',
    'brand:en': 'FamilyMart',
    'brand:ja': 'ファミリーマート',
    'brand:wikidata': 'Q11247682',
    name: 'ファミリーマート',
    'name:en': 'FamilyMart',
    'name:ja': 'ファミリーマート',
  },
  lawson: {
    brand: 'LAWSON',
    'brand:en': 'LAWSON',
    'brand:ja': 'ローソン',
    'brand:wikidata': 'Q1557223',
    name: 'ローソン',
    'name:en': 'Lawson',
    'name:ja': 'ローソン',
  },
  ministop: {
    brand: 'MINISTOP',
    'brand:en': 'MINISTOP',
    'brand:ja': 'ミニストップ',
    'brand:wikidata': 'Q1038929',
    name: 'ミニストップ',
    'name:en': 'Ministop',
    'name:ja': 'ミニストップ',
  },
};

export function convenienceTags(
  brand: ConvenienceBrand,
  storeName: string,
): Record<string, string> {
  if (brand === 'other') {
    const name = storeName.trim();
    return name ? { shop: 'convenience', name } : { shop: 'convenience' };
  }
  const tags = { shop: 'convenience', ...BRAND_TAGS[brand] };
  const name = storeName.trim();
  return name ? { ...tags, name, 'name:ja': name } : tags;
}
