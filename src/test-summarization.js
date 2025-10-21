
import { isText } from 'istextorbinary';
import fs from 'fs';
import { pipeline } from '@xenova/transformers';

const generator = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');

const filePath = './src/server.js'
const buffer = fs.readFileSync(filePath);
const isTextFile = isText(null, buffer); // true if it's text

console.log('isTextFile =', isTextFile)

if (isTextFile) {
    const output = await generator(buffer, {
        max_new_tokens: 128,
      });
        
    console.log('output =', output)
}

/*
   Summarization
   https://huggingface.co/docs/transformers.js/api/pipelines#module_pipelines.SummarizationPipeline
*/
