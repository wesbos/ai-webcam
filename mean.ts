// Inspried by https://twitter.com/charliebholtz/status/1724815159590293764
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { writeFile } from 'fs/promises';
import { VoicePrompt, prompts } from './prompts.js';

config();

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_KEY,
});

function massageText(text: string) {
  return text
    .replaceAll(',', '')
    .replaceAll('frickin', 'fucking')
    .replaceAll('goofball', 'dumbass')
    .replaceAll('little turd', 'shit head');
}

async function generateSpeech(text: string, voice: VoicePrompt) {
  console.log(`Start: Generating Speech with voice ${voice.name}`);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVEN_LABS_KEY,
    },
    body: JSON.stringify({
      model_id: 'eleven_multilingual_v2',
      text,
      voice_settings: {
        similarity_boost: 0.75,
        stability: 0.3,
        use_speaker_boost: false,
        style: 0.65,
      },
    }),
  };

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/stream`, options);
  const stream = new ReadableStream({
    async pull(controller) {
      for await (const chunk of res.body as any) {
        controller.enqueue(chunk);
      }
      console.log('Done Chunking');
      controller.close();
    },
  });
  console.log('Sending stream to client');
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
    },
  });
}

async function describeImage(image: string, voice: VoicePrompt) {
  const chatCompletion = await openai.chat.completions.create({
    max_tokens: 100,
    messages: [
      {
        role: 'system',
        content: voice.system,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: voice.user,
          },
          {
            type: 'image_url',
            image_url: image,
          },
        ],
      },
    ],
    model: 'gpt-4-vision-preview',
  });
  console.log(chatCompletion.choices);
  await writeFile(`./completions/${Date.now()}.json`, JSON.stringify(chatCompletion, null, 2));
  return chatCompletion.choices[0].message.content;
  // const speech = await generateSpeech(`Oh, check out this frickin' goofball with his fancy headgear`, prompt);
}

const app = new Hono();

app.get('/', (c) => c.text('Hono!'));
app.use('/audio', cors());
app.post('/audio', async (c) => {
  console.log('From Client!!!');
  const { image, voice } = await c.req.json<{ image: string; voice: string }>();
  const voicePrompt = prompts[voice];
  const description = await describeImage(image, voicePrompt);
  console.log('Description', description);
  if (!description) {
    throw new Error('No description');
  }
  const massagedText = massageText(description);
  return generateSpeech(massagedText, voicePrompt);
});

serve(app, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
