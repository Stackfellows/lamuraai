import { Router } from 'express';
import { getSettings, updateSettings, sendEmail, getInbox } from '../controllers/emailController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(protect);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/send', sendEmail);
router.get('/inbox', getInbox);

export default router;
