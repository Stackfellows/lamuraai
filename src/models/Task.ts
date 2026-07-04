import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
  dueDate: { type: Date },
  category: { type: String },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Enterprise Database Optimization: Compound indexes for fast querying
taskSchema.index({ user: 1, dueDate: 1 });
taskSchema.index({ user: 1, status: 1 });
taskSchema.index({ user: 1, category: 1 });

export const Task = mongoose.model('Task', taskSchema);
