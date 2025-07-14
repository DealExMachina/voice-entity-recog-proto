import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import type { 
  TTSRequest, 
  TTSResponse, 
  VoiceConfig, 
  AgentPersona 
} from '../types/index.js';
import { getPersonaById } from '../database/duckdb.js';

export class TTSService {
  private openai: OpenAI | null = null;
  private audioDir: string;

  constructor() {
    this.audioDir = path.join(process.cwd(), 'public', 'audio');
    
    // Ensure audio directory exists
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
    
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  async initialize(): Promise<boolean> {
    console.log('🔊 TTS Service initializing...');
    
    const availableProviders: string[] = [];
    if (this.openai) availableProviders.push('OpenAI');
    
    if (availableProviders.length > 0) {
      console.log(`🔊 TTS service initialized with: ${availableProviders.join(', ')}`);
    } else {
      console.log('🔊 TTS service initialized with demo mode (no API keys)');
    }
    
    return true;
  }

  async synthesizeSpeech(request: TTSRequest): Promise<TTSResponse> {
    try {
      let voiceConfig: VoiceConfig;
      
      // Get persona configuration if specified
      if (request.personaId) {
        const persona = await getPersonaById(request.personaId);
        if (persona) {
          voiceConfig = persona.voice as VoiceConfig;
        } else {
          throw new Error(`Persona not found: ${request.personaId}`);
        }
      } else {
        // Use default voice config
        voiceConfig = {
          provider: 'openai',
          voice: 'alloy',
          language: 'en',
          speed: 1.0,
          pitch: 0,
          volume: 1.0
        };
      }

      // Merge with request-specific config
      if (request.voiceConfig) {
        voiceConfig = { ...voiceConfig, ...request.voiceConfig };
      }

      let audioUrl: string;
      let duration: number;
      let wordCount: number;

      if (voiceConfig.provider === 'openai' && this.openai) {
        const result = await this.synthesizeWithOpenAI(request.text, voiceConfig);
        audioUrl = result.audioUrl;
        duration = result.duration;
        wordCount = result.wordCount;
      } else {
        // Demo mode - generate placeholder audio
        const result = await this.synthesizeDemo(request.text, voiceConfig);
        audioUrl = result.audioUrl;
        duration = result.duration;
        wordCount = result.wordCount;
      }

      return {
        audioUrl,
        duration,
        wordCount,
        metadata: {
          provider: voiceConfig.provider,
          voice: voiceConfig.voice,
          language: voiceConfig.language,
          speed: voiceConfig.speed,
          pitch: voiceConfig.pitch,
          volume: voiceConfig.volume
        }
      };

    } catch (error) {
      console.error('TTS synthesis error:', error);
      throw new Error(`TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async synthesizeWithOpenAI(text: string, config: VoiceConfig): Promise<{ audioUrl: string; duration: number; wordCount: number }> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    console.log('🔊 Synthesizing speech with OpenAI...');
    
    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: config.voice as any,
      input: text,
      speed: config.speed
    });

    // Generate unique filename
    const filename = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`;
    const filePath = path.join(this.audioDir, filename);
    
    // Convert response to buffer and save
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);

    // Estimate duration (rough calculation: ~150 words per minute)
    const wordCount = text.split(/\s+/).length;
    const duration = (wordCount / 150) * 60; // seconds

    return {
      audioUrl: `/audio/${filename}`,
      duration,
      wordCount
    };
  }

  private async synthesizeDemo(text: string, config: VoiceConfig): Promise<{ audioUrl: string; duration: number; wordCount: number }> {
    console.log('🔊 Demo TTS synthesis...');
    
    // Create a simple audio file for demo purposes
    const filename = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.wav`;
    const filePath = path.join(this.audioDir, filename);
    
    // Generate a simple beep sound for demo
    await this.generateDemoAudio(filePath, text.length);
    
    const wordCount = text.split(/\s+/).length;
    const duration = (wordCount / 150) * 60; // seconds

    return {
      audioUrl: `/audio/${filename}`,
      duration,
      wordCount
    };
  }

  private async generateDemoAudio(filePath: string, textLength: number): Promise<void> {
    // Create a simple WAV file with beep sounds
    const sampleRate = 44100;
    const duration = Math.min(textLength * 0.1, 5); // Max 5 seconds
    const samples = Math.floor(sampleRate * duration);
    
    const buffer = Buffer.alloc(44 + samples * 2); // WAV header + 16-bit samples
    
    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples * 2, 40);
    
    // Generate beep sound
    const frequency = 800;
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
      const value = Math.floor(sample * 32767);
      buffer.writeInt16LE(value, 44 + i * 2);
    }
    
    await fs.promises.writeFile(filePath, buffer);
  }

  getAvailableVoices(): { provider: string; voices: string[] }[] {
    const voices: { provider: string; voices: string[] }[] = [];
    
    if (this.openai) {
      voices.push({
        provider: 'openai',
        voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
      });
    }
    
    // Add demo voices
    voices.push({
      provider: 'demo',
      voices: ['demo-1', 'demo-2', 'demo-3']
    });
    
    return voices;
  }

  getDefaultVoiceConfig(): VoiceConfig {
    return {
      provider: 'openai',
      voice: 'alloy',
      language: 'en',
      speed: 1.0,
      pitch: 0,
      volume: 1.0
    };
  }
}