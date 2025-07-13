import OpenAI from 'openai';
import { Mistral } from '@mistralai/mistralai';
import type { 
  AIProvider, 
  ExtractedEntity, 
  AgentResponse
} from '../types/index.js';

interface ChainOfThoughtStep {
  step: number;
  reasoning: string;
  action: string;
  result?: string;
  confidence: number;
}

interface ChainOfThoughtProcess {
  query: string;
  steps: ChainOfThoughtStep[];
  finalReasoning: string;
  selectedAgent: string;
  confidence: number;
  processedAt: string;
}

interface AgentCapability {
  name: string;
  description: string;
  expertise: string[];
  confidence: number;
}

interface TaskContext {
  type: 'voice_processing' | 'entity_extraction' | 'response_generation' | 'tts' | 'analysis';
  input: string | Buffer;
  metadata?: Record<string, unknown>;
  requiredCapabilities: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface AgentTask {
  id: string;
  context: TaskContext;
  assignedAgent: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
}

interface AgentMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageResponseTime: number;
  successRate: number;
  lastUpdated: string;
}

export class MasterAgent {
  private openai: OpenAI | null = null;
  private mistral: Mistral | null = null;
  private aiProvider: AIProvider;
  private registeredAgents: Map<string, AgentCapability> = new Map();
  private taskQueue: AgentTask[] = [];
  private activeAgents: Map<string, any> = new Map();
  private metrics: Map<string, AgentMetrics> = new Map();

  constructor() {
    this.aiProvider = (process.env.AI_PROVIDER as AIProvider) || 'openai';
    
    // Initialize AI providers
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    if (process.env.MISTRAL_API_KEY) {
      this.mistral = new Mistral({
        apiKey: process.env.MISTRAL_API_KEY
      });
    }
    
    this.initializeDefaultAgents();
  }

  private initializeDefaultAgents(): void {
    // Register default agent capabilities
    this.registerAgent('voice-processor', {
      name: 'Voice Processor',
      description: 'Specialized in voice transcription and audio processing',
      expertise: ['transcription', 'audio-processing', 'speech-to-text'],
      confidence: 0.9
    });

    this.registerAgent('entity-extractor', {
      name: 'Entity Extractor',
      description: 'Specialized in extracting entities from text',
      expertise: ['entity-extraction', 'nlp', 'text-analysis'],
      confidence: 0.85
    });

    this.registerAgent('response-generator', {
      name: 'Response Generator',
      description: 'Specialized in generating conversational responses',
      expertise: ['conversation', 'response-generation', 'dialogue'],
      confidence: 0.8
    });

    this.registerAgent('tts-synthesizer', {
      name: 'TTS Synthesizer',
      description: 'Specialized in text-to-speech synthesis',
      expertise: ['tts', 'voice-synthesis', 'audio-generation'],
      confidence: 0.88
    });

    this.registerAgent('data-analyst', {
      name: 'Data Analyst',
      description: 'Specialized in data analysis and insights',
      expertise: ['analytics', 'data-processing', 'insights'],
      confidence: 0.82
    });
  }

  async initialize(): Promise<boolean> {
    console.log('🧠 Master Agent initializing...');
    
    const availableProviders: string[] = [];
    if (this.openai) availableProviders.push('OpenAI');
    if (this.mistral) availableProviders.push('Mistral');
    
    console.log(`🧠 Master Agent initialized with providers: ${availableProviders.join(', ')}`);
    console.log(`🤖 Registered agents: ${Array.from(this.registeredAgents.keys()).join(', ')}`);
    
    return true;
  }

  registerAgent(id: string, capability: AgentCapability): void {
    this.registeredAgents.set(id, capability);
    this.metrics.set(id, {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageResponseTime: 0,
      successRate: 0,
      lastUpdated: new Date().toISOString()
    });
    console.log(`🤖 Registered agent: ${id} - ${capability.name}`);
  }

  setActiveAgent(id: string, agent: any): void {
    this.activeAgents.set(id, agent);
    console.log(`🔄 Active agent set: ${id}`);
  }

  private async performChainOfThought(task: TaskContext): Promise<ChainOfThoughtProcess> {
    const startTime = Date.now();
    const steps: ChainOfThoughtStep[] = [];
    
    // Step 1: Analyze the task
    steps.push({
      step: 1,
      reasoning: `Analyzing task of type '${task.type}' with priority '${task.priority}'`,
      action: 'ANALYZE_TASK',
      confidence: 0.9
    });

    // Step 2: Evaluate agent capabilities
    const suitableAgents = this.findSuitableAgents(task.requiredCapabilities);
    steps.push({
      step: 2,
      reasoning: `Found ${suitableAgents.length} suitable agents for capabilities: ${task.requiredCapabilities.join(', ')}`,
      action: 'EVALUATE_AGENTS',
      result: suitableAgents.map(a => a.name).join(', '),
      confidence: 0.85
    });

    // Step 3: Select best agent using AI reasoning
    const selectedAgent = await this.selectBestAgent(task, suitableAgents);
    steps.push({
      step: 3,
      reasoning: `Selected agent '${selectedAgent.name}' based on expertise match and current performance metrics`,
      action: 'SELECT_AGENT',
      result: selectedAgent.name,
      confidence: selectedAgent.confidence
    });

    // Step 4: Generate final reasoning
    const finalReasoning = await this.generateFinalReasoning(task, selectedAgent, steps);

    return {
      query: task.type,
      steps,
      finalReasoning,
      selectedAgent: selectedAgent.name,
      confidence: this.calculateOverallConfidence(steps),
      processedAt: new Date().toISOString()
    };
  }

  private findSuitableAgents(requiredCapabilities: string[]): AgentCapability[] {
    const suitableAgents: AgentCapability[] = [];
    
    for (const [id, capability] of this.registeredAgents) {
      const matchingCapabilities = capability.expertise.filter(exp => 
        requiredCapabilities.some(req => exp.includes(req) || req.includes(exp))
      );
      
      if (matchingCapabilities.length > 0) {
        suitableAgents.push({
          ...capability,
          confidence: capability.confidence * (matchingCapabilities.length / requiredCapabilities.length)
        });
      }
    }
    
    return suitableAgents.sort((a, b) => b.confidence - a.confidence);
  }

  private async selectBestAgent(task: TaskContext, suitableAgents: AgentCapability[]): Promise<AgentCapability> {
    if (suitableAgents.length === 0) {
      throw new Error('No suitable agents found for task');
    }

    // If only one agent, select it
    if (suitableAgents.length === 1) {
      return suitableAgents[0];
    }

    // Use AI to make intelligent selection
    try {
      const selectionPrompt = this.createAgentSelectionPrompt(task, suitableAgents);
      const selection = await this.queryAI(selectionPrompt);
      
      // Parse AI response and select agent
      const selectedName = this.parseAgentSelection(selection, suitableAgents);
      const selectedAgent = suitableAgents.find(a => a.name === selectedName);
      if (!selectedAgent && suitableAgents.length === 0) {
        throw new Error('No suitable agents available');
      }
      return selectedAgent || suitableAgents[0];
    } catch (error) {
      console.error('AI selection failed, using highest confidence agent:', error);
      return suitableAgents[0];
    }
  }

  private createAgentSelectionPrompt(task: TaskContext, agents: AgentCapability[]): string {
    return `
You are a master agent coordinator. Select the best agent for this task.

Task Details:
- Type: ${task.type}
- Priority: ${task.priority}
- Required Capabilities: ${task.requiredCapabilities.join(', ')}

Available Agents:
${agents.map(a => `- ${a.name}: ${a.description} (Confidence: ${a.confidence})`).join('\n')}

Consider:
1. Agent expertise alignment with task requirements
2. Current performance metrics
3. Task priority and complexity

Respond with only the agent name that would be best for this task.
`.trim();
  }

  private async generateFinalReasoning(task: TaskContext, agent: AgentCapability, steps: ChainOfThoughtStep[]): Promise<string> {
    const reasoningPrompt = `
Generate a clear explanation of why this agent selection makes sense.

Task: ${task.type}
Selected Agent: ${agent.name}
Agent Expertise: ${agent.expertise.join(', ')}

Chain of Thought Steps:
${steps.map(s => `${s.step}. ${s.reasoning}`).join('\n')}

Provide a concise final reasoning (2-3 sentences).
`;

    try {
      const reasoning = await this.queryAI(reasoningPrompt);
      return reasoning || `Selected ${agent.name} as it best matches the required capabilities for ${task.type} with high confidence.`;
    } catch (error) {
      return `Selected ${agent.name} as it best matches the required capabilities for ${task.type} with high confidence.`;
    }
  }

  private parseAgentSelection(response: string, agents: AgentCapability[]): string {
    const cleanResponse = response.trim().toLowerCase();
    
    // Find agent by name match
    for (const agent of agents) {
      if (cleanResponse.includes(agent.name.toLowerCase())) {
        return agent.name;
      }
    }
    
    // Fallback to first agent
    return agents.length > 0 ? agents[0].name : 'unknown';
  }

  private calculateOverallConfidence(steps: ChainOfThoughtStep[]): number {
    if (steps.length === 0) return 0;
    
    const totalConfidence = steps.reduce((sum, step) => sum + step.confidence, 0);
    return totalConfidence / steps.length;
  }

  private async queryAI(prompt: string): Promise<string> {
    if (this.aiProvider === 'openai' && this.openai) {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3
      });
      return completion.choices[0]?.message?.content || '';
    } else if (this.aiProvider === 'mistral' && this.mistral) {
      const response = await this.mistral.chat.complete({
        model: 'mistral-tiny',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.3
      });
      const content = response.choices[0]?.message?.content;
      return typeof content === 'string' ? content : '';
    } else {
      // Demo mode - simple heuristic
      return `Demo response for: ${prompt.substring(0, 100)}...`;
    }
  }

  async processTask(context: TaskContext): Promise<AgentResponse> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Perform chain of thought reasoning
      const chainOfThought = await this.performChainOfThought(context);
      
      console.log(`🧠 Chain of Thought completed for task ${taskId}:`);
      console.log(`   Selected Agent: ${chainOfThought.selectedAgent}`);
      console.log(`   Confidence: ${chainOfThought.confidence}`);
      console.log(`   Reasoning: ${chainOfThought.finalReasoning}`);
      
      // Create and queue the task
      const task: AgentTask = {
        id: taskId,
        context,
        assignedAgent: chainOfThought.selectedAgent,
        status: 'pending',
        startTime: Date.now()
      };
      
      this.taskQueue.push(task);
      
      // Execute the task
      const result = await this.executeTask(task);
      
      // Update metrics
      this.updateAgentMetrics(task.assignedAgent, task);
      
      return {
        text: result.text || 'Task completed successfully',
        entities: result.entities || [],
        confidence: chainOfThought.confidence,
        responseTime: Date.now() - task.startTime,
        personaUsed: task.assignedAgent,
        audioUrl: result.audioUrl
      };
      
    } catch (error) {
      console.error(`❌ Task ${taskId} failed:`, error);
      throw error;
    }
  }

  private async executeTask(task: AgentTask): Promise<any> {
    task.status = 'processing';
    
    try {
      const agent = this.activeAgents.get(task.assignedAgent);
      
      if (!agent) {
        throw new Error(`Agent ${task.assignedAgent} not found in active agents`);
      }
      
      let result: any;
      
      // Route to appropriate agent method based on task type
      switch (task.context.type) {
        case 'voice_processing':
          result = await agent.processVoiceInput?.(task.context.input);
          break;
        case 'entity_extraction':
          result = await agent.extractEntities?.(task.context.input);
          break;
        case 'response_generation':
          result = await agent.generateResponse?.(task.context.input);
          break;
        case 'tts':
          result = await agent.synthesizeSpeech?.(task.context.input);
          break;
        case 'analysis':
          result = await agent.analyzeEntities?.(task.context.input);
          break;
        default:
          throw new Error(`Unknown task type: ${task.context.type}`);
      }
      
      task.status = 'completed';
      task.result = result;
      task.endTime = Date.now();
      
      return result;
      
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.endTime = Date.now();
      throw error;
    }
  }

  private updateAgentMetrics(agentId: string, task: AgentTask): void {
    const metrics = this.metrics.get(agentId);
    if (!metrics) return;
    
    metrics.totalTasks++;
    
    if (task.status === 'completed') {
      metrics.completedTasks++;
    } else if (task.status === 'failed') {
      metrics.failedTasks++;
    }
    
    metrics.successRate = metrics.completedTasks / metrics.totalTasks;
    
    if (task.endTime) {
      const responseTime = task.endTime - task.startTime;
      metrics.averageResponseTime = 
        (metrics.averageResponseTime * (metrics.totalTasks - 1) + responseTime) / metrics.totalTasks;
    }
    
    metrics.lastUpdated = new Date().toISOString();
    this.metrics.set(agentId, metrics);
  }

  getRegisteredAgents(): Map<string, AgentCapability> {
    return this.registeredAgents;
  }

  getAgentMetrics(agentId?: string): AgentMetrics | Map<string, AgentMetrics> {
    if (agentId) {
      return this.metrics.get(agentId) || {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageResponseTime: 0,
        successRate: 0,
        lastUpdated: new Date().toISOString()
      };
    }
    return this.metrics;
  }

  getTaskQueue(): AgentTask[] {
    return this.taskQueue;
  }

  async getSystemStatus(): Promise<{
    masterAgent: string;
    registeredAgents: number;
    activeAgents: number;
    queuedTasks: number;
    totalTasksProcessed: number;
    overallSuccessRate: number;
  }> {
    const totalTasks = Array.from(this.metrics.values()).reduce((sum, m) => sum + m.totalTasks, 0);
    const completedTasks = Array.from(this.metrics.values()).reduce((sum, m) => sum + m.completedTasks, 0);
    
    return {
      masterAgent: 'active',
      registeredAgents: this.registeredAgents.size,
      activeAgents: this.activeAgents.size,
      queuedTasks: this.taskQueue.filter(t => t.status === 'pending').length,
      totalTasksProcessed: totalTasks,
      overallSuccessRate: totalTasks > 0 ? completedTasks / totalTasks : 0
    };
  }
}