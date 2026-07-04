import mongoose from 'mongoose';

const whatsappContactSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  jid: { type: String, required: true },
  number: { type: String, required: true },
  name: { type: String },
  lastMessageTime: { type: Number, required: true }
}, { timestamps: true });

// Ensure uniqueness per user and jid
whatsappContactSchema.index({ user: 1, jid: 1 }, { unique: true });

export const WhatsAppContact = mongoose.model('WhatsAppContact', whatsappContactSchema);
