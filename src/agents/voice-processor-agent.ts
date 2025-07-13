import OpenAI from 'openai';
import { Mistral } from '@mistralai/mistralai';
import fs from 'fs';
import path from 'path';
import type { 
  AIProvider, 
  ExtractedEntity, 
  TranscriptionResponse 
} from '../types/index.js';

interface VoiceProcessingResult {
  transcription: string;
  entities: ExtractedEntity[];
  analysis: {
    totalEntities: number;
    entityCounts: Record<string, number>;
    insights: string[];
    relationships: string[];
  };
  processedAt: string;
}

export class VoiceProcessorAgent {
  private openai: OpenAI | null = null;
  private mistral: Mistral | null = null;
  private aiProvider: AIProvider;

  constructor() {
    this.aiProvider = (process.env.AI_PROVIDER as AIProvider) || 'openai';
    
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    // Initialize Mistral if API key is available
    if (process.env.MISTRAL_API_KEY) {
      this.mistral = new Mistral({
        apiKey: process.env.MISTRAL_API_KEY
      });
    }
  }

  async initialize(): Promise<boolean> {
    console.log('🎙️ Voice Processor Agent initializing...');
    
    const availableProviders: string[] = [];
    if (this.openai) availableProviders.push('OpenAI');
    if (this.mistral) availableProviders.push('Mistral');
    
    if (availableProviders.length > 0) {
      console.log(`🎙️ Voice Processor Agent initialized with: ${availableProviders.join(', ')}`);
    } else {
      console.log('🎙️ Voice Processor Agent initialized with demo mode');
    }
    
    return true;
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    try {
      if (this.aiProvider === 'openai' && this.openai) {
        return await this.transcribeWithOpenAI(audioBuffer);
      } else if (this.aiProvider === 'mistral' && this.mistral) {
        // Mistral doesn't have native transcription, use demo
        return this.generateDemoTranscription(audioBuffer);
      } else {
        return this.generateDemoTranscription(audioBuffer);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async transcribeWithOpenAI(audioBuffer: Buffer): Promise<string> {
    try {
      // Validate buffer
      if (!this.isValidWebMBuffer(audioBuffer)) {
        console.warn('⚠️ Audio buffer might not be in WebM format, attempting transcription anyway...');
      }

      // Create a temporary file for the audio
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `audio_${Date.now()}.webm`);
      fs.writeFileSync(tempFilePath, audioBuffer);

      try {
        // Use OpenAI Whisper for transcription
        const transcription = await this.openai!.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
          language: 'en', // Can be made configurable
          response_format: 'text'
        });

        // Clean up temp file
        fs.unlinkSync(tempFilePath);

        if (typeof transcription === 'string') {
          return transcription.trim();
        } else {
          return 'Transcription failed - unexpected response format';
        }
      } catch (apiError) {
        // Clean up temp file even if API call fails
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        throw apiError;
      }
    } catch (error) {
      console.error('OpenAI transcription error:', error);
      throw new Error(`OpenAI transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isValidWebMBuffer(buffer: Buffer): boolean {
    // Check for WebM signature (0x1A, 0x45, 0xDF, 0xA3)
    if (buffer.length < 4) return false;
    
    const webmSignature = [0x1A, 0x45, 0xDF, 0xA3];
    for (let i = 0; i < 4; i++) {
      if (buffer[i] !== webmSignature[i]) return false;
    }
    return true;
  }

  private generateDemoTranscription(audioBuffer: Buffer): string {
    // Generate a demo transcription based on audio buffer size
    const size = audioBuffer.length;
    const demoTexts = [
      "Hello, this is a demo transcription of your audio input.",
      "Thank you for testing the voice processing capabilities.",
      "This is a sample transcription to demonstrate the voice processor agent.",
      "Voice processing is working in demo mode.",
      "Your audio has been processed successfully in demo mode."
    ];
    
    const index = Math.floor(size / 1000) % demoTexts.length;
    return demoTexts[index] || 'Demo transcription result';
  }

  async processVoiceInput(audioBuffer: Buffer): Promise<VoiceProcessingResult> {
    try {
      const startTime = Date.now();
      
      // Transcribe the audio
      const transcription = await this.transcribe(audioBuffer);
      
      // For now, return basic result - entity extraction will be handled by EntityExtractorAgent
      const result: VoiceProcessingResult = {
        transcription,
        entities: [], // Will be populated by EntityExtractorAgent
        analysis: {
          totalEntities: 0,
          entityCounts: {},
          insights: [`Transcription completed in ${Date.now() - startTime}ms`],
          relationships: []
        },
        processedAt: new Date().toISOString()
      };

      return result;
    } catch (error) {
      console.error('Voice processing error:', error);
      throw error;
    }
  }

  getCapabilities(): string[] {
    return ['transcription', 'audio-processing', 'speech-to-text'];
  }

  getProvider(): AIProvider {
    return this.aiProvider;
  }

  isAvailable(): boolean {
    return this.aiProvider === 'demo' || 
           (this.aiProvider === 'openai' && this.openai !== null) ||
           (this.aiProvider === 'mistral' && this.mistral !== null);
  }
}