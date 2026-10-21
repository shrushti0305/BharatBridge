import { VIPGuest } from '../types';

export const INITIAL_VIP_GUESTS: VIPGuest[] = [
  // VVIPs: Heads of State, Prime Ministers, Cabinet Ministers & Global Agency Chiefs
  {
    id: 'VIP-001',
    name: 'H.E. Lawrence Wong',
    officialTitle: 'Prime Minister & Minister for Finance',
    countryOrOrg: 'Singapore (Host Head of Government)',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'Official State Motorcade',
      airline: 'Singapore Police Special Escort',
      terminal: 'Istana Command Transfer',
      scheduledArrival: '08:30 AM',
      actualEta: 'Landed 08:15 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-01',
      vehicleType: 'BMW i7 Armored Protection Sedan',
      plateNumber: 'MID-01',
      driverName: 'Sgt. Farhan Rahim',
      driverPhone: '+65 9111 8801',
      securityEscortUnit: 'SPF Special Escorts Unit 1',
      status: 'Arrived Onsite',
      currentEta: 'Onsite (Gate 4)'
    },
    liaisonOfficer: { id: 'VOL-104', name: 'Priya Rao', phone: '+65 8123 0004' },
    hotel: 'Official State Residence',
    assignedSuite: 'Host Presidential Suite',
    dietaryRestrictions: 'Standard Protocol, No Restrictions',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 6
  },
  {
    id: 'VIP-002',
    name: 'Lord Norman Foster',
    officialTitle: 'Founder & Executive Chairman, Foster + Partners',
    countryOrOrg: 'United Kingdom',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'BA 015',
      airline: 'British Airways First',
      terminal: 'Changi Terminal 1 (VIP CIP)',
      scheduledArrival: '09:10 AM',
      actualEta: 'Landed 09:05 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-02',
      vehicleType: 'Mercedes EQS 580 Electric Limousine',
      plateNumber: 'MID-02',
      driverName: 'Wong Kah Wei',
      driverPhone: '+65 9111 0005',
      securityEscortUnit: 'Diplomatic Protection Detail 2',
      status: 'Arrived Onsite',
      currentEta: 'Onsite (VIP Lounge)'
    },
    liaisonOfficer: { id: 'VOL-109', name: 'Michael Teo', phone: '+65 8123 0009' },
    hotel: 'Raffles Hotel Singapore',
    assignedSuite: 'VIP Green Room A',
    dietaryRestrictions: 'Vegetarian',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 3
  },
  {
    id: 'VIP-003',
    name: 'Prof. Hiroshi Amano',
    officialTitle: 'Nobel Laureate in Physics & Clean Energy Director',
    countryOrOrg: 'Japan (Nagoya University)',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'JL 037',
      airline: 'Japan Airlines First',
      terminal: 'Changi Terminal 3 (VIP CIP)',
      scheduledArrival: '09:45 AM',
      actualEta: 'Landed 09:40 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-03',
      vehicleType: 'Lexus LM500h Royal Executive Van',
      plateNumber: 'MID-03',
      driverName: 'Kenji Mori',
      driverPhone: '+65 9111 0009',
      securityEscortUnit: 'Protocol Escort Unit 3',
      status: 'Arrived Onsite',
      currentEta: 'In Plenary Session'
    },
    liaisonOfficer: { id: 'VOL-105', name: 'Chen Wei', phone: '+65 8123 0005' },
    hotel: 'Grand Hyatt Singapore',
    assignedSuite: 'Bilateral Suite 2',
    dietaryRestrictions: 'No Shellfish',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 5
  },
  {
    id: 'VIP-004',
    name: 'H.E. Dr. Sultan Al Jaber',
    officialTitle: 'President of COP28 & Minister of Industry',
    countryOrOrg: 'United Arab Emirates',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'EK 354',
      airline: 'Emirates First Class',
      terminal: 'Changi Terminal 1 (VIP Commercenter)',
      scheduledArrival: '10:00 AM',
      actualEta: 'Landed 09:50 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-04',
      vehicleType: 'Mercedes Maybach S680',
      plateNumber: 'MID-04',
      driverName: 'Ahmad Faiz',
      driverPhone: '+65 9111 0001',
      securityEscortUnit: 'SPF Escort Alpha',
      status: 'Arrived Onsite',
      currentEta: 'In Bilateral Suite 3'
    },
    liaisonOfficer: { id: 'VOL-108', name: 'Priya Nair', phone: '+65 8123 0008' },
    hotel: 'The Fullerton Hotel Singapore',
    assignedSuite: 'Bilateral Suite 3',
    dietaryRestrictions: 'Strict Halal',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 6
  },
  {
    id: 'VIP-005',
    name: 'H.E. Matthew Opoku Prempeh',
    officialTitle: 'Minister of Energy',
    countryOrOrg: 'Ghana',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'ET 638',
      airline: 'Ethiopian Airlines Business',
      terminal: 'Changi Terminal 2 (VIP Bay)',
      scheduledArrival: '11:15 AM',
      actualEta: 'En Route (ETA 11:22 AM)',
      status: 'En Route'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-05',
      vehicleType: 'BMW i7 Luxury Sedan',
      plateNumber: 'MID-05',
      driverName: 'Hassan Basri',
      driverPhone: '+65 9111 0010',
      securityEscortUnit: 'Protocol Outrider Unit 5',
      status: 'Standby Airport',
      currentEta: 'Staging at Changi T2 VIP Bay'
    },
    liaisonOfficer: { id: 'VOL-102', name: 'Nurul Huda', phone: '+65 8123 0002' },
    hotel: 'Marina Bay Sands',
    assignedSuite: 'Bilateral Suite 4',
    dietaryRestrictions: 'None',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 2
  },
  {
    id: 'VIP-006',
    name: 'Jin Liqun',
    officialTitle: 'President and Chair of Board of Directors',
    countryOrOrg: 'Asian Infrastructure Investment Bank (AIIB)',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'SQ 805',
      airline: 'Singapore Airlines First Suites',
      terminal: 'Changi Terminal 3 (VIP CIP)',
      scheduledArrival: '10:45 AM',
      actualEta: 'Landed 10:40 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-06',
      vehicleType: 'Audi A8 L Security Electric',
      plateNumber: 'MID-06',
      driverName: 'David Seah',
      driverPhone: '+65 9111 0004',
      securityEscortUnit: 'Special Operations Task 2',
      status: 'Convoy In Transit',
      currentEta: '12 min (Highway A2 Detour)'
    },
    liaisonOfficer: { id: 'VOL-103', name: 'Samuel Lee', phone: '+65 8123 0003' },
    hotel: 'Grand Hyatt Singapore',
    assignedSuite: 'VIP Bilateral Room 1',
    dietaryRestrictions: 'Pescatarian',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 4
  },
  {
    id: 'VIP-007',
    name: 'Wopke Hoekstra',
    officialTitle: 'European Commissioner for Climate Action',
    countryOrOrg: 'European Union',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'KL 835',
      airline: 'KLM Royal Dutch Airlines First',
      terminal: 'Changi Terminal 1 (VIP Commercenter)',
      scheduledArrival: '11:00 AM',
      actualEta: 'Landed 10:55 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-07',
      vehicleType: 'Mercedes EQS 580',
      plateNumber: 'MID-07',
      driverName: 'Grace Lim',
      driverPhone: '+65 9111 0002',
      securityEscortUnit: 'Diplomatic Outrider Squadron 1',
      status: 'Staging Gate 4',
      currentEta: 'At Gate 4 Security Check'
    },
    liaisonOfficer: { id: 'VOL-101', name: 'Marcus Goh', phone: '+65 8123 0001' },
    hotel: 'Raffles Hotel Singapore',
    assignedSuite: 'VIP Lounge Suite C',
    dietaryRestrictions: 'Vegetarian',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 5
  },
  {
    id: 'VIP-008',
    name: 'H.E. Pichai Naripthaphan',
    officialTitle: 'Minister of Commerce',
    countryOrOrg: 'Thailand',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'TG 403',
      airline: 'Thai Airways Royal Silk',
      terminal: 'Changi Terminal 1 (VIP Bay)',
      scheduledArrival: '09:20 AM',
      actualEta: 'Landed 09:15 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-08',
      vehicleType: 'Toyota Alphard Executive Lounge',
      plateNumber: 'MID-08',
      driverName: 'Bala Kumar',
      driverPhone: '+65 9111 0008',
      securityEscortUnit: 'Royal Thai Embassy Security + SPF',
      status: 'Arrived Onsite',
      currentEta: 'In Plenary Session'
    },
    liaisonOfficer: { id: 'VOL-106', name: 'Fatima Zahra', phone: '+65 8123 0006' },
    hotel: 'Grand Hyatt Singapore',
    assignedSuite: 'Bilateral Suite 2',
    dietaryRestrictions: 'No Pork, Halal certified',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 3
  },
  {
    id: 'VIP-009',
    name: 'Li Junhua',
    officialTitle: 'Under-Secretary-General for Economic and Social Affairs',
    countryOrOrg: 'United Nations',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'SQ 021',
      airline: 'Singapore Airlines (New York non-stop)',
      terminal: 'Changi Terminal 3 (VIP CIP)',
      scheduledArrival: '07:30 AM',
      actualEta: 'Landed 07:15 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-09',
      vehicleType: 'BMW i7 Armored Electric',
      plateNumber: 'MID-09',
      driverName: 'Siti Nurhaliza',
      driverPhone: '+65 9111 0006',
      securityEscortUnit: 'UN Security Detail & SPF',
      status: 'Arrived Onsite',
      currentEta: 'Main Plenary Stage Left'
    },
    liaisonOfficer: { id: 'VOL-110', name: 'Ananya Sharma', phone: '+65 8123 0010' },
    hotel: 'The Fullerton Hotel Singapore',
    assignedSuite: 'VIP Lounge Suite A',
    dietaryRestrictions: 'Vegan',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 6
  },
  {
    id: 'VIP-010',
    name: 'H.E. Grace Fu',
    officialTitle: 'Minister for Sustainability and the Environment',
    countryOrOrg: 'Singapore (Host Dignitary)',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'Official Motorcade Transfer',
      airline: 'State Protocol Escort',
      terminal: 'Istana Command Transfer',
      scheduledArrival: '08:00 AM',
      actualEta: 'Arrived 07:55 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Host-01',
      vehicleType: 'State Limousine 1 (Electric Armored)',
      plateNumber: 'SG-STATE-1',
      driverName: 'Chief Insp. Jason Tan',
      driverPhone: '+65 9111 9999',
      securityEscortUnit: 'Special Branch PSD',
      status: 'Arrived Onsite',
      currentEta: 'Hosting Bilateral Delegates'
    },
    liaisonOfficer: { id: 'VOL-101', name: 'Marcus Goh', phone: '+65 8123 0001' },
    hotel: 'Official State Residence',
    assignedSuite: 'Host Presidential Suite',
    dietaryRestrictions: 'Strict Vegetarian (Jain options)',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 8
  },
  {
    id: 'VIP-011',
    name: 'Dr. Ngozi Okonjo-Iweala',
    officialTitle: 'Director-General',
    countryOrOrg: 'World Trade Organization (WTO)',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'LX 176',
      airline: 'Swiss International Air Lines',
      terminal: 'Changi Terminal 2 (VIP Bay)',
      scheduledArrival: '11:40 AM',
      actualEta: 'En Route (ETA 11:35 AM)',
      status: 'En Route'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-11',
      vehicleType: 'Mercedes Maybach S680',
      plateNumber: 'MID-11',
      driverName: 'Lim Seng Huat',
      driverPhone: '+65 9111 0011',
      securityEscortUnit: 'Protocol Motorcade 6',
      status: 'Standby Airport',
      currentEta: 'Airport T2 VIP Curbside'
    },
    liaisonOfficer: { id: 'VOL-107', name: 'Darren Tan', phone: '+65 8123 0007' },
    hotel: 'Marina Bay Sands',
    assignedSuite: 'Bilateral Suite 3',
    dietaryRestrictions: 'No Seafood',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 4
  },
  {
    id: 'VIP-012',
    name: 'Børge Brende',
    officialTitle: 'President',
    countryOrOrg: 'World Economic Forum (WEF)',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'LH 778',
      airline: 'Lufthansa First',
      terminal: 'Changi Terminal 1 (VIP CIP)',
      scheduledArrival: '10:15 AM',
      actualEta: 'Landed 10:10 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-12',
      vehicleType: 'Audi A8 L Security',
      plateNumber: 'MID-12',
      driverName: 'Tan Chee Keong',
      driverPhone: '+65 9111 0012',
      securityEscortUnit: 'Diplomatic Protective Unit',
      status: 'Convoy In Transit',
      currentEta: '8 min (Approaching Gate 4)'
    },
    liaisonOfficer: { id: 'VOL-104', name: 'Priya Rao', phone: '+65 8123 0004' },
    hotel: 'Raffles Hotel Singapore',
    assignedSuite: 'VIP Bilateral Room 4',
    dietaryRestrictions: 'None',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 5
  },
  {
    id: 'VIP-013',
    name: 'H.E. Luhut Binsar Pandjaitan',
    officialTitle: 'Coordinating Minister for Maritime Affairs & Investment',
    countryOrOrg: 'Indonesia',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'GA 824',
      airline: 'Garuda Indonesia Executive',
      terminal: 'Changi Terminal 3 (VIP CIP)',
      scheduledArrival: '09:00 AM',
      actualEta: 'Landed 08:50 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-13',
      vehicleType: 'Lexus LM500h Royal',
      plateNumber: 'MID-13',
      driverName: 'Bambang Tri',
      driverPhone: '+65 9111 0013',
      securityEscortUnit: 'RI Presidential Security Detail',
      status: 'Arrived Onsite',
      currentEta: 'In Bilateral Suite 1'
    },
    liaisonOfficer: { id: 'VOL-106', name: 'Fatima Zahra', phone: '+65 8123 0006' },
    hotel: 'Grand Hyatt Singapore',
    assignedSuite: 'Bilateral Suite 1',
    dietaryRestrictions: 'Halal Certified',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 4
  },
  {
    id: 'VIP-014',
    name: 'Dr. Fatih Birol',
    officialTitle: 'Executive Director',
    countryOrOrg: 'International Energy Agency (IEA)',
    tier: 'VVIP',
    flightInfo: {
      flightNumber: 'AF 182',
      airline: 'Air France First',
      terminal: 'Changi Terminal 1 (VIP Bay)',
      scheduledArrival: '10:30 AM',
      actualEta: 'Landed 10:25 AM',
      status: 'Landed'
    },
    motorcade: {
      convoyId: 'Convoy Alpha-14',
      vehicleType: 'BMW i7 Armored',
      plateNumber: 'MID-14',
      driverName: 'Rajendran M.',
      driverPhone: '+65 9111 0003',
      securityEscortUnit: 'Protocol Outrider Alpha',
      status: 'Arrived Onsite',
      currentEta: 'In Main Plenary'
    },
    liaisonOfficer: { id: 'VOL-109', name: 'Michael Teo', phone: '+65 8123 0009' },
    hotel: 'The Fullerton Hotel Singapore',
    assignedSuite: 'VIP Green Room B',
    dietaryRestrictions: 'Mediterranean, Halal',
    securityClearance: 'Level 1 (Armed / Close Protection)',
    bilateralMeetingsCount: 5
  },

  // VIPs (36 Real Distinguished Global Leaders, Industry CEOs, Scientists & Envoys)
  ...[
    { name: 'H.E. Mia Mottley', title: 'Prime Minister of Barbados & Climate Finance Co-Chair', country: 'Barbados' },
    { name: 'Mark Carney', title: 'UN Special Envoy for Climate Action & Brookfield Chair', country: 'Canada / United Kingdom' },
    { name: 'Simon Stiell', title: 'Executive Secretary, UNFCCC', country: 'United Nations' },
    { name: 'Jensen Huang', title: 'Founder & CEO, NVIDIA', country: 'United States' },
    { name: 'Satya Nadella', title: 'Chairman & CEO, Microsoft', country: 'United States' },
    { name: 'Sundar Pichai', title: 'CEO, Alphabet & Google', country: 'United States' },
    { name: 'Laurence Tubiana', title: 'CEO, European Climate Foundation & Architect of Paris Agreement', country: 'France' },
    { name: 'Prof. Johan Rockström', title: 'Director, Potsdam Institute for Climate Impact Research', country: 'Germany / Sweden' },
    { name: 'Sunita Narain', title: 'Director General, Centre for Science and Environment', country: 'India' },
    { name: 'Dr. Arunabha Ghosh', title: 'CEO, Council on Energy, Environment and Water (CEEW)', country: 'India' },
    { name: 'Marie-Claire Daveu', title: 'Chief Sustainability and Institutional Affairs Officer, Kering', country: 'France' },
    { name: 'Patrick Pouyanné', title: 'Chairman and CEO, TotalEnergies', country: 'France' },
    { name: 'Dr. Jennifer Holmgren', title: 'CEO, LanzaTech', country: 'United States' },
    { name: 'Boyan Slat', title: 'Founder and CEO, The Ocean Cleanup', country: 'Netherlands' },
    { name: 'Antoine Arnault', title: 'Head of Image and Environment, LVMH', country: 'France' },
    { name: 'Oliver Bäte', title: 'CEO, Allianz SE', country: 'Germany' },
    { name: 'Christiana Figueres', title: 'Founding Partner, Global Optimism & Former UNFCCC Head', country: 'Costa Rica' },
    { name: 'Prof. Jeffrey Sachs', title: 'President, UN Sustainable Development Solutions Network', country: 'United States' },
    { name: 'Lord Nicholas Stern', title: 'Chair of Grantham Research Institute, LSE', country: 'United Kingdom' },
    { name: 'Lord Adair Turner', title: 'Chair, Energy Transitions Commission', country: 'United Kingdom' },
    { name: 'Kate Raworth', title: 'Senior Associate, Oxford Environmental Change Institute', country: 'United Kingdom' },
    { name: 'Paul Polman', title: 'Business Leader & Vice-Chair of UN Global Compact', country: 'Netherlands' },
    { name: 'Prof. Mariana Mazzucato', title: 'Founding Director, UCL Institute for Innovation and Public Purpose', country: 'Italy / UK' },
    { name: 'Mary Robinson', title: 'Chair of The Elders & Former President of Ireland', country: 'Ireland' },
    { name: 'Ban Ki-moon', title: 'Former Secretary-General of the United Nations', country: 'South Korea' },
    { name: 'Gim Huay Neo', title: 'Managing Director, WEF Centre for Nature and Climate', country: 'Singapore' },
    { name: 'Sir Alok Sharma', title: 'Former COP26 President', country: 'United Kingdom' },
    { name: 'Dr. Rajiv Shah', title: 'President, The Rockefeller Foundation', country: 'United States' },
    { name: 'Rachel Kyte', title: 'Co-Chair, Voluntary Carbon Markets Integrity Initiative', country: 'United Kingdom' },
    { name: 'Natarajan Chandrasekaran', title: 'Chairman, Tata Sons', country: 'India' },
    { name: 'Feike Sijbesma', title: 'Honorary Chairman, Royal DSM & Climate Leader', country: 'Netherlands' },
    { name: 'Helena Helmersson', title: 'Senior Industrial Advisor & Sustainability Strategist', country: 'Sweden' },
    { name: 'Svein Tore Holsether', title: 'President and CEO, Yara International', country: 'Norway' },
    { name: 'Makhtar Diop', title: 'Managing Director, International Finance Corporation (IFC)', country: 'Senegal / World Bank' },
    { name: 'Gideon Lichfield', title: 'Senior Technology Editor & Global Innovation Fellow', country: 'United States' },
    { name: 'Nandan Nilekani', title: 'Founding Chairman, UIDAI & Co-Founder Infosys', country: 'India' }
  ].map((dignitary, idx) => {
    const vipIndex = idx + 15;
    const paddedId = `VIP-0${vipIndex < 100 ? (vipIndex < 10 ? '0' + vipIndex : vipIndex) : vipIndex}`;

    const hotels = [
      'Marina Bay Sands (Sands Premier Suite)',
      'The Fullerton Hotel Singapore (Heritage Suite)',
      'Raffles Hotel Singapore (Courtyard Suite)',
      'Grand Hyatt Singapore (Grand Executive)',
      'Shangri-La Singapore (Valley Wing)',
      'JW Marriott South Beach',
      'Capella Singapore (Sentosa Sanctuary)'
    ];

    const driverNames = [
      'Sgt. Jonathan Tan', 'Mohd Azman', 'Goh Boon Keng', 'Kavitha Sundram', 'Heng Wee Kiat',
      'Ridhwan Salleh', 'Adrian Teo', 'Vikramaditya Rao', 'Steven Koh', 'Ahmad Razak',
      'Daniel Lim', 'Francis Xavier', 'Chua Swee Guan', 'Nurul Iman', 'Harpreet Singh',
      'Zheng Zhiwei', 'Kenny Yeo', 'Suresh Pillai', 'Desmond Fong', 'Zulkifli Mansor',
      'Raymond Ng', 'Marcus Tay', 'Mohamed Shafi', 'Kelvin Chew', 'Subramanian V.',
      'Jeremy Low', 'Hafiz Osman', 'Gary Seah', 'Bernard Tan', 'Karthik Raja',
      'Edwin Sim', 'Taufiq Hidayat', 'Patrick Chong', 'David Nair', 'Andy Kwek', 'Melvin Lee'
    ];

    const liaisonOfficers = [
      { id: 'VOL-101', name: 'Marcus Goh', phone: '+65 8123 0001' },
      { id: 'VOL-102', name: 'Nurul Huda', phone: '+65 8123 0002' },
      { id: 'VOL-103', name: 'Samuel Lee', phone: '+65 8123 0003' },
      { id: 'VOL-104', name: 'Priya Rao', phone: '+65 8123 0004' },
      { id: 'VOL-105', name: 'Chen Wei', phone: '+65 8123 0005' },
      { id: 'VOL-106', name: 'Fatima Zahra', phone: '+65 8123 0006' },
      { id: 'VOL-107', name: 'Darren Tan', phone: '+65 8123 0007' },
      { id: 'VOL-108', name: 'Priya Nair', phone: '+65 8123 0008' },
      { id: 'VOL-109', name: 'Michael Teo', phone: '+65 8123 0009' },
      { id: 'VOL-110', name: 'Ananya Sharma', phone: '+65 8123 0010' }
    ];

    const motorcadeStatuses: VIPGuest['motorcade']['status'][] = [
      'Arrived Onsite', 'Arrived Onsite', 'Convoy In Transit', 'Staging Gate 4', 'Standby Airport', 'Arrived Onsite'
    ];

    const flightStatuses: VIPGuest['flightInfo']['status'][] = [
      'Landed', 'Landed', 'En Route', 'Landed', 'Delayed', 'Landed'
    ];

    const suites = [
      'Bilateral Room 2',
      'Bilateral Room 3',
      'VIP Lounge East',
      'Executive Suite 5',
      'Green Room C',
      'Speaker Boardroom'
    ];

    const chosenStatus = motorcadeStatuses[idx % motorcadeStatuses.length];
    const flightStatus = flightStatuses[idx % flightStatuses.length];
    const assignedLiaison = liaisonOfficers[idx % liaisonOfficers.length];

    return {
      id: paddedId,
      name: dignitary.name,
      officialTitle: dignitary.title,
      countryOrOrg: dignitary.country,
      tier: 'VIP' as const,
      flightInfo: {
        flightNumber: `SQ ${310 + idx}`,
        airline: 'Singapore Airlines First / Business',
        terminal: idx % 2 === 0 ? 'Changi Terminal 3' : 'Changi Terminal 1',
        scheduledArrival: `${8 + (idx % 4)}:${(idx * 7) % 60 < 10 ? '0' + ((idx * 7) % 60) : (idx * 7) % 60} AM`,
        actualEta: flightStatus === 'Landed' ? 'On Schedule (Landed)' : flightStatus === 'Delayed' ? 'Delayed (+35m)' : 'En Route ETA 11:45',
        status: flightStatus
      },
      motorcade: {
        convoyId: `Convoy Bravo-${idx < 9 ? '0' + (idx + 1) : (idx + 1)}`,
        vehicleType: idx % 3 === 0 ? 'VIP Electric Sedan (Mercedes EQE)' : idx % 3 === 1 ? 'VIP Electric Sedan (BMW i4)' : '14-Seater Executive VIP Van',
        plateNumber: `VIP-${100 + idx}`,
        driverName: driverNames[idx] || `Driver ${idx + 1}`,
        driverPhone: `+65 9111 ${1000 + idx}`,
        securityEscortUnit: 'Protocol Fleet Team B',
        status: chosenStatus,
        currentEta: chosenStatus === 'Arrived Onsite' ? 'Onsite (Gate 4)' : chosenStatus === 'Convoy In Transit' ? `${6 + (idx % 12)} min to Venue` : 'Staging at Hub'
      },
      liaisonOfficer: assignedLiaison,
      hotel: hotels[idx % hotels.length],
      assignedSuite: suites[idx % suites.length],
      dietaryRestrictions: idx % 4 === 0 ? 'Vegetarian' : idx % 4 === 1 ? 'Halal' : idx % 4 === 2 ? 'Gluten-Free' : 'Standard',
      securityClearance: idx % 3 === 0 ? 'Level 2 (Protocol Escort)' as const : 'Standard VIP' as const,
      bilateralMeetingsCount: 2 + (idx % 4)
    };
  })
];
