import 'dotenv/config';
import axios from 'axios';

async function test() {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        messages: [
          { role: 'system', content: 'You are an AI assistant.' },
          { role: 'user', content: 'Hello' }
        ],
        model: 'mixtral-8x7b-32768',
      },
      {
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Success:', response.data.choices[0].message.content);
  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

test();
