import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  Download,
  Copy,
  Sparkles,
  ArrowRight,
  Database,
  Crown,
  Users,
  Bus,
  RefreshCw,
  HelpCircle,
  FileUp
} from 'lucide-react';
import { VIPGuest, Participant, Vehicle, Volunteer } from '../types';
import { INITIAL_VIP_GUESTS } from '../data/vipData';

export type ImportDatasetType = 'vip' | 'participants' | 'vehicles' | 'volunteers';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDataset?: ImportDatasetType;
  onImportVIPGuests: (guests: VIPGuest[], mode: 'replace' | 'merge') => void;
  onImportParticipants?: (participants: Participant[], mode: 'replace' | 'merge') => void;
  onImportVehicles?: (vehicles: Vehicle[], mode: 'replace' | 'merge') => void;
  onAddToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onLogActivity?: (message: string, category?: any) => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  initialDataset = 'vip',
  onImportVIPGuests,
  onImportParticipants,
  onImportVehicles,
  onAddToast,
  onLogActivity
}) => {
  const [selectedDataset, setSelectedDataset] = useState<ImportDatasetType>(initialDataset);
  const [inputMethod, setInputMethod] = useState<'upload' | 'paste' | 'preset'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawContent, setRawContent] = useState<string>('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('replace');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Sample CSV Templates for instant download
  const handleDownloadTemplate = (type: ImportDatasetType) => {
    let headers: string[] = [];
    let sampleRows: string[][] = [];
    let filename = '';

    if (type === 'vip') {
      headers = [
        'ID',
        'Tier',
        'Name',
        'Official Title',
        'Country / Organization',
        'Flight Number',
        'Airline',
        'Terminal',
        'Scheduled Arrival',
        'Flight Status',
        'Convoy ID',
        'Vehicle Type',
        'Plate Number',
        'Driver Name',
        'Driver Phone',
        'Escort Unit',
        'Convoy Status',
        'Current ETA',
        'Hotel',
        'Assigned Suite',
        'Liaison Name',
        'Liaison Phone',
        'Security Clearance',
        'Dietary Restrictions',
        'Bilateral Meetings'
      ];
      sampleRows = [
        [
          'VIP-001',
          'VVIP',
          'H.E. Lawrence Wong',
          'Prime Minister & Minister for Finance',
          'Singapore',
          'Official State Motorcade',
          'Police Escort Unit',
          'Istana Command Transfer',
          '08:30 AM',
          'Landed',
          'Convoy Alpha-01',
          'BMW i7 Armored Protection Sedan',
          'MID-01',
          'Sgt. Farhan Rahim',
          '+65 9111 8801',
          'SPF Escort Unit 1',
          'Arrived Onsite',
          'Onsite (Gate 4)',
          'Official State Residence',
          'Host Presidential Suite',
          'Priya Rao',
          '+65 8123 0004',
          'Level 1 (Armed / Close Protection)',
          'Standard Protocol',
          '6'
        ],
        [
          'VIP-002',
          'VVIP',
          'Lord Norman Foster',
          'Founder & Executive Chairman, Foster + Partners',
          'United Kingdom',
          'BA 015',
          'British Airways First',
          'Changi T1 (VIP CIP)',
          '09:10 AM',
          'Landed',
          'Convoy Alpha-02',
          'Mercedes EQS 580 Limousine',
          'MID-02',
          'Wong Kah Wei',
          '+65 9111 0005',
          'Diplomatic Protection Detail 2',
          'Arrived Onsite',
          'Onsite (VIP Lounge)',
          'Raffles Hotel Singapore',
          'VIP Green Room A',
          'Michael Teo',
          '+65 8123 0009',
          'Level 1 (Armed / Close Protection)',
          'Vegetarian',
          '3'
        ]
      ];
      filename = 'YESummit_2027_VIP_VVIP_Import_Template.csv';
    } else if (type === 'participants') {
      headers = ['ID', 'QR ID', 'Name', 'Category', 'Hotel', 'Transport Allocation', 'Status', 'Phone', 'Email'];
      sampleRows = [
        ['ATT-1001', 'QR-9901', 'Laurence Tubiana', 'VIP', 'Raffles Hotel Singapore', 'VIP Convoy Bravo-01', 'Checked In', '+65 9123 4567', 'l.tubiana@climate.org'],
        ['ATT-1002', 'QR-9902', 'Dr. Marcus Vance', 'Speaker', 'Grand Hyatt Singapore', 'Shuttle Route B', 'Checked In', '+65 9234 5678', 'm.vance@mit.edu']
      ];
      filename = 'YESummit_2027_Participants_Import_Template.csv';
    } else {
      headers = ['ID', 'Driver', 'Type', 'Route', 'Location', 'Passengers', 'Status', 'ETA', 'Phone', 'Fuel'];
      sampleRows = [
        ['V-001', 'David Lim', 'Electric 45-pax Coach', 'Route A (Changi T1 - Complex)', 'Changi Express ECP', '38/45', 'ON_TIME', 'On time', '+65 9123 4001', '85'],
        ['V-002', 'Ahmad Razak', 'Executive Shuttle 22-pax', 'Route B (Marina Hotels - Complex)', 'Shenton Way Gate 2', '20/22', 'ON_TIME', '4 min', '+65 9123 4002', '92']
      ];
      filename = 'YESummit_2027_Fleet_Import_Template.csv';
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddToast) {
      onAddToast('Template Downloaded', `${filename} generated successfully.`, 'info');
    }
  };

  // Parsing CSV text
  const parseCSV = (csvText: string, datasetType: ImportDatasetType) => {
    const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setParseErrors(['CSV contains insufficient rows (header + at least 1 record required).']);
      setParsedData([]);
      return;
    }

    // Parse header
    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let insideQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (insideQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const header = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows = lines.slice(1).map(parseRow);

    const parsed: any[] = [];
    const errors: string[] = [];

    if (datasetType === 'vip') {
      rows.forEach((row, idx) => {
        if (row.length < 3) return; // skip empty/invalid

        // Extract using fuzzy matching on header indices
        const getVal = (possibleKeys: string[], defaultVal = ''): string => {
          for (const k of possibleKeys) {
            const index = header.findIndex((h) => h.includes(k));
            if (index !== -1 && row[index] !== undefined && row[index] !== '') {
              return row[index];
            }
          }
          return defaultVal;
        };

        const id = getVal(['id', 'vipid'], `VIP-${(idx + 1).toString().padStart(3, '0')}`);
        const name = getVal(['name', 'guest', 'dignitary'], `Dignitary ${idx + 1}`);
        const tier = (getVal(['tier', 'level'], 'VIP').toUpperCase().includes('VVIP') ? 'VVIP' : 'VIP') as 'VVIP' | 'VIP';
        const officialTitle = getVal(['title', 'role', 'position'], 'Official Representative');
        const countryOrOrg = getVal(['country', 'org', 'nation'], 'International Delegation');
        const flightNumber = getVal(['flightnumber', 'flightno', 'flight'], 'SQ 001');
        const airline = getVal(['airline'], 'Commercial / VIP Fleet');
        const terminal = getVal(['terminal'], 'Changi T3 VIP');
        const scheduledArrival = getVal(['scheduled', 'arrival'], '10:00 AM');
        const flightStatus = (getVal(['flightstatus', 'status'], 'Landed') as any);
        const convoyId = getVal(['convoyid', 'convoy'], `Convoy ${tier === 'VVIP' ? 'Alpha' : 'Bravo'}-${(idx + 1).toString().padStart(2, '0')}`);
        const vehicleType = getVal(['vehicletype', 'vehicle'], tier === 'VVIP' ? 'Armored Protection Sedan' : 'VIP Electric Executive Sedan');
        const plateNumber = getVal(['plate', 'platenumber'], `MID-${10 + idx}`);
        const driverName = getVal(['drivername', 'driver', 'chauffeur'], 'SPF VIP Chauffeur');
        const driverPhone = getVal(['driverphone', 'phone'], '+65 9111 0000');
        const escortUnit = getVal(['escort', 'securityescort'], tier === 'VVIP' ? 'SPF Special Escorts Unit' : 'Protocol Fleet Team');
        const convoyStatus = (getVal(['convoystatus'], 'Arrived Onsite') as any);
        const currentEta = getVal(['currenteta', 'eta'], 'Onsite (Gate 4)');
        const hotel = getVal(['hotel'], 'Marina Bay Sands');
        const assignedSuite = getVal(['suite', 'assignedsuite'], `Bilateral Suite ${(idx % 6) + 1}`);
        const liaisonName = getVal(['liaisonname', 'liaison'], 'Protocol Officer');
        const liaisonPhone = getVal(['liaisonphone'], '+65 8123 0000');
        const securityClearance = (getVal(['securityclearance', 'clearance'], tier === 'VVIP' ? 'Level 1 (Armed / Close Protection)' : 'Level 2 (Protocol Escort)') as any);
        const dietaryRestrictions = getVal(['dietary', 'food', 'diet'], 'Standard');
        const bilateralMeetingsCount = parseInt(getVal(['bilateral', 'meetings'], '3')) || 3;

        const vipRecord: VIPGuest = {
          id,
          name,
          officialTitle,
          countryOrOrg,
          tier,
          flightInfo: {
            flightNumber,
            airline,
            terminal,
            scheduledArrival,
            actualEta: `${flightStatus} ${scheduledArrival}`,
            status: ['Landed', 'En Route', 'Delayed', 'Departed'].includes(flightStatus) ? flightStatus : 'Landed'
          },
          motorcade: {
            convoyId,
            vehicleType,
            plateNumber,
            driverName,
            driverPhone,
            securityEscortUnit: escortUnit,
            status: ['Standby Airport', 'Convoy In Transit', 'Staging Gate 4', 'Arrived Onsite', 'Departed'].includes(convoyStatus)
              ? convoyStatus
              : 'Arrived Onsite',
            currentEta
          },
          liaisonOfficer: {
            id: `VOL-${101 + (idx % 10)}`,
            name: liaisonName,
            phone: liaisonPhone
          },
          hotel,
          assignedSuite,
          dietaryRestrictions,
          securityClearance,
          bilateralMeetingsCount
        };

        parsed.push(vipRecord);
      });
    } else if (datasetType === 'participants') {
      rows.forEach((row, idx) => {
        if (row.length < 2) return;
        const id = row[0] || `ATT-${1000 + idx}`;
        const qrId = row[1] || `QR-${9000 + idx}`;
        const name = row[2] || `Delegate ${idx + 1}`;
        const category = (['VIP', 'Speaker', 'Media', 'Organizer'].includes(row[3]) ? row[3] : 'Delegate') as any;
        const hotel = row[4] || 'Marina Bay Sands';
        const transportAllocation = row[5] || 'Shuttle Route A';
        const eventStatus = (row[6] || 'Checked In') as any;
        const phone = row[7] || '+65 9000 0000';
        const email = row[8] || `attendee${idx + 1}@yesummit.org`;

        parsed.push({
          id,
          qrId,
          name,
          category,
          hotel,
          transportAllocation,
          mealsToday: { breakfast: true, lunch: false, dinner: false },
          eventStatus,
          phone,
          email
        });
      });
    }

    if (parsed.length === 0) {
      errors.push('No valid records could be extracted. Please check the column headers.');
    }

    setParseErrors(errors);
    setParsedData(parsed);
  };

  // Parsing JSON input
  const parseJSON = (jsonText: string, datasetType: ImportDatasetType) => {
    try {
      const data = JSON.parse(jsonText);
      const array = Array.isArray(data) ? data : data.records || data.guests || data.items || [];
      if (!Array.isArray(array) || array.length === 0) {
        setParseErrors(['JSON must be an array of records or contain a "records" or "guests" array.']);
        setParsedData([]);
        return;
      }
      setParseErrors([]);
      setParsedData(array);
    } catch (e: any) {
      setParseErrors([`JSON parsing error: ${e.message}`]);
      setParsedData([]);
    }
  };

  const handleProcessRawContent = (content: string, type: ImportDatasetType) => {
    setRawContent(content);
    const trimmed = content.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      parseJSON(trimmed, type);
    } else {
      parseCSV(trimmed, type);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleProcessRawContent(text, selectedDataset);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleProcessRawContent(text, selectedDataset);
      };
      reader.readAsText(file);
    }
  };

  const handlePresetSelect = (presetKey: 'vip50' | 'asean10') => {
    if (presetKey === 'vip50') {
      setFileName('Official_YESummit_50_Dignitaries_Roster.json');
      setParsedData(INITIAL_VIP_GUESTS);
      setParseErrors([]);
      setSelectedDataset('vip');
      if (onAddToast) {
        onAddToast('Preset Selected', 'Loaded complete official 50 VIP & VVIP dignitaries with motorcade convoy itineraries.', 'info');
      }
    } else {
      // 10 Additional ASEAN delegates
      const additionalVIPs: VIPGuest[] = [
        {
          id: 'VIP-051',
          name: 'H.E. Dato Sri Wan Rosdy',
          officialTitle: 'Chief Minister & Regional Trade Envoy',
          countryOrOrg: 'Malaysia',
          tier: 'VVIP',
          flightInfo: {
            flightNumber: 'MH 603',
            airline: 'Malaysia Airlines',
            terminal: 'Changi T2 (VIP CIP)',
            scheduledArrival: '11:45 AM',
            actualEta: 'En Route 11:50 AM',
            status: 'En Route'
          },
          motorcade: {
            convoyId: 'Convoy Alpha-07',
            vehicleType: 'Armored Mercedes S-Class',
            plateNumber: 'MID-51',
            driverName: 'Zulkifli Hassan',
            driverPhone: '+65 9111 5101',
            securityEscortUnit: 'SPF Escort Unit 7',
            status: 'Standby Airport',
            currentEta: 'Changi T2 VIP Holding'
          },
          liaisonOfficer: { id: 'VOL-101', name: 'Tan Wei Ling', phone: '+65 8123 0001' },
          hotel: 'Raffles Hotel Singapore',
          assignedSuite: 'Bilateral Suite 3',
          dietaryRestrictions: 'Halal',
          securityClearance: 'Level 1 (Armed / Close Protection)',
          bilateralMeetingsCount: 4
        },
        {
          id: 'VIP-052',
          name: 'Hon. Luhut B. Pandjaitan Lead',
          officialTitle: 'Coordinating Minister for Maritime Affairs & Investment',
          countryOrOrg: 'Indonesia',
          tier: 'VVIP',
          flightInfo: {
            flightNumber: 'GA 826',
            airline: 'Garuda Indonesia',
            terminal: 'Changi T3 (VIP CIP)',
            scheduledArrival: '12:15 PM',
            actualEta: 'Scheduled 12:15 PM',
            status: 'En Route'
          },
          motorcade: {
            convoyId: 'Convoy Alpha-08',
            vehicleType: 'Lexus LM Executive Royal Van',
            plateNumber: 'MID-52',
            driverName: 'Bambang Soetoro',
            driverPhone: '+65 9111 5202',
            securityEscortUnit: 'SPF Diplomatic Protection',
            status: 'Standby Airport',
            currentEta: 'Staging VIP Changi'
          },
          liaisonOfficer: { id: 'VOL-103', name: 'Nurul Huda', phone: '+65 8123 0003' },
          hotel: 'The Ritz-Carlton Millenia',
          assignedSuite: 'Bilateral Suite 4',
          dietaryRestrictions: 'Halal',
          securityClearance: 'Level 1 (Armed / Close Protection)',
          bilateralMeetingsCount: 5
        },
        {
          id: 'VIP-053',
          name: 'Dr. Thani bin Ahmed Al Zeyoudi',
          officialTitle: 'Minister of State for Foreign Trade',
          countryOrOrg: 'United Arab Emirates',
          tier: 'VVIP',
          flightInfo: {
            flightNumber: 'EK 354',
            airline: 'Emirates / Royal Flight',
            terminal: 'VIP Jet Terminal (Seletar)',
            scheduledArrival: '12:40 PM',
            actualEta: 'En Route',
            status: 'En Route'
          },
          motorcade: {
            convoyId: 'Convoy Alpha-09',
            vehicleType: 'BMW i7 M70 Executive Limousine',
            plateNumber: 'MID-53',
            driverName: 'Rashid Al-Kaabi',
            driverPhone: '+65 9111 5303',
            securityEscortUnit: 'Special Operations Protocol',
            status: 'Standby Airport',
            currentEta: 'Seletar VIP Staging'
          },
          liaisonOfficer: { id: 'VOL-105', name: 'Chen Wei', phone: '+65 8123 0005' },
          hotel: 'Marina Bay Sands (Presidential Suite)',
          assignedSuite: 'VIP Green Room B',
          dietaryRestrictions: 'Halal',
          securityClearance: 'Level 1 (Armed / Close Protection)',
          bilateralMeetingsCount: 6
        }
      ];
      setFileName('ASEAN_GCC_Special_Delegation_Patch.json');
      setParsedData(additionalVIPs);
      setParseErrors([]);
      setSelectedDataset('vip');
      if (onAddToast) {
        onAddToast('Preset Selected', 'Loaded additional ministerial envoys with tarmac convoy assignments.', 'info');
      }
    }
  };

  const handleConfirmImport = () => {
    if (parsedData.length === 0) return;

    setIsProcessing(true);

    setTimeout(() => {
      if (selectedDataset === 'vip') {
        onImportVIPGuests(parsedData as VIPGuest[], importMode);
      } else if (selectedDataset === 'participants' && onImportParticipants) {
        onImportParticipants(parsedData as Participant[], importMode);
      }

      setIsProcessing(false);
      setImportSuccess(true);

      const count = parsedData.length;
      const typeLabel = selectedDataset === 'vip' ? 'VIP & VVIP Dignitaries' : selectedDataset === 'participants' ? 'Participants' : 'Records';

      if (onAddToast) {
        onAddToast(
          'Data Ingested Successfully',
          `${count} ${typeLabel} have been successfully validated and synced into the Command Centre.`,
          'success'
        );
      }

      if (onLogActivity) {
        onLogActivity(
          `Data Import: Ingested ${count} ${typeLabel} (${importMode === 'replace' ? 'Clean Override' : 'Merged'})`,
          'admin'
        );
      }

      setTimeout(() => {
        setImportSuccess(false);
        onClose();
      }, 1400);
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
      <div className="bg-[var(--card)] rounded-xl max-w-4xl w-full border border-[var(--line)] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--line)] flex items-center justify-between bg-[var(--card)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[var(--ink)]">
                  Data Import & Manifest Ingestion Gateway
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                  Real-Time Sync
                </span>
              </div>
              <p className="text-xs text-[var(--mute)] mt-0.5">
                Import and map CSV or JSON datasets directly into the YESummit Command Centre with instant validation.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Dataset Type Selector */}
          <div className="space-y-1.5">
            <label className="font-bold text-[var(--ink)] flex items-center justify-between">
              <span>Select Destination Dataset:</span>
              <span className="text-[11px] font-normal text-[var(--mute)]">Auto-matches fields based on selected schema</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'vip', label: 'VIP & VVIP Manifest (50)', icon: Crown, desc: 'Dignitaries, Motorcades, Flights' },
                { key: 'participants', label: 'Attendees & Delegates', icon: Users, desc: 'Registration, Hotel, Badges' },
                { key: 'vehicles', label: 'Mobility Fleet', icon: Bus, desc: 'Buses, Shuttles, Telemetry' },
                { key: 'volunteers', label: 'Volunteers Roster', icon: Users, desc: 'Staff, Zones, Check-ins' }
              ].map((item) => {
                const Icon = item.icon;
                const active = selectedDataset === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSelectedDataset(item.key as ImportDatasetType);
                      setParsedData([]);
                      setParseErrors([]);
                      setFileName(null);
                    }}
                    className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      active
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 shadow-xs'
                        : 'border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--card)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[var(--ink)]">
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-[var(--primary)]' : 'text-[var(--mute)]'}`} />
                      <span>{item.label}</span>
                    </div>
                    <div className="text-[10px] text-[var(--mute)] mt-1 truncate">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick-Action Bar: Preset & Templates */}
          <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-[var(--ink)]">Need quick sample data? </span>
                <span className="text-[var(--mute)]">Load verified rosters or grab ready-to-use CSV templates.</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedDataset === 'vip' && (
                <>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('vip50')}
                    className="px-2.5 py-1.5 rounded bg-[var(--card)] border border-amber-500/40 hover:border-amber-500 text-amber-700 dark:text-amber-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Crown className="w-3 h-3 text-amber-500" />
                    <span>Load 50 VIP & VVIP Roster</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('asean10')}
                    className="px-2.5 py-1.5 rounded bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <span>+ ASEAN Envoys (Patch)</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => handleDownloadTemplate(selectedDataset)}
                className="px-2.5 py-1.5 rounded bg-[var(--card)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Download className="w-3 h-3 text-[var(--mute)]" />
                <span>Download Sample CSV</span>
              </button>
            </div>
          </div>

          {/* Input Method Tabs */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-[var(--line)] pb-1">
              {[
                { key: 'upload', label: 'Upload CSV / JSON File', icon: Upload },
                { key: 'paste', label: 'Copy / Paste Spreadsheet Text', icon: Copy }
              ].map((m) => {
                const Icon = m.icon;
                const active = inputMethod === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setInputMethod(m.key as any)}
                    className={`pb-2 px-3 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors border-b-2 -mb-[1px] ${
                      active
                        ? 'border-[var(--primary)] text-[var(--primary)] font-bold'
                        : 'border-transparent text-[var(--mute)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {inputMethod === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 scale-101'
                    : 'border-[var(--line)] hover:border-[var(--primary)]/60 bg-[var(--bg)]'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.json,.txt,.tsv"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-[var(--card)] border border-[var(--line)] flex items-center justify-center shadow-xs">
                  <FileUp className="w-6 h-6 text-[var(--primary)]" />
                </div>
                <div>
                  <div className="font-bold text-[var(--ink)] text-sm">
                    {fileName ? (
                      <span className="text-[var(--primary)]">{fileName}</span>
                    ) : (
                      'Click to upload or drag & drop file here'
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--mute)] mt-1">
                    Supports .CSV, .JSON, .TSV exported from Excel, Google Sheets, or Diplomatic Protocol systems.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    handleProcessRawContent(e.target.value, selectedDataset);
                  }}
                  placeholder={`Paste raw CSV rows with headers here, or paste JSON array...\nExample:\nID,Tier,Name,Official Title,Country / Organization,Flight Number,Convoy ID,Vehicle Type\nVIP-001,VVIP,H.E. Lawrence Wong,Prime Minister,Singapore,Official State Motorcade,Convoy Alpha-01,BMW i7 Armored`}
                  className="w-full p-3 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-mono text-[11px] focus:outline-hidden focus:border-[var(--primary)]"
                />
                <div className="flex items-center justify-between text-[11px] text-[var(--mute)]">
                  <span>Delimiters automatically detected (comma, tab, semicolon).</span>
                  <span>{pastedText.length} characters</span>
                </div>
              </div>
            )}
          </div>

          {/* Validation & Preview Section */}
          {parseErrors.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Validation Issues Detected</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] space-y-0.5">
                {parseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-[var(--ink)]">
                    Parsed {parsedData.length} records ready to import:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--mute)]">Import Mode:</span>
                  <div className="inline-flex rounded-md border border-[var(--line)] bg-[var(--bg)] p-0.5">
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        importMode === 'replace' ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs' : 'text-[var(--mute)]'
                      }`}
                    >
                      Overwrite / Clean Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('merge')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        importMode === 'merge' ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs' : 'text-[var(--mute)]'
                      }`}
                    >
                      Append & Merge
                    </button>
                  </div>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-[var(--line)] rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--mute)] font-semibold sticky top-0">
                      <th className="py-2 px-2.5">ID</th>
                      <th className="py-2 px-2.5">Tier / Type</th>
                      <th className="py-2 px-2.5">Dignitary / Name</th>
                      <th className="py-2 px-2.5">Country / Org</th>
                      <th className="py-2 px-2.5">Flight & Tarmac</th>
                      <th className="py-2 px-2.5">Motorcade Convoy</th>
                      <th className="py-2 px-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {parsedData.slice(0, 10).map((row: any, i) => (
                      <tr key={i} className="hover:bg-[var(--bg)]">
                        <td className="py-1.5 px-2.5 font-mono font-semibold text-[var(--primary)]">{row.id}</td>
                        <td className="py-1.5 px-2.5">
                          {row.tier ? (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                row.tier === 'VVIP'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30'
                              }`}
                            >
                              {row.tier}
                            </span>
                          ) : (
                            <span className="text-[var(--mute)]">{row.category || 'Record'}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 font-medium text-[var(--ink)]">
                          <div>{row.name}</div>
                          <div className="text-[10px] text-[var(--mute)] truncate max-w-xs">{row.officialTitle}</div>
                        </td>
                        <td className="py-1.5 px-2.5 text-[var(--mute)]">{row.countryOrOrg || row.hotel || '-'}</td>
                        <td className="py-1.5 px-2.5">
                          {row.flightInfo ? (
                            <div className="font-mono text-[10px]">
                              {row.flightInfo.flightNumber} ({row.flightInfo.status})
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-1.5 px-2.5">
                          {row.motorcade ? (
                            <div className="font-mono text-[10px]">
                              {row.motorcade.convoyId} · {row.motorcade.vehicleType.slice(0, 16)}...
                            </div>
                          ) : (
                            row.transportAllocation || '-'
                          )}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
                            {row.motorcade?.status || row.eventStatus || 'Validated'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 10 && (
                <div className="text-center text-[10px] text-[var(--mute)]">
                  Showing first 10 of {parsedData.length} records. All {parsedData.length} will be imported.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-[var(--line)] bg-[var(--card)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[var(--mute)] flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-[var(--mute)]" />
            <span>Real-time reconciliation guarantees zero downtime and instant UI refresh.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-md border border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--card)] text-[var(--ink)] cursor-pointer transition-colors flex-1 sm:flex-initial"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={parsedData.length === 0 || isProcessing}
              className={`px-5 py-2 text-xs font-bold rounded-md text-white flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md flex-1 sm:flex-initial ${
                parsedData.length > 0 && !isProcessing
                  ? 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] hover:scale-102'
                  : 'bg-[var(--mute)]/50 cursor-not-allowed'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating & Ingesting...</span>
                </>
              ) : importSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Imported Successfully!</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>
                    Confirm & Ingest {parsedData.length > 0 ? `${parsedData.length} Records` : 'Dataset'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
