class MastraVoiceApp {
    constructor() {
        this.isRecording = false;
        this.isProcessing = false;
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.currentAiProvider = 'openai'; // Set default fallback value
        this.ws = null;
        
        // Text-to-speech setup
        this.speechSynthesis = window.speechSynthesis;
        this.voiceAssistant = null;
        this.isWaitingForUserInput = false;
        
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
            
            // Initialize voice assistant
            await this.initializeVoiceAssistant();
            
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
            
            // Welcome the user with voice assistant
            setTimeout(() => {
                this.welcomeUser();
            }, 1000); // Small delay to ensure everything is loaded
            
        } catch (error) {
            console.warn('⚠️ App initialization had issues:', error.message);
            // Ensure we have a fallback provider
            this.currentAiProvider = this.currentAiProvider || 'openai';
            console.log('🔄 Using fallback AI provider:', this.currentAiProvider);
            
            // Still try to welcome user even if other init failed
            setTimeout(() => {
                this.welcomeUser();
            }, 1000);
        }
    }

    async initializeVoiceAssistant() {
        try {
            // Wait for voices to be loaded
            if (this.speechSynthesis.getVoices().length === 0) {
                await new Promise(resolve => {
                    this.speechSynthesis.addEventListener('voiceschanged', resolve, { once: true });
                });
            }
            
            // Find the best French female voice
            const voices = this.speechSynthesis.getVoices();
            console.log('🎤 Available voices:', voices.map(v => `${v.name} (${v.lang})`));
            
            // Prefer French voices, then female voices
            this.voiceAssistant = voices.find(voice => 
                voice.lang.startsWith('fr') && voice.name.toLowerCase().includes('fem')
            ) || voices.find(voice => 
                voice.lang.startsWith('fr')
            ) || voices.find(voice => 
                voice.name.toLowerCase().includes('fem')
            ) || voices[0];
            
            console.log('🗣️ Selected voice assistant:', this.voiceAssistant?.name, this.voiceAssistant?.lang);
            
        } catch (error) {
            console.warn('⚠️ Voice assistant initialization failed:', error);
        }
    }

    speak(text, callback = null) {
        if (!this.speechSynthesis || !this.voiceAssistant) {
            console.warn('⚠️ Text-to-speech not available');
            if (callback) callback();
            return;
        }

        // Cancel any ongoing speech
        this.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = this.voiceAssistant;
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1.1; // Slightly higher for friendliness
        utterance.volume = 0.8;

        utterance.onend = () => {
            console.log('🗣️ Finished saying:', text);
            if (callback) callback();
        };

        utterance.onerror = (error) => {
            console.error('🗣️ Speech error:', error);
            if (callback) callback();
        };

        console.log('🗣️ Assistant saying:', text);
        this.speechSynthesis.speak(utterance);
    }

    welcomeUser() {
        const welcomeMessage = "Bonjour je suis votre assistante personnelle, que voulez-vous faire ?";
        
        this.speak(welcomeMessage, () => {
            // After welcome, automatically start recording session
            setTimeout(() => {
                console.log('🎙️ Starting automatic recording session...');
                this.isWaitingForUserInput = true;
                this.startRecording();
            }, 1000);
        });
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
        
        // Connect WebSocket after DOM is ready
        this.connectWebSocket();
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
            case 'entities_extracted':
                this.displayTranscription(data.transcription);
                this.displayEntities(data.entities);
                this.showToast('Entities extracted successfully!');
                break;
            case 'sales_analysis_complete':
                this.handleSalesAnalysisComplete(data);
                break;
            case 'tts_audio':
                this.playTTSAudio(data.audio_data, data.format);
                break;
            case 'error':
                this.showToast(`Error: ${data.error}`, 'error');
                break;
        }
    }

    async handleSalesAnalysisComplete(data) {
        console.log('📊 Sales analysis complete:', data);
        
        // Display transcription and entities as before
        this.displayTranscription(data.transcription);
        this.displayEntities(data.entities);
        
        // Display sales analysis
        this.displaySalesAnalysis(data.sales_analysis);
        
        // Display agent response
        this.displayAgentResponse(data.agent_response);
        
        // Display follow-up questions
        this.displayFollowUpQuestions(data.follow_up_questions);
        
        // Display opportunity information if available
        if (data.opportunity_match && data.opportunity_match.matched) {
            this.displayOpportunityMatch(data.opportunity_match);
        }
        
        // Show success notification
        const confidence = Math.round(data.sales_analysis.confidence * 100);
        this.showToast(`Sales analysis complete (${confidence}% confidence)${data.has_audio ? ' - Audio response ready' : ''}`, 'success');
        
        // Speak the agent response if TTS is not available via WebSocket
        if (!data.has_audio && data.agent_response) {
            setTimeout(() => {
                this.speak(data.agent_response);
            }, 1000);
        }
    }

    playTTSAudio(audioData, format = 'mp3') {
        try {
            console.log('🔊 Playing TTS audio response...');
            
            // Convert base64 to blob
            const byteCharacters = atob(audioData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const audioBlob = new Blob([byteArray], { type: `audio/${format}` });
            
            // Create audio URL and play
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onloadeddata = () => {
                console.log('🎵 TTS audio loaded, playing...');
                audio.play().catch(error => {
                    console.error('Failed to play TTS audio:', error);
                    this.showToast('Failed to play audio response', 'error');
                });
            };
            
            audio.onended = () => {
                console.log('🎵 TTS audio finished');
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.onerror = (error) => {
                console.error('TTS audio error:', error);
                URL.revokeObjectURL(audioUrl);
                this.showToast('Audio playback error', 'error');
            };
            
        } catch (error) {
            console.error('Failed to process TTS audio:', error);
            this.showToast('Failed to process audio response', 'error');
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
            // Immediate visual feedback with better animation
            this.showProcessingState('🎯 Initializing recording system...', 'requesting');
            this.updateRecordingUI('requesting');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 1 // Mono for better performance
                } 
            });
            
            console.log('🎤 Media stream obtained:', {
                audioTracks: stream.getAudioTracks().length,
                settings: stream.getAudioTracks()[0]?.getSettings()
            });
            
            // Set up real-time audio feedback
            this.setupAudioFeedback(stream);
            
            // Update UI to show we're setting up recording
            this.showProcessingState('⚙️ Optimizing audio settings...', 'preparing');
            this.updateRecordingUI('preparing');
            
            // Try different MIME types for better performance and compatibility
            const mimeTypes = [
                'audio/webm;codecs=opus', // Best compression
                'audio/webm;codecs=pcm',  // Better quality
                'audio/webm',             // Fallback
                'audio/mp4',              // Safari support
                ''                        // Browser default
            ];
            
            let mimeType = '';
            for (const type of mimeTypes) {
                if (!type || MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }
            
            console.log('🎵 Using optimized MIME type:', mimeType || 'default');
            
            this.mediaRecorder = new MediaRecorder(stream, { 
                mimeType: mimeType || undefined,
                audioBitsPerSecond: 128000 // Optimize bitrate for performance
            });
            
            console.log('📹 MediaRecorder created:', {
                mimeType: this.mediaRecorder.mimeType,
                state: this.mediaRecorder.state
            });
            
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                console.log('📊 Data chunk received:', {
                    size: event.data.size,
                    type: event.data.type
                });
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    // Real-time chunk processing could be added here
                    this.updateChunkProgress();
                }
            };
            
            this.mediaRecorder.onstop = () => {
                console.log('🛑 Recording stopped, processing...');
                this.stopAudioFeedback();
                this.processRecording();
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('🚨 MediaRecorder error:', event);
                this.showToast('Recording error occurred', 'error');
                this.stopAudioFeedback();
                this.hideProcessingState();
            };
            
            // Add event listener for when recording actually starts
            this.mediaRecorder.onstart = () => {
                console.log('🎬 MediaRecorder started - ready to record!');
                this.isRecording = true;
                this.updateRecordingUI('recording');
                this.startRecordingCountdown();
            };
            
            // Start recording with smaller chunks for better responsiveness
            this.mediaRecorder.start(500); // 500ms chunks for better real-time potential
            console.log('🎬 Starting optimized MediaRecorder...');
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.showToast(`Recording failed: ${error.message}`, 'error');
            this.hideProcessingState();
            this.updateRecordingUI('error');
        }
    }

    setupAudioFeedback(stream) {
        try {
            // Create audio context for simple voice detection
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Configure analyser for simple voice detection
            this.analyser.fftSize = 128;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // Connect microphone to analyser (no audio output)
            this.microphone.connect(this.analyser);
            
            // Set up data array for voice detection
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            
            // Start simple voice detection
            this.startVoiceDetection();
            
            console.log('🎵 Simple voice detection initialized');
        } catch (error) {
            console.warn('⚠️ Voice detection not available:', error);
            // Continue without voice detection if not supported
        }
    }

    startVoiceDetection() {
        if (!this.analyser || !this.isRecording) return;
        
        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Simple voice detection - check if there's significant audio
        const sum = this.dataArray.reduce((a, b) => a + b, 0);
        const average = sum / this.dataArray.length;
        const isSpeaking = average > 15; // Simple threshold for voice detection
        
        // Update simple visual indicator
        this.updateVoiceIndicator(isSpeaking);
        
        // Continue monitoring if still recording
        if (this.isRecording) {
            this.audioLevelAnimationFrame = requestAnimationFrame(() => this.startVoiceDetection());
        }
    }

    updateVoiceIndicator(isSpeaking) {
        const recordingStatus = document.getElementById('recordingStatus');
        if (!recordingStatus || !this.isRecording) return;
        
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Simple pulsing indicator
        const voiceIndicator = isSpeaking ? 
            '<div class="w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>' :
            '<div class="w-3 h-3 rounded-full bg-red-400"></div>';
        
        const statusText = isSpeaking ? 'Recording - Voice detected' : 'Recording - Speak now';
        
        recordingStatus.innerHTML = `
            <div class="flex items-center space-x-3 p-3">
                ${voiceIndicator}
                <span class="text-red-600 font-medium">${statusText}: ${timeStr}</span>
                <span class="text-slate-400 text-xs">
                    ${Math.round(this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0) / 1024)}KB
                </span>
            </div>
        `;
    }

    stopAudioFeedback() {
        // Stop audio level monitoring
        if (this.audioLevelAnimationFrame) {
            cancelAnimationFrame(this.audioLevelAnimationFrame);
            this.audioLevelAnimationFrame = null;
        }
        
        // Clean up audio context
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.analyser = null;
        this.dataArray = null;
        
        console.log('🎵 Audio feedback system stopped');
    }

    updateChunkProgress() {
        // Only update if not using real-time audio feedback
        if (this.audioContext && this.isRecording) {
            // Audio level display is handling the UI updates
            return;
        }
        
        const chunkCount = this.audioChunks.length;
        const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        const sizeKB = Math.round(totalSize / 1024);
        
        // Update recording status with chunk info (fallback when no audio feedback)
        if (this.isRecording) {
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            document.getElementById('recordingStatus').innerHTML = `
                <div class="flex items-center space-x-3 p-2">
                    <div class="w-3 h-3 rounded-full recording-indicator"></div>
                    <span class="text-red-600 font-medium">Recording: ${timeStr}</span>
                    <div class="flex items-center space-x-1 text-slate-400 text-xs">
                        <span>•</span>
                        <span>${sizeKB}KB</span>
                        <span>•</span>
                        <span>${chunkCount} chunks</span>
                    </div>
                </div>
            `;
        }
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
            
            // Clean up audio feedback
            this.stopAudioFeedback();
            
            // Clear timer
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }
            
            // Update UI
            this.updateRecordingUI('idle');
            
            // Voice assistant announces analysis
            if (this.isWaitingForUserInput) {
                const analysisMessage = "Je vais maintenant analyser ce que vous m'avez dit";
                this.speak(analysisMessage, () => {
                    this.showProcessingState('🧠 L\'assistante analyse votre message...');
                });
                this.isWaitingForUserInput = false;
            } else {
                this.showProcessingState('Processing audio...');
            }
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
            
            // Enhanced processing animation
            this.showProcessingAnimation('🔄 Preparing audio for analysis...', 0);
            
            if (this.audioChunks.length === 0) {
                throw new Error('No audio data recorded - please try recording again');
            }
            
            // Calculate total size to ensure we have actual data
            const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
            console.log('💾 Total audio data size:', totalSize, 'bytes');
            
            if (totalSize < 1000) { // Less than 1KB suggests no real audio was captured
                throw new Error('Audio recording too short or empty - please speak longer');
            }
            
            this.showProcessingAnimation('🎵 Optimizing audio format...', 20);
            
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
            
            this.showProcessingAnimation('📁 Packaging for upload...', 40);
            
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
            
            this.showProcessingAnimation('🚀 Starting AI analysis...', 60);
            
            // Upload the audio with enhanced progress tracking
            await this.uploadAudioWithProgress(audioBlob, filename);
            
        } catch (error) {
            console.error('🚨 Processing error:', error);
            this.showToast(`Processing failed: ${error.message}`, 'error');
            this.hideProcessingState();
            
            // Voice assistant can acknowledge the error
            this.speak("Désolée, j'ai rencontré un problème. Pouvez-vous essayer à nouveau ?");
        }
    }

    showProcessingAnimation(message, progress = 0) {
        const recordingStatus = document.getElementById('recordingStatus');
        const isComplete = progress >= 100;
        
        recordingStatus.innerHTML = `
            <div class="flex flex-col items-center space-y-3 p-4 processing-animation">
                <div class="flex items-center space-x-3">
                    <div class="relative">
                        <div class="processing-spinner rounded-full h-8 w-8 border-4 border-blue-200"></div>
                        <div class="processing-spinner rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent absolute top-0"></div>
                    </div>
                    <span class="text-blue-600 font-medium ${isComplete ? 'success-bounce' : ''}">${message}</span>
                </div>
                <div class="w-64 bg-gray-200 rounded-full h-2 progress-bar overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 h-2 rounded-full transition-all duration-1000 ease-out ${isComplete ? 'success-bounce' : ''}" 
                         style="width: ${progress}%"></div>
                </div>
                <div class="text-xs text-slate-500 transition-all duration-300">
                    ${progress}% complete ${isComplete ? '🎉' : ''}
                </div>
            </div>
        `;
    }

    async uploadAudioWithProgress(audioBlob, filename) {
        try {
            this.isProcessing = true;
            
            // Ensure we have a valid AI provider
            const provider = this.currentAiProvider || 'openai';
            const providerName = provider.toUpperCase();
            
            this.showProcessingAnimation(`🧠 Processing with ${providerName}...`, 70);
            
            console.log('📤 Uploading audio:', {
                filename: filename,
                size: audioBlob.size,
                type: audioBlob.type,
                provider: provider
            });
            
            const formData = new FormData();
            formData.append('audio', audioBlob, filename);
            
            // Enhanced upload with progress simulation
            this.showProcessingAnimation(`📡 Uploading to ${providerName}...`, 80);
            
            const response = await fetch('/api/process-audio', {
                method: 'POST',
                body: formData
            });
            
            this.showProcessingAnimation('🔍 Analyzing transcription...', 90);
            
            console.log('📥 Server response status:', response.status);
            const result = await response.json();
            console.log('📋 Server response:', result);
            
            if (result.success) {
                this.showProcessingAnimation('✅ Extracting entities...', 95);
                
                // Add a brief delay to show completion
                await new Promise(resolve => setTimeout(resolve, 500));
                
                this.showProcessingAnimation('🎉 Analysis complete!', 100);
                
                this.displayTranscription(result.data.transcription);
                this.displayEntities(result.data.entities);
                this.displayAnalysis(result.data.analysis);
                this.loadDatabaseEntities(); // Refresh database view
                
                // Voice assistant announces completion
                const entityCount = result.data.entities?.length || 0;
                let completionMessage;
                if (entityCount > 0) {
                    completionMessage = `Parfait ! J'ai identifié ${entityCount} élément${entityCount > 1 ? 's' : ''} important${entityCount > 1 ? 's' : ''} dans votre message.`;
                } else {
                    completionMessage = "J'ai bien analysé votre message. Que souhaitez-vous faire maintenant ?";
                }
                
                this.speak(completionMessage);
                
                // Show success with provider info
                const providerInfo = provider === 'demo' ? 'Demo Mode' : 
                                   provider === 'openai' ? 'OpenAI' : 'Mistral AI';
                this.showToast(`✓ Audio processed successfully with ${providerInfo}!`);
                
                // Clear processing state after success
                setTimeout(() => {
                    this.hideProcessingState();
                }, 3000); // Longer delay to let voice assistant speak
            } else {
                throw new Error(result.message || result.error || 'Processing failed');
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast(`Upload failed: ${error.message}`, 'error');
            // Voice assistant can acknowledge the error
            this.speak("Désolée, j'ai eu un problème avec l'analyse. Voulez-vous réessayer ?");
        } finally {
            this.isProcessing = false;
            // Don't hide processing state immediately if successful - let the success animation play
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
        
        this.showProcessingAnimation('📁 Processing uploaded file...', 10);
        await this.uploadAudioWithProgress(file, file.name);
    }

    // Backwards compatibility
    async uploadAudio(audioBlob, filename) {
        return this.uploadAudioWithProgress(audioBlob, filename);
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

    showProcessingState(message, state = 'idle') {
        const recordBtn = document.getElementById('recordBtn');
        const recordingStatus = document.getElementById('recordingStatus');
        
        if (state === 'idle') {
            recordBtn.innerHTML = `
                <div class="flex flex-col items-center">
                    <i data-lucide="mic" class="w-8 h-8 mb-2"></i>
                    <span class="text-sm">Record</span>
                </div>
            `;
            recordBtn.className = 'record-button bg-gradient-to-br from-red-50 to-rose-100 border-2 border-red-200 text-red-700 font-medium hover:from-red-100 hover:to-rose-200 flex items-center justify-center';
            recordingStatus.textContent = '';
        } else {
            recordBtn.innerHTML = `
                <div class="flex flex-col items-center">
                    <i data-lucide="${state}" class="w-8 h-8 mb-2 animate-spin"></i>
                    <span class="text-sm">${message}</span>
                </div>
            `;
            recordBtn.className = `record-button bg-gradient-to-br from-${state}-100 to-${state}-200 border-2 border-${state}-300 text-${state}-800 font-medium flex items-center justify-center`;
            recordingStatus.textContent = message;
        }
        
        lucide.createIcons();
    }

    hideProcessingState() {
        document.getElementById('recordingStatus').textContent = '';
    }

    displayTranscription(transcription) {
        const panel = document.getElementById('transcriptionPanel');
        const textDiv = document.getElementById('transcriptionText');
        
        textDiv.textContent = transcription;
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
            const response = await fetch('/health');
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
        console.log('📁 Audio file selected:', {
            name: file.name,
            size: file.size,
            type: file.type
        });
        
        if (!file.type.startsWith('audio/')) {
            this.showToast('Please select a valid audio file', 'error');
            return;
        }
        
        this.showProcessingState('Processing uploaded audio file...');
        await this.uploadAudio(file, file.name);
    }

    displaySalesAnalysis(analysis) {
        // Create or get sales analysis container
        let salesContainer = document.getElementById('salesAnalysisContainer');
        if (!salesContainer) {
            salesContainer = document.createElement('div');
            salesContainer.id = 'salesAnalysisContainer';
            salesContainer.className = 'mb-6';
            
            // Insert after transcription panel
            const transcriptionPanel = document.getElementById('transcriptionPanel');
            if (transcriptionPanel && transcriptionPanel.nextSibling) {
                transcriptionPanel.parentNode.insertBefore(salesContainer, transcriptionPanel.nextSibling);
            } else {
                document.querySelector('.main-content').appendChild(salesContainer);
            }
        }
        
        salesContainer.style.display = 'block';
        
        const opportunityHtml = analysis.opportunity_detected ? `
            <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <h4 class="text-green-800 font-medium text-sm mb-2">🎯 Sales Opportunity Detected</h4>
                ${analysis.opportunity_summary ? `
                    <div class="grid grid-cols-2 gap-3 text-xs">
                        <div><span class="text-green-600">Client:</span> <strong>${analysis.opportunity_summary.client}</strong></div>
                        <div><span class="text-green-600">Value:</span> <strong>${analysis.opportunity_summary.currency}${analysis.opportunity_summary.value?.toLocaleString() || 'TBD'}</strong></div>
                        <div><span class="text-green-600">Stage:</span> <strong>${analysis.opportunity_summary.stage}</strong></div>
                        <div><span class="text-green-600">Timeline:</span> <strong>${analysis.opportunity_summary.timeline}</strong></div>
                    </div>
                ` : ''}
            </div>
        ` : '';
        
        const insightsHtml = analysis.key_insights.map(insight => 
            `<li class="text-slate-600 text-sm">💡 ${insight}</li>`
        ).join('');
        
        const risksHtml = analysis.risk_factors.map(risk => 
            `<li class="text-red-600 text-sm">⚠️ ${risk}</li>`
        ).join('');
        
        const actionsHtml = analysis.next_actions.map(action => 
            `<li class="text-blue-600 text-sm">👉 ${action}</li>`
        ).join('');
        
        salesContainer.innerHTML = `
            <div class="glass-effect rounded-2xl p-6 border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
                <div class="flex items-center space-x-3 mb-4">
                    <i class="w-5 h-5 text-purple-600">💼</i>
                    <h2 class="text-lg font-medium text-purple-800">Sales Analysis</h2>
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${analysis.opportunity_detected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">
                        ${Math.round(analysis.confidence * 100)}% confidence
                    </span>
                </div>
                
                ${opportunityHtml}
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    ${analysis.key_insights.length > 0 ? `
                        <div>
                            <h4 class="text-purple-700 font-medium mb-2">Key Insights</h4>
                            <ul class="space-y-1">${insightsHtml}</ul>
                        </div>
                    ` : ''}
                    
                    ${analysis.risk_factors.length > 0 ? `
                        <div>
                            <h4 class="text-red-700 font-medium mb-2">Risk Factors</h4>
                            <ul class="space-y-1">${risksHtml}</ul>
                        </div>
                    ` : ''}
                    
                    ${analysis.next_actions.length > 0 ? `
                        <div>
                            <h4 class="text-blue-700 font-medium mb-2">Next Actions</h4>
                            <ul class="space-y-1">${actionsHtml}</ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    displayAgentResponse(response) {
        // Create or get agent response container
        let responseContainer = document.getElementById('agentResponseContainer');
        if (!responseContainer) {
            responseContainer = document.createElement('div');
            responseContainer.id = 'agentResponseContainer';
            responseContainer.className = 'mb-6';
            
            // Insert after sales analysis
            const salesContainer = document.getElementById('salesAnalysisContainer');
            if (salesContainer && salesContainer.nextSibling) {
                salesContainer.parentNode.insertBefore(responseContainer, salesContainer.nextSibling);
            } else {
                document.querySelector('.main-content').appendChild(responseContainer);
            }
        }
        
        responseContainer.style.display = 'block';
        responseContainer.innerHTML = `
            <div class="glass-effect rounded-2xl p-6 border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
                <div class="flex items-center space-x-3 mb-4">
                    <i class="w-5 h-5 text-blue-600">🤖</i>
                    <h2 class="text-lg font-medium text-blue-800">AI Assistant Response</h2>
                </div>
                <div class="text-slate-700 leading-relaxed">
                    ${response}
                </div>
            </div>
        `;
    }

    displayFollowUpQuestions(questions) {
        if (!questions || questions.length === 0) return;
        
        // Create or get questions container
        let questionsContainer = document.getElementById('followUpQuestionsContainer');
        if (!questionsContainer) {
            questionsContainer = document.createElement('div');
            questionsContainer.id = 'followUpQuestionsContainer';
            questionsContainer.className = 'mb-6';
            
            // Insert after agent response
            const responseContainer = document.getElementById('agentResponseContainer');
            if (responseContainer && responseContainer.nextSibling) {
                responseContainer.parentNode.insertBefore(questionsContainer, responseContainer.nextSibling);
            } else {
                document.querySelector('.main-content').appendChild(questionsContainer);
            }
        }
        
        questionsContainer.style.display = 'block';
        
        const questionsHtml = questions.map((question, index) => `
            <button class="w-full text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm" 
                    onclick="app.handleFollowUpQuestion('${question.replace(/'/g, "\\'")}')">
                <span class="text-blue-600 font-medium">${index + 1}.</span> ${question}
            </button>
        `).join('');
        
        questionsContainer.innerHTML = `
            <div class="glass-effect rounded-2xl p-6 border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                <div class="flex items-center space-x-3 mb-4">
                    <i class="w-5 h-5 text-amber-600">❓</i>
                    <h2 class="text-lg font-medium text-amber-800">Follow-up Questions</h2>
                </div>
                <div class="space-y-2">
                    ${questionsHtml}
                </div>
                <p class="text-xs text-amber-600 mt-3">Click a question to use it as your next input</p>
            </div>
        `;
    }

    displayOpportunityMatch(opportunityMatch) {
        if (!opportunityMatch || !opportunityMatch.matched) return;
        
        // Create or get opportunity container
        let opportunityContainer = document.getElementById('opportunityMatchContainer');
        if (!opportunityContainer) {
            opportunityContainer = document.createElement('div');
            opportunityContainer.id = 'opportunityMatchContainer';
            opportunityContainer.className = 'mb-6';
            
            // Insert after follow-up questions
            const questionsContainer = document.getElementById('followUpQuestionsContainer');
            if (questionsContainer && questionsContainer.nextSibling) {
                questionsContainer.parentNode.insertBefore(opportunityContainer, questionsContainer.nextSibling);
            } else {
                document.querySelector('.main-content').appendChild(opportunityContainer);
            }
        }
        
        opportunityContainer.style.display = 'block';
        
        const opportunity = opportunityMatch.existing_opportunity;
        const similarity = Math.round((opportunityMatch.similarity_score || 0) * 100);
        
        const differencesHtml = opportunityMatch.differences && opportunityMatch.differences.length > 0 ? `
            <div class="mt-3 p-2 bg-yellow-50 rounded">
                <h5 class="text-yellow-800 font-medium text-xs mb-1">Differences noted:</h5>
                <ul class="text-yellow-700 text-xs space-y-1">
                    ${opportunityMatch.differences.map(diff => `<li>• ${diff}</li>`).join('')}
                </ul>
            </div>
        ` : '';
        
        opportunityContainer.innerHTML = `
            <div class="glass-effect rounded-2xl p-6 border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                <div class="flex items-center space-x-3 mb-4">
                    <i class="w-5 h-5 text-green-600">🎯</i>
                    <h2 class="text-lg font-medium text-green-800">Opportunity Match Found</h2>
                    <span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ${similarity}% match
                    </span>
                </div>
                
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="text-green-600">Client:</span> <strong>${opportunity.client_organization || 'N/A'}</strong></div>
                    <div><span class="text-green-600">Value:</span> <strong>${opportunity.currency}${opportunity.estimated_value?.toLocaleString() || 'TBD'}</strong></div>
                    <div><span class="text-green-600">Stage:</span> <strong>${opportunity.stage}</strong></div>
                    <div><span class="text-green-600">Probability:</span> <strong>${Math.round(opportunity.probability * 100)}%</strong></div>
                </div>
                
                ${opportunityMatch.merge_recommended ? `
                    <div class="mt-3 p-2 bg-blue-50 rounded">
                        <span class="text-blue-800 font-medium text-xs">💡 Merge recommended - similar opportunity detected</span>
                    </div>
                ` : ''}
                
                ${differencesHtml}
            </div>
        `;
    }

    handleFollowUpQuestion(question) {
        // Set the question as input and trigger processing
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.value = question;
            // Show text input if hidden
            const textInputArea = document.getElementById('textInputArea');
            if (textInputArea.style.display === 'none') {
                this.toggleTextInput();
            }
            // Auto-process the question
            this.processText();
        } else {
            // Fallback: speak the question and start recording
            this.speak(`You asked: ${question}. Please provide your answer.`, () => {
                setTimeout(() => {
                    this.startRecording();
                }, 1000);
            });
        }
    }
}

// Initialize the app when the page loads
let app; // Global reference for onclick handlers
document.addEventListener('DOMContentLoaded', () => {
    app = new MastraVoiceApp();
}); 