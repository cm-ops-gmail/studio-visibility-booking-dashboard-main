'use server';

const N8N_WEBHOOK_URL = 'https://vibeacademy.cloud/webhook/4a9b90cf-f01d-4135-950b-eb72bd900d32';

export async function sendMessageToAgent(message: string): Promise<string> {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: message }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status}`);
    }

    const text = await response.text();
    
    let answer = text;
    
    try {
      const data = JSON.parse(text);
      
      if (Array.isArray(data)) {
        answer = data[0]?.text || data[0]?.answer || text;
      } else if (typeof data === 'object') {
        answer = data.text || data.answer || data.output || data.message || text;
      } else {
        answer = text;
      }
    } catch(e) {
      answer = text;
    }

    return answer.replace(/\\n/g, '\n');

  } catch (error) {
    console.error('Error calling n8n webhook:', error);
    return 'An error occurred while trying to contact the agent.';
  }
}
