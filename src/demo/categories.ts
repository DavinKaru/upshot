import type { CategoryResource } from '@/api/up/types';

/**
 * The category tree used for demo data. The IDs follow the same human-readable style as Up's
 * categories, so code written against demo data works the same way with real data.
 */
export const CATEGORY_TREE: Record<string, { name: string; children: Record<string, string> }> = {
  'good-life': {
    name: 'Good Life',
    children: {
      'restaurants-and-cafes': 'Restaurants & Cafes',
      takeaway: 'Takeaway',
      'pubs-and-bars': 'Pubs & Bars',
      'events-and-gigs': 'Events & Gigs',
      hobbies: 'Hobbies',
      'tv-and-music': 'TV, Music & Streaming',
      'holidays-and-travel': 'Holidays & Travel',
    },
  },
  home: {
    name: 'Home',
    children: {
      groceries: 'Groceries',
      'rent-and-mortgage': 'Rent & Mortgage',
      utilities: 'Utilities',
      internet: 'Internet',
      'homeware-and-appliances': 'Homeware & Appliances',
      pets: 'Pets',
    },
  },
  personal: {
    name: 'Personal',
    children: {
      'clothing-and-accessories': 'Clothing & Accessories',
      'fitness-and-wellbeing': 'Fitness & Wellbeing',
      'health-and-medical': 'Health & Medical',
      'hair-and-beauty': 'Hair & Beauty',
      'gifts-and-charity': 'Gifts & Charity',
      'mobile-phone': 'Mobile Phone',
      technology: 'Technology',
    },
  },
  transport: {
    name: 'Transport',
    children: {
      'public-transport': 'Public Transport',
      fuel: 'Fuel',
      'taxis-and-share-cars': 'Taxis & Share Cars',
      parking: 'Parking',
      'car-insurance-and-maintenance': 'Car Insurance & Maintenance',
    },
  },
};

const categoryLink = (id: string) => `https://api.up.com.au/api/v1/categories/${id}`;

/** Builds the tree as Up's API returns it: one flat list with parent and child links. */
export function buildCategories(): CategoryResource[] {
  const resources: CategoryResource[] = [];
  for (const [parentId, parent] of Object.entries(CATEGORY_TREE)) {
    resources.push({
      type: 'categories',
      id: parentId,
      attributes: { name: parent.name },
      relationships: {
        parent: { data: null },
        children: {
          data: Object.keys(parent.children).map((id) => ({ type: 'categories', id })),
        },
      },
      links: { self: categoryLink(parentId) },
    });
    for (const [childId, childName] of Object.entries(parent.children)) {
      resources.push({
        type: 'categories',
        id: childId,
        attributes: { name: childName },
        relationships: {
          parent: { data: { type: 'categories', id: parentId } },
          children: { data: [] },
        },
        links: { self: categoryLink(childId) },
      });
    }
  }
  return resources;
}

/** Child category ID to parent category ID. */
export function parentOf(childId: string): string {
  for (const [parentId, parent] of Object.entries(CATEGORY_TREE)) {
    if (childId in parent.children) return parentId;
  }
  throw new Error(`Unknown category ${childId}`);
}
