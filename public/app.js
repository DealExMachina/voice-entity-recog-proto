class MastraVoiceApp {
    constructor() {
        this.isRecording = false;
        this.isProcessing = false;
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.currentAiProvider = 'openai'; // Set default fallback value
        this.ws = null;
        this.streamingSessionId = null;
        this.transcriptionBuffer = '';
        this.isStreamingTranscription = false;
        this.currentPersonaId = null;
        this.currentAgentResponse = null;
        this.currentAudio = null;
        
        // Initialize app asynchronously without blocking
        this.initializeApp().catch(error => {
            console.error('Failed to initialize app:', error);
            // Continue with basic functionality even if init fails
            this.setupEventListeners();
        });
    }

    async initializeApp() {
        try {
            console.log('🚀 Initializing MastraVoiceApp...');
            
            // Set up event listeners first (non-blocking)
            this.setupEventListeners();
            
            // Load AI status and providers (with timeout)
            const initPromises = [
                this.loadAiStatus(),
                this.loadAiProviders(),
                this.loadSystemStatus(),
                this.loadDatabaseEntities()
            ];
            
            // Wait for all with a 5-second timeout
            await Promise.race([
                Promise.all(initPromises),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Initialization timeout')), 5000)
                )
            ]);
            
            console.log('✅ App initialized successfully with AI provider:', this.currentAiProvider);
        } catch (error) {
            console.warn('⚠️ App initialization had issues:', error.message);
            // Ensure we have a fallback provider
            this.currentAiProvider = this.currentAiProvider || 'openai';
            console.log('🔄 Using fallback AI provider:', this.currentAiProvider);
        }
    }

    setupEventListeners() {
        // Record button
        document.getElementById('recordBtn').addEventListener('click', () => {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        });

        // Process text button
        document.getElementById('processBtn').addEventListener('click', () => {
            this.processText();
        });

        // AI Provider selector
        document.getElementById('aiProvider').addEventListener('change', (e) => {
            this.switchAiProvider(e);
        });

        // Entity filter controls
        document.getElementById('entityTypeFilter').addEventListener('change', () => {
            this.loadDatabaseEntities();
        });

        document.getElementById('limitInput').addEventListener('change', () => {
            this.loadDatabaseEntities();
        });

        // Statistics button
        document.getElementById('statsBtn').addEventListener('click', () => {
            this.showStatistics();
        });

        // Text input toggle
        document.getElementById('textInputToggle').addEventListener('click', () => {
            this.toggleTextInput();
        });

        // Agent configuration toggle
        document.getElementById('agentConfigToggle').addEventListener('click', () => {
            this.toggleAgentConfig();
        });

        // Persona management
        document.getElementById('createPersonaBtn').addEventListener('click', () => {
            this.createNewPersona();
        });

        document.getElementById('editPersonaBtn').addEventListener('click', () => {
            this.editSelectedPersona();
        });

        document.getElementById('deletePersonaBtn').addEventListener('click', () => {
            this.deleteSelectedPersona();
        });

        document.getElementById('savePersonaBtn').addEventListener('click', () => {
            this.savePersona();
        });

        document.getElementById('cancelPersonaBtn').addEventListener('click', () => {
            this.cancelPersonaEdit();
        });

        // TTS controls
        document.getElementById('playResponseBtn').addEventListener('click', () => {
            this.playAgentResponse();
        });

        document.getElementById('stopResponseBtn').addEventListener('click', () => {
            this.stopAgentResponse();
        });

        // Voice configuration
        document.getElementById('voiceSpeed').addEventListener('input', (e) => {
            document.getElementById('speedValue').textContent = e.target.value;
        });

        document.getElementById('voiceVolume').addEventListener('input', (e) => {
            document.getElementById('volumeValue').textContent = e.target.value;
        });

        // Audio upload (file input)
        document.getElementById('audioUpload').addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleAudioFile(e.target.files[0]);
            }
        });

        // Refresh buttons
        document.getElementById('refreshEntities').addEventListener('click', () => {
            this.loadDatabaseEntities();
        });

        document.getElementById('refreshStatus').addEventListener('click', () => {
            this.loadSystemStatus();
        });

        // Persona pane functionality
        this.setupPersonaEventListeners();
        
        // Connect WebSocket after DOM is ready
        this.connectWebSocket();
    }

    setupPersonaEventListeners() {
        // Add persona button
        const addPersonaBtn = document.getElementById('addPersonaBtn');
        if (addPersonaBtn) {
            addPersonaBtn.addEventListener('click', () => {
                this.showAddPersonaModal();
            });
        }

        // Persona card clicks
        const personaCards = document.querySelectorAll('.persona-card');
        personaCards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    this.selectPersona(card);
                }
            });
        });

        // Quick action buttons
        const quickActionButtons = document.querySelectorAll('.persona-card + div button');
        quickActionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = button.textContent.trim().toLowerCase();
                this.handleQuickAction(action);
            });
        });
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${window.location.host}`);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.connectWebSocket(), 5000);
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'streaming_started':
                this.streamingSessionId = data.sessionId;
                this.isStreamingTranscription = true;
                console.log('🎬 Streaming session started:', data.sessionId);
                break;
                
            case 'transcription_chunk':
                this.handleTranscriptionChunk(data.transcription, data.isFinal);
                break;
                
            case 'entities_extracted':
                this.displayTranscription(data.transcription);
                this.displayEntities(data.entities);
                this.showToast('Entities extracted successfully!');
                this.isStreamingTranscription = false;
                
                // Generate agent response after entities are extracted
                if (data.transcription) {
                    this.generateAgentResponse(data.transcription);
                }
                break;
                
            case 'agent_response':
                this.displayAgentResponse(data);
                this.currentAgentResponse = data;
                break;
                
            case 'streaming_error':
                console.error('Streaming error:', data.error);
                this.showToast(`Streaming error: ${data.error}`, 'error');
                this.isStreamingTranscription = false;
                break;
                
            case 'error':
                this.showToast(`Error: ${data.message}`, 'error');
                break;
        }
    }

    handleTranscriptionChunk(transcription, isFinal) {
        if (isFinal) {
            // Final chunk - update the complete transcription
            this.transcriptionBuffer = transcription;
            this.displayTranscription(transcription);
        } else {
            // Partial chunk - show with "..." to indicate it's in progress
            this.displayTranscription(transcription + '...', true);
        }
    }

    async toggleRecording() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    async startRecording() {
        try {
            // Immediate visual feedback
            this.showProcessingState('Requesting microphone access...');
            this.updateRecordingUI('requesting');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000, // Optimized for speech recognition
                    channelCount: 1, // Mono for better compression
                    autoGainControl: true
                } 
            });
            
            console.log('🎤 Media stream obtained:', {
                audioTracks: stream.getAudioTracks().length,
                settings: stream.getAudioTracks()[0]?.getSettings()
            });
            
            // Update UI to show we're setting up recording
            this.showProcessingState('Setting up recording...');
            this.updateRecordingUI('preparing');
            
            // Optimize MIME type for streaming
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'audio/mp4';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = '';
                    }
                }
            }
            
            console.log('🎵 Using MIME type:', mimeType || 'default');
            
            this.mediaRecorder = new MediaRecorder(stream, { 
                mimeType: mimeType || undefined
            });
            
            console.log('📹 MediaRecorder created:', {
                mimeType: this.mediaRecorder.mimeType,
                state: this.mediaRecorder.state
            });
            
            this.audioChunks = [];
            this.transcriptionBuffer = '';
            
            // Optimized chunking for real-time streaming
            this.mediaRecorder.ondataavailable = (event) => {
                console.log('📊 Data chunk received:', {
                    size: event.data.size,
                    type: event.data.type
                });
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    // Stream chunk immediately via WebSocket
                    this.streamAudioChunk(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                console.log('🛑 Recording stopped, finalizing...');
                this.finalizeStreaming();
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('🚨 MediaRecorder error:', event);
                this.showToast('Recording error occurred', 'error');
                this.hideProcessingState();
                this.isStreamingTranscription = false;
            };
            
            // Add event listener for when recording actually starts
            this.mediaRecorder.onstart = () => {
                console.log('🎬 MediaRecorder started - ready to record!');
                this.isRecording = true;
                this.updateRecordingUI('recording');
                this.startRecordingCountdown();
                // Initialize streaming session
                this.initializeStreamingSession();
            };
            
            // Use smaller chunks for more responsive streaming (250ms instead of 1000ms)
            this.mediaRecorder.start(250);
            console.log('🎬 Starting MediaRecorder with optimized chunking...');
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showToast(`Recording failed: ${error.message}`, 'error');
            this.hideProcessingState();
            this.updateRecordingUI('error');
        }
    }

    async initializeStreamingSession() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'start_streaming',
                provider: this.currentAiProvider,
                audioFormat: this.mediaRecorder?.mimeType || 'audio/webm'
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    async streamAudioChunk(audioChunk) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isStreamingTranscription) {
            try {
                // Convert blob to base64 for WebSocket transmission
                const arrayBuffer = await audioChunk.arrayBuffer();
                const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                
                const message = {
                    type: 'voice_data',
                    audio: base64Audio,
                    sessionId: this.streamingSessionId,
                    chunkIndex: this.audioChunks.length - 1,
                    isFinal: false
                };
                
                this.ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('Failed to stream audio chunk:', error);
            }
        }
    }

    async finalizeStreaming() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.streamingSessionId) {
            const message = {
                type: 'end_streaming',
                sessionId: this.streamingSessionId
            };
            this.ws.send(JSON.stringify(message));
        }
        
        this.isRecording = false;
        this.isStreamingTranscription = false;
        this.streamingSessionId = null;
        
        // Clear timer
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        // Update UI
        this.updateRecordingUI('idle');
        this.showProcessingState('Finalizing transcription...');
    }

    startRecordingCountdown() {
        // Play audio notification to indicate recording started
        this.playRecordingStartSound();
        
        // Show immediate "ready to speak" feedback with visual countdown
        let countdown = 3;
        this.showProcessingState(`🎤 Recording in ${countdown}... Get ready!`);
        
        const countdownTimer = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                this.showProcessingState(`🎤 Recording in ${countdown}... Get ready!`);
                // Play a subtle tick sound for countdown
                this.playTickSound();
            } else {
                clearInterval(countdownTimer);
                this.showProcessingState('🔴 Recording NOW - speak clearly!');
                
                // Start the recording timer
                this.recordingStartTime = Date.now();
                this.recordingTimer = setInterval(() => {
                    const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                    const minutes = Math.floor(elapsed / 60);
                    const seconds = elapsed % 60;
                    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                    
                    // Update both the processing state and recording status
                    this.showProcessingState(`🔴 Recording: ${timeStr} - Click to stop`);
                    document.getElementById('recordingStatus').textContent = `Recording: ${timeStr}`;
                }, 1000);
            }
        }, 1000);
    }
    
    playRecordingStartSound() {
        try {
            // Create a simple audio context for notification sounds
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // High frequency beep for start
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (error) {
            console.log('Audio notification not available:', error);
        }
    }
    
    playTickSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Lower frequency tick for countdown
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.log('Audio notification not available:', error);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            
            // Clear timer
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }
            
            // Update UI
            this.updateRecordingUI('idle');
            this.showProcessingState('Processing audio...');
        }
    }

    updateRecordingUI(state) {
        const recordBtn = document.getElementById('recordBtn');
        const recordingStatus = document.getElementById('recordingStatus');
        
        switch (state) {
            case 'requesting':
                recordBtn.innerHTML = `
                    <div class="flex flex-col items-center">
                        <i data-lucide="mic" class="w-8 h-8 mb-2 animate-pulse"></i>
                        <span class="text-sm">Requesting...</span>
                    </div>
                `;
                recordBtn.className = 'record-button bg-gradient-to-br from-yellow-100 to-amber-200 border-2 border-yellow-300 text-yellow-800 font-medium flex items-center justify-center';
                recordingStatus.textContent = 'Please allow microphone access';
                break;
                
            case 'preparing':
                recordBtn.innerHTML = `
                    <div class="flex flex-col items-center">
                        <i data-lucide="settings" class="w-8 h-8 mb-2 animate-spin"></i>
                        <span class="text-sm">Preparing...</span>
                    </div>
                `;
                recordBtn.className = 'record-button bg-gradient-to-br from-blue-100 to-indigo-200 border-2 border-blue-300 text-blue-800 font-medium flex items-center justify-center';
                recordingStatus.textContent = 'Setting up audio recording...';
                break;
                
            case 'recording':
                recordBtn.innerHTML = `
                    <div class="flex flex-col items-center">
                        <i data-lucide="square" class="w-8 h-8 mb-2"></i>
                        <span class="text-sm">Stop</span>
                    </div>
                `;
                recordBtn.className = 'record-button bg-gradient-to-br from-red-200 to-rose-300 border-2 border-red-400 text-red-800 font-medium recording flex items-center justify-center';
                recordingStatus.textContent = '🔴 Recording - speak now!';
                break;
                
            case 'error':
                recordBtn.innerHTML = `
                    <div class="flex flex-col items-center">
                        <i data-lucide="alert-triangle" class="w-8 h-8 mb-2"></i>
                        <span class="text-sm">Error</span>
                    </div>
                `;
                recordBtn.className = 'record-button bg-gradient-to-br from-red-100 to-red-200 border-2 border-red-300 text-red-800 font-medium flex items-center justify-center';
                recordingStatus.textContent = 'Recording failed - try again';
                break;
                
            default: // 'idle' or false
                recordBtn.innerHTML = `
                    <div class="flex flex-col items-center">
                        <i data-lucide="mic" class="w-8 h-8 mb-2"></i>
                        <span class="text-sm">Record</span>
                    </div>
                `;
                recordBtn.className = 'record-button bg-gradient-to-br from-red-50 to-rose-100 border-2 border-red-200 text-red-700 font-medium hover:from-red-100 hover:to-rose-200 flex items-center justify-center';
                recordingStatus.textContent = '';
                break;
        }
        
        lucide.createIcons();
    }

    async processRecording() {
        try {
            console.log('🎬 Processing recording with', this.audioChunks.length, 'chunks');
            
            if (this.audioChunks.length === 0) {
                throw new Error('No audio data recorded - please try recording again');
            }
            
            // Calculate total size to ensure we have actual data
            const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
            console.log('💾 Total audio data size:', totalSize, 'bytes');
            
            if (totalSize < 1000) { // Less than 1KB suggests no real audio was captured
                throw new Error('Audio recording too short or empty - please speak longer');
            }
            
            // Determine the actual MIME type from the first chunk
            const firstChunk = this.audioChunks[0];
            const actualMimeType = firstChunk.type || this.mediaRecorder?.mimeType || 'audio/webm';
            console.log('🎵 Actual audio MIME type:', actualMimeType);
            
            const audioBlob = new Blob(this.audioChunks, { type: actualMimeType });
            console.log('💾 Created audio blob:', {
                size: audioBlob.size,
                type: audioBlob.type,
                expectedSize: totalSize
            });
            
            // Validate blob was created properly
            if (audioBlob.size === 0) {
                throw new Error('Failed to create audio blob - please try recording again');
            }
            
            // Determine appropriate filename based on MIME type
            let filename = 'recording.webm'; // default
            if (actualMimeType.includes('mp4')) {
                filename = 'recording.mp4';
            } else if (actualMimeType.includes('wav')) {
                filename = 'recording.wav';
            } else if (actualMimeType.includes('ogg')) {
                filename = 'recording.ogg';
            }
            
            console.log('📁 Using filename:', filename);
            
            // Upload the audio
            await this.uploadAudio(audioBlob, filename);
            
        } catch (error) {
            console.error('🚨 Processing error:', error);
            this.showToast(`Processing failed: ${error.message}`, 'error');
            this.hideProcessingState();
        }
    }

    async convertToWav(webmBlob) {
        // For now, return the original blob
        // In a production environment, you might want to convert to WAV
        return webmBlob;
    }

    async processAudioFile() {
        const fileInput = document.getElementById('audioUpload');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select an audio file', 'error');
            return;
        }
        
        this.showProcessingState('Processing uploaded file...');
        await this.uploadAudio(file, file.name);
    }

    async uploadAudio(audioBlob, filename) {
        try {
            this.isProcessing = true;
            
            // Ensure we have a valid AI provider
            const provider = this.currentAiProvider || 'openai';
            const providerName = provider.toUpperCase();
            
            this.showProcessingState(`Processing with ${providerName}...`);
            
            console.log('📤 Uploading audio:', {
                filename: filename,
                size: audioBlob.size,
                type: audioBlob.type,
                provider: provider
            });
            
            const formData = new FormData();
            formData.append('audio', audioBlob, filename);
            
            const response = await fetch('/api/process-audio', {
                method: 'POST',
                body: formData
            });
            
            console.log('📥 Server response status:', response.status);
            const result = await response.json();
            console.log('📋 Server response:', result);
            
            if (result.success) {
                this.displayTranscription(result.data.transcription);
                this.displayEntities(result.data.entities);
                this.displayAnalysis(result.data.analysis);
                this.loadDatabaseEntities(); // Refresh database view
                
                // Show success with provider info
                const providerInfo = provider === 'demo' ? 'Demo Mode' : 
                                   provider === 'openai' ? 'OpenAI' : 'Mistral AI';
                this.showToast(`✓ Audio processed successfully with ${providerInfo}!`);
            } else {
                throw new Error(result.message || result.error || 'Processing failed');
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast(`Upload failed: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
            this.hideProcessingState();
        }
    }

    async processText() {
        const textInput = document.getElementById('textInput');
        const text = textInput.value.trim();
        
        if (!text) {
            this.showToast('Please enter some text', 'error');
            return;
        }
        
        try {
            this.isProcessing = true;
            
            // Ensure we have a valid AI provider
            const provider = this.currentAiProvider || 'openai';
            const providerName = provider.toUpperCase();
            
            this.showProcessingState(`Extracting entities with ${providerName}...`);
            
            const response = await fetch('/api/extract-entities', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.displayEntities(result.entities);
                this.displayAnalysis(result.analysis);
                
                // Refresh database entities to show newly stored entities
                await this.loadDatabaseEntities();
                
                // Show success with provider info
                const providerInfo = provider === 'demo' ? 'Demo Mode' : 
                                   provider === 'openai' ? 'OpenAI' : 'Mistral AI';
                this.showToast(`✓ Entities extracted with ${providerInfo}!`);
            } else {
                throw new Error(result.message || 'Extraction failed');
            }
            
        } catch (error) {
            console.error('Text processing error:', error);
            this.showToast(`Processing failed: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
            this.hideProcessingState();
        }
    }

    showProcessingState(message) {
        document.getElementById('recordingStatus').innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span class="text-blue-600 font-medium">${message}</span>
            </div>
        `;
    }

    hideProcessingState() {
        document.getElementById('recordingStatus').textContent = '';
    }

    displayTranscription(transcription, isPartial = false) {
        const panel = document.getElementById('transcriptionPanel');
        const textDiv = document.getElementById('transcriptionText');
        
        if (isPartial) {
            // For partial transcriptions, show with streaming indicator
            textDiv.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span>${transcription}</span>
                    <div class="flex space-x-1">
                        <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                        <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.2s"></div>
                        <div class="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style="animation-delay: 0.4s"></div>
                    </div>
                </div>
            `;
        } else {
            // For final transcriptions, show clean text
            textDiv.textContent = transcription;
        }
        
        panel.style.display = 'block';
        
        // Smooth scroll to results
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    displayEntities(entities) {
        const container = document.getElementById('resultsContainer');
        
        if (!entities || entities.length === 0) {
            container.innerHTML = `
                <div class="text-center text-slate-400 py-8">
                    <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                        <i data-lucide="search" class="w-6 h-6 text-slate-300"></i>
                    </div>
                    <p class="text-slate-500 font-light text-sm">No entities yet</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        const entitiesHtml = entities.map((entity, index) => `
            <div class="entity-card bg-white/70 rounded-lg p-3 border border-slate-200/50 hover:bg-white/90 transition-colors animate-fade-in" style="animation-delay: ${index * 0.1}s">
                <div class="flex items-center justify-between mb-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${this.getEntityColor(entity.type)}-100 text-${this.getEntityColor(entity.type)}-700">
                        ${this.getEntityIcon(entity.type)} ${entity.type}
                    </span>
                    <div class="text-xs text-slate-500">
                        ${Math.round(entity.confidence * 100)}%
                    </div>
                </div>
                
                <div class="font-medium text-slate-700 text-sm mb-1">${entity.value}</div>
                ${entity.context ? `<div class="text-xs text-slate-500 italic line-clamp-2 mb-2">"${entity.context}"</div>` : ''}
                
                <div class="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                    <span>Just now</span>
                    <i data-lucide="check-circle" class="w-3 h-3 text-emerald-400"></i>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = entitiesHtml;
        lucide.createIcons();
    }

    getProviderBadge(provider) {
        const providerNames = {
            'demo': 'Demo Mode',
            'openai': 'OpenAI',
            'mistral': 'Mistral AI'
        };
        
        const providerColors = {
            'demo': 'gray',
            'openai': 'green',
            'mistral': 'orange'
        };
        
        const color = providerColors[provider] || 'gray';
        const name = providerNames[provider] || provider;
        
        return `
            <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${color}-100 text-${color}-700 border border-${color}-200">
                <div class="w-2 h-2 bg-${color}-500 rounded-full mr-2"></div>
                ${name}
            </span>
        `;
    }

    getProviderColor(provider) {
        const colors = {
            'demo': 'gray',
            'openai': 'green', 
            'mistral': 'orange'
        };
        return colors[provider] || 'gray';
    }

    displayAnalysis(analysis) {
        if (!analysis || !analysis.insights) return;
        
        const insights = analysis.insights.map(insight => `
            <div class="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/50 rounded-lg p-4 mb-3">
                <div class="flex items-center space-x-2">
                    <i data-lucide="lightbulb" class="w-4 h-4 text-blue-600"></i>
                    <p class="text-blue-800 text-sm font-medium">${insight}</p>
                </div>
            </div>
        `).join('');
        
        if (insights) {
            const container = document.getElementById('resultsContainer');
            container.innerHTML += `
                <div class="mt-6 pt-6 border-t border-slate-200">
                    <div class="flex items-center space-x-2 mb-4">
                        <i data-lucide="brain" class="w-4 h-4 text-slate-600"></i>
                        <h3 class="font-medium text-slate-700">Insights</h3>
                    </div>
                    ${insights}
                </div>
            `;
            lucide.createIcons();
        }
    }

    async loadSystemStatus() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            
            const indicators = document.getElementById('statusIndicators');
            if (!indicators) return;

            const statusItems = [];
            
            // Process each service status (data.services is an array)
            data.services.forEach(service => {
                const color = this.getStatusColor(service.status);
                const icon = service.name === 'database' ? 'DB' : 
                            service.name === 'ai' ? 'AI' : 
                            service.name === 'mcp' ? 'MCP' : 
                            service.name === 'mastra' ? 'AI' : service.name.toUpperCase();
                
                statusItems.push(`
                    <div class="flex items-center space-x-1">
                        <div class="w-2 h-2 bg-${color}-400 rounded-full"></div>
                        <span class="text-xs text-slate-600">${icon}</span>
                    </div>
                `);
            });

            indicators.innerHTML = statusItems.join('');
            
        } catch (error) {
            console.error('Failed to load status:', error);
            // Show error status
            const indicators = document.getElementById('statusIndicators');
            if (indicators) {
                indicators.innerHTML = `
                    <div class="flex items-center space-x-1">
                        <div class="w-2 h-2 bg-red-400 rounded-full"></div>
                        <span class="text-xs text-slate-600">System Error</span>
                    </div>
                `;
            }
        }
    }

    async loadDatabaseEntities() {
        try {
            const typeFilter = document.getElementById('entityTypeFilter').value;
            const limit = document.getElementById('limitInput').value || 50;
            
            const params = new URLSearchParams();
            if (typeFilter) params.append('type', typeFilter);
            params.append('limit', limit);
            
            const response = await fetch(`/api/entities?${params}`);
            const result = await response.json();
            
            if (result.success) {
                this.displayDatabaseEntities(result.entities);
            }
            
        } catch (error) {
            console.error('Failed to load entities:', error);
        }
    }

    displayDatabaseEntities(entities) {
        const container = document.getElementById('databaseEntities');
        
        if (!entities || entities.length === 0) {
            container.innerHTML = `
                <div class="text-center text-slate-400 py-8">
                    <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                        <i data-lucide="database" class="w-6 h-6 text-slate-300"></i>
                    </div>
                    <p class="text-slate-500 font-light">No entities in database</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        const entitiesHtml = entities.map(entity => `
            <div class="bg-white/50 rounded-lg p-3 border border-slate-200/50 hover:bg-white/70 transition-colors">
                <div class="flex items-center justify-between mb-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${this.getEntityColor(entity.type)}-100 text-${this.getEntityColor(entity.type)}-700">
                        ${this.getEntityIcon(entity.type)} ${entity.type}
                    </span>
                    <div class="text-xs text-slate-500">
                        ${Math.round(entity.confidence * 100)}%
                    </div>
                </div>
                <div class="font-medium text-slate-700 text-sm mb-1 truncate">${entity.value}</div>
                <div class="text-xs text-slate-500">${new Date(entity.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
        
        container.innerHTML = entitiesHtml;
        lucide.createIcons();
    }

    async showStatistics() {
        try {
            const response = await fetch('/api/stats');
            const result = await response.json();
            
            if (result.success) {
                const stats = result.stats;
                const statsHtml = `
                    <div class="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-200/50 rounded-xl p-6">
                        <div class="flex items-center space-x-2 mb-4">
                            <i data-lucide="bar-chart-3" class="w-5 h-5 text-blue-600"></i>
                            <h3 class="font-medium text-slate-700">Database Statistics</h3>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="text-center">
                                <div class="text-3xl font-light text-blue-600 mb-1">${stats.totalEntities}</div>
                                <div class="text-sm text-slate-600">Total Entities</div>
                            </div>
                            <div class="space-y-2">
                                ${Object.entries(stats.entityTypes).map(([type, count]) => 
                                    `<div class="flex justify-between items-center text-sm">
                                        <span class="text-slate-600">${this.getEntityIcon(type)} ${type}</span>
                                        <span class="font-medium text-slate-700">${count}</span>
                                    </div>`
                                ).join('')}
                            </div>
                        </div>
                        <div class="flex items-center justify-center space-x-1 text-xs text-slate-500 mt-4 pt-4 border-t border-blue-200/50">
                            <i data-lucide="clock" class="w-3 h-3"></i>
                            <span>Updated ${new Date(stats.lastUpdated).toLocaleString()}</span>
                        </div>
                    </div>
                `;
                
                const container = document.getElementById('databaseEntities');
                container.innerHTML = statsHtml;
                lucide.createIcons();
            }
            
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }

    getEntityColor(type) {
        const colors = {
            person: 'blue',
            organization: 'green',
            location: 'red',
            event: 'purple',
            product: 'yellow',
            financial: 'indigo',
            contact: 'pink',
            date: 'gray',
            time: 'teal'
        };
        return colors[type] || 'gray';
    }

    getEntityIcon(type) {
        const icons = {
            person: '👤',
            organization: '🏢',
            location: '📍',
            event: '📅',
            product: '📦',
            financial: '💰',
            contact: '📞',
            date: '📆',
            time: '⏰'
        };
        return icons[type] || '🏷️';
    }

    getStatusIcon(status) {
        const icons = {
            connected: 'check-circle',
            active: 'play-circle',
            ready: 'check',
            error: 'alert-circle'
        };
        return icons[status] || 'help-circle';
    }

    getStatusColor(status) {
        const colors = {
            connected: 'emerald',
            active: 'blue',
            ready: 'emerald',
            up: 'emerald',
            error: 'red',
            down: 'red'
        };
        return colors[status] || 'slate';
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');
        
        toastMessage.textContent = message;
        
        // Set icon based on type
        if (type === 'error') {
            toastIcon.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 text-red-500"></i>';
        } else {
            toastIcon.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 text-emerald-500"></i>';
        }
        
        toast.classList.remove('hidden');
        lucide.createIcons();
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }

    // AI Provider Management
    async loadAiProviders() {
        try {
            console.log('📡 Loading AI providers...');
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI providers timeout')), 3000)
            );
            
            const response = await Promise.race([
                fetch('/api/ai/providers'),
                timeoutPromise
            ]);
            
            const data = await response.json();
            
            if (data.success && data.providers) {
                const select = document.getElementById('aiProvider');
                if (select) {
                    select.innerHTML = '';
                    
                    data.providers.forEach(provider => {
                        const option = document.createElement('option');
                        option.value = provider.name;
                        option.textContent = provider.displayName;
                        select.appendChild(option);
                    });
                    
                    console.log('✅ AI providers loaded:', data.providers.map(p => p.name));
                }
            } else {
                console.warn('⚠️ Failed to load AI providers, using defaults');
                this.createDefaultProviderOptions();
            }
        } catch (error) {
            console.warn('⚠️ AI providers load failed:', error.message);
            this.createDefaultProviderOptions();
        }
    }
    
    createDefaultProviderOptions() {
        const select = document.getElementById('aiProvider');
        if (select) {
            select.innerHTML = `
                <option value="demo">Demo Mode</option>
                <option value="openai">OpenAI</option>
                <option value="mistral">Mistral AI</option>
            `;
            console.log('✅ Created default provider options');
        }
    }
    
    async loadAiStatus() {
        try {
            console.log('📡 Loading AI status...');
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI status timeout')), 3000)
            );
            
            const response = await Promise.race([
                fetch('/api/ai/status'),
                timeoutPromise
            ]);
            
            const data = await response.json();
            
            if (data.success && data.data) {
                this.currentAiProvider = data.data.current || 'openai';
                const select = document.getElementById('aiProvider');
                if (select) {
                    select.value = this.currentAiProvider;
                }
                console.log('✅ AI provider loaded:', this.currentAiProvider);
            } else {
                console.warn('⚠️ Failed to load AI status, using fallback');
                this.currentAiProvider = 'openai';
            }
        } catch (error) {
            console.warn('⚠️ AI status load failed:', error.message);
            this.currentAiProvider = 'openai'; // Fallback
        }
    }
    
    async switchAiProvider(event) {
        const newProvider = event.target.value;
        
        try {
            const response = await fetch('/api/ai/provider', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ provider: newProvider })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentAiProvider = newProvider;
                this.showToast(`✓ Switched to ${newProvider.toUpperCase()}`);
            } else {
                // Revert selection on failure
                document.getElementById('aiProvider').value = this.currentAiProvider;
                this.showToast(`✗ ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Failed to switch AI provider:', error);
            document.getElementById('aiProvider').value = this.currentAiProvider;
            this.showToast('✗ Failed to switch AI provider', 'error');
        }
    }

    toggleTextInput() {
        const textInputArea = document.getElementById('textInputArea');
        const isHidden = textInputArea.style.display === 'none';
        
        if (isHidden) {
            textInputArea.style.display = 'block';
            textInputArea.classList.add('fade-in');
            document.getElementById('textInput').focus();
        } else {
            textInputArea.style.display = 'none';
        }
    }

    async handleAudioFile(file) {
        try {
            this.showProcessingState('Processing uploaded file...');
            await this.uploadAudio(file, file.name);
        } catch (error) {
            console.error('File handling error:', error);
            this.showToast(`File processing failed: ${error.message}`, 'error');
        }
    }

    // Persona Management Methods
    async toggleAgentConfig() {
        const panel = document.getElementById('agentConfigPanel');
        const isVisible = !panel.classList.contains('hidden');
        
        if (!isVisible) {
            panel.classList.remove('hidden');
            await this.loadPersonas();
        } else {
            panel.classList.add('hidden');
        }
    }

    async loadPersonas() {
        try {
            const response = await fetch('/api/personas');
            const result = await response.json();
            
            if (result.success) {
                this.populatePersonaSelect(result.data.personas);
            } else {
                console.error('Failed to load personas:', result.error);
            }
        } catch (error) {
            console.error('Load personas error:', error);
        }
    }

    populatePersonaSelect(personas) {
        const select = document.getElementById('personaSelect');
        select.innerHTML = '<option value="">Default Persona</option>';
        
        personas.forEach(persona => {
            const option = document.createElement('option');
            option.value = persona.id;
            option.textContent = persona.name;
            select.appendChild(option);
        });
    }

    createNewPersona() {
        this.showPersonaForm();
        this.clearPersonaForm();
        this.currentPersonaId = null;
    }

    async editSelectedPersona() {
        const select = document.getElementById('personaSelect');
        const personaId = select.value;
        
        if (!personaId) {
            this.showToast('Please select a persona to edit', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/api/personas/${personaId}`);
            const result = await response.json();
            
            if (result.success) {
                this.populatePersonaForm(result.data.persona);
                this.currentPersonaId = personaId;
                this.showPersonaForm();
            } else {
                this.showToast('Failed to load persona', 'error');
            }
        } catch (error) {
            console.error('Edit persona error:', error);
            this.showToast('Failed to load persona', 'error');
        }
    }

    async deleteSelectedPersona() {
        const select = document.getElementById('personaSelect');
        const personaId = select.value;
        
        if (!personaId) {
            this.showToast('Please select a persona to delete', 'error');
            return;
        }
        
        if (!confirm('Are you sure you want to delete this persona?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/personas/${personaId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Persona deleted successfully');
                await this.loadPersonas();
            } else {
                this.showToast('Failed to delete persona', 'error');
            }
        } catch (error) {
            console.error('Delete persona error:', error);
            this.showToast('Failed to delete persona', 'error');
        }
    }

    async savePersona() {
        const personaData = this.getPersonaFormData();
        
        if (!personaData.name) {
            this.showToast('Persona name is required', 'error');
            return;
        }
        
        try {
            const url = this.currentPersonaId ? `/api/personas/${this.currentPersonaId}` : '/api/personas';
            const method = this.currentPersonaId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(personaData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Persona saved successfully');
                this.hidePersonaForm();
                await this.loadPersonas();
            } else {
                this.showToast('Failed to save persona', 'error');
            }
        } catch (error) {
            console.error('Save persona error:', error);
            this.showToast('Failed to save persona', 'error');
        }
    }

    cancelPersonaEdit() {
        this.hidePersonaForm();
        this.currentPersonaId = null;
    }

    showPersonaForm() {
        document.getElementById('personaForm').classList.remove('hidden');
    }

    hidePersonaForm() {
        document.getElementById('personaForm').classList.add('hidden');
    }

    clearPersonaForm() {
        document.getElementById('personaName').value = '';
        document.getElementById('personaDescription').value = '';
        document.getElementById('voiceProvider').value = 'openai';
        document.getElementById('voiceType').value = 'alloy';
        document.getElementById('voiceSpeed').value = '1.0';
        document.getElementById('voiceVolume').value = '1.0';
        document.getElementById('personalityTone').value = 'professional';
        document.getElementById('personalityStyle').value = 'conversational';
        document.getElementById('responseLength').value = 'medium';
        document.getElementById('personaExpertise').value = '';
        
        document.getElementById('speedValue').textContent = '1.0';
        document.getElementById('volumeValue').textContent = '1.0';
    }

    populatePersonaForm(persona) {
        document.getElementById('personaName').value = persona.name;
        document.getElementById('personaDescription').value = persona.description;
        
        const voice = persona.voice;
        document.getElementById('voiceProvider').value = voice.provider;
        document.getElementById('voiceType').value = voice.voice;
        document.getElementById('voiceSpeed').value = voice.speed;
        document.getElementById('voiceVolume').value = voice.volume;
        
        const personality = persona.personality;
        document.getElementById('personalityTone').value = personality.tone;
        document.getElementById('personalityStyle').value = personality.style;
        document.getElementById('responseLength').value = personality.responseLength;
        document.getElementById('personaExpertise').value = persona.expertise.join(', ');
        
        document.getElementById('speedValue').textContent = voice.speed;
        document.getElementById('volumeValue').textContent = voice.volume;
    }

    getPersonaFormData() {
        return {
            name: document.getElementById('personaName').value,
            description: document.getElementById('personaDescription').value,
            voice: {
                provider: document.getElementById('voiceProvider').value,
                voice: document.getElementById('voiceType').value,
                language: 'en',
                speed: parseFloat(document.getElementById('voiceSpeed').value),
                pitch: 0,
                volume: parseFloat(document.getElementById('voiceVolume').value)
            },
            personality: {
                tone: document.getElementById('personalityTone').value,
                style: document.getElementById('personalityStyle').value,
                traits: [],
                responseLength: document.getElementById('responseLength').value
            },
            expertise: document.getElementById('personaExpertise').value.split(',').map(s => s.trim()).filter(s => s)
        };
    }

    // TTS Methods
    async playAgentResponse() {
        const audioUrl = this.currentAgentResponse?.audioUrl;
        if (!audioUrl) {
            this.showToast('No audio response available', 'error');
            return;
        }
        
        try {
            const audio = new Audio(audioUrl);
            audio.volume = parseFloat(document.getElementById('responseVolume').value);
            
            audio.addEventListener('loadedmetadata', () => {
                const duration = Math.floor(audio.duration);
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                document.getElementById('responseDuration').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            });
            
            audio.addEventListener('play', () => {
                document.getElementById('playResponseBtn').classList.add('hidden');
                document.getElementById('stopResponseBtn').classList.remove('hidden');
            });
            
            audio.addEventListener('ended', () => {
                document.getElementById('playResponseBtn').classList.remove('hidden');
                document.getElementById('stopResponseBtn').classList.add('hidden');
            });
            
            this.currentAudio = audio;
            await audio.play();
            
        } catch (error) {
            console.error('Audio playback error:', error);
            this.showToast('Failed to play audio response', 'error');
        }
    }

    stopAgentResponse() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            document.getElementById('playResponseBtn').classList.remove('hidden');
            document.getElementById('stopResponseBtn').classList.add('hidden');
        }
    }

    async generateAgentResponse(input) {
        try {
            const personaId = document.getElementById('personaSelect').value;
            
            const response = await fetch('/api/agent/respond', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: input,
                    personaId: personaId || undefined,
                    includeAudio: true
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.displayAgentResponse(result.data);
                this.currentAgentResponse = result.data;
            } else {
                throw new Error(result.message || 'Failed to generate response');
            }
            
        } catch (error) {
            console.error('Agent response error:', error);
            this.showToast(`Failed to generate response: ${error.message}`, 'error');
        }
    }

    displayAgentResponse(response) {
        const panel = document.getElementById('agentResponsePanel');
        const textDiv = document.getElementById('agentResponseText');
        const entitiesDiv = document.getElementById('responseEntities');
        
        textDiv.textContent = response.text;
        panel.classList.remove('hidden');
        
        // Display entities if any
        if (response.entities && response.entities.length > 0) {
            this.displayResponseEntities(response.entities, entitiesDiv);
        } else {
            entitiesDiv.innerHTML = '';
        }
        
        // Show TTS controls if audio is available
        const ttsControls = document.getElementById('ttsControls');
        if (response.audioUrl) {
            ttsControls.classList.remove('hidden');
        } else {
            ttsControls.classList.add('hidden');
        }
        
        // Smooth scroll to response
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    displayResponseEntities(entities, container) {
        const entitiesHtml = entities.map((entity, index) => `
            <div class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-${this.getEntityColor(entity.type)}-100 text-${this.getEntityColor(entity.type)}-700 mr-2 mb-2">
                ${this.getEntityIcon(entity.type)} ${entity.type}: ${entity.value}
            </div>
        `).join('');
        
        container.innerHTML = `
            <div class="flex flex-wrap">
                ${entitiesHtml}
            </div>
        `;
        lucide.createIcons();
    }

    // Persona Management Methods
    showAddPersonaModal() {
        // Create modal HTML
        const modalHTML = `
            <div id="personaModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <div class="modern-card max-w-md w-full mx-4 p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-lg font-semibold text-slate-800">Add New Persona</h3>
                        <button id="closePersonaModal" class="text-slate-400 hover:text-slate-600">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                    <form id="personaForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-2">Name</label>
                            <input type="text" id="personaName" class="modern-input w-full px-3 py-2 rounded-lg" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-2">Title</label>
                            <input type="text" id="personaTitle" class="modern-input w-full px-3 py-2 rounded-lg" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-2">Company</label>
                            <input type="text" id="personaCompany" class="modern-input w-full px-3 py-2 rounded-lg" required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-2">Industry</label>
                            <select id="personaIndustry" class="modern-input w-full px-3 py-2 rounded-lg">
                                <option value="technology">Technology</option>
                                <option value="healthcare">Healthcare</option>
                                <option value="finance">Finance</option>
                                <option value="retail">Retail</option>
                                <option value="manufacturing">Manufacturing</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                            <select id="personaPriority" class="modern-input w-full px-3 py-2 rounded-lg">
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                        <div class="flex space-x-3 pt-4">
                            <button type="button" id="cancelPersona" class="flex-1 btn-primary text-slate-600 px-4 py-2 rounded-lg">
                                Cancel
                            </button>
                            <button type="submit" class="flex-1 floating-action text-white px-4 py-2 rounded-lg">
                                Add Persona
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        lucide.createIcons();
        
        // Add event listeners
        document.getElementById('closePersonaModal').addEventListener('click', () => {
            this.closePersonaModal();
        });
        
        document.getElementById('cancelPersona').addEventListener('click', () => {
            this.closePersonaModal();
        });
        
        document.getElementById('personaForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPersona();
        });
    }

    closePersonaModal() {
        const modal = document.getElementById('personaModal');
        if (modal) {
            modal.remove();
        }
    }

    addPersona() {
        const name = document.getElementById('personaName').value;
        const title = document.getElementById('personaTitle').value;
        const company = document.getElementById('personaCompany').value;
        const industry = document.getElementById('personaIndustry').value;
        const priority = document.getElementById('personaPriority').value;
        
        // Create new persona card
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
        const badgeClass = priority === 'high' ? 'persona-badge' : 
                          priority === 'medium' ? 'persona-badge secondary' : 'persona-badge success';
        
        const personaHTML = `
            <div class="persona-card rounded-xl p-4 cursor-pointer animate-fade-in">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-medium">
                        ${initials}
                    </div>
                    <div class="flex-1">
                        <h4 class="font-medium text-slate-800 text-sm">${name}</h4>
                        <p class="text-xs text-slate-500">${title}</p>
                    </div>
                    <div class="${badgeClass} px-2 py-0.5 rounded-full text-xs text-white">
                        ${priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </div>
                </div>
            </div>
        `;
        
        // Add to persona list
        const personaList = document.querySelector('.space-y-3');
        if (personaList) {
            personaList.insertAdjacentHTML('beforeend', personaHTML);
        }
        
        this.closePersonaModal();
        this.showToast(`Persona "${name}" added successfully!`);
        
        // Re-initialize event listeners for new persona cards
        this.setupPersonaEventListeners();
    }

    selectPersona(card) {
        // Remove active state from all cards
        document.querySelectorAll('.persona-card').forEach(c => {
            c.classList.remove('ring-2', 'ring-purple-500');
        });
        
        // Add active state to selected card
        card.classList.add('ring-2', 'ring-purple-500');
        
        // Extract persona info
        const name = card.querySelector('h4')?.textContent || 'Unknown';
        const title = card.querySelector('p')?.textContent || '';
        
        this.showToast(`Selected persona: ${name} - ${title}`);
        
        // Update active persona display
        this.updateActivePersona(name, title);
    }

    updateActivePersona(name, title) {
        const activePersonaCard = document.querySelector('.persona-card.rounded-2xl');
        if (activePersonaCard) {
            const nameElement = activePersonaCard.querySelector('h3');
            const titleElement = activePersonaCard.querySelector('p');
            
            if (nameElement) nameElement.textContent = name;
            if (titleElement) titleElement.textContent = title;
        }
    }

    handleQuickAction(action) {
        switch (action) {
            case 'search personas':
                this.showToast('Search functionality coming soon!');
                break;
            case 'filter by status':
                this.showToast('Filter functionality coming soon!');
                break;
            case 'analytics':
                this.showStatistics();
                break;
            default:
                this.showToast(`Action "${action}" not implemented yet`);
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MastraVoiceApp();
}); 