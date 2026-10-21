export type TabKey = 
  | 'overview'
  | 'vip'
  | 'incidents'
  | 'tasks'
  | 'mobility'
  | 'volunteers'
  | 'sessions'
  | 'heads'
  | 'map'
  | 'participants'
  | 'comms'
  | 'admin';

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface VIPGuest {
  id: string; // VIP-001 to VIP-050
  name: string;
  officialTitle: string;
  countryOrOrg: string;
  tier: 'VVIP' | 'VIP';
  flightInfo: {
    flightNumber: string;
    airline: string;
    terminal: string;
    scheduledArrival: string;
    actualEta: string;
    status: 'Landed' | 'En Route' | 'Delayed' | 'Departed';
  };
  motorcade: {
    convoyId: string;
    vehicleType: string;
    plateNumber: string;
    driverName: string;
    driverPhone: string;
    securityEscortUnit: string;
    status: 'Standby Airport' | 'Convoy In Transit' | 'Staging Gate 4' | 'Arrived Onsite' | 'Departed';
    currentEta: string;
  };
  liaisonOfficer: {
    id: string;
    name: string;
    phone: string;
  };
  hotel: string;
  assignedSuite: string;
  dietaryRestrictions: string;
  securityClearance: 'Level 1 (Armed / Close Protection)' | 'Level 2 (Protocol Escort)' | 'Standard VIP';
  bilateralMeetingsCount: number;
}

export interface TimelineEntry {
  time: string;
  text: string;
  actor: string;
}

export interface Incident {
  id: string;
  title: string;
  type: 'Medical' | 'Mobility' | 'Technical / AV' | 'Crowd / Security' | 'Catering' | 'Facility';
  location: string;
  priority: Priority;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  reportedAt: string;
  minutesAgo: number;
  reporter: string;
  assignedTeam: string;
  affectedCount: number;
  description: string;
  timeline: TimelineEntry[];
  escalatedToLead?: boolean;
}

export interface Task {
  id: string;
  title: string;
  category: 'Venue' | 'AV' | 'Catering' | 'Logistics' | 'Security' | 'Medical' | 'Volunteer';
  location: string;
  priority: Priority;
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
  assignee: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  driver: string;
  type: string;
  route: string;
  location: string;
  passengers: string;
  eta: string;
  status: 'ON_TIME' | 'DELAYED' | 'BREAKDOWN' | 'STANDBY' | 'MAINTENANCE';
  batteryFuel: number;
  phone: string;
  x: number;
  y: number;
  routePath?: { x: number; y: number }[];
}

export interface Volunteer {
  id: string;
  name: string;
  role: string;
  zone: string;
  status: 'AVAILABLE' | 'ASSIGNED' | 'BUSY' | 'OFFLINE';
  currentTask: string;
  phone: string;
  checkInTime: string;
  x: number;
  y: number;
  zoneBounds: { minX: number; maxX: number; minY: number; maxY: number };
  assignedParticipantIds?: string[];
  assignedCohort?: string;
}

export interface Session {
  id: string;
  title: string;
  room: string;
  speaker: string;
  moderator: string;
  time: string;
  avStatus: 'OK' | 'ACTION REQUIRED';
  translationStatus: 'OK' | 'ACTION REQUIRED';
  recordingStatus: 'Active' | 'Ready' | 'Paused';
  attendance: string;
  status: 'LIVE' | 'STARTING_SOON' | 'SCHEDULED' | 'COMPLETED';
  alertNote?: string;
}

export interface AreaController {
  id: string;
  area: 'Mobility' | 'Volunteers' | 'Venue' | 'Programme' | 'Participant Services' | 'Technical' | 'Safety';
  name: string;
  email: string;
  phone: string;
  isOnline: boolean;
  openIssuesCount: number;
  assignedStaff: number;
  lastCheckIn: string;
}

export interface Participant {
  id: string;
  qrId: string;
  name: string;
  category: 'Delegate' | 'VIP' | 'Speaker' | 'Media' | 'Organizer';
  hotel: string;
  transportAllocation: string;
  mealsToday: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
  };
  eventStatus: 'Checked In' | 'In Session' | 'Offsite' | 'Arriving';
  phone: string;
  email: string;
  responsibleVolunteerId?: string;
  responsibleVolunteerName?: string;
  responsibleVolunteerPhone?: string;
}

export interface SentBroadcast {
  id: string;
  audience: string;
  channel: 'Push' | 'SMS' | 'Email';
  priority: 'Normal' | 'High' | 'Emergency';
  subject: string;
  message: string;
  sentAt: string;
  recipientsCount: number;
  status: string;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  message: string;
  category: 'incident' | 'task' | 'mobility' | 'volunteer' | 'session' | 'admin' | 'system';
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timestamp: string;
}

export type UserRole = 
  | 'super_admin'
  | 'command_centre_lead'
  | 'mobility_lead'
  | 'volunteer_lead'
  | 'safety_lead'
  | 'technical_lead';
