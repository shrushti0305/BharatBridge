import {
  Incident,
  Task,
  Vehicle,
  Volunteer,
  Session,
  AreaController,
  Participant,
  SentBroadcast,
  ActivityItem
} from '../types';

export const INITIAL_CONTROLLERS: AreaController[] = [
  {
    id: 'AC-1',
    area: 'Mobility',
    name: 'Rajesh Verma',
    email: 'r.verma@yesummit.org',
    phone: '+65 9123 4561',
    isOnline: true,
    openIssuesCount: 2,
    assignedStaff: 54,
    lastCheckIn: '2 min ago'
  },
  {
    id: 'AC-2',
    area: 'Volunteers',
    name: 'Sarah Jenkins',
    email: 's.jenkins@yesummit.org',
    phone: '+65 9234 5672',
    isOnline: true,
    openIssuesCount: 1,
    assignedStaff: 212,
    lastCheckIn: 'Just now'
  },
  {
    id: 'AC-3',
    area: 'Venue',
    name: 'Kenji Sato',
    email: 'k.sato@yesummit.org',
    phone: '+65 9345 6783',
    isOnline: true,
    openIssuesCount: 1,
    assignedStaff: 38,
    lastCheckIn: '6 min ago'
  },
  {
    id: 'AC-4',
    area: 'Programme',
    name: 'Dr. Maya Lin',
    email: 'm.lin@yesummit.org',
    phone: '+65 9456 7894',
    isOnline: true,
    openIssuesCount: 0,
    assignedStaff: 24,
    lastCheckIn: '12 min ago'
  },
  {
    id: 'AC-5',
    area: 'Participant Services',
    name: 'Amina Al-Mansoor',
    email: 'a.almansoor@yesummit.org',
    phone: '+65 9567 8905',
    isOnline: true,
    openIssuesCount: 1,
    assignedStaff: 42,
    lastCheckIn: '4 min ago'
  },
  {
    id: 'AC-6',
    area: 'Technical',
    name: 'David Chen',
    email: 'd.chen@yesummit.org',
    phone: '+65 9678 9016',
    isOnline: false, // Initial simulated offline to test escalation!
    openIssuesCount: 1,
    assignedStaff: 30,
    lastCheckIn: '28 min ago'
  },
  {
    id: 'AC-7',
    area: 'Safety',
    name: 'Dr. Marcus Vance',
    email: 'm.vance@yesummit.org',
    phone: '+65 9789 0127',
    isOnline: true,
    openIssuesCount: 1,
    assignedStaff: 26,
    lastCheckIn: '1 min ago'
  }
];

export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'INC-024',
    title: 'Participant faint & respiratory distress',
    type: 'Medical',
    location: 'Hall B Corridor (Zone 4)',
    priority: 'HIGH',
    status: 'OPEN',
    reportedAt: '10:48 AM',
    minutesAgo: 6,
    reporter: 'VOL-108 (Priya Nair)',
    assignedTeam: 'Safety & First Aid Rapid Response Team 2',
    affectedCount: 1,
    description: 'Elderly delegate collapsed near doorway B3 during transition. Conscious but dizzy. Medical team dispatched with wheelchair & vitals kit.',
    timeline: [
      { time: '10:48 AM', text: 'Incident raised by Volunteer VOL-108 via radio', actor: 'Priya Nair' },
      { time: '10:49 AM', text: 'Safety Lead Dr. Marcus Vance acknowledged and assigned Team 2', actor: 'Command Lead' },
      { time: '10:51 AM', text: 'Paramedic team en route from Central First Aid booth', actor: 'Safety Dispatch' }
    ]
  },
  {
    id: 'INC-023',
    title: 'Main Hall Audio feedback & Channel 3 dropout',
    type: 'Technical / AV',
    location: 'Main Hall Stage Left',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    reportedAt: '10:35 AM',
    minutesAgo: 19,
    reporter: 'Dr. Arunabha Ghosh (Programme Directorate)',
    assignedTeam: 'AV Technical Core',
    affectedCount: 650,
    description: 'Intermittent hum on keynote speaker wireless lavalier mic. Sound engineer switching receiver frequencies.',
    timeline: [
      { time: '10:35 AM', text: 'Reported by Programme Director Dr. Arunabha Ghosh', actor: 'Dr. Arunabha Ghosh' },
      { time: '10:37 AM', text: 'Escalated to Command Centre Lead due to Technical Controller offline', actor: 'System Auto-Escalate', },
      { time: '10:40 AM', text: 'Backup RF receiver calibrated; monitoring levels', actor: 'Tech Lead On-duty' }
    ],
    escalatedToLead: true
  },
  {
    id: 'INC-022',
    title: 'Shuttle VH-07 coolant overheating on Highway A2',
    type: 'Mobility',
    location: 'Expressway Exit 14 towards Airport',
    priority: 'MEDIUM',
    status: 'OPEN',
    reportedAt: '10:28 AM',
    minutesAgo: 26,
    reporter: 'Driver T. Tan (VH-07)',
    assignedTeam: 'Mobility Fleet Relief Team',
    affectedCount: 34,
    description: 'Vehicle pulled onto emergency shoulder. Passengers safe with AC running on battery. Relief bus VH-12 dispatched from Depot.',
    timeline: [
      { time: '10:28 AM', text: 'Driver signaled breakdown code #4', actor: 'T. Tan' },
      { time: '10:30 AM', text: 'Mobility controller Rajesh Verma dispatched relief bus VH-12', actor: 'Rajesh Verma' },
      { time: '10:39 AM', text: 'Relief bus ETA 8 minutes; highway traffic slow', actor: 'Mobility Dispatch' }
    ]
  },
  {
    id: 'INC-021',
    title: 'Turnstile Scanner 4 firmware freeze at Gate 1',
    type: 'Facility',
    location: 'Registration Pavilion Gate 1',
    priority: 'LOW',
    status: 'RESOLVED',
    reportedAt: '09:15 AM',
    minutesAgo: 99,
    reporter: 'VOL-101 (Marcus Goh)',
    assignedTeam: 'Gate IT Support',
    affectedCount: 45,
    description: 'Turnstile reset completed. Offline QR scanner deployed in parallel.',
    timeline: [
      { time: '09:15 AM', text: 'Scanner reboot initiated', actor: 'Marcus Goh' },
      { time: '09:22 AM', text: 'Hardware cache cleared and re-synced', actor: 'Gate IT' },
      { time: '09:25 AM', text: 'Resolved and calibrated with active RFID credentials', actor: 'Kenji Sato' }
    ]
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'TSK-108',
    title: 'Deliver 150 VIP gift packs to Green Room B',
    category: 'Logistics',
    location: 'VIP Lounge & Green Room B',
    priority: 'HIGH',
    status: 'NEW',
    assignee: 'Unassigned',
    createdAt: '10:45 AM'
  },
  {
    id: 'TSK-107',
    title: 'Escort Japanese trade delegation to bilateral suite 3',
    category: 'Volunteer',
    location: 'Main Entry / Gate 1',
    priority: 'MEDIUM',
    status: 'ASSIGNED',
    assignee: 'VOL-104 (Priya Rao)',
    createdAt: '10:30 AM'
  },
  {
    id: 'TSK-106',
    title: 'Replace faulty translation headset batch at Hall B Row 12-16',
    category: 'AV',
    location: 'Hall B',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assignee: 'AV Runner Team C',
    createdAt: '10:15 AM'
  },
  {
    id: 'TSK-105',
    title: 'Restock bottled water & electrolytes at Speaker Green Room',
    category: 'Catering',
    location: 'Main Hall Backstage',
    priority: 'LOW',
    status: 'IN_PROGRESS',
    assignee: 'Catering Runner Leo',
    createdAt: '10:00 AM'
  },
  {
    id: 'TSK-104',
    title: 'Set up overflow chairs in Hall A Balcony East',
    category: 'Venue',
    location: 'Hall A',
    priority: 'MEDIUM',
    status: 'NEW',
    assignee: 'Venue Ops Team 4',
    createdAt: '09:50 AM'
  },
  {
    id: 'TSK-103',
    title: 'Perform security sweep of VIP motorcade bay',
    category: 'Security',
    location: 'VIP Gate 4',
    priority: 'HIGH',
    status: 'COMPLETED',
    assignee: 'Sec Officer Wu',
    createdAt: '09:10 AM'
  },
  {
    id: 'TSK-102',
    title: 'Test digital signs at Exhibition entrance',
    category: 'AV',
    location: 'Exhibition Hall',
    priority: 'LOW',
    status: 'COMPLETED',
    assignee: 'Tech Volunteer Alan',
    createdAt: '08:45 AM'
  }
];

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'VH-01',
    driver: 'Ahmad Faiz',
    type: '45-Seater Coach',
    route: 'Airport T1 ↔ Venue',
    location: 'Expressway Km 12 (Northbound)',
    passengers: '38/45',
    eta: '6 min',
    status: 'ON_TIME',
    batteryFuel: 82,
    phone: '+65 9111 0001',
    x: 180,
    y: 110
  },
  {
    id: 'VH-02',
    driver: 'Grace Lim',
    type: '45-Seater Coach',
    route: 'Hotel Grand ↔ Venue',
    location: 'Orchard Blvd Junction',
    passengers: '42/45',
    eta: '11 min',
    status: 'ON_TIME',
    batteryFuel: 74,
    phone: '+65 9111 0002',
    x: 230,
    y: 195
  },
  {
    id: 'VH-03',
    driver: 'Rajendran M.',
    type: '45-Seater Coach',
    route: 'Airport T3 ↔ Venue',
    location: 'Airport Viaduct East',
    passengers: '44/45',
    eta: 'Delayed (+16m)',
    status: 'DELAYED',
    batteryFuel: 68,
    phone: '+65 9111 0003',
    x: 140,
    y: 70
  },
  {
    id: 'VH-04',
    driver: 'David Seah',
    type: '14-Seater VIP Van',
    route: 'Hotel Marina ↔ Venue',
    location: 'Marina Bay Way',
    passengers: '11/14',
    eta: '4 min',
    status: 'ON_TIME',
    batteryFuel: 89,
    phone: '+65 9111 0004',
    x: 270,
    y: 280
  },
  {
    id: 'VH-05',
    driver: 'Wong Kah Wei',
    type: 'VIP Electric Sedan',
    route: 'VIP Circuit',
    location: 'Venue VIP Gate 4 Access Ramp',
    passengers: '2/4',
    eta: 'On site',
    status: 'ON_TIME',
    batteryFuel: 94,
    phone: '+65 9111 0005',
    x: 440,
    y: 470
  },
  {
    id: 'VH-06',
    driver: 'Siti Nurhaliza',
    type: '45-Seater Coach',
    route: 'City Center ↔ Venue',
    location: 'Bras Basah Tunnel',
    passengers: '39/45',
    eta: 'Delayed (+12m)',
    status: 'DELAYED',
    batteryFuel: 61,
    phone: '+65 9111 0006',
    x: 310,
    y: 340
  },
  {
    id: 'VH-07',
    driver: 'T. Tan',
    type: '45-Seater Coach',
    route: 'Airport T1 ↔ Venue',
    location: 'Expressway Exit 14 Shoulder',
    passengers: '34/45',
    eta: 'Breakdown (Relief arriving)',
    status: 'BREAKDOWN',
    batteryFuel: 42,
    phone: '+65 9111 0007',
    x: 195,
    y: 65
  },
  {
    id: 'VH-08',
    driver: 'Bala Kumar',
    type: '45-Seater Coach',
    route: 'Hotel Grand ↔ Venue',
    location: 'Venue South Coach Bay',
    passengers: '0/45',
    eta: 'Boarding next wave (11:15)',
    status: 'ON_TIME',
    batteryFuel: 79,
    phone: '+65 9111 0008',
    x: 490,
    y: 490
  },
  {
    id: 'VH-09',
    driver: 'Kenji Mori',
    type: '14-Seater VIP Van',
    route: 'VIP Circuit',
    location: 'Changi Aviation Hub',
    passengers: '6/14',
    eta: 'Delayed (+8m)',
    status: 'DELAYED',
    batteryFuel: 70,
    phone: '+65 9111 0009',
    x: 120,
    y: 130
  },
  {
    id: 'VH-10',
    driver: 'Hassan Basri',
    type: 'VIP Electric Sedan',
    route: 'VIP Circuit',
    location: 'Venue Gate 4 Staging',
    passengers: '0/4',
    eta: 'Standby',
    status: 'STANDBY',
    batteryFuel: 97,
    phone: '+65 9111 0010',
    x: 460,
    y: 460
  }
];

export const INITIAL_VOLUNTEERS: Volunteer[] = [
  {
    id: 'VOL-101',
    name: 'Marcus Goh',
    role: 'Registration & QR',
    zone: 'Registration',
    status: 'ASSIGNED',
    currentTask: 'Express Badge Print Kiosk 2',
    phone: '+65 8123 0001',
    checkInTime: '07:30 AM',
    x: 390,
    y: 380,
    zoneBounds: { minX: 340, maxX: 460, minY: 340, maxY: 420 },
    assignedParticipantIds: ['PART-2043', 'PART-2045'],
    assignedCohort: 'Registration Cohort A (Grand Hyatt Delegates)'
  },
  {
    id: 'VOL-102',
    name: 'Nurul Huda',
    role: 'Registration & QR',
    zone: 'Registration',
    status: 'AVAILABLE',
    currentTask: 'Standing by for delegate rush',
    phone: '+65 8123 0002',
    checkInTime: '07:45 AM',
    x: 420,
    y: 360,
    zoneBounds: { minX: 340, maxX: 460, minY: 340, maxY: 420 },
    assignedParticipantIds: [],
    assignedCohort: 'Floating Registration Assistance'
  },
  {
    id: 'VOL-103',
    name: 'Samuel Lee',
    role: 'Usher & Seating',
    zone: 'Main Hall',
    status: 'BUSY',
    currentTask: 'Plenary Aisle 4 Crowds',
    phone: '+65 8123 0003',
    checkInTime: '08:00 AM',
    x: 480,
    y: 190,
    zoneBounds: { minX: 420, maxX: 640, minY: 140, maxY: 260 },
    assignedParticipantIds: [],
    assignedCohort: 'Plenary Aisle 4 Attendees'
  },
  {
    id: 'VOL-104',
    name: 'Priya Rao',
    role: 'Liaison & VIP',
    zone: 'VIP',
    status: 'BUSY',
    currentTask: 'Escorting JP Delegation (TSK-107)',
    phone: '+65 8123 0004',
    checkInTime: '07:15 AM',
    x: 690,
    y: 170,
    zoneBounds: { minX: 660, maxX: 750, minY: 130, maxY: 220 },
    assignedParticipantIds: ['PART-2041', 'PART-2042'],
    assignedCohort: 'VIP Plenary Speakers & Keynote Dignitaries'
  },
  {
    id: 'VOL-105',
    name: 'Chen Wei',
    role: 'Audio/Visual Runner',
    zone: 'Hall A',
    status: 'ASSIGNED',
    currentTask: 'Stage timer synchronization',
    phone: '+65 8123 0005',
    checkInTime: '08:10 AM',
    x: 320,
    y: 190,
    zoneBounds: { minX: 250, maxX: 390, minY: 140, maxY: 260 }
  },
  {
    id: 'VOL-106',
    name: 'Fatima Zahra',
    role: 'Usher & Seating',
    zone: 'Hall B',
    status: 'AVAILABLE',
    currentTask: 'Headset distribution point',
    phone: '+65 8123 0006',
    checkInTime: '08:00 AM',
    x: 320,
    y: 290,
    zoneBounds: { minX: 250, maxX: 390, minY: 270, maxY: 350 },
    assignedParticipantIds: ['PART-2044'],
    assignedCohort: 'International Press & Media Pool'
  },
  {
    id: 'VOL-107',
    name: 'Darren Tan',
    role: 'Catering Support',
    zone: 'Food Court',
    status: 'BUSY',
    currentTask: 'Halal buffet line crowd flow',
    phone: '+65 8123 0007',
    checkInTime: '08:30 AM',
    x: 690,
    y: 330,
    zoneBounds: { minX: 630, maxX: 750, minY: 280, maxY: 400 },
    assignedParticipantIds: [],
    assignedCohort: 'Dietary Protocol Support'
  },
  {
    id: 'VOL-108',
    name: 'Priya Nair',
    role: 'First Aid Liaison',
    zone: 'Medical',
    status: 'BUSY',
    currentTask: 'Assisting incident INC-024 in Hall B',
    phone: '+65 8123 0008',
    checkInTime: '07:00 AM',
    x: 540,
    y: 380,
    zoneBounds: { minX: 500, maxX: 600, minY: 350, maxY: 420 },
    assignedParticipantIds: ['PART-2046', 'PART-2047'],
    assignedCohort: 'Arrival Concierge & Mobility Assistance'
  },
  {
    id: 'VOL-109',
    name: 'Michael Teo',
    role: 'Help Desk Concierge',
    zone: 'Help Desk',
    status: 'AVAILABLE',
    currentTask: 'Attendee lost badge queries',
    phone: '+65 8123 0009',
    checkInTime: '08:15 AM',
    x: 630,
    y: 240,
    zoneBounds: { minX: 600, maxX: 670, minY: 220, maxY: 280 },
    assignedParticipantIds: [],
    assignedCohort: 'General Inquiries & Badge Helpdesk'
  },
  {
    id: 'VOL-110',
    name: 'Ananya Sharma',
    role: 'Exhibition Greeter',
    zone: 'Exhibition',
    status: 'ASSIGNED',
    currentTask: 'Start-up alley directional guide',
    phone: '+65 8123 0010',
    checkInTime: '08:20 AM',
    x: 510,
    y: 300,
    zoneBounds: { minX: 420, maxX: 600, minY: 270, maxY: 340 },
    assignedParticipantIds: ['PART-2048'],
    assignedCohort: 'Staff & Internal Operations Liaison'
  },
  {
    id: 'VOL-111',
    name: 'Kevin Zhao',
    role: 'Usher & Seating',
    zone: 'Entry/Exit',
    status: 'OFFLINE',
    currentTask: 'Shift starts at 12:00 PM',
    phone: '+65 8123 0011',
    checkInTime: 'Not checked in',
    x: 410,
    y: 460,
    zoneBounds: { minX: 360, maxX: 460, minY: 440, maxY: 500 }
  }
];

export const INITIAL_SESSIONS: Session[] = [
  {
    id: 'SES-01',
    title: 'Opening Plenary: Future of Energy & Clean Tech',
    room: 'Main Hall',
    speaker: 'Li Junhua & H.E. Grace Fu',
    moderator: 'Simon Stiell',
    time: '10:00 - 11:30 AM',
    avStatus: 'OK',
    translationStatus: 'OK',
    recordingStatus: 'Active',
    attendance: '740 / 800 (92%)',
    status: 'LIVE'
  },
  {
    id: 'SES-02',
    title: 'Breakout A: AI in Scaled Operations & Robotics',
    room: 'Hall A',
    speaker: 'Prof. Hiroshi Tanaka (Keio)',
    moderator: 'Jensen Huang',
    time: '10:15 - 11:15 AM',
    avStatus: 'OK',
    translationStatus: 'OK',
    recordingStatus: 'Active',
    attendance: '280 / 300 (93%)',
    status: 'LIVE'
  },
  {
    id: 'SES-03',
    title: 'Breakout B: Cross-Border Green Finance Frameworks',
    room: 'Hall B',
    speaker: 'H.E. Amina Al-Mansoor & Mark Carney',
    moderator: 'Jean-Luc Moreau',
    time: '10:30 - 11:45 AM',
    avStatus: 'ACTION REQUIRED',
    translationStatus: 'ACTION REQUIRED',
    recordingStatus: 'Active',
    attendance: '265 / 300 (88%)',
    status: 'LIVE',
    alertNote: 'Channel 3 Audio dropout & Headset inventory deficit in Row 14'
  },
  {
    id: 'SES-04',
    title: 'Tech Showcase: Carbon Neutral Smart Mobility Hubs',
    room: 'Exhibition',
    speaker: 'Rajesh Verma & Fleet Partners',
    moderator: 'Boyan Slat',
    time: '10:45 - 12:00 PM',
    avStatus: 'OK',
    translationStatus: 'OK',
    recordingStatus: 'Active',
    attendance: '190 / 250 (76%)',
    status: 'LIVE'
  },
  {
    id: 'SES-05',
    title: 'Closed Door Ministerial Bilateral: ASEAN Logistics',
    room: 'VIP Lounge',
    speaker: 'Delegates Only (Strict Security)',
    moderator: 'Chief Protocol Officer',
    time: '10:00 - 12:00 PM',
    avStatus: 'OK',
    translationStatus: 'OK',
    recordingStatus: 'Ready',
    attendance: '28 / 30 (93%)',
    status: 'LIVE'
  },
  {
    id: 'SES-06',
    title: 'Youth Innovator Demo Stage: Pitch Session #1',
    room: 'Help Desk / Open Stage',
    speaker: '12 Regional Finalists',
    moderator: 'Dr. Arunabha Ghosh',
    time: '10:30 - 11:30 AM',
    avStatus: 'OK',
    translationStatus: 'OK',
    recordingStatus: 'Active',
    attendance: '110 / 120 (91%)',
    status: 'LIVE'
  },
  {
    id: 'SES-07',
    title: 'Keynote 2: Sustainable Urban Architecture 2030',
    room: 'Main Hall',
    speaker: 'Lord Norman Foster',
    moderator: 'Laurence Tubiana',
    time: '11:45 - 12:45 PM',
    avStatus: 'OK',
    translationStatus: 'OK',
    recordingStatus: 'Ready',
    attendance: '620 Pre-Registered / 800',
    status: 'STARTING_SOON'
  },
  {
    id: 'SES-08',
    title: 'Global Supply Chain Resilience Panel',
    room: 'Hall A',
    speaker: 'DHL Global & Port Authority Heads',
    moderator: 'Mark Vance',
    time: '11:30 - 12:30 PM',
    avStatus: 'ACTION REQUIRED',
    translationStatus: 'OK',
    recordingStatus: 'Ready',
    attendance: '275 Pre-Registered / 300',
    status: 'STARTING_SOON',
    alertNote: 'Stage podium HDMI feed requires switcher reset'
  }
];

export const INITIAL_PARTICIPANTS: Participant[] = [
  {
    id: 'PART-2041',
    qrId: 'QR-9821',
    name: 'Prof. Hiroshi Amano',
    category: 'Speaker',
    hotel: 'Grand Hyatt Singapore',
    transportAllocation: 'VIP Electric Sedan (VH-05)',
    mealsToday: { breakfast: true, lunch: false, dinner: false },
    eventStatus: 'In Session',
    phone: '+81 90 1234 5678',
    email: 'h.amano@nagoya-u.ac.jp',
    responsibleVolunteerId: 'VOL-104',
    responsibleVolunteerName: 'Priya Rao',
    responsibleVolunteerPhone: '+65 8123 0004'
  },
  {
    id: 'PART-2042',
    qrId: 'QR-9822',
    name: 'H.E. Lawrence Wong',
    category: 'VIP',
    hotel: 'Marina Bay Sands',
    transportAllocation: 'VIP Van (VH-04)',
    mealsToday: { breakfast: true, lunch: false, dinner: false },
    eventStatus: 'In Session',
    phone: '+65 6235 8800',
    email: 'lawrence_wong@pmo.gov.sg',
    responsibleVolunteerId: 'VOL-104',
    responsibleVolunteerName: 'Priya Rao',
    responsibleVolunteerPhone: '+65 8123 0004'
  },
  {
    id: 'PART-2043',
    qrId: 'QR-9823',
    name: 'Fatima Al-Hassan',
    category: 'Delegate',
    hotel: 'Grand Hyatt Singapore',
    transportAllocation: 'Route B Shuttle Coach (VH-02)',
    mealsToday: { breakfast: true, lunch: false, dinner: false },
    eventStatus: 'Checked In',
    phone: '+971 50 123 4567',
    email: 'f.alhassan@adnoc.ae',
    responsibleVolunteerId: 'VOL-101',
    responsibleVolunteerName: 'Marcus Goh',
    responsibleVolunteerPhone: '+65 8123 0001'
  },
  {
    id: 'PART-2044',
    qrId: 'QR-9824',
    name: 'Julianne Beaumont',
    category: 'Media',
    hotel: 'City Lodge Clarke Quay',
    transportAllocation: 'City Center Shuttle (VH-06)',
    mealsToday: { breakfast: true, lunch: false, dinner: false },
    eventStatus: 'In Session',
    phone: '+33 6 12 34 56 78',
    email: 'j.beaumont@afp.com',
    responsibleVolunteerId: 'VOL-106',
    responsibleVolunteerName: 'Fatima Zahra',
    responsibleVolunteerPhone: '+65 8123 0006'
  },
  {
    id: 'PART-2045',
    qrId: 'QR-9825',
    name: 'H.E. Pichai Naripthaphan',
    category: 'Delegate',
    hotel: 'Grand Hyatt Singapore',
    transportAllocation: 'Route B Shuttle Coach (VH-02)',
    mealsToday: { breakfast: true, lunch: false, dinner: false },
    eventStatus: 'Checked In',
    phone: '+66 81 234 5678',
    email: 'pichai.n@moc.go.th',
    responsibleVolunteerId: 'VOL-101',
    responsibleVolunteerName: 'Marcus Goh',
    responsibleVolunteerPhone: '+65 8123 0001'
  },
  {
    id: 'PART-2046',
    qrId: 'QR-9826',
    name: 'H.E. Matthew Opoku Prempeh',
    category: 'Speaker',
    hotel: 'Marina Bay Sands',
    transportAllocation: 'VIP Sedan (VH-10)',
    mealsToday: { breakfast: true, lunch: false, dinner: false },
    eventStatus: 'Arriving',
    phone: '+233 24 123 4567',
    email: 'm.prempeh@energy.gov.gh',
    responsibleVolunteerId: 'VOL-108',
    responsibleVolunteerName: 'Priya Nair',
    responsibleVolunteerPhone: '+65 8123 0008'
  },
  {
    id: 'PART-2047',
    qrId: 'QR-9827',
    name: 'Lars Lindqvist',
    category: 'Delegate',
    hotel: 'Local / Self-Arranged',
    transportAllocation: 'Self / Public Metro',
    mealsToday: { breakfast: false, lunch: false, dinner: false },
    eventStatus: 'Checked In',
    phone: '+46 70 123 4567',
    email: 'lars@vestas.se',
    responsibleVolunteerId: 'VOL-108',
    responsibleVolunteerName: 'Priya Nair',
    responsibleVolunteerPhone: '+65 8123 0008'
  },
  {
    id: 'PART-2048',
    qrId: 'QR-9828',
    name: 'Vikram Patel',
    category: 'Organizer',
    hotel: 'Onsite Staff Quarters',
    transportAllocation: 'Fleet Internal',
    mealsToday: { breakfast: true, lunch: false, dinner: false },
    eventStatus: 'Checked In',
    phone: '+65 9222 3344',
    email: 'v.patel@yesummit.org',
    responsibleVolunteerId: 'VOL-110',
    responsibleVolunteerName: 'Ananya Sharma',
    responsibleVolunteerPhone: '+65 8123 0010'
  }
];

export const INITIAL_BROADCASTS: SentBroadcast[] = [
  {
    id: 'COM-081',
    audience: 'All Volunteers',
    channel: 'Push',
    priority: 'Normal',
    subject: 'Lunch Shift Handover at 11:45 AM',
    message: 'Team leaders please begin rotation 1 handover at designated food stations. Keep radio ch 2 clear.',
    sentAt: '10:15 AM',
    recipientsCount: 186,
    status: 'Delivered (100%)'
  },
  {
    id: 'COM-080',
    audience: 'Drivers (Mobility Fleet)',
    channel: 'SMS',
    priority: 'High',
    subject: 'Expressway A2 Exit 14 Congestion Alert',
    message: 'Highway A2 congested due to vehicle stall. Reroute via Airport East coastal road.',
    sentAt: '10:32 AM',
    recipientsCount: 48,
    status: 'Delivered (100%)'
  },
  {
    id: 'COM-079',
    audience: 'Hotel A Participants',
    channel: 'Push',
    priority: 'Normal',
    subject: 'Afternoon Plenary Shuttle Schedule',
    message: 'Return shuttles to Grand Hyatt will depart every 15 min from South Coach Bay starting 16:30.',
    sentAt: '09:00 AM',
    recipientsCount: 420,
    status: 'Delivered (100%)'
  }
];

export const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: 'ACT-1',
    timestamp: '11:04 AM',
    message: 'Volunteer VOL-104 accepted task TSK-107 (Escort VIP delegation)',
    category: 'volunteer'
  },
  {
    id: 'ACT-2',
    timestamp: '10:58 AM',
    message: 'Shuttle VH-03 departed Terminal 3 with 44 passengers',
    category: 'mobility'
  },
  {
    id: 'ACT-3',
    timestamp: '10:49 AM',
    message: 'Medical incident INC-024 escalated; First Aid Team 2 en route to Hall B',
    category: 'incident'
  },
  {
    id: 'ACT-4',
    timestamp: '10:45 AM',
    message: 'Hall A Audio mic receiver replaced; sound check passed',
    category: 'session'
  },
  {
    id: 'ACT-5',
    timestamp: '10:38 AM',
    message: 'Task TSK-103 marked completed by Sec Officer Wu at VIP Gate 4',
    category: 'task'
  },
  {
    id: 'ACT-6',
    timestamp: '10:30 AM',
    message: 'Relief bus VH-12 dispatched to relieve VH-07 on Highway A2',
    category: 'mobility'
  }
];
