import { Router } from 'express';
import { register, login, getMe, updateAiSettings, upgradePlan, cancelPlan } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect as any, getMe);
router.put('/ai-settings', protect as any, updateAiSettings);
router.post('/upgrade-plan', protect as any, upgradePlan);
router.post('/cancel-plan', protect as any, cancelPlan);

export default router;
