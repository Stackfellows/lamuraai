import mongoose from 'mongoose';

const financeSchema = new mongoose.Schema({
  type: { type: String, enum: ['Income', 'Expense'], required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Enterprise Database Optimization: Compound indexes for fast querying
financeSchema.index({ user: 1, date: -1 });
financeSchema.index({ user: 1, type: 1 });

export const Finance = mongoose.model('Finance', financeSchema);
