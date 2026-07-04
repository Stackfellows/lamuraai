import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  whatsappNumber: { type: String },
  financeCurrency: { type: String, default: 'PKR' },
  financeBudget: { type: Number, default: 5000 },
  emailAccount: { type: String },
  emailAppPassword: { type: String },
  emailAutoResponderEnabled: { type: Boolean, default: false },
  aiUsageType: { type: String, enum: ['business', 'personal'], default: 'personal' },
  aiTrainingData: { type: String, default: '' },
  plan: { type: String, enum: ['trial', 'basic', 'premium'], default: 'trial' },
  trialStartDate: { type: Date, default: Date.now },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
