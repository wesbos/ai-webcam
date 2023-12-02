// Inspired by https://twitter.com/charliebholtz/status/1724815159590293764
import { VoicePrompt, prompts } from './prompts.ts';
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";
import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";

const env = await load();

const openai = new OpenAI({
  apiKey: env['OPEN_AI_KEY'],
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
      'xi-api-key': env['ELEVEN_LABS_KEY'],
    },
    body: JSON.stringify({
      model_id: 'eleven_multilingual_v2',
      text,
      voice_settings: {
        similarity_boost: 1,
        stability: 0.3,
        use_speaker_boost: false,
        style: 1,
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
  console.log('Sending stream to client', stream);
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
    },
  });
}

const nameFolder = './completions';

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
            image_url: { "url": image },
          },
        ],
      },
    ],
    model: 'gpt-4-vision-preview',
  });
  console.log(chatCompletion.choices);
  await Deno.writeTextFile(`${nameFolder}/${Date.now()}.json`, JSON.stringify(chatCompletion, null, 2));
  return chatCompletion.choices[0].message.content;
  // const speech = await generateSpeech(`Oh, check out this frickin' goofball with his fancy headgear`, prompt);
}

const router = new Router();

router.get('/', (context: any) => {
  context.response.body = 'Deno!';
});

router.post('/audio', async (context) => {
  console.log('From Client!!!');
  const { image, voice } = await context.request.body().value;
  const voicePrompt = prompts[voice];
  console.log('Voice Prompt', voicePrompt);
  const description = await describeImage(image, voicePrompt);
  console.log('Description', description);
  if (!description) {
    throw new Error('No description');
  }
  const massagedText = massageText(description);
  return generateSpeech(massagedText, voicePrompt);
});

const app = new Application();
app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Listening on http://localhost:8000`);
await app.listen({ port: 8000 });
