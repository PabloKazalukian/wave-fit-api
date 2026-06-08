// modules/ai/providers/groq.provider.ts
import { Injectable } from '@nestjs/common';
import { IAiProvider } from '../interfaces/ai-proider.interface';
import { ChatGroq } from '@langchain/groq';
// import { IAiProvider } from '../interfaces/ai-provider.interface';

@Injectable()
export class GroqProvider implements IAiProvider {
  readonly name = 'groq';
  private model: ChatGroq;

  constructor() {
    this.model = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      apiKey: process.env.GROQ_API_KEY,
      temperature: 0,
    });
  }

  getModel() {
    return this.model;
  }
}
