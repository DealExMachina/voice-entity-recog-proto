class MastraVoiceApp {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.ws = null;
        this.currentAiProvider = 'demo';
        
        this.initializeEventListeners();
        this.connectWebSocket();
        this.loadSystemStatus();
        this.loadDatabaseEntities();
        this.loadAiProviders();
        this.loadAiStatus();
    }

    initializeEventListeners() {
        // Recording controls
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        
        // File upload
        document.getElementById('uploadBtn').addEventListener('click', () => this.processAudioFile());
        
        // Text processing
        document.getElementById('processTextBtn').addEventListener('click', () => this.processText());
        
        // Status and database controls
        document.getElementById('refreshStatus').addEventListener('click', () => this.loadSystemStatus());
        document.getElementById('refreshEntities').addEventListener('click', () => this.loadDatabaseEntities());
        document.getElementById('showStats').addEventListener('click', () => this.showStatistics());
        
        // Entity filtering
        document.getElementById('entityTypeFilter').addEventListener('change', () => this.loadDatabaseEntities());
        document.getElementById('limitInput').addEventListener('change', () => this.loadDatabaseEntities());
        
        // AI Provider selection
        document.getElementById('aiProvider').addEventListener('change', (e) => this.switchAiProvider(e));
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
            case 'error':
                this.showToast(`Error: ${data.message}`, 'error');
                break;
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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            
            // Update UI
            const recordBtn = document.getElementById('recordBtn');
            recordBtn.innerHTML = `
                <div class="flex items-center justify-center space-x-3">
                    <div class="relative">
                        <i data-lucide="square" class="w-6 h-6"></i>
                        <div class="absolute inset-0 rounded-full bg-red-400 opacity-20 recording"></div>
                    </div>
                    <span>Stop Recording</span>
                </div>
            `;
            recordBtn.className = 'group relative bg-gradient-to-br from-gray-100 to-slate-200 border border-gray-300 text-gray-700 px-10 py-6 rounded-2xl text-lg font-medium hover:from-gray-200 hover:to-slate-300 transition-all duration-300';
            
            document.getElementById('recordingStatus').textContent = 'Recording... Click to stop';
            lucide.createIcons();
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showToast('Failed to start recording. Please check microphone permissions.', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            this.isRecording = false;
            
            // Update UI
            const recordBtn = document.getElementById('recordBtn');
            recordBtn.innerHTML = `
                <div class="flex items-center justify-center space-x-3">
                    <div class="relative">
                        <i data-lucide="mic" class="w-6 h-6"></i>
                        <div class="absolute inset-0 rounded-full bg-red-400 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                    </div>
                    <span>Start Recording</span>
                </div>
            `;
            recordBtn.className = 'group relative bg-gradient-to-br from-red-50 to-rose-100 border border-red-200 text-red-700 px-10 py-6 rounded-2xl text-lg font-medium hover:from-red-100 hover:to-rose-200 transition-all duration-300 transform hover:scale-105';
            
            document.getElementById('recordingStatus').textContent = 'Processing...';
            lucide.createIcons();
        }
    }

    async processRecording() {
        try {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            await this.uploadAudio(audioBlob, 'recording.wav');
        } catch (error) {
            console.error('Error processing recording:', error);
            this.showToast('Failed to process recording', 'error');
        }
        
        document.getElementById('recordingStatus').textContent = '';
    }

    async processAudioFile() {
        const fileInput = document.getElementById('audioUpload');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select an audio file', 'error');
            return;
        }
        
        await this.uploadAudio(file, file.name);
    }

    async uploadAudio(audioBlob, filename) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, filename);
            
            const response = await fetch('/api/process-audio', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.displayTranscription(result.transcription);
                this.displayEntities(result.entities);
                this.displayAnalysis(result.analysis);
                this.loadDatabaseEntities(); // Refresh database view
                this.showToast('Audio processed successfully!');
            } else {
                throw new Error(result.message || 'Processing failed');
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast(`Upload failed: ${error.message}`, 'error');
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
                this.showToast('Entities extracted successfully!');
            } else {
                throw new Error(result.message || 'Extraction failed');
            }
            
        } catch (error) {
            console.error('Text processing error:', error);
            this.showToast(`Processing failed: ${error.message}`, 'error');
        }
    }

    displayTranscription(transcription) {
        const panel = document.getElementById('transcriptionPanel');
        const textDiv = document.getElementById('transcriptionText');
        
        textDiv.textContent = transcription;
        panel.style.display = 'block';
    }

    displayEntities(entities) {
        const container = document.getElementById('resultsContainer');
        
        if (!entities || entities.length === 0) {
            container.innerHTML = `
                <div class="text-center text-slate-400 py-12">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                        <i data-lucide="search" class="w-8 h-8 text-slate-300"></i>
                    </div>
                    <p class="text-slate-500 font-light mb-1">No entities found</p>
                    <p class="text-sm text-slate-400">Try a different input</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        const entitiesHtml = entities.map(entity => `
            <div class="entity-card bg-gradient-to-br from-white/80 to-slate-50/80 border border-slate-200/50 rounded-xl p-4 mb-3 hover:shadow-md transition-all duration-200">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center space-x-2 mb-2">
                            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-${this.getEntityColor(entity.type)}-100 text-${this.getEntityColor(entity.type)}-700 border border-${this.getEntityColor(entity.type)}-200">
                                ${this.getEntityIcon(entity.type)} ${entity.type}
                            </span>
                            <div class="flex items-center space-x-1 text-xs text-slate-400">
                                <i data-lucide="zap" class="w-3 h-3"></i>
                                <span>${Math.round(entity.confidence * 100)}%</span>
                            </div>
                        </div>
                        <div class="font-medium text-slate-800 mb-1">${entity.value}</div>
                        ${entity.context ? `<div class="text-sm text-slate-500 font-light italic leading-relaxed">"${entity.context}"</div>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = entitiesHtml;
        lucide.createIcons();
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
            
            const statusHtml = Object.entries(data.services).map(([service, status]) => `
                <div class="text-center p-4 rounded-xl bg-white/50 backdrop-blur-sm border border-slate-200/50">
                    <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-${this.getStatusColor(status)}-100 flex items-center justify-center">
                        <i data-lucide="${this.getStatusIcon(status)}" class="w-6 h-6 text-${this.getStatusColor(status)}-600"></i>
                    </div>
                    <div class="font-medium text-slate-700 capitalize text-sm">${service}</div>
                    <div class="text-xs text-slate-500 capitalize mt-1">${status}</div>
                </div>
            `).join('');
            
            document.getElementById('statusDisplay').innerHTML = statusHtml;
            lucide.createIcons();
            
        } catch (error) {
            console.error('Failed to load status:', error);
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
            <div class="flex items-center justify-between p-4 border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <div class="flex items-center space-x-3 flex-1">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-${this.getEntityColor(entity.type)}-100 text-${this.getEntityColor(entity.type)}-700 border border-${this.getEntityColor(entity.type)}-200">
                        ${this.getEntityIcon(entity.type)} ${entity.type}
                    </span>
                    <span class="font-medium text-slate-700 truncate">${entity.value}</span>
                </div>
                <div class="text-right text-xs text-slate-500 flex-shrink-0 ml-3">
                    <div class="flex items-center space-x-1 mb-1">
                        <i data-lucide="zap" class="w-3 h-3"></i>
                        <span>${Math.round(entity.confidence * 100)}%</span>
                    </div>
                    <div>${new Date(entity.created_at).toLocaleDateString()}</div>
                </div>
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
            error: 'red'
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
            const response = await fetch('/api/ai/providers');
            const data = await response.json();
            
            if (data.success) {
                const select = document.getElementById('aiProvider');
                select.innerHTML = '';
                
                data.providers.forEach(provider => {
                    const option = document.createElement('option');
                    option.value = provider.name;
                    option.textContent = provider.displayName;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load AI providers:', error);
        }
    }
    
    async loadAiStatus() {
        try {
            const response = await fetch('/api/ai/status');
            const data = await response.json();
            
            if (data.success) {
                this.currentAiProvider = data.current;
                document.getElementById('aiProvider').value = this.currentAiProvider;
            }
        } catch (error) {
            console.error('Failed to load AI status:', error);
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
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MastraVoiceApp();
}); 