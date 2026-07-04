import { Router } from 'express';
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/taskController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { requirePlan } from '../middlewares/requirePlan.js';

const router = Router();

router.use(protect); // Secure all task routes
router.use(requirePlan(['basic', 'premium']));

router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;
