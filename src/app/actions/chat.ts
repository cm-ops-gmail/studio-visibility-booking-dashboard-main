'use server';

const N8N_WEBHOOK_URL = 'https://vibeacademy.cloud/webhook/4a9b90cf-f01d-4135-950b-eb72bd900d32';

export async function sendMessageToAgent(message: string): Promise<string> {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ question: message }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    const text = await response.text();
    
    if (!text || text.trim() === '') {
      return 'No response received from agent.';
    }

    let answer = '';

    try {
      const data = JSON.parse(text);
      
      if (Array.isArray(data) && data.length > 0) {
        answer = data[0]?.text || data[0]?.answer || '';
      } else if (typeof data === 'object' && data !== null) {
        answer = data.text || data.answer || data.output || data.message || '';
      }
      
      if (!answer) {
        answer = text;
      }
      
    } catch(e) {
      answer = text;
    }

    return answer;

  } catch (error) {
    console.error('Error calling n8n webhook:', error);
    return 'An error occurred while trying to contact the agent.';
  }
}
