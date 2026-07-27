// Seed a starter "VerShip Pre-Packed Food Barrel" product + contents so the
// landing page renders before the owner customizes it in the admin panel.
// Idempotent: updates the existing seeded product instead of duplicating.
require('dotenv').config();
const db = require('./models');

// Full barrel manifest. `quantity` holds the count/size descriptor shown on the
// right side of each list row (e.g. "8ct · 15oz"); `name` is the clean product
// name shown on the left. The page renders these as an even two-column grid.
const CONTENTS = [
  { name: 'Basmati Rice', quantity: '40lbs', icon: '🍚', category: 'Food', sort_order: 1 },
  { name: 'Toilet Paper', quantity: '18ct', icon: '🧻', category: 'Household Items', sort_order: 2 },
  { name: 'All Purpose Flour', quantity: '20lbs', icon: '🌾', category: 'Food', sort_order: 3 },
  { name: 'Colgate Toothpaste', quantity: '5ct', icon: '🪥', category: 'Personal Care', sort_order: 4 },
  { name: 'Granulated Sugar', quantity: '10lbs', icon: '🧂', category: 'Food', sort_order: 5 },
  { name: 'Irish Spring Bath Soap', quantity: '10ct', icon: '🧼', category: 'Personal Care', sort_order: 6 },
  { name: 'Yellow Cornmeal', quantity: '5lbs', icon: '🌽', category: 'Food', sort_order: 7 },
  { name: 'Paper Towel', quantity: '4ct', icon: '🧻', category: 'Household Items', sort_order: 8 },
  { name: 'Gallon Canola Cooking Oil', quantity: '2ct', icon: '🛢️', category: 'Food', sort_order: 9 },
  { name: 'Always Ultra-Thin w/Wings', quantity: '32ct', icon: '🧴', category: 'Personal Care', sort_order: 10 },
  { name: 'Whole Kernel Sweet Corn', quantity: '12ct', icon: '🌽', category: 'Food', sort_order: 11 },
  { name: 'Adult Toothbrush', quantity: '6ct', icon: '🪥', category: 'Personal Care', sort_order: 12 },
  { name: 'Sweet Green Peas', quantity: '12ct', icon: '🫛', category: 'Food', sort_order: 13 },
  { name: 'Equate Mouthwash', quantity: '2ct · 500ml', icon: '🧴', category: 'Personal Care', sort_order: 14 },
  { name: 'Corned Beef', quantity: '6ct', icon: '🥫', category: 'Food', sort_order: 15 },
  { name: 'Trash Bag', quantity: '20ct · 13 gal', icon: '🗑️', category: 'Household Items', sort_order: 16 },
  { name: 'Sardines', quantity: '12ct', icon: '🐟', category: 'Food', sort_order: 17 },
  { name: 'Instant Oats (Quaker)', quantity: '1ct · 42oz', icon: '🥣', category: 'Food', sort_order: 18 },
  { name: 'Tuna', quantity: '12ct', icon: '🐟', category: 'Food', sort_order: 19 },
  { name: 'Mac and Cheese', quantity: '12ct · 15oz', icon: '🧀', category: 'Food', sort_order: 20 },
  { name: 'Chicken Vienna Sausage', quantity: '12ct', icon: '🌭', category: 'Food', sort_order: 21 },
  { name: 'Spaghetti', quantity: '8ct', icon: '🍝', category: 'Food', sort_order: 22 },
  { name: 'Chef Boyardee Beef Ravioli', quantity: '8ct · 15oz', icon: '🥫', category: 'Food', sort_order: 23 },
  { name: 'Light Red Kidney Beans', quantity: '3ct · 1lb', icon: '🫘', category: 'Food', sort_order: 24 },
  { name: 'Condensed Milk', quantity: '8ct', icon: '🥛', category: 'Food', sort_order: 25 },
  { name: "Kellogg's Frosted Flakes", quantity: '1ct · 21.07oz', icon: '🥣', category: 'Food', sort_order: 26 },
  { name: 'Evaporated Milk', quantity: '8ct', icon: '🥛', category: 'Food', sort_order: 27 },
  { name: 'Creamy Peanut Butter', quantity: '2ct · 16oz', icon: '🥜', category: 'Food', sort_order: 28 },
  { name: 'Ocean Spray Cranberry Juice', quantity: '2ct · 64oz', icon: '🧃', category: 'Food', sort_order: 29 },
  { name: 'Grape Jelly', quantity: '2ct · 18oz', icon: '🍇', category: 'Food', sort_order: 30 },
  { name: 'Swiss Miss Hot Chocolate', quantity: '20ct', icon: '☕', category: 'Food', sort_order: 31 },
  { name: 'BBQ Sauce', quantity: '3ct · 18oz', icon: '🍖', category: 'Food', sort_order: 32 },
  { name: 'Heinz Ketchup', quantity: '3ct · 44oz', icon: '🍅', category: 'Food', sort_order: 33 },
  { name: 'Mayonnaise', quantity: '2ct · 15oz', icon: '🫙', category: 'Food', sort_order: 34 },
];

(async () => {
  try {
    await db.sequelize.authenticate();
    // index.js fires sync() un-awaited; wait for it here so the new tables exist
    // before we query. alter:false → creates missing tables, no-ops existing ones.
    await db.sequelize.sync({ alter: false });

    // `compareAtPrice` was added after the table shipped; alter:false won't add a
    // column to an existing table, so add it idempotently before we write to it.
    await db.sequelize.query(
      'ALTER TABLE prepacked_barrel ADD COLUMN IF NOT EXISTS "compareAtPrice" VARCHAR(255) DEFAULT \'\''
    );
    // Same story for the contents' grouping column (see migrate-barrel-categories.js).
    await db.sequelize.query(
      "ALTER TABLE prepacked_barrel_items ADD COLUMN IF NOT EXISTS category VARCHAR(255) NOT NULL DEFAULT 'Food'"
    );

    const productBase = {
      name: 'Packed with love. Filled with care. Delivered by VerShip.',
      tagline: '',
      description: 'Order in seconds. Countless hours saved.',
      image: '/images/barrel-animation-v3.mp4',
      price: '899',
      // Regular price shown struck-through beside the $899 promo. Set this to the
      // "was" amount (must be above 899). Left empty until confirmed → no strike.
      compareAtPrice: '',
      currency: 'USD',
      transitTime: '14 days',
      status: '1',
      // The canonical barrel must be featured so it's the one the public page shows.
      featured: true,
    };

    // Idempotent match that survives renames: try the current name, then the
    // original seeded name, then fall back to the oldest row. Without this, a
    // name change would insert a duplicate instead of updating the canonical row.
    const LEGACY_NAME = 'VerShip Pre-Packed Food Barrel';
    let product =
      (await db.prepacked_barrel.findOne({ where: { name: productBase.name }, paranoid: false })) ||
      (await db.prepacked_barrel.findOne({ where: { name: LEGACY_NAME }, paranoid: false })) ||
      (await db.prepacked_barrel.findOne({ order: [['id', 'ASC']], paranoid: false }));
    if (product) {
      await product.update({ ...productBase, deletedAt: null });
    } else {
      product = await db.prepacked_barrel.create(productBase);
    }

    // Replace contents (parent-replaces-children)
    await db.prepacked_barrel_items.destroy({ where: { prepacked_barrel_id: product.id }, force: true });
    for (const c of CONTENTS) {
      await db.prepacked_barrel_items.create({ ...c, prepacked_barrel_id: product.id });
    }

    console.log(`Seeded pre-packed barrel product id=${product.id} with ${CONTENTS.length} content items @ $${productBase.price}`);
    process.exit(0);
  } catch (e) {
    console.error('SEED PREPACKED FAILED:', e);
    process.exit(1);
  }
})();
