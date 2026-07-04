import { Router } from 'express';
import { chatWithAi, parseTask, parseFinance } from '../controllers/aiController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requirePlan } from '../middlewares/requirePlan.js';

const router = Router();

router.use(protect);
router.use(requirePlan(['premium']));
router.post('/chat', chatWithAi);
router.post('/parse-task', parseTask);
router.post('/parse-finance', parseFinance);

export default router;
