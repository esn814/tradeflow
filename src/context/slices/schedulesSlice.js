import { useCallback } from 'react';

export const SCHEDULES_DEFAULTS = [];

export function useSchedulesActions(store, setStore) {
  const addSchedule = useCallback((schedule) => {
    setStore(prev => ({
      ...prev,
      schedules: [...prev.schedules, { ...schedule, id: schedule.id || `sch-${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10) }],
    }));
  }, [setStore]);

  const updateSchedule = useCallback((id, patch) => {
    setStore(prev => ({
      ...prev,
      schedules: prev.schedules.map(s => s.id === id ? { ...s, ...patch } : s),
    }));
  }, [setStore]);

  const removeSchedule = useCallback((id) => {
    setStore(prev => ({
      ...prev,
      schedules: prev.schedules.filter(s => s.id !== id),
    }));
  }, [setStore]);

  return { addSchedule, updateSchedule, removeSchedule };
}
