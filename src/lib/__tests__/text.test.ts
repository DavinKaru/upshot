import { splitLeadingEmoji } from '../text';

describe('splitLeadingEmoji', () => {
  it('splits an emoji from the start of a name', () => {
    expect(splitLeadingEmoji('🗾 Japan Trip')).toEqual({ emoji: '🗾', label: 'Japan Trip' });
    expect(splitLeadingEmoji('🌧️ Rainy Day')).toEqual({ emoji: '🌧️', label: 'Rainy Day' });
  });

  it('leaves names without a leading emoji alone', () => {
    expect(splitLeadingEmoji('Holiday fund')).toEqual({ emoji: null, label: 'Holiday fund' });
    expect(splitLeadingEmoji('Café savings')).toEqual({ emoji: null, label: 'Café savings' });
    expect(splitLeadingEmoji('Bills')).toEqual({ emoji: null, label: 'Bills' });
  });
});
