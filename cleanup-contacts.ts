import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function cleanup() {
  await mongoose.connect(process.env.MONGO_URI as string);
  const { WhatsAppContact } = await import('./src/models/WhatsAppContact.js');
  const res = await WhatsAppContact.deleteMany({
    $or: [
      { jid: /@g\.us$/ },
      { jid: /status@broadcast/ },
      { jid: /@broadcast$/ },
      { jid: /@newsletter$/ },
      { jid: { $regex: '^.{21,}$' } }
    ]
  });
  console.log('Deleted bad contacts:', res);
  process.exit(0);
}

cleanup().catch(console.error);
