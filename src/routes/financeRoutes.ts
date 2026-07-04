import { Router } from 'express';
import { getTransactions, createTransaction, deleteTransaction, getSettings, updateSettings } from '../controllers/financeController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requirePlan } from '../middlewares/requirePlan.js';

const router = Router();

router.use(protect);
router.use(requirePlan(['basic', 'premium']));

router.get('/settings', getSettings);
router.put('/settings', updateSettings);

router.get('/', getTransactions);
router.post('/', createTransaction);
router.delete('/:id', deleteTransaction);

export default router;
