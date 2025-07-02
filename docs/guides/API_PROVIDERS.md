# AI Providers Guide

This guide covers the available AI providers and how to switch between them.

## Current Providers

### OpenAI (Recommended)
- **Models**: GPT-4o-mini, Whisper
- **Features**: Voice transcription + entity extraction
- **Cost**: $0.006/minute audio + $0.15/1M input tokens
- **Setup**: `OPENAI_API_KEY=sk-your-key`

### Mistral AI
- **Models**: Mistral-small
- **Features**: Text-only entity extraction
- **Limitation**: No audio transcription capability
- **Setup**: `MISTRAL_API_KEY=your-key`

### Demo Mode
- **Features**: Pattern-based entity extraction
- **Cost**: Free
- **Use Case**: Testing without API keys
- **Setup**: `AI_PROVIDER=demo`

## Provider Configuration

### Environment Variables
```bash
# Primary provider
AI_PROVIDER=openai  # or 'mistral' or 'demo'

# API Keys
OPENAI_API_KEY=sk-your-openai-key
MISTRAL_API_KEY=your-mistral-key

# Rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MINUTES=15
```

### Switching Providers at Runtime
```bash
# Via API
curl -X POST http://localhost:3000/api/ai/provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "demo"}'

# Check current provider
curl http://localhost:3000/api/ai/status
```

## Alternative Providers (Future)

### Deepgram Nova-3
- **Advantage**: 54% better accuracy than Whisper
- **Cost**: $0.46/hour
- **Features**: Real-time streaming, built-in punctuation

### AssemblyAI
- **Advantage**: Voice agent optimization
- **Cost**: $0.65/hour  
- **Features**: Ultra-low latency, speaker diarization

### Google Gemini
- **Advantage**: Direct audio processing
- **Features**: Handles accents well, technical vocabulary
- **Limitation**: No real-time streaming yet

## Provider Selection Guide

### For Development
- **Demo mode**: No API keys needed
- **OpenAI**: Full functionality testing

### For Production
- **OpenAI**: Proven, reliable, full features
- **Mistral**: Cost-effective for text-only processing

### For Real-time Applications
- **Consider**: Deepgram + AssemblyAI
- **Current**: OpenAI Whisper (batch processing)

## Troubleshooting

### Provider Switch Fails
1. Check API key validity
2. Verify provider availability
3. Check rate limiting status

### Audio Processing Issues
- Only OpenAI supports audio transcription
- Mistral/Demo work with pre-transcribed text only
- Check audio format compatibility (wav, mp3, m4a)

### Rate Limiting
- Different limits apply per provider
- AI operations: 50 requests/15 minutes
- File uploads: 20 requests/15 minutes
- Adjust via environment variables 