import { ImapFlow } from 'imapflow';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './src/models/User.js';

dotenv.config();

async function testImap() {
  await mongoose.connect(process.env.MONGO_URI as string);
  
  const user = await User.findOne({ emailAccount: 'devasad0278@gmail.com' });
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }

  console.log(`Connecting to IMAP for ${user.emailAccount}`);
  
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: user.emailAccount,
      pass: user.emailAppPassword
    },
    logger: false as any
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');

  try {
    const unseenUids = await client.search({ seen: false });
    console.log('Unseen UIDs:', unseenUids);
    
    if (unseenUids.length > 0) {
      const searchIterator = client.fetch(unseenUids, { envelope: true, uid: true });
      for await (const message of searchIterator) {
        console.log(`UID: ${message.uid}, Subject: ${message.envelope.subject}`);
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();
  mongoose.disconnect();
}

testImap().catch(console.error);
