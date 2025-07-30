/**
 * @fileoverview Redux Store Configuration
 * Central store configuration for the application using Redux Toolkit
 */

import { datasetsApi } from '@/services/datasetsService';
import { modelsMetricsApi } from '@/services/modelMetricsService';
import { modelsApi } from '@/services/modelsService';
import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { authApi } from '../services/auth/authService';
import { kpiApi } from '../services/kpiService'; // Import the kpiApi
import authReducer, { logout } from './authSlice';
import { alertsApi } from '@/services/alertsService';
import { monitoringApi } from '@/services/monitoringService';
import { dashboardApi } from '@/services/dashboardService';
import { insightsApi } from '@/services/insightsService';
import { agentsApi } from '@/services/agentsService';
import { setupApi } from '@/services/setupService';
import { demoEmailApi } from '@/services/demoEmailService';
import { conversationApi } from '@/services/conversationService';
import { promptApi } from '@/services/promptService';
import { reviewersTemplateApi } from '@/services/reviewersTemplateService';
import { integrationTokenApi } from '@/services/integrationTokenService';
import { evaluatorMetricApi } from '@/services/evaluatorMetricService';
import { providerApi } from '@/services/providerService';
import { cliAuthApi } from '@/services/cliAuthService';

/**
 * Combined reducer for all application state
 * @type {Reducer}
 * 
 * @description
 * Combines all reducers including:
 * - Authentication state
 * - API slices for various services
 * - Core application state
 */
const appReducer = combineReducers({
  auth: authReducer,
  [authApi.reducerPath]: authApi.reducer,
  [kpiApi.reducerPath]: kpiApi.reducer,
  [modelsApi.reducerPath]: modelsApi.reducer,
  [alertsApi.reducerPath]: alertsApi.reducer,
  [monitoringApi.reducerPath]: monitoringApi.reducer,
  [modelsMetricsApi.reducerPath]: modelsMetricsApi.reducer,
  [datasetsApi.reducerPath]: datasetsApi.reducer,
  [dashboardApi.reducerPath]: dashboardApi.reducer,
  [insightsApi.reducerPath]: insightsApi.reducer,
  [agentsApi.reducerPath]: agentsApi.reducer,
  [setupApi.reducerPath]: setupApi.reducer,
  [demoEmailApi.reducerPath]: demoEmailApi.reducer,
  [conversationApi.reducerPath]: conversationApi.reducer,
  [promptApi.reducerPath]: promptApi.reducer,
  [reviewersTemplateApi.reducerPath]: reviewersTemplateApi.reducer,
  [integrationTokenApi.reducerPath]: integrationTokenApi.reducer,
  [evaluatorMetricApi.reducerPath]: evaluatorMetricApi.reducer,
  [providerApi.reducerPath]: providerApi.reducer,
  [cliAuthApi.reducerPath]: cliAuthApi.reducer,
});

/**
 * Root reducer with logout functionality
 * @param {Object} state - Current state
 * @param {Object} action - Action being dispatched
 * @returns {Object} New state
 * 
 * @description
 * Handles the root state management:
 * - Resets state on logout
 * - Delegates to appReducer for all other actions
 */
const rootReducer = (state, action) => {
  if (action.type === logout.type) {
    state = undefined;
  }

  return appReducer(state, action);
};

/**
 * Configured Redux store
 * @type {Store}
 * 
 * @description
 * Creates and configures the Redux store with:
 * - Combined reducers
 * - RTK Query middleware for all API slices
 * - Default middleware configuration
 */
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(authApi.middleware)
      .concat(kpiApi.middleware)
      .concat(modelsApi.middleware)
      .concat(alertsApi.middleware)
      .concat(datasetsApi.middleware)
      .concat(modelsMetricsApi.middleware)
      .concat(monitoringApi.middleware)
      .concat(dashboardApi.middleware)
      .concat(insightsApi.middleware)
      .concat(agentsApi.middleware)
      .concat(setupApi.middleware)
      .concat(demoEmailApi.middleware)
      .concat(promptApi.middleware)
      .concat(conversationApi.middleware)
      .concat(reviewersTemplateApi.middleware)
      .concat(integrationTokenApi.middleware)
      .concat(evaluatorMetricApi.middleware)
      .concat(providerApi.middleware)
      .concat(cliAuthApi.middleware),
});
