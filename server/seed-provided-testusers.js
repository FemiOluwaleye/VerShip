// Local-only seed for happy-path testing with the credentials the user provided.
// Creates the personal + freight-forwarder test accounts in the dev DB so login works.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./models');

async function ensureUser({ email, password, role, firstName, lastName }) {
  const hash = await bcrypt.hash(password, 10);
  const base = {
    role, firstName, lastName, email,
    countryCode: '+1', phoneNumber: '5550' + role + '0199',
    password: hash,
    isProfileComplete: '1', otpVerify: '1', status: '1',
    profile_step: 6,
    loginTime: 1000000 + Number(role),
  };
  let user = await db.users.findOne({ where: { email }, paranoid: false });
  if (user) {
    await user.update({ ...base, deletedAt: null });
  } else {
    user = await db.users.create(base);
  }
  return user;
}

(async () => {
  try {
    await db.sequelize.authenticate();
    const u = await ensureUser({ email: 'dejoun.green@vershipgo.com', password: '@Pilleur876', role: '1', firstName: 'Dejoun', lastName: 'Green' });
    const p = await ensureUser({ email: 'dejoungreen@gmail.com', password: '@Testing876', role: '2', firstName: 'Dejoun', lastName: 'Green' });
    console.log('Seeded personal id', u.id, '/ FF id', p.id);
    process.exit(0);
  } catch (e) {
    console.error('SEED FAILED:', e);
    process.exit(1);
  }
})();
