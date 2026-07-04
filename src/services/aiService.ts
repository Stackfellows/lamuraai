import axios from 'axios';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'; 

export const generateAiReply = async (message: string, user: any = {}): Promise<string> => {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  try {
    const userName = user.name || 'User';
    const isBusiness = user.aiUsageType === 'business';
    const customTraining = user.aiTrainingData || '';
    
    // Get current hour specifically in Pakistan time (Asia/Karachi)
    const pkTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" });
    const currentHour = new Date(pkTime).getHours();
    const isNight = currentHour >= 22 || currentHour < 7;
    
    let systemPrompt = "";
    
    if (isBusiness) {
      systemPrompt = `You are a professional AI business assistant for ${userName}.
Always maintain a highly professional, polite, and helpful tone.
Use clear and concise language.

CRITICAL BUSINESS KNOWLEDGE/RULES TO FOLLOW:
${customTraining ? customTraining : 'No specific business rules provided. Just be helpful.'}

If it is currently night time in Pakistan (${isNight ? 'Yes' : 'No'}), you may mention that business hours are closed and the team will get back during the day, but still answer the query if the knowledge base covers it.`;
    } else {
      // Personal use case
      if (isNight) {
        systemPrompt = `Aap ${userName} ke personal AI assistant hain.
Abhi Pakistan mein raat ka time hai aur ${userName} so rha hai.
Sender k message ko parho aur oska reply bilkul casual Pakistani texting style (Roman Urdu) ma do.
Jese aam dost chat krty hain (e.g., 'kya ho rha h', 'kya scene h', 'sahi h'). Koi formal ya hindi word use nahi krna.
Sath ma short and sweet bta do k ${userName} so rha h, subha baat kry ga.
Rule: Reply bohat chota (short) hona chahiye, sirf 1 ya 2 lines mein. Lamba message bilkul nai likhna.`;
      } else {
        systemPrompt = `Aap ${userName} ke personal AI assistant hain.
Din ka time hai aur ${userName} thora busy hai.
Sender k message ko parho aur oska context k hisab sa reply do.
Reply bilkul casual Pakistani texting style (Roman Urdu) ma hona chahiye. 
Jese hum whatsapp pr aam chat krty hain (e.g., 'kya kr rha h', 'kaha h', 'acha theek h'). Koi hindi word ya formal language use nahi krni.
Reply k end ma bta do k '${userName} abhi busy h, thori der ma reply kry ga'.
Rule: Reply bohat chota (short) hona chahiye, sirf 1 ya 2 lines mein. Lamba paragraph ya message bilkul nai likhna.`;
      }
      
      if (customTraining) {
        systemPrompt += `\n\nCRITICAL PERSONAL RULES/KNOWLEDGE:\n${customTraining}\nAlways prioritize these rules when replying.`;
      }
    }

    const response = await axios.post(
      GROQ_API_URL,
      {
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: message },
        ],
        model: 'llama-3.1-8b-instant', 
        stream: false,
      },
      {
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling AI:', error);
    return 'Sorry, mujhe aik error agaya hai reply generate karne mein.';
  }
};

export const generateGroqCompletion = async (messages: any[]): Promise<string> => {
  const GROK_API_KEY = process.env.GROK_API_KEY;
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        messages,
        model: 'llama-3.1-8b-instant', 
        stream: false,
      },
      {
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error in generateGroqCompletion:', error);
    throw error;
  }
};
