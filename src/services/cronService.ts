import cron from 'node-cron';
import { Task } from '../models/Task.js';
import { sendWhatsAppMessage, userSockets } from './whatsappService.js';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { processAutoResponder } from './emailCronService.js';

dotenv.config();

const sendTaskReminders = async () => {
  try {
    const usersWithWhatsApp = await User.find({ whatsappNumber: { $exists: true, $ne: null } });
    if (usersWithWhatsApp.length === 0) {
      console.log('cronService: No users with registered WhatsApp numbers found.');
      return;
    }

    for (const user of usersWithWhatsApp) {
      try {
        const userId = user._id.toString();
        const targetNumber = user.whatsappNumber as string;

        // Fetch pending and in-progress tasks for THIS user only
        const tasks = await Task.find({ 
          user: userId,
          status: { $in: ['Pending', 'In Progress'] } 
        }).sort({ priority: -1, dueDate: 1 });
        
        if (tasks.length === 0) {
          console.log(`cronService: No pending tasks for user ${userId}.`);
          continue;
        }

        // Construct the reminder message
        let message = `📅 *Daily Task Reminder for ${user.name || 'User'}*\n\n`;
        message += `You have ${tasks.length} task(s) requiring your attention:\n\n`;
        
        tasks.forEach((task, index) => {
          const priorityEmoji = task.priority === 'High' ? '🔴' : (task.priority === 'Medium' ? '🟡' : '🟢');
          const statusEmoji = task.status === 'In Progress' ? '⏳' : '📝';
          message += `${index + 1}. *${task.title}* ${priorityEmoji} ${statusEmoji}\n`;
          if (task.description) {
            message += `   _Details:_ ${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}\n`;
          }
          message += '\n';
        });
        
        message += 'Let\'s get things done! 💪';

        // Check if socket exists, otherwise we can't send
        if (userSockets.has(userId)) {
          await sendWhatsAppMessage(userId, targetNumber, message);
          console.log(`cronService: Task reminders sent to ${targetNumber} for user ${userId}`);
        } else {
          console.log(`cronService: Cannot send reminder for user ${userId}, WhatsApp socket not active.`);
        }
      } catch (err) {
        console.error(`cronService: Error sending reminder for user ${user._id}`, err);
      }
    }
  } catch (error) {
    console.error('cronService: Error in scheduled job:', error);
  }
};

export const initCronJobs = () => {
  // WhatsApp Reminders (Every hour between 9 AM and 6 PM Pakistan Time)
  cron.schedule('0 9-18 * * *', () => {
    console.log('cronService: Triggering scheduled task reminder...');
    sendTaskReminders();
  }, {
    timezone: "Asia/Karachi"
  });
  
  // Email Auto-Responder (Every 1 minute)
  // cron.schedule('* * * * *', () => {
  //   console.log('cronService: Triggering Email Auto-Responder...');
  //   processAutoResponder();
  // }, {
  //   timezone: "Asia/Karachi"
  // });

  console.log('Cron jobs initialized successfully.');
};
