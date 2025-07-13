import express, { Request, Response } from 'express';
import type { 
  ApiResponse, 
  EmailSearchCriteria,
  CalendarSearchCriteria,
  ScheduledMeeting
} from '../types/index.js';
import type { IntegrationService } from '../services/integration-service.js';

// Extend Express Request to include our app locals
declare global {
  namespace Express {
    interface Locals {
      integrationService: IntegrationService;
    }
  }
}

const router = express.Router();

// Get integration status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const status = await integrationService.getAgentStatus();
    
    const response: ApiResponse = {
      success: true,
      data: status
    };
    
    res.json(response);
  } catch (error) {
    console.error('Integration status error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get integration status',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Start all sync processes
router.post('/sync/start', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    await integrationService.startAllSync();
    
    const response: ApiResponse = {
      success: true,
      message: 'All sync processes started successfully'
    };
    
    res.json(response);
  } catch (error) {
    console.error('Start sync error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to start sync processes',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Stop all sync processes
router.post('/sync/stop', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    await integrationService.stopAllSync();
    
    const response: ApiResponse = {
      success: true,
      message: 'All sync processes stopped successfully'
    };
    
    res.json(response);
  } catch (error) {
    console.error('Stop sync error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to stop sync processes',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Get recent activity
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const activity = await integrationService.getRecentActivity(limit);
    
    const response: ApiResponse = {
      success: true,
      data: activity
    };
    
    res.json(response);
  } catch (error) {
    console.error('Recent activity error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get recent activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Get analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const analytics = await integrationService.getAnalytics();
    
    const response: ApiResponse = {
      success: true,
      data: analytics
    };
    
    res.json(response);
  } catch (error) {
    console.error('Analytics error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Search entities
router.get('/entities/search', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const query = req.query.q as string;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      } as ApiResponse);
    }
    
    const entities = await integrationService.searchEntities(query);
    
    const response: ApiResponse = {
      success: true,
      data: entities
    };
    
    res.json(response);
  } catch (error) {
    console.error('Entity search error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to search entities',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Get entity summary
router.get('/entities/:entityId/summary', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const { entityId } = req.params;
    
    const summary = await integrationService.getEntitySummary(entityId);
    
    const response: ApiResponse = {
      success: true,
      data: summary
    };
    
    res.json(response);
  } catch (error) {
    console.error('Entity summary error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get entity summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Get client timeline
router.get('/entities/:entityId/timeline', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const { entityId } = req.params;
    
    const timeline = await integrationService.getClientTimeline(entityId);
    
    const response: ApiResponse = {
      success: true,
      data: timeline
    };
    
    res.json(response);
  } catch (error) {
    console.error('Client timeline error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get client timeline',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Schedule meeting
router.post('/meetings', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const meetingData = req.body as Partial<ScheduledMeeting>;
    
    if (!meetingData.title || !meetingData.entity_ids || meetingData.entity_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Title and entity_ids are required'
      } as ApiResponse);
    }
    
    const meetingId = await integrationService.scheduleMeeting(meetingData);
    
    const response: ApiResponse = {
      success: true,
      data: { meeting_id: meetingId },
      message: 'Meeting scheduled successfully'
    };
    
    res.json(response);
  } catch (error) {
    console.error('Schedule meeting error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to schedule meeting',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Send email
router.post('/email/send', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const { to, subject, body, cc, bcc, attachments } = req.body;
    
    if (!to || !Array.isArray(to) || to.length === 0 || !subject || !body) {
      return res.status(400).json({
        success: false,
        error: 'to, subject, and body are required'
      } as ApiResponse);
    }
    
    const emailId = await integrationService.sendEmail(to, subject, body, {
      cc,
      bcc,
      attachments
    });
    
    const response: ApiResponse = {
      success: true,
      data: { email_id: emailId },
      message: 'Email sent successfully'
    };
    
    res.json(response);
  } catch (error) {
    console.error('Send email error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to send email',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Create calendar event
router.post('/calendar/events', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const eventData = req.body;
    
    if (!eventData.title || !eventData.start_time || !eventData.end_time) {
      return res.status(400).json({
        success: false,
        error: 'title, start_time, and end_time are required'
      } as ApiResponse);
    }
    
    const eventId = await integrationService.createCalendarEvent(eventData);
    
    const response: ApiResponse = {
      success: true,
      data: { event_id: eventId },
      message: 'Calendar event created successfully'
    };
    
    res.json(response);
  } catch (error) {
    console.error('Create calendar event error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to create calendar event',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

// Get client communications
router.get('/communications/:entityId', async (req: Request, res: Response) => {
  try {
    const { integrationService } = req.app.locals;
    const { entityId } = req.params;
    
    const communications = await integrationService.getClientCommunications(entityId);
    
    const response: ApiResponse = {
      success: true,
      data: communications
    };
    
    res.json(response);
  } catch (error) {
    console.error('Client communications error:', error);
    const errorResponse: ApiResponse = {
      success: false,
      error: 'Failed to get client communications',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    res.status(500).json(errorResponse);
  }
});

export default router;