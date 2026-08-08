import { describe, expect, it } from 'vitest';
import { convenienceTags } from './convenienceTags';

describe('convenienceTags', () => {
  it.each([
    ['seven-eleven', '7-ELEVEN', 'Q259340', 'セブン-イレブン'],
    ['familymart', 'FamilyMart', 'Q11247682', 'ファミリーマート'],
    ['lawson', 'LAWSON', 'Q1557223', 'ローソン'],
    ['ministop', 'MINISTOP', 'Q1038929', 'ミニストップ'],
  ] as const)(
    '%sへ日本向けNSIタグを設定する',
    (brand, name, wikidata, japanese) => {
      expect(convenienceTags(brand, '')).toMatchObject({
        shop: 'convenience',
        brand: name,
        'brand:wikidata': wikidata,
        name: japanese,
        'name:ja': japanese,
      });
    },
  );

  it('その他は入力名と共通タグだけを設定する', () => {
    expect(convenienceTags('other', '  個人商店  ')).toEqual({
      shop: 'convenience',
      name: '個人商店',
    });
  });
});
