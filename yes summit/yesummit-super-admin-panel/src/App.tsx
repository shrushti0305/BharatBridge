/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TabKey,
  UserRole,
  Incident,
  Task,
  Vehicle,
  Volunteer,
  Session,
  AreaController,
  Participant,
  SentBroadcast,
  ActivityItem,
  ToastNotification,
  VIPGuest
} from './types';
import {
  INITIAL_CONTROLLERS,
  INITIAL_INCIDENTS,
  INITIAL_TASKS,
  INITIAL_VEHICLES,
  INITIAL_VOLUNTEERS,
  INITIAL_SESSIONS,
  INITIAL_PARTICIPANTS,
  INITIAL_BROADCASTS,
  INITIAL_ACTIVITIES
} from './data/initialData';
import { INITIAL_VIP_GUESTS } from './data/vipData';
import { Header } from './components/Header';
import { TabNav } from './components/TabNav';
import { OverviewTab } from './components/OverviewTab';
import { VIPProtocolTab } from './components/VIPProtocolTab';
import { IncidentsTab } from './components/IncidentsTab';
import { TasksTab } from './components/TasksTab';
import { MobilityTab } from './components/MobilityTab';
import { VolunteersTab } from './components/VolunteersTab';
import { SessionsTab } from './components/SessionsTab';
import { HeadsTab } from './components/HeadsTab';
import { MapTab } from './components/MapTab';
import { ParticipantsTab } from './components/ParticipantsTab';
import { CommsTab } from './components/CommsTab';
import { AdminTab } from './components/AdminTab';
import { ToastContainer } from './components/ToastContainer';
import { QuickActionsFAB } from './components/QuickActionsFAB';
import { DataImportModal, ImportDatasetType } from './components/DataImportModal';
import { SystemArchitectureModal } from './components/SystemArchitectureModal';
import { GoogleMapsAssistantModal } from './components/GoogleMapsAssistantModal';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ShiftHandoverModal } from './components/ShiftHandoverModal';
import { EnvironmentalRibbon } from './components/EnvironmentalRibbon';
import {
  setMasterAudioMuted,
  playSuccessChime,
  playTacticalClick,
  playAlertAlarm
} from './utils/audioFeedback';

export default function App() {
  // Navigation & View state
  const [currentTab, setCurrentTab] = useState<TabKey>('overview');
  const [userRole, setUserRole] = useState<UserRole>('super_admin');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch {
      return false;
    }
  });

  // Operational System States
  const [scanningPaused, setScanningPaused] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importDatasetType, setImportDatasetType] = useState<ImportDatasetType>('vip');
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState<boolean>(false);
  const [isMapsModalOpen, setIsMapsModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isShiftBriefingOpen, setIsShiftBriefingOpen] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [mapsInitialPrompt, setMapsInitialPrompt] = useState<string>('');
  const [mapsContextTitle, setMapsContextTitle] = useState<string>('');

  const handleOpenMapsGrounding = (initialPrompt?: string, contextTitle?: string) => {
    setMapsInitialPrompt(initialPrompt || '');
    setMapsContextTitle(contextTitle || '');
    setIsMapsModalOpen(true);
  };

  const handleToggleAudioMute = () => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      setMasterAudioMuted(next);
      return next;
    });
  };

  // Global hotkey: Cmd+K or Ctrl+K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Entities Data State (Pure in-memory, no localStorage per spec)
  const [vipGuests, setVIPGuests] = useState<VIPGuest[]>(INITIAL_VIP_GUESTS);
  const [controllers, setControllers] = useState<AreaController[]>(INITIAL_CONTROLLERS);
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [volunteers, setVolunteers] = useState<Volunteer[]>(INITIAL_VOLUNTEERS);
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [participants, setParticipants] = useState<Participant[]>(INITIAL_PARTICIPANTS);
  const [broadcasts, setBroadcasts] = useState<SentBroadcast[]>(INITIAL_BROADCASTS);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Selected Detail records for drawers
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);

  // Sync theme with html root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Helper to add toast
  const addToast = useCallback((title: string, message: string, type: ToastNotification['type'] = 'info') => {
    const id = 'toast-' + Math.random().toString(36).substring(2, 9);
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const newToast: ToastNotification = { id, title, message, type, timestamp: now };
    setToasts((prev) => [newToast, ...prev].slice(0, 5));

    // Auto dismiss after 6s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper to log activity
  const logActivity = useCallback((message: string, category: ActivityItem['category'] = 'system') => {
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    const id = 'act-' + Math.random().toString(36).substring(2, 9);
    setActivities((prev) => [{ id, timestamp: now, message, category }, ...prev]);
  }, []);

  // Map Movement Simulation (every 1.2s, clamped to zones and routes)
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      // 1. Move vehicles slightly along safe coordinate ranges
      setVehicles((prev) =>
        prev.map((vh) => {
          if (vh.status === 'BREAKDOWN') return vh; // Breakdown vehicle is stationary
          const deltaX = (Math.random() - 0.48) * 3;
          const deltaY = (Math.random() - 0.48) * 3;
          let newX = vh.x + deltaX;
          let newY = vh.y + deltaY;

          // Clamp to overall road layout
          newX = Math.max(90, Math.min(880, newX));
          newY = Math.max(50, Math.min(510, newY));

          return { ...vh, x: newX, y: newY };
        })
      );

      // 2. Move volunteers slightly, strictly clamped inside their assigned zone bounding box
      setVolunteers((prev) =>
        prev.map((vol) => {
          if (vol.status === 'OFFLINE') return vol;
          const deltaX = (Math.random() - 0.5) * 2;
          const deltaY = (Math.random() - 0.5) * 2;
          const bounds = vol.zoneBounds;

          let newX = vol.x + deltaX;
          let newY = vol.y + deltaY;

          // Strict boundary clamping
          newX = Math.max(bounds.minX + 5, Math.min(bounds.maxX - 5, newX));
          newY = Math.max(bounds.minY + 5, Math.min(bounds.maxY - 5, newY));

          return { ...vol, x: newX, y: newY };
        })
      );
    }, 1200);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Zone coordinates lookup for moving volunteers
  const getZoneBounds = (zoneName: string) => {
    switch (zoneName) {
      case 'Main Hall':
        return { minX: 430, maxX: 630, minY: 120, maxY: 220 };
      case 'Hall A':
        return { minX: 260, maxX: 390, minY: 120, maxY: 220 };
      case 'Hall B':
        return { minX: 260, maxX: 390, minY: 260, maxY: 360 };
      case 'Exhibition':
        return { minX: 430, maxX: 600, minY: 260, maxY: 335 };
      case 'Registration':
        return { minX: 430, maxX: 540, minY: 370, maxY: 420 };
      case 'Medical':
        return { minX: 570, maxX: 640, minY: 370, maxY: 420 };
      case 'Food Court':
        return { minX: 670, maxX: 810, minY: 310, maxY: 400 };
      case 'VIP':
        return { minX: 670, maxX: 810, minY: 120, maxY: 200 };
      case 'Help Desk':
        return { minX: 670, maxX: 810, minY: 230, maxY: 280 };
      case 'Entry/Exit':
      default:
        return { minX: 380, maxX: 610, minY: 445, maxY: 495 };
    }
  };

  // --- Handlers for Incidents ---
  const handleUpdateIncidentStatus = (id: string, newStatus: Incident['status']) => {
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === id) {
          const updatedTimeline = [
            ...inc.timeline,
            { time: now, text: `Status updated to ${newStatus}`, actor: 'Super Admin' }
          ];
          const updated = { ...inc, status: newStatus, timeline: updatedTimeline };
          if (selectedIncident?.id === id) setSelectedIncident(updated);
          return updated;
        }
        return inc;
      })
    );

    if (newStatus === 'RESOLVED') {
      addToast('Incident Resolved', `Incident ${id} has been marked resolved.`, 'success');
      logActivity(`Incident ${id} marked resolved by Super Admin`, 'incident');
    } else {
      addToast('Incident Reopened', `Incident ${id} status set to ${newStatus}.`, 'warning');
      logActivity(`Incident ${id} reopened as ${newStatus}`, 'incident');
    }
  };

  const handleAssignTeam = (id: string, teamName: string) => {
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === id) {
          const updated = {
            ...inc,
            assignedTeam: teamName,
            status: inc.status === 'OPEN' ? 'IN_PROGRESS' : inc.status,
            timeline: [...inc.timeline, { time: now, text: `Assigned to ${teamName}`, actor: 'Super Admin' }]
          };
          if (selectedIncident?.id === id) setSelectedIncident(updated);
          return updated;
        }
        return inc;
      })
    );
    addToast('Team Assigned', `Incident ${id} assigned to ${teamName}.`, 'info');
    logActivity(`Incident ${id} assigned to ${teamName}`, 'incident');
  };

  const handleEscalateIncident = (id: string) => {
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    setIncidents((prev) =>
      prev.map((inc) => {
        if (inc.id === id) {
          const updated = {
            ...inc,
            escalatedToLead: true,
            timeline: [...inc.timeline, { time: now, text: 'Escalated to Command Centre Lead & Super Admin', actor: 'Super Admin' }]
          };
          if (selectedIncident?.id === id) setSelectedIncident(updated);
          return updated;
        }
        return inc;
      })
    );
    addToast('Incident Escalated', `Incident ${id} escalated to Command Centre Lead.`, 'error');
    logActivity(`Incident ${id} escalated to Command Centre Lead`, 'incident');
  };

  const handleSendAlert = (inc: Incident) => {
    addToast('Zone Alert Dispatched', `Broadcast alert sent to on-duty volunteers near ${inc.location}.`, 'warning');
    logActivity(`Urgent push alert dispatched for ${inc.id} (${inc.location})`, 'incident');
  };

  const handleCreateIncident = (newInc: Omit<Incident, 'id' | 'reportedAt' | 'minutesAgo' | 'timeline'>) => {
    const nextNum = incidents.length + 25;
    const newId = `INC-0${nextNum}`;
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });

    const created: Incident = {
      ...newInc,
      id: newId,
      reportedAt: now,
      minutesAgo: 0,
      timeline: [{ time: now, text: 'Incident logged by Super Admin', actor: 'Super Admin' }]
    };

    setIncidents((prev) => [created, ...prev]);
    setSelectedIncident(created);
    addToast('Incident Logged', `Incident ${newId} logged successfully.`, 'warning');
    logActivity(`Incident ${newId} logged by Super Admin: ${created.title}`, 'incident');
  };

  // --- Handlers for Tasks ---
  const handleAdvanceTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          let nextStatus: Task['status'] = t.status;
          if (t.status === 'NEW') nextStatus = 'ASSIGNED';
          else if (t.status === 'ASSIGNED') nextStatus = 'IN_PROGRESS';
          else if (t.status === 'IN_PROGRESS') nextStatus = 'COMPLETED';

          logActivity(`Task ${t.id} moved to ${nextStatus}`, 'task');
          addToast('Task Advanced', `Task ${t.id} advanced to ${nextStatus}.`, 'info');
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  };

  const handleRegressTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          let prevStatus: Task['status'] = t.status;
          if (t.status === 'COMPLETED') prevStatus = 'IN_PROGRESS';
          else if (t.status === 'IN_PROGRESS') prevStatus = 'ASSIGNED';
          else if (t.status === 'ASSIGNED') prevStatus = 'NEW';

          return { ...t, status: prevStatus };
        }
        return t;
      })
    );
  };

  const handleCreateTask = (newTask: Omit<Task, 'id' | 'createdAt'>) => {
    const newId = `TSK-${tasks.length + 109}`;
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    const created: Task = {
      ...newTask,
      id: newId,
      createdAt: now
    };
    setTasks((prev) => [created, ...prev]);
    addToast('Task Created', `Task ${newId} posted to Kanban.`, 'info');
    logActivity(`Task ${newId} created: ${created.title}`, 'task');
  };

  // --- Handlers for Mobility ---
  const handleReassignRoute = (id: string, newRoute: string) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          const updated = { ...v, route: newRoute };
          if (selectedVehicle?.id === id) setSelectedVehicle(updated);
          return updated;
        }
        return v;
      })
    );
    addToast('Route Reassigned', `Vehicle ${id} reassigned to ${newRoute}.`, 'info');
    logActivity(`Vehicle ${id} reassigned to route ${newRoute}`, 'mobility');
  };

  const handleReportIncidentForVehicle = (v: Vehicle) => {
    handleCreateIncident({
      title: `Vehicle ${v.id} issue reported on ${v.route}`,
      type: 'Mobility',
      location: v.location,
      priority: 'HIGH',
      status: 'OPEN',
      reporter: `Driver ${v.driver} (${v.id})`,
      assignedTeam: 'Mobility Fleet Relief Team',
      affectedCount: parseInt(v.passengers) || 30,
      description: `Vehicle alert triggered for ${v.id}. Driver: ${v.driver}. Route: ${v.route}. Battery/Fuel: ${v.batteryFuel}%. Location: ${v.location}.`
    });
    setCurrentTab('incidents');
  };

  // --- Handlers for Volunteers ---
  const handleAssignTaskToVolunteer = (volId: string, taskTitle: string) => {
    setVolunteers((prev) =>
      prev.map((v) => {
        if (v.id === volId) {
          const updated = { ...v, currentTask: taskTitle, status: 'BUSY' as const };
          if (selectedVolunteer?.id === volId) setSelectedVolunteer(updated);
          return updated;
        }
        return v;
      })
    );
    addToast('Volunteer Task Assigned', `${volId} assigned to "${taskTitle}".`, 'info');
    logActivity(`Volunteer ${volId} assigned task: ${taskTitle}`, 'volunteer');
  };

  const handleMoveVolunteerZone = (volId: string, newZone: string) => {
    const bounds = getZoneBounds(newZone);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    setVolunteers((prev) =>
      prev.map((v) => {
        if (v.id === volId) {
          const updated = {
            ...v,
            zone: newZone,
            zoneBounds: bounds,
            x: centerX,
            y: centerY
          };
          if (selectedVolunteer?.id === volId) setSelectedVolunteer(updated);
          return updated;
        }
        return v;
      })
    );
    addToast('Zone Reassigned', `${volId} relocated to ${newZone}. Coordinates clamped to new boundary.`, 'info');
    logActivity(`Volunteer ${volId} relocated to zone ${newZone}`, 'volunteer');
  };

  const handleRequestReplacement = (volId: string) => {
    addToast('Replacement Requested', `Relief volunteer request submitted to Volunteer Controller for ${volId}.`, 'warning');
    logActivity(`Replacement relief requested for volunteer ${volId}`, 'volunteer');
  };

  const handleAssignVolunteerToParticipant = (participantId: string, volunteerId: string) => {
    const vol = volunteers.find((v) => v.id === volunteerId);
    if (!vol) return;
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id === participantId) {
          return {
            ...p,
            responsibleVolunteerId: vol.id,
            responsibleVolunteerName: vol.name,
            responsibleVolunteerPhone: vol.phone
          };
        }
        return p;
      })
    );
    setVolunteers((prev) =>
      prev.map((v) => {
        if (v.id === volunteerId) {
          const currentList = v.assignedParticipantIds || [];
          if (!currentList.includes(participantId)) {
            return { ...v, assignedParticipantIds: [...currentList, participantId] };
          }
        }
        return v;
      })
    );
    addToast('Liaison Volunteer Assigned', `${vol.name} is now responsible for attendee ${participantId}.`, 'success');
    logActivity(`Assigned volunteer ${vol.name} as responsible liaison for attendee ${participantId}`, 'volunteer');
  };

  const handleRemoveParticipantFromVolunteer = (volunteerId: string, participantId: string) => {
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.id === participantId && p.responsibleVolunteerId === volunteerId) {
          const { responsibleVolunteerId, responsibleVolunteerName, responsibleVolunteerPhone, ...rest } = p;
          return rest as Participant;
        }
        return p;
      })
    );
    setVolunteers((prev) =>
      prev.map((v) => {
        if (v.id === volunteerId && v.assignedParticipantIds) {
          return { ...v, assignedParticipantIds: v.assignedParticipantIds.filter((id) => id !== participantId) };
        }
        return v;
      })
    );
    addToast('Liaison Removed', `Removed participant ${participantId} from volunteer ${volunteerId}.`, 'info');
    logActivity(`Removed participant ${participantId} from volunteer ${volunteerId}`, 'volunteer');
  };

  // --- Handlers for Sessions ---
  const handleResolveSessionAlert = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            avStatus: 'OK',
            translationStatus: 'OK',
            alertNote: undefined
          };
        }
        return s;
      })
    );
    addToast('Session Readiness Verified', `AV and translation systems marked operational.`, 'success');
    logActivity(`Session ${sessionId} AV anomaly cleared`, 'session');
  };

  // --- Handlers for Heads / Controllers (with Offline Escalation) ---
  const handleToggleControllerStatus = (id: string) => {
    setControllers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const nextState = !c.isOnline;
          addToast(
            'Controller Status Updated',
            `${c.name} (${c.area}) is now ${nextState ? 'ONLINE' : 'OFFLINE'}.`,
            nextState ? 'info' : 'warning'
          );
          logActivity(`Area Controller ${c.name} (${c.area}) set to ${nextState ? 'ONLINE' : 'OFFLINE'}`, 'admin');
          return { ...c, isOnline: nextState };
        }
        return c;
      })
    );
  };

  // 1. Demo Button 1: Vehicle Breakdown
  const handleSimulateVehicleBreakdown = () => {
    const mobilityCtrl = controllers.find((c) => c.area === 'Mobility');
    const isCtrlOnline = mobilityCtrl ? mobilityCtrl.isOnline : false;
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    const incId = `INC-0${incidents.length + 25}`;

    // Mark vehicle VH-07 as breakdown
    setVehicles((prev) =>
      prev.map((v) => (v.id === 'VH-07' ? { ...v, status: 'BREAKDOWN' as const, eta: 'Breakdown (Relief Dispatched)' } : v))
    );

    const newIncident: Incident = {
      id: incId,
      title: 'Vehicle Breakdown: Shuttle VH-07 coolant overheating on Highway A2',
      type: 'Mobility',
      location: 'Expressway Exit 14 towards Airport',
      priority: 'HIGH',
      status: 'OPEN',
      reportedAt: now,
      minutesAgo: 1,
      reporter: 'Driver T. Tan (VH-07)',
      assignedTeam: isCtrlOnline ? 'Mobility Fleet Relief Team (Rajesh Verma)' : 'Command Centre Lead (Super Admin Escalation)',
      affectedCount: 34,
      description: 'Shuttle bus engine overheated. 34 airport-bound delegates stopped safely on shoulder. AC running on battery backup.',
      timeline: [
        { time: now, text: 'Volunteer raised issue via field dispatch simulator', actor: 'VOL-101' },
        ...(isCtrlOnline
          ? [{ time: now, text: 'Assigned to Mobility Controller Rajesh Verma', actor: 'Rajesh Verma' }]
          : [{ time: now, text: 'ESCALATED to Command Centre Lead (Rajesh Verma is offline)', actor: 'System Auto-Escalate' }])
      ],
      escalatedToLead: !isCtrlOnline
    };

    setIncidents((prev) => [newIncident, ...prev]);
    setControllers((prev) =>
      prev.map((c) => (c.area === 'Mobility' ? { ...c, openIssuesCount: c.openIssuesCount + 1 } : c))
    );

    if (isCtrlOnline) {
      addToast(
        'Vehicle Breakdown Raised',
        `Incident ${incId} created (High Priority: Mobility). Assigned to Rajesh Verma.`,
        'error'
      );
      logActivity(`Incident ${incId} created: Vehicle Breakdown on Highway A2`, 'incident');
    } else {
      addToast(
        'ESCALATED: Mobility Lead Offline',
        `Incident ${incId} escalated to Command Centre Lead: Rajesh Verma is currently offline.`,
        'error'
      );
      logActivity(`Incident ${incId} auto-escalated to Command Centre Lead (Mobility Lead offline)`, 'incident');
    }
  };

  // 2. Demo Button 2: Volunteer Shortage
  const handleSimulateVolunteerShortage = () => {
    const volCtrl = controllers.find((c) => c.area === 'Volunteers');
    const isCtrlOnline = volCtrl ? volCtrl.isOnline : false;
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    const taskId = `TSK-${tasks.length + 109}`;

    const newTask: Task = {
      id: taskId,
      title: 'Volunteer Shortage: Deploy 4 backup volunteers to Registration Pavilion Kiosks',
      category: 'Volunteer',
      location: 'Registration Pavilion Gates 1-4',
      priority: 'HIGH',
      status: 'NEW',
      assignee: isCtrlOnline ? 'Sarah Jenkins (Volunteers Lead)' : 'Command Centre Lead (Super Admin Escalation)',
      createdAt: now
    };

    setTasks((prev) => [newTask, ...prev]);
    setControllers((prev) =>
      prev.map((c) => (c.area === 'Volunteers' ? { ...c, openIssuesCount: c.openIssuesCount + 1 } : c))
    );

    if (isCtrlOnline) {
      addToast(
        'Volunteer Shortage Raised',
        `Task ${taskId} created (High Priority). Assigned to Sarah Jenkins.`,
        'warning'
      );
      logActivity(`Task ${taskId} logged: Volunteer Shortage at Registration`, 'task');
    } else {
      addToast(
        'ESCALATED: Volunteers Lead Offline',
        `Task ${taskId} escalated to Command Centre Lead: Sarah Jenkins is currently offline.`,
        'error'
      );
      logActivity(`Task ${taskId} auto-escalated to Command Centre Lead (Volunteers Lead offline)`, 'task');
    }
  };

  // 3. Demo Button 3: Medical Emergency
  const handleSimulateMedicalEmergency = () => {
    const safetyCtrl = controllers.find((c) => c.area === 'Safety');
    const isCtrlOnline = safetyCtrl ? safetyCtrl.isOnline : false;
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    const incId = `INC-0${incidents.length + 25}`;

    const newIncident: Incident = {
      id: incId,
      title: 'Medical Emergency: Delegate faint & heat exhaustion at Gate 1 Queue',
      type: 'Medical',
      location: 'Main Entry / Exit Gate 1 Pavilion',
      priority: 'HIGH',
      status: 'OPEN',
      reportedAt: now,
      minutesAgo: 0,
      reporter: 'VOL-108 (First Aid Liaison)',
      assignedTeam: isCtrlOnline ? 'Dr. Marcus Vance (Safety Rapid Team 1)' : 'Command Centre Lead (Super Admin Escalation)',
      affectedCount: 1,
      description: 'Delegate exhibiting heat exhaustion symptoms. Rapid response paramedic kit required immediately.',
      timeline: [
        { time: now, text: 'Medical alarm raised by Volunteer VOL-108', actor: 'VOL-108' },
        ...(isCtrlOnline
          ? [{ time: now, text: 'Assigned to Safety Controller Dr. Marcus Vance', actor: 'Dr. Marcus Vance' }]
          : [{ time: now, text: 'ESCALATED to Command Centre Lead (Dr. Marcus Vance is offline)', actor: 'System Auto-Escalate' }])
      ],
      escalatedToLead: !isCtrlOnline
    };

    setIncidents((prev) => [newIncident, ...prev]);
    setControllers((prev) =>
      prev.map((c) => (c.area === 'Safety' ? { ...c, openIssuesCount: c.openIssuesCount + 1 } : c))
    );

    if (isCtrlOnline) {
      addToast(
        'Medical Emergency Raised',
        `Incident ${incId} created (High Priority: Safety). Assigned to Dr. Marcus Vance.`,
        'error'
      );
      logActivity(`Incident ${incId} created: Medical Emergency at Gate 1`, 'incident');
    } else {
      addToast(
        'ESCALATED: Safety Lead Offline',
        `Incident ${incId} escalated to Command Centre Lead: Dr. Marcus Vance is currently offline.`,
        'error'
      );
      logActivity(`Incident ${incId} auto-escalated to Command Centre Lead (Safety Lead offline)`, 'incident');
    }
  };

  // --- Handlers for VIP & Motorcade ---
  const handleUpdateVIPMotorcadeStatus = (id: string, newStatus: VIPGuest['motorcade']['status']) => {
    setVIPGuests((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          const updatedEta = newStatus === 'Arrived Onsite' ? 'Onsite (Gate 4)' : g.motorcade.currentEta;
          logActivity(`VIP Motorcade ${g.motorcade.convoyId} (${g.name}) marked: ${newStatus}`, 'mobility');
          addToast('Motorcade Status Updated', `${g.motorcade.convoyId} (${g.name}) updated to "${newStatus}".`, 'info');
          return {
            ...g,
            motorcade: {
              ...g.motorcade,
              status: newStatus,
              currentEta: updatedEta
            }
          };
        }
        return g;
      })
    );
  };

  const handleUpdateVIPSuite = (id: string, newSuite: string) => {
    setVIPGuests((prev) =>
      prev.map((g) => {
        if (g.id === id) {
          logActivity(`VIP ${g.name} reassigned to ${newSuite}`, 'admin');
          addToast('Suite Reassigned', `${g.name} assigned to ${newSuite}.`, 'info');
          return { ...g, assignedSuite: newSuite };
        }
        return g;
      })
    );
  };

  // --- Data Import Handlers ---
  const handleOpenImportModal = (dataset: ImportDatasetType = 'vip') => {
    setImportDatasetType(dataset);
    setIsImportModalOpen(true);
  };

  const handleImportVIPGuests = (imported: VIPGuest[], mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      setVIPGuests(imported);
    } else {
      setVIPGuests((prev) => {
        const existingIds = new Set(imported.map((g) => g.id));
        return [...imported, ...prev.filter((g) => !existingIds.has(g.id))];
      });
    }
  };

  const handleImportParticipants = (imported: Participant[], mode: 'replace' | 'merge') => {
    if (mode === 'replace') {
      setParticipants(imported);
    } else {
      setParticipants((prev) => {
        const existingIds = new Set(imported.map((p) => p.id));
        return [...imported, ...prev.filter((p) => !existingIds.has(p.id))];
      });
    }
  };

  // --- Handlers for Communications ---
  const handleSendBroadcast = (broadcastData: Omit<SentBroadcast, 'id' | 'sentAt' | 'status'>) => {
    const newId = `COM-0${broadcasts.length + 82}`;
    const now = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false });
    const newRecord: SentBroadcast = {
      ...broadcastData,
      id: newId,
      sentAt: now,
      status: 'Delivered (100%)'
    };

    setBroadcasts((prev) => [newRecord, ...prev]);
    addToast('Broadcast Sent', `Broadcast ${newId} dispatched to ${newRecord.audience}.`, 'success');
    logActivity(`Broadcast dispatched (${newRecord.channel}): ${newRecord.subject}`, 'admin');
  };

  // --- Handlers for Admin / Sync ---
  const handleTriggerSync = () => {
    setIsSyncing(true);
    addToast('Sync Started', 'Connecting to Registration and Fleet Gateways...', 'info');
    setTimeout(() => {
      setIsSyncing(false);
      addToast('Data Sync Complete', 'Master database flushed & re-cached. 3,100 attendees synced.', 'success');
      logActivity('Super Admin performed master gateway synchronization', 'admin');
    }, 1400);
  };

  const handleToggleScanning = (paused: boolean) => {
    setScanningPaused(paused);
    if (paused) {
      addToast('SCANNING SUSPENDED', 'All QR turnstiles and meal checkpoints are paused.', 'error');
      logActivity('Super Admin SUSPENDED all scanning turnstiles', 'admin');
    } else {
      addToast('Scanning Resumed', 'All QR turnstiles are operational.', 'success');
      logActivity('Super Admin resumed scanning turnstiles', 'admin');
    }
  };

  const handleSimulateGlobalScan = () => {
    const candidate = vipGuests.find((v) => v.tier === 'VVIP' && v.motorcade.status !== 'Arrived Onsite') || vipGuests[0];
    if (candidate) {
      playSuccessChime();
      addToast(
        `👑 Diplomatic QR Clearance: ${candidate.name}`,
        `${candidate.officialTitle} (${candidate.countryOrOrg}) cleared Gate 4 VIP Arch. Liaison: ${candidate.liaisonOfficer.name}.`,
        'success'
      );
      logActivity(
        `[GATE 4 SCANNED] ${candidate.name} (${candidate.countryOrOrg}) verified credential`,
        'system'
      );
    }
  };

  const handleRestoreSystemState = (importedState: {
    incidents?: Incident[];
    tasks?: Task[];
    vehicles?: Vehicle[];
    volunteers?: Volunteer[];
    sessions?: Session[];
    participants?: Participant[];
    vipGuests?: VIPGuest[];
    activities?: ActivityItem[];
  }) => {
    if (importedState.incidents && importedState.incidents.length > 0) setIncidents(importedState.incidents);
    if (importedState.tasks && importedState.tasks.length > 0) setTasks(importedState.tasks);
    if (importedState.vehicles && importedState.vehicles.length > 0) setVehicles(importedState.vehicles);
    if (importedState.volunteers && importedState.volunteers.length > 0) setVolunteers(importedState.volunteers);
    if (importedState.sessions && importedState.sessions.length > 0) setSessions(importedState.sessions);
    if (importedState.participants && importedState.participants.length > 0) setParticipants(importedState.participants);
    if (importedState.vipGuests && importedState.vipGuests.length > 0) setVIPGuests(importedState.vipGuests);
    if (importedState.activities && importedState.activities.length > 0) setActivities(importedState.activities);

    playSuccessChime();
    addToast(
      'System State & Audit Log Restored',
      'The complete operational audit log and system state have been loaded for post-event analysis.',
      'success'
    );
    logActivity('Super Admin loaded historical system state and audit log', 'admin');
  };

  // Count active badges for tabs
  const openIncidentsCount = incidents.filter((i) => i.status !== 'RESOLVED').length;
  const openTasksCount = tasks.filter((t) => t.status !== 'COMPLETED').length;
  const vehicleAlertCount = vehicles.filter((v) => v.status === 'DELAYED' || v.status === 'BREAKDOWN').length;
  const sessionAlertCount = sessions.filter((s) => s.avStatus === 'ACTION REQUIRED' || s.translationStatus === 'ACTION REQUIRED').length;
  const vipInTransitCount = vipGuests.filter((g) => g.motorcade.status === 'Convoy In Transit').length;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] antialiased transition-colors">
      {/* Header Bar */}
      <Header
        currentTab={currentTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        unreadCount={openIncidentsCount}
        scanningPaused={scanningPaused}
        onToggleScanningModal={() => setScanningPaused(false)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        notifications={toasts}
        onSelectTab={setCurrentTab}
        onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
        onOpenMapsGrounding={handleOpenMapsGrounding}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      />

      {/* Real-time Environmental & Atmospheric Telemetry Ribbon */}
      <EnvironmentalRibbon
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenShiftBriefing={() => setIsShiftBriefingOpen(true)}
        onSimulateScan={handleSimulateGlobalScan}
        isAudioMuted={isAudioMuted}
        onToggleAudioMute={handleToggleAudioMute}
      />

      {/* Tab Navigation */}
      <TabNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        openIncidentsCount={openIncidentsCount}
        openTasksCount={openTasksCount}
        activeVehiclesIssueCount={vehicleAlertCount}
        sessionAlertsCount={sessionAlertCount}
        userRole={userRole}
        vipInTransitCount={vipInTransitCount}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {currentTab === 'overview' && (
          <OverviewTab
            incidents={incidents}
            tasks={tasks}
            vehicles={vehicles}
            volunteers={volunteers}
            sessions={sessions}
            activities={activities}
            vipGuests={vipGuests}
            onSelectTab={setCurrentTab}
            onSelectIncident={(inc) => {
              setSelectedIncident(inc);
              setCurrentTab('incidents');
            }}
            onSelectVehicle={(vh) => {
              setSelectedVehicle(vh);
              setCurrentTab('mobility');
            }}
            onSelectTask={(tsk) => {
              setCurrentTab('tasks');
            }}
            onAddToast={addToast}
            onLogActivity={logActivity}
          />
        )}

        {currentTab === 'vip' && (
          <VIPProtocolTab
            vipGuests={vipGuests}
            onUpdateVIPMotorcadeStatus={handleUpdateVIPMotorcadeStatus}
            onUpdateVIPSuite={handleUpdateVIPSuite}
            onAddToast={addToast}
            onOpenImportModal={() => handleOpenImportModal('vip')}
            onOpenMapsGrounding={handleOpenMapsGrounding}
          />
        )}

        {currentTab === 'incidents' && (
          <IncidentsTab
            incidents={incidents}
            selectedIncident={selectedIncident}
            onSelectIncident={setSelectedIncident}
            onUpdateIncidentStatus={handleUpdateIncidentStatus}
            onAssignTeam={handleAssignTeam}
            onEscalateIncident={handleEscalateIncident}
            onSendAlert={handleSendAlert}
            onCreateIncident={handleCreateIncident}
            searchQuery={searchQuery}
          />
        )}

        {currentTab === 'tasks' && (
          <TasksTab
            tasks={tasks}
            onAdvanceTask={handleAdvanceTask}
            onRegressTask={handleRegressTask}
            onCreateTask={handleCreateTask}
            onUpdateAssignee={(id, assignee) => {
              setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, assignee } : t)));
            }}
          />
        )}

        {currentTab === 'mobility' && (
          <MobilityTab
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            onSelectVehicle={setSelectedVehicle}
            onReassignRoute={handleReassignRoute}
            onReportIncidentForVehicle={handleReportIncidentForVehicle}
            searchQuery={searchQuery}
            onOpenMapsGrounding={handleOpenMapsGrounding}
          />
        )}

        {currentTab === 'volunteers' && (
          <VolunteersTab
            volunteers={volunteers}
            participants={participants}
            openTasks={tasks.filter((t) => t.status !== 'COMPLETED')}
            selectedVolunteer={selectedVolunteer}
            onSelectVolunteer={setSelectedVolunteer}
            onAssignTaskToVolunteer={handleAssignTaskToVolunteer}
            onMoveVolunteerZone={handleMoveVolunteerZone}
            onRequestReplacement={handleRequestReplacement}
            searchQuery={searchQuery}
            onAssignParticipantToVolunteer={handleAssignVolunteerToParticipant}
            onRemoveParticipantFromVolunteer={handleRemoveParticipantFromVolunteer}
          />
        )}

        {currentTab === 'sessions' && (
          <SessionsTab
            sessions={sessions}
            onResolveSessionAlert={handleResolveSessionAlert}
            onRequestAVSupport={(id, issue) => {
              handleCreateTask({
                title: `AV Support in ${id}: ${issue}`,
                category: 'AV',
                location: id,
                priority: 'HIGH',
                status: 'NEW',
                assignee: 'AV Runner Team'
              });
              addToast('AV Task Created', `Dispatched AV support for ${id}.`, 'info');
            }}
          />
        )}

        {currentTab === 'heads' && (
          <HeadsTab
            controllers={controllers}
            onToggleControllerStatus={handleToggleControllerStatus}
            onSimulateVehicleBreakdown={handleSimulateVehicleBreakdown}
            onSimulateVolunteerShortage={handleSimulateVolunteerShortage}
            onSimulateMedicalEmergency={handleSimulateMedicalEmergency}
          />
        )}

        {currentTab === 'map' && (
          <MapTab
            vehicles={vehicles}
            volunteers={volunteers}
            incidents={incidents}
            isSimulating={isSimulating}
            onToggleSimulation={() => setIsSimulating(!isSimulating)}
            onSelectVehicle={(vh) => {
              setSelectedVehicle(vh);
            }}
            onSelectVolunteer={(vol) => {
              setSelectedVolunteer(vol);
            }}
            onSelectIncident={(inc) => {
              setSelectedIncident(inc);
            }}
            onOpenMapsGrounding={handleOpenMapsGrounding}
          />
        )}

        {currentTab === 'participants' && (
          <ParticipantsTab
            participants={participants}
            volunteers={volunteers}
            onOpenCreateTaskForParticipant={(part) => {
              handleCreateTask({
                title: `Assist ${part.category} ${part.name} (${part.id})`,
                category: 'Logistics',
                location: part.hotel || 'Main Foyer',
                priority: 'MEDIUM',
                status: 'NEW',
                assignee: 'Unassigned'
              });
              setCurrentTab('tasks');
            }}
            searchQuery={searchQuery}
            onOpenImportModal={() => handleOpenImportModal('participants')}
            onAssignVolunteerToParticipant={handleAssignVolunteerToParticipant}
          />
        )}

        {currentTab === 'comms' && (
          <CommsTab
            broadcasts={broadcasts}
            onSendBroadcast={handleSendBroadcast}
          />
        )}

        {currentTab === 'admin' && (
          <AdminTab
            userRole={userRole}
            onChangeUserRole={setUserRole}
            scanningPaused={scanningPaused}
            onToggleScanning={handleToggleScanning}
            incidents={incidents}
            participants={participants}
            tasks={tasks}
            sessions={sessions}
            vehicles={vehicles}
            volunteers={volunteers}
            vipGuests={vipGuests}
            activities={activities}
            onTriggerSync={handleTriggerSync}
            isSyncing={isSyncing}
            onAddToast={addToast}
            onOpenImportModal={handleOpenImportModal}
            onLogActivity={logActivity}
            onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
            onRestoreSystemState={handleRestoreSystemState}
          />
        )}
      </main>

      {/* Global Quick Actions Floating Action Button */}
      <QuickActionsFAB
        onCreateIncident={handleCreateIncident}
        onSendBroadcast={handleSendBroadcast}
        onTriggerSync={handleTriggerSync}
        isSyncing={isSyncing}
        scanningPaused={scanningPaused}
        onToggleScanning={handleToggleScanning}
        onSimulateBreakdown={handleSimulateVehicleBreakdown}
        onSimulateMedical={handleSimulateMedicalEmergency}
        onSimulateShortage={handleSimulateVolunteerShortage}
        onOpenImportModal={() => handleOpenImportModal('vip')}
      />

      {/* Stacked Toasts Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Global Data Import & Manifest Ingestion Modal */}
      <DataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        initialDataset={importDatasetType}
        onImportVIPGuests={handleImportVIPGuests}
        onImportParticipants={handleImportParticipants}
        onAddToast={addToast}
        onLogActivity={logActivity}
      />

      {/* Distributed System Architecture & Event Bus Console Modal */}
      <SystemArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
        incidents={incidents}
        tasks={tasks}
        participants={participants}
        vehicles={vehicles}
        volunteers={volunteers}
        vipGuests={vipGuests}
        onAddToast={addToast}
        onLogActivity={logActivity}
      />

      {/* Google Maps Grounding Intelligence Modal (gemini-3.5-flash with googleMaps) */}
      <GoogleMapsAssistantModal
        isOpen={isMapsModalOpen}
        onClose={() => setIsMapsModalOpen(false)}
        initialPrompt={mapsInitialPrompt}
        contextTitle={mapsContextTitle}
      />

      {/* Global Command Palette Modal (Cmd+K / Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={setCurrentTab}
        vipGuests={vipGuests}
        incidents={incidents}
        vehicles={vehicles}
        onSelectIncident={setSelectedIncident}
        onSelectVehicle={setSelectedVehicle}
        onOpenMapsGrounding={() => handleOpenMapsGrounding()}
        onOpenShiftBriefing={() => setIsShiftBriefingOpen(true)}
        onSimulateScan={handleSimulateGlobalScan}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />

      {/* Shift Handover Briefing & Print Modal */}
      <ShiftHandoverModal
        isOpen={isShiftBriefingOpen}
        onClose={() => setIsShiftBriefingOpen(false)}
        vipGuests={vipGuests}
        incidents={incidents}
        vehicles={vehicles}
        volunteers={volunteers}
        sessions={sessions}
      />
    </div>
  );
}
