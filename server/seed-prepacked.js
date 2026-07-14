// Seed a starter "VerShip Pre-Packed Food Barrel" product + contents so the
// landing page renders before the owner customizes it in the admin panel.
// Idempotent: updates the existing seeded product instead of duplicating.
require('dotenv').config();
const db = require('./models');

// Full barrel manifest (quantities are baked into each product name, so the
// separate quantity column is left empty).
const CONTENTS = [
  { name: "Royal Sona Masoori 20lbs (Sam's Club)", quantity: '', icon: '🍚', sort_order: 1 },
  { name: "Gold Medal All Purpose Flour 12lbs (Sam's Club)", quantity: '', icon: '🌾', sort_order: 2 },
  { name: "Member's Mark G-Sugar 10lbs (Sam's Club)", quantity: '', icon: '🧂', sort_order: 3 },
  { name: "Member's Mark Canola Oil 6qts (Sam's Club)", quantity: '', icon: '🛢️', sort_order: 4 },
  { name: 'Del Monte Sweet Corn 8pk', quantity: '', icon: '🌽', sort_order: 5 },
  { name: 'Le Sueur Sweet Peas 8pk', quantity: '', icon: '🫛', sort_order: 6 },
  { name: "45 rolls Scott's Toilet Paper (Sam's Club)", quantity: '', icon: '🧻', sort_order: 7 },
  { name: 'Crest Pro Advanced 5pk (Sam\'s Club)', quantity: '', icon: '🪥', sort_order: 8 },
  { name: 'Irish Spring Bath Soap 20ct', quantity: '', icon: '🧼', sort_order: 9 },
  { name: 'Genuine Joe Paper Towel 24 rolls (Walmart)', quantity: '', icon: '🧻', sort_order: 10 },
  { name: 'Kraft Mac and Cheese 18ct (Costco)', quantity: '', icon: '🧀', sort_order: 11 },
  { name: 'Quaker Oats 42oz', quantity: '', icon: '🥣', sort_order: 12 },
  { name: 'Great Value Corned Beef (Walmart)', quantity: '', icon: '🥫', sort_order: 13 },
  { name: 'Bumble Bee Sardines in Water (Walmart)', quantity: '', icon: '🐟', sort_order: 14 },
  { name: "Starkist Tuna 12pk (Sam's Club)", quantity: '', icon: '🐟', sort_order: 15 },
  { name: 'Great Value Spaghetti 16oz (Walmart)', quantity: '', icon: '🍝', sort_order: 16 },
  { name: 'Great Value Light Red Kidney Beans 1lb (Walmart)', quantity: '', icon: '🫘', sort_order: 17 },
  { name: "Kellogg's Frosted Flakes 21oz", quantity: '', icon: '🥣', sort_order: 18 },
  { name: 'Swiss Miss Hot Chocolate 50ct (Costco)', quantity: '', icon: '☕', sort_order: 19 },
  { name: 'Always Ultra-Thin w/Wings 76ct (Walmart)', quantity: '', icon: '🧴', sort_order: 20 },
  { name: 'Ocean Spray Cranberry Juice 64oz (Walmart)', quantity: '', icon: '🧃', sort_order: 21 },
  { name: 'Trash Bags 13 gal 20ct (Walmart)', quantity: '', icon: '🗑️', sort_order: 22 },
  { name: 'Jif Peanut Butter', quantity: '', icon: '🥜', sort_order: 23 },
  { name: 'Great Value Grape Jelly 30oz (Walmart)', quantity: '', icon: '🍇', sort_order: 24 },
  { name: 'Armour Vienna Sausage 18ct (Costco)', quantity: '', icon: '🌭', sort_order: 25 },
  { name: 'Equate Toothbrush 6pk (Walmart)', quantity: '', icon: '🪥', sort_order: 26 },
  { name: 'Heinz Ketchup 44oz 3pk (Walmart)', quantity: '', icon: '🍅', sort_order: 27 },
  { name: 'Equate Mouthwash 500ml (Walmart)', quantity: '', icon: '🧴', sort_order: 28 },
  { name: 'Great Value BBQ Sauce 18oz (Walmart)', quantity: '', icon: '🍖', sort_order: 29 },
  { name: 'Great Value Mayonnaise 30oz (Walmart)', quantity: '', icon: '🫙', sort_order: 30 },
  { name: "Chef Boyardee Beef Ravioli 15oz 8pk (Sam's Club)", quantity: '', icon: '🥫', sort_order: 31 },
  { name: 'Hills Bros French Vanilla (Walmart)', quantity: '', icon: '☕', sort_order: 32 },
  { name: 'Great Value Condensed Milk (Walmart)', quantity: '', icon: '🥛', sort_order: 33 },
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
