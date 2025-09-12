import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import session from 'express-session';
import cors from 'cors';
import compression from 'compression';
import authRoutes from './routes/authRoutes.js';
import cliAuthRoutes from './routes/cliAuthRoutes.js';
import githubRoutes from './routes/githubRoutes.js';
import githubOAuthRoutes from './routes/githubOAuthRoutes.js';
import agentStructureRoutes from './routes/agentStructureRoutes.js';

// Importing all route files
import companyRoutes from './routes/companyRoutes.js';
import companyMetricRoutes from './routes/companyMetricRoutes.js';
import companyMetricLogRoutes from './routes/companyMetricLogRoutes.js';
import companyMetricModelRoutes from './routes/companyMetricModelRoutes.js';
import datasetRoutes from './routes/datasetRoutes.js';
import datasetGroupRoutes from './routes/datasetGroupRoutes.js';
import modelRoutes from './routes/modelRoutes.js';
import modelDatasetRoutes from './routes/modelDatasetRoutes.js';
import modelGroupRoutes from './routes/modelGroupRoutes.js';
import modelLogRoutes from './routes/modelLogRoutes.js';
import modelMetricRoutes from './routes/modelMetricRoutes.js';
import modelMetricLogRoutes from './routes/modelMetricLogRoutes.js';
import userRoutes from './routes/userRoutes.js';
import trackRoutes from './routes/trackRoutes.js';
import monitoringRoutes from './routes/monitoringRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import abTestRoutes from './routes/abTestRoutes.js';  
import insightsRoutes from './routes/insightsRoutes.js';
import performanceRoutes from './routes/performanceRoutes.js';
import authenticateJWT from './middleware/authMiddleware.js';
import automaticOptimizationRoutes from './routes/automaticOptimizationRoutes.js';
import evaluatorRoutes from './routes/evaluatorRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import { addMetricJob } from './jobs/metricJob.js';
import setupRouter from './routes/setupRouter.js';
import samplingRoutes from './routes/samplingRoutes.js';
import nodeMetricsRoutes from './routes/nodeMetricsRoutes.js';
import messageRouter from './routes/messageRouter.js';
import validateApiToken from './middleware/apiTokenMiddleware.js';
import promptVersionRoutes from './routes/promptVersionRoutes.js';
import integrationTokenRoutes from './routes/integrationTokenRoutes.js';
import evaluatorMetricRoutes from './routes/evaluatorMetricRoutes.js';
import providersRoutes from './routes/providersRoutes.js';
import reviewersTemplateRoutes from './routes/reviewersTemplateRoutes.js';
import promptRoutes from './routes/promptRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import notificationSystemRoutes from './routes/notificationSystemRoutes.js';
import emailAutonomRoutes from './routes/emailAutonomRoutes.js';
import promptOptimizationRoutes from './routes/promptOptimizationRoutes.js';
import ingestRoutes from './routes/ingestRoutes.js';
import agentMaintenanceRoutes from './routes/agentMaintenanceRoutes.js';

dotenv.config();

const app = express();


// Enable compression
app.use(compression());

// Enable CORS for all routes
app.use(cors({
  origin: ['http://127.0.0.1:3000', 'http://localhost:3000', 'http://localhost:3002', '*', 'https://handit-dashboard.vercel.app', 'https://dashboard.handit.ai', 'https://sandbox.handit.ai','https://try.handit.ai', 'https://handit.ai', 'https://www.handit.ai', 'https://beta.handit.ai', 'https://www.beta.handit.ai'],
}));

// Remove global chunked transfer encoding middleware
// Only specific endpoints will set this header as needed

// Configure body-parser with increased limits for all routes
app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

// Special configuration for track routes to handle even larger payloads
const trackBodyParser = bodyParser.json({ limit: '500mb' });
const trackUrlEncoded = bodyParser.urlencoded({ limit: '500mb', extended: true });

app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use('/api/setup', setupRouter);
app.use('/api/email-autonom', emailAutonomRoutes);


// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/cli/auth', cliAuthRoutes);
app.use('/api/git', githubRoutes);
app.use('/api/auth/github', githubOAuthRoutes);
app.use('/api/sampling', validateApiToken, samplingRoutes);
app.use('/api/node-metrics', validateApiToken, nodeMetricsRoutes);
app.use('/api/messages', validateApiToken, messageRouter);
app.use('/api/agent-structure', validateApiToken, agentStructureRoutes);

app.use('/api/email', emailRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/agent-maintenance', agentMaintenanceRoutes);

app.use('/api/notification-system', notificationSystemRoutes);


// Apply JWT authentication middleware to all routes except auth routes
app.use(authenticateJWT);
app.use('/api/prompts', promptRoutes);
app.use('/api/setup-assistant', setupRouter);

app.use('/api/evaluator', evaluatorRoutes);
app.use('/api/automatic-optimization', automaticOptimizationRoutes);
app.use('/api/ab-tests', abTestRoutes);
app.use('/api/model-metric-logs', modelMetricLogRoutes);
// Apply special body parser configuration for track routes
app.use('/api/track', trackBodyParser, trackUrlEncoded, trackRoutes);
// Protected routes
app.use('/api/companies', companyRoutes);
app.use('/api/company-metrics', companyMetricRoutes);
app.use('/api/company-metric-logs', companyMetricLogRoutes);
app.use('/api/company-metric-models', companyMetricModelRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/dataset-groups', datasetGroupRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/model-datasets', modelDatasetRoutes);
app.use('/api/model-groups', modelGroupRoutes);
app.use('/api/model-logs', modelLogRoutes);
app.use('/api/model-metrics', modelMetricRoutes);
app.use('/api/users', userRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/prompt-versions', promptVersionRoutes);
app.use('/api/integration-tokens', integrationTokenRoutes);
app.use('/api/evaluator-metrics', evaluatorMetricRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/reviewers-template', reviewersTemplateRoutes);
app.use('/api/prompt-optimization', promptOptimizationRoutes);

// Add sampling routes

// Add setup routes

// Configure express to handle large payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const scheduleMetricJobs = async () => {
  // Define your metric jobs here
  const metricJobs = [
    {
      cronTime: '* * * * *',
    }
  ];

  for (const job of metricJobs) {
    try {
      await addMetricJob(job);
      console.log(`Scheduled metric job: ${job.metricType} with cron time: ${job.cronTime}`);
    } catch (error) {
      console.error(`Failed to schedule metric job: ${job.metricType}`, error);
    }
  }
};
console.log("Hello World");
scheduleMetricJobs();
