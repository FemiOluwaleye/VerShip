// Seed a starter "VerShip Pre-Packed Food Barrel" product + contents so the
// landing page renders before the owner customizes it in the admin panel.
// Idempotent: updates the existing seeded product instead of duplicating.
require('dotenv').config();
const db = require('./models');

const CONTENTS = [
  { name: 'Rice (10 lb)', quantity: '2', icon: '🍚', sort_order: 1 },
  { name: 'Flour (5 lb)', quantity: '2', icon: '🌾', sort_order: 2 },
  { name: 'Cooking Oil (1 gal)', quantity: '1', icon: '🛢️', sort_order: 3 },
  { name: 'Canned Mackerel', quantity: '6', icon: '🐟', sort_order: 4 },
  { name: 'Corned Beef', quantity: '6', icon: '🥫', sort_order: 5 },
  { name: 'Sugar (4 lb)', quantity: '2', icon: '🧂', sort_order: 6 },
  { name: 'Milk Powder', quantity: '2', icon: '🥛', sort_order: 7 },
  { name: 'Cornmeal', quantity: '2', icon: '🌽', sort_order: 8 },
  { name: 'Dried Peas / Beans', quantity: '3', icon: '🫘', sort_order: 9 },
  { name: 'Seasonings & Spices set', quantity: '1', icon: '🧑‍🍳', sort_order: 10 },
];

(async () => {
  try {
    await db.sequelize.authenticate();
    // index.js fires sync() un-awaited; wait for it here so the new tables exist
    // before we query. alter:false → creates missing tables, no-ops existing ones.
    await db.sequelize.sync({ alter: false });

    const productBase = {
      name: 'VerShip Pre-Packed Food Barrel',
      tagline: 'A barrel of essentials, packed and shipped to your family in Jamaica.',
      description:
        'Skip the shopping. We pack a full barrel of staple foods and ship it door-to-door to Jamaica. One price, no haggling, no forwarders to compare — just order and we handle the rest.',
      image: '',
      price: '299',
      currency: 'USD',
      transitTime: '14-21 days',
      status: '1',
    };

    let product = await db.prepacked_barrel.findOne({ where: { name: productBase.name }, paranoid: false });
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
