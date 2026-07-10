import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const chatWithAi = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { message, history } = req.body;
  
  if (!message || message.length > 1000) {
    return next(new AppError('Message is required and must be under 1000 characters', 400));
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return next(new AppError('AI API key not configured', 500));
  }

  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant for a management dashboard. Keep your answers concise and useful.' },
    ...(Array.isArray(history) ? history.slice(-5) : []), // limit history to last 5
    { role: 'user', content: message }
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages,
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new AppError(data.error?.message || 'Failed to fetch AI response', response.status);
  }

  res.json({ reply: data.choices[0].message.content });
});

export const parseTask = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { prompt } = req.body;
  
  if (!prompt || prompt.length > 500) {
    return next(new AppError('Prompt is required and must be under 500 characters', 400));
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return next(new AppError('AI API key not configured', 500));
  }

  const today = new Date().toISOString().split('T')[0];
  
  const systemPrompt = `You are an intelligent task parsing assistant. 
Your goal is to extract task details from the user's natural language input (which could be in English or Roman Urdu).
You MUST output ONLY valid JSON format, with absolutely no markdown wrapping, no explanation, no backticks.
The JSON must strictly match this structure:
{
  "title": "String, a clear and concise task title",
  "description": "String, any extra details or context, leave empty string if none",
  "priority": "String, must be exactly one of: 'Low', 'Medium', 'High'. Default to 'Medium' if not specified, but infer 'High' for urgent words like urgent, jaldi, fast, asap, zaruri.",
  "category": "String, must be exactly one of: 'Work', 'Personal', 'Meeting', 'Study', 'Health'. Default to 'Work' if unclear.",
  "dueDate": "String in YYYY-MM-DD format. Today's date is ${today}. Infer the date if the user says 'tomorrow', 'next week', 'aaj', 'kal', etc. If not specified, leave empty string."
}
Do NOT output anything else except the raw JSON object.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.1,
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new AppError(data.error?.message || 'Failed to fetch AI response', response.status);
  }

  try {
    let content = data.choices[0].message.content.trim();
    // Sometimes LLMs output markdown JSON blocks anyway
    if (content.startsWith('\`\`\`json')) {
      content = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    }
    const taskData = JSON.parse(content);
    res.json(taskData);
  } catch (err) {
    throw new AppError('AI failed to parse the task into valid JSON.', 400);
  }
});

export const parseFinance = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { prompt } = req.body;
  
  if (!prompt || prompt.length > 500) {
    return next(new AppError('Prompt is required and must be under 500 characters', 400));
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return next(new AppError('AI API key not configured', 500));
  }

  const systemPrompt = `You are an intelligent financial parsing assistant. 
Your goal is to extract transaction details from the user's natural language input (in English or Roman Urdu).
You MUST output ONLY valid JSON format, with absolutely no markdown wrapping, no explanation, no backticks.
The JSON must strictly match this structure:
{
  "type": "String, must be exactly 'Income' or 'Expense'. Default to 'Expense' if the user bought something or paid for something. If they got paid, received money, or salary, it's 'Income'.",
  "amount": "Number, extract the numerical amount. E.g. for '2000', output 2000.",
  "category": "String, a short 1-2 word category like 'Food', 'Salary', 'Groceries', 'Utilities', 'Freelance', 'Rent'.",
  "description": "String, a brief description based on the prompt, or empty string."
}
Do NOT output anything else except the raw JSON object.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.1,
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new AppError(data.error?.message || 'Failed to fetch AI response', response.status);
  }

  try {
    let content = data.choices[0].message.content.trim();
    if (content.startsWith('\`\`\`json')) {
      content = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    }
    const financeData = JSON.parse(content);
    res.json(financeData);
  } catch (err) {
    throw new AppError('AI failed to parse the finance record into valid JSON.', 400);
  }
});
