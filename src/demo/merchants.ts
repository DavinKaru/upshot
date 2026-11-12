/**
 * Made-up merchants for demo data. Every name here is invented, so screenshots and bug reports
 * taken in demo mode can't be traced back to a real business or person.
 */

export interface MerchantPattern {
  /** Child category ID. */
  category: string;
  names: readonly string[];
  /** Typical spend per purchase, in dollars. */
  amount: readonly [min: number, max: number];
  /** Average purchases per week. Fractions mean "sometimes". */
  perWeek: number;
  /** Text Up would show for how it was paid. */
  transactionType?: string;
}

export const MERCHANT_PATTERNS: readonly MerchantPattern[] = [
  {
    category: 'restaurants-and-cafes',
    names: ['Bean There Espresso', 'Little Fern Café', 'Oak & Ember Kitchen', 'The Morning Tram'],
    amount: [4.5, 38],
    perWeek: 5,
  },
  {
    category: 'takeaway',
    names: ['Noodle Lantern', 'Pizza Orbit', 'Burrito Junction', 'Golden Wok Express'],
    amount: [14, 42],
    perWeek: 1.4,
  },
  {
    category: 'pubs-and-bars',
    names: ['The Rusty Anchor', 'Laneway Social', 'Hop & Barrel'],
    amount: [9, 64],
    perWeek: 0.8,
  },
  {
    category: 'events-and-gigs',
    names: ['Riverside Live Tickets', 'Starlight Cinemas'],
    amount: [18, 120],
    perWeek: 0.25,
  },
  {
    category: 'hobbies',
    names: ['Pixel Forge Games', 'Thread & Needle Supplies'],
    amount: [12, 90],
    perWeek: 0.3,
  },
  {
    category: 'groceries',
    names: ['Freshway Market', 'Corner Pantry', 'GreenLeaf Grocers', 'Harbour Butcher'],
    amount: [18, 165],
    perWeek: 2.2,
  },
  {
    category: 'homeware-and-appliances',
    names: ['Nest & Nook Homewares', 'Brightline Appliances'],
    amount: [15, 240],
    perWeek: 0.2,
  },
  { category: 'pets', names: ['Paws Pantry'], amount: [22, 85], perWeek: 0.35 },
  {
    category: 'clothing-and-accessories',
    names: ['Threadline Apparel', 'Sole Society Shoes', 'Wrenfield Outfitters'],
    amount: [25, 180],
    perWeek: 0.4,
  },
  {
    category: 'health-and-medical',
    names: ['Wellspring Pharmacy', 'Bayview Medical Centre'],
    amount: [9, 95],
    perWeek: 0.35,
  },
  { category: 'hair-and-beauty', names: ['Shear Bliss Studio'], amount: [35, 95], perWeek: 0.2 },
  {
    category: 'gifts-and-charity',
    names: ['Paper Crane Gifts', 'Kindred Animal Rescue'],
    amount: [10, 80],
    perWeek: 0.2,
  },
  {
    category: 'technology',
    names: ['Circuit City Electronics'],
    amount: [20, 160],
    perWeek: 0.1,
  },
  {
    category: 'public-transport',
    names: ['Metro Travel Card'],
    amount: [4.6, 50],
    perWeek: 3.5,
    transactionType: 'Purchase',
  },
  {
    category: 'taxis-and-share-cars',
    names: ['ZipRide', 'CityShare Cars'],
    amount: [11, 46],
    perWeek: 0.6,
  },
  {
    category: 'fuel',
    names: ['Southern Cross Fuel'],
    amount: [45, 95],
    perWeek: 0.3,
  },
  { category: 'parking', names: ['ParkSmart Bays'], amount: [6, 28], perWeek: 0.3 },
];

/** Bills that arrive on a fixed day each month. */
export interface MonthlyBill {
  category: string;
  name: string;
  day: number;
  amount: readonly [min: number, max: number];
  transactionType: string;
}

export const MONTHLY_BILLS: readonly MonthlyBill[] = [
  {
    category: 'rent-and-mortgage',
    name: 'Harbourview Property Group',
    day: 1,
    amount: [2340, 2340],
    transactionType: 'Direct Debit',
  },
  {
    category: 'utilities',
    name: 'Brightspark Energy',
    day: 12,
    amount: [96, 188],
    transactionType: 'Direct Debit',
  },
  {
    category: 'internet',
    name: 'Fibrewave Internet',
    day: 18,
    amount: [79, 79],
    transactionType: 'Direct Debit',
  },
  {
    category: 'mobile-phone',
    name: 'Cloudnine Mobile',
    day: 22,
    amount: [35, 35],
    transactionType: 'Direct Debit',
  },
  {
    category: 'tv-and-music',
    name: 'Streamly',
    day: 5,
    amount: [17.99, 17.99],
    transactionType: 'Purchase',
  },
  {
    category: 'fitness-and-wellbeing',
    name: 'Peak Form Gym',
    day: 9,
    amount: [64, 64],
    transactionType: 'Direct Debit',
  },
];

export const EMPLOYER = 'Northwind Studio Payroll';
