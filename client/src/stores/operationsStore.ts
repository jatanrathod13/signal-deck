/**
 * Operations Store
 * Tracks schedule/webhook runtime events for observability dashboards.
 */

import { create } from 'zustand';
import type { ScheduleTriggeredEvent, WebhookDeliveryEvent } from '../types';

interface OperationsStore {
  scheduleEvents: ScheduleTriggeredEvent[];
  webhookEvents: WebhookDeliveryEvent[];
  addScheduleEvent: (event: ScheduleTriggeredEvent) => void;
  addWebhookEvent: (event: WebhookDeliveryEvent) => void;
  clearOperationsEvents: () => void;
}

const MAX_EVENTS = 200;

export const useOperationsStore = create<OperationsStore>((set) => ({
  scheduleEvents: [],
  webhookEvents: [],

  addScheduleEvent: (event) => {
    set((state) => ({
      scheduleEvents: [event, ...state.scheduleEvents].slice(0, MAX_EVENTS)
    }));
  },

  addWebhookEvent: (event) => {
    set((state) => ({
      webhookEvents: [event, ...state.webhookEvents].slice(0, MAX_EVENTS)
    }));
  },

  clearOperationsEvents: () => {
    set({ scheduleEvents: [], webhookEvents: [] });
  }
}));
