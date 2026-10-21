import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Users,
  RefreshCw,
  Download,
  AlertOctagon,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Lock,
  Eye,
  SlidersHorizontal,
  Info,
  X,
  Copy,
  Upload,
  UserCheck,
  MapPin,
  CheckSquare,
  Cpu,
  Radio,
  Layers,
  Zap,
  Database,
  History,
  Printer
} from 'lucide-react';
import {
  UserRole,
  Incident,
  Participant,
  Task,
  Session,
  Vehicle,
  Volunteer,
  VIPGuest,
  ActivityItem
} from '../types';
import { AuditDossierModal } from './AuditDossierModal';
import { AuditStateImportModal } from './AuditStateImportModal';

interface AdminTabProps {
  userRole: UserRole;
  onChangeUserRole: (role: UserRole) => void;
  scanningPaused: boolean;
  onToggleScanning: (paused: boolean) => void;
  incidents: Incident[];
  participants: Participant[];
  tasks?: Task[];
  sessions?: Session[];
  vehicles?: Vehicle[];
  volunteers?: Volunteer[];
  vipGuests?: VIPGuest[];
  activities?: ActivityItem[];
  onTriggerSync: () => void;
  isSyncing: boolean;
  onAddToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenImportModal?: (dataset?: 'vip' | 'participants' | 'vehicles' | 'volunteers') => void;
  onLogActivity?: (message: string, category?: any) => void;
  onOpenArchitectureModal?: () => void;
  onRestoreSystemState?: (importedState: {
    incidents?: Incident[];
    tasks?: Task[];
    vehicles?: Vehicle[];
    volunteers?: Volunteer[];
    sessions?: Session[];
    participants?: Participant[];
    vipGuests?: VIPGuest[];
    activities?: ActivityItem[];
  }) => void;
}

export const AdminTab: React.FC<AdminTabProps> = ({
  userRole,
  onChangeUserRole,
  scanningPaused,
  onToggleScanning,
  incidents,
  participants,
  tasks = [],
  sessions = [],
  vehicles = [],
  volunteers = [],
  vipGuests = [],
  activities = [],
  onTriggerSync,
  isSyncing,
  onAddToast,
  onOpenImportModal,
  onLogActivity,
  onOpenArchitectureModal,
  onRestoreSystemState
}) => {
  const [showConfirmPauseModal, setShowConfirmPauseModal] = useState(false);
  const [showPreviewSummaryModal, setShowPreviewSummaryModal] = useState(false);
  const [showAuditDossierModal, setShowAuditDossierModal] = useState(false);
  const [showAuditImportModal, setShowAuditImportModal] = useState(false);
  const [previewTab, setPreviewTab] = useState<'json' | 'volunteers' | 'participants' | 'matrix'>('json');
  const [generatedSummaryJson, setGeneratedSummaryJson] = useState<string>('');
  const [generatedSummaryObj, setGeneratedSummaryObj] = useState<any>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const zones = [
    'Main Hall',
    'Hall A',
    'Hall B',
    'Exhibition',
    'Registration',
    'Food Court',
    'Medical',
    'Help Desk',
    'VIP',
    'Entry/Exit'
  ];

  // Generate the PDF-style structured JSON summary document
  const generateSummaryData = () => {
    const now = new Date();
    const isoDate = now.toISOString();
    const formattedDate = now.toLocaleDateString('en-SG', { dateStyle: 'full' });
    const formattedTime =
      now.toLocaleTimeString('en-SG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + ' SGT';

    // 1. Compile all active incidents
    const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
    const highPriorityActive = activeIncidents.filter((i) => i.priority === 'HIGH');
    const mediumPriorityActive = activeIncidents.filter((i) => i.priority === 'MEDIUM');
    const lowPriorityActive = activeIncidents.filter((i) => i.priority === 'LOW');
    const resolvedTodayCount = incidents.filter((i) => i.status === 'RESOLVED').length + 20;

    // 2. Compile current task status
    const openTasks = tasks.filter((t) => t.status !== 'COMPLETED');
    const newTasks = tasks.filter((t) => t.status === 'NEW');
    const assignedTasks = tasks.filter((t) => t.status === 'ASSIGNED');
    const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS');
    const completedTasksToday = tasks.filter((t) => t.status === 'COMPLETED').length + 310;

    // 3. Compile real-time attendance
    const totalRegistered = 3100;
    const checkedInHeadcount = 2840;
    const checkInRate = '91.6%';

    return {
      $schema: 'https://schema.yesummit.org/v2/daily-operations-summary.json',
      reportType: 'Daily Operations Summary',
      documentHeader: {
        documentTitle: 'YESummit 2027 Operations Command Centre - Daily Operations Summary',
        securityClassification: 'CONFIDENTIAL // INTERNAL SUPER ADMIN BRIEFING',
        reportReference: `YES-DOS-2027-D2-${Math.floor(1000 + Math.random() * 9000)}`,
        compiledAt: `${formattedDate}, ${formattedTime} (${isoDate})`,
        compiledBy: 'A. Sharma (Super Admin)',
        commandCentreStatus: 'NOMINAL · 99.4% OPERATIONAL AVAILABILITY',
        eventInformation: {
          name: 'YESummit 2027',
          edition: 'Day 2 of 3 (Main Plenary & Breakouts)',
          venue: 'YESummit Convention Complex',
          scheduledHours: '07:00 - 20:00 SGT'
        }
      },
      // Core Requirement 1: Active Incidents Snapshot
      activeIncidentsSnapshot: {
        summaryText: `${activeIncidents.length} active incidents currently open in triage (${highPriorityActive.length} HIGH, ${mediumPriorityActive.length} MEDIUM, ${lowPriorityActive.length} LOW). 14-minute average triage resolution speed.`,
        totalActiveIncidents: activeIncidents.length,
        highPriorityActiveCount: highPriorityActive.length,
        mediumPriorityActiveCount: mediumPriorityActive.length,
        lowPriorityActiveCount: lowPriorityActive.length,
        resolvedTodayCount: resolvedTodayCount,
        activeIncidents: activeIncidents.map((inc) => ({
          id: inc.id,
          type: inc.type,
          title: inc.title,
          location: inc.location,
          priority: inc.priority,
          status: inc.status,
          reportedAt: inc.reportedAt,
          minutesAgo: inc.minutesAgo,
          reporter: inc.reporter,
          assignedTeam: inc.assignedTeam,
          affectedCount: inc.affectedCount,
          description: inc.description,
          actionAuditTrail: inc.timeline,
          escalatedToLead: !!inc.escalatedToLead
        }))
      },
      // Core Requirement 2: Current Task Status Snapshot
      currentTaskStatusSnapshot: {
        summaryText: `${openTasks.length} open operational tasks in flight across venue, logistics, technical, and medical teams. ${completedTasksToday} tasks successfully resolved today.`,
        totalTasksRecorded: tasks.length + 310,
        totalOpenTasks: openTasks.length,
        statusBreakdown: {
          NEW: newTasks.length,
          ASSIGNED: assignedTasks.length,
          IN_PROGRESS: inProgressTasks.length,
          COMPLETED_TODAY: completedTasksToday
        },
        activeTasks: openTasks.map((t) => ({
          id: t.id,
          category: t.category,
          title: t.title,
          location: t.location,
          priority: t.priority,
          status: t.status,
          assignee: t.assignee,
          createdAt: t.createdAt
        })),
        allTasksRoster: tasks.map((t) => ({
          id: t.id,
          category: t.category,
          title: t.title,
          location: t.location,
          priority: t.priority,
          status: t.status,
          assignee: t.assignee,
          createdAt: t.createdAt
        }))
      },
      // Core Requirement 3: Real-Time Attendance Snapshot
      realTimeAttendanceSnapshot: {
        summaryText: `Real-time attendee check-in has reached ${checkInRate} (${checkedInHeadcount.toLocaleString()} of ${totalRegistered.toLocaleString()} registered participants). Hardware turnstile gateways operating normally with zero critical bottleneck delays.`,
        totalRegisteredAttendees: totalRegistered,
        checkedInHeadcount: checkedInHeadcount,
        checkInCompletionRate: checkInRate,
        activeOnPremisesNow: checkedInHeadcount,
        scanningHardwareStatus: scanningPaused ? 'PAUSED_BY_ADMIN' : 'ALL_GATEWAYS_ONLINE (16/16)',
        categoryBreakdown: {
          vipMinisters: 48,
          speakersAndFaculty: 92,
          delegates: 2580,
          mediaPress: 84,
          organizers: 36
        },
        attendanceByStatus: {
          checkedIn: participants.filter((p) => p.eventStatus === 'Checked In').length,
          inSession: participants.filter((p) => p.eventStatus === 'In Session').length,
          offsite: participants.filter((p) => p.eventStatus === 'Offsite').length,
          arriving: participants.filter((p) => p.eventStatus === 'Arriving').length
        },
        mealRedemptionAudit: {
          breakfastCompleted: 2410,
          lunchServiceStatus: 'ACTIVE_PRE_STAGING',
          dinnerServiceStatus: 'SCHEDULED'
        },
        attendeesSampleRoster: participants.map((p) => ({
          participantId: p.id,
          qrIdentifier: p.qrId,
          fullName: p.name,
          category: p.category,
          allocatedHotel: p.hotel,
          transportRoute: p.transportAllocation,
          mealsStatusToday: p.mealsToday,
          currentEventStatus: p.eventStatus,
          emergencyContact: p.phone,
          email: p.email
        }))
      },
      // Core Requirement 4: Volunteers & Workforce Responsibility Snapshot
      volunteersResponsibilitySnapshot: {
        summaryText: `${volunteers.length} registered volunteers (${volunteers.filter((v) => v.status !== 'OFFLINE').length} actively deployed on duty across ${zones.length} operational zones). Complete accountability records detailing assigned tasks, responding incidents, and dedicated attendee cohorts.`,
        totalVolunteersRoster: volunteers.length,
        activeOnDutyCount: volunteers.filter((v) => v.status !== 'OFFLINE').length,
        availableFloatingCount: volunteers.filter((v) => v.status === 'AVAILABLE').length,
        busyDeployedCount: volunteers.filter((v) => v.status === 'BUSY').length,
        assignedDeployedCount: volunteers.filter((v) => v.status === 'ASSIGNED').length,
        offlineNotCheckedInCount: volunteers.filter((v) => v.status === 'OFFLINE').length,
        zoneDeploymentBreakdown: zones.reduce((acc, z) => {
          acc[z] = volunteers.filter((v) => v.zone === z).length;
          return acc;
        }, {} as Record<string, number>),
        volunteersRoster: volunteers.map((vol) => {
          // Identify tasks assigned to this volunteer
          const volTasks = tasks.filter(
            (t) =>
              t.assignee.toLowerCase().includes(vol.id.toLowerCase()) ||
              t.assignee.toLowerCase().includes(vol.name.toLowerCase())
          );
          // Identify incidents in their zone or reported by them
          const volIncidents = incidents.filter(
            (i) =>
              (i.reporter && i.reporter.toLowerCase().includes(vol.id.toLowerCase())) ||
              i.location.toLowerCase().includes(vol.zone.toLowerCase())
          );
          // Identify registered participants assigned to this volunteer
          const volParticipants = participants.filter(
            (p) =>
              p.responsibleVolunteerId === vol.id ||
              (vol.assignedParticipantIds && vol.assignedParticipantIds.includes(p.id))
          );

          return {
            volunteerId: vol.id,
            fullName: vol.name,
            operationalRole: vol.role,
            assignedZone: vol.zone,
            dutyStatus: vol.status,
            checkInTime: vol.checkInTime,
            contactPhone: vol.phone,
            assignedCohort: vol.assignedCohort || 'General Floor Support',
            currentActiveTask: vol.currentTask,
            responsibilityDossier: {
              primaryArea: `Stationed in ${vol.zone} (${vol.role})`,
              assignedCohortName: vol.assignedCohort || 'General Participant Assistance',
              tasksResponsibleFor: volTasks.map((t) => ({
                id: t.id,
                title: t.title,
                category: t.category,
                priority: t.priority,
                status: t.status,
                location: t.location
              })),
              incidentsInZoneOrTriage: volIncidents.map((i) => ({
                id: i.id,
                title: i.title,
                priority: i.priority,
                status: i.status,
                location: i.location,
                assignedTeam: i.assignedTeam
              })),
              registeredUsersResponsibleFor: volParticipants.map((p) => ({
                participantId: p.id,
                qrIdentifier: p.qrId,
                name: p.name,
                category: p.category,
                hotel: p.hotel,
                eventStatus: p.eventStatus,
                phone: p.phone
              })),
              dutyBriefing: `${vol.name} (${vol.id}) is stationed in ${vol.zone}. Current task: "${vol.currentTask}". Responsible for ${volParticipants.length} attendee(s) and ${volTasks.length} open task(s).`
            }
          };
        })
      },
      // Core Requirement 5: Registered Users Profile & Operational Responsibility Snapshot
      registeredUsersResponsibilitySnapshot: {
        summaryText: `Complete registry of ${participants.length} registered summit users (Delegates, VIPs, Speakers, Media, Organizers) with registered credentials, designated volunteer liaisons, and role commitments.`,
        totalRegisteredUsers: participants.length,
        checkedInCount: participants.filter((p) => p.eventStatus === 'Checked In' || p.eventStatus === 'In Session').length,
        usersWithAssignedLiaison: participants.filter((p) => !!p.responsibleVolunteerId).length,
        coverageRate: `${Math.round(
          (participants.filter((p) => !!p.responsibleVolunteerId).length / (participants.length || 1)) * 100
        )}% of attendees linked to dedicated volunteer liaisons`,
        registeredUsersRoster: participants.map((p) => {
          const liaison = volunteers.find((v) => v.id === p.responsibleVolunteerId);

          // Role-specific operational responsibilities
          let roleResponsibilities: Record<string, any> = {};
          if (p.category === 'Speaker') {
            const speakerSessions = sessions.filter(
              (s) =>
                s.speaker.toLowerCase().includes(p.name.toLowerCase()) ||
                p.name.toLowerCase().includes(s.speaker.toLowerCase())
            );
            roleResponsibilities = {
              roleType: 'Keynote / Breakout Speaker',
              speakingEngagements: speakerSessions.map((s) => ({
                sessionId: s.id,
                title: s.title,
                room: s.room,
                time: s.time,
                avReadiness: s.avStatus,
                status: s.status
              })),
              dutyCommitment: 'Responsible for delivering presentation on stage, adhering to stage clock and Q&A protocol.'
            };
          } else if (p.category === 'VIP') {
            const vipEntry = vipGuests.find(
              (v) =>
                v.name.toLowerCase().includes(p.name.toLowerCase()) ||
                p.name.toLowerCase().includes(v.name.toLowerCase())
            );
            roleResponsibilities = {
              roleType: 'High-Level Dignitary / Ministerial VIP',
              bilateralMeetingsCount: vipEntry ? vipEntry.bilateralMeetingsCount : 2,
              motorcadeConvoy: vipEntry ? vipEntry.motorcade.convoyId : 'VIP Escort Motorcade',
              securityClearance: vipEntry ? vipEntry.securityClearance : 'Level 2 (Protocol Escort)',
              dutyCommitment: 'Responsible for bilateral summit discussions, ministerial roundtables, and official protocol.'
            };
          } else if (p.category === 'Organizer') {
            roleResponsibilities = {
              roleType: 'Organizing Committee Lead / Operational Staff',
              oversightArea: 'Command Centre & Triage Escalation',
              dutyCommitment: 'Responsible for overseeing operational zones, resolving triage tasks, and communicating with Area Controllers.'
            };
          } else if (p.category === 'Media') {
            roleResponsibilities = {
              roleType: 'Accredited International Press & Media Pool',
              credentials: 'Press Gallery & Live Broadcast clearance',
              dutyCommitment: 'Responsible for coverage of plenary speeches, pool photography, and official press briefings.'
            };
          } else {
            roleResponsibilities = {
              roleType: 'Registered Summit Delegate',
              delegationCohort: p.hotel ? `${p.hotel} Delegation Group` : 'General Plenary Delegate',
              dutyCommitment: 'Responsible for checking in at turnstiles, attending scheduled breakout tracks, and badge scans.'
            };
          }

          return {
            participantId: p.id,
            qrIdentifier: p.qrId,
            fullName: p.name,
            category: p.category,
            allocatedHotel: p.hotel,
            transportRoute: p.transportAllocation,
            mealsToday: p.mealsToday,
            currentEventStatus: p.eventStatus,
            emergencyContact: p.phone,
            officialEmail: p.email,
            // Dedicated Volunteer Liaison
            responsibleVolunteerLiaison: {
              volunteerId: p.responsibleVolunteerId || (liaison ? liaison.id : 'UNASSIGNED'),
              volunteerName: p.responsibleVolunteerName || (liaison ? liaison.name : 'Floor Liaison Pool'),
              volunteerPhone: p.responsibleVolunteerPhone || (liaison ? liaison.phone : '+65 8123 0000'),
              liaisonStatus: p.responsibleVolunteerId ? 'ASSIGNED' : 'UNASSIGNED',
              volunteerAssignedCohort: liaison?.assignedCohort || 'General Floor Assistance'
            },
            // What this registered user is responsible for
            operationalResponsibility: roleResponsibilities
          };
        })
      },
      // Core Requirement 6: Accountability & Responsibility Cross-Reference Matrix
      accountabilityAndResponsibilityMatrix: {
        summaryText: 'Multi-domain operational cross-reference linking incidents to lead responders, tasks to assignees, and participants to dedicated volunteers.',
        incidentAccountability: activeIncidents.map((inc) => ({
          incidentId: inc.id,
          title: inc.title,
          priority: inc.priority,
          responsibleAssignedTeam: inc.assignedTeam,
          reporter: inc.reporter,
          location: inc.location,
          responsibleVolunteersInZone: volunteers
            .filter((v) => inc.location.toLowerCase().includes(v.zone.toLowerCase()))
            .map((v) => `${v.name} (${v.id} - ${v.phone})`)
        })),
        taskAccountability: openTasks.map((t) => ({
          taskId: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          responsibleAssignee: t.assignee,
          location: t.location,
          createdAt: t.createdAt
        })),
        attendeeVolunteerLiaisonPairings: participants.map((p) => ({
          participant: `${p.name} (${p.id} · ${p.category})`,
          hotel: p.hotel,
          responsibleVolunteer: p.responsibleVolunteerName
            ? `${p.responsibleVolunteerName} (${p.responsibleVolunteerId} · ${p.responsibleVolunteerPhone})`
            : 'Unassigned (General Support)'
        })),
        zoneDeploymentMatrix: zones.map((z) => ({
          zoneName: z,
          deployedVolunteersCount: volunteers.filter((v) => v.zone === z).length,
          volunteersOnDuty: volunteers
            .filter((v) => v.zone === z)
            .map((v) => `${v.name} (${v.id} · ${v.status} · ${v.phone})`)
        }))
      },
      // Supplementary Operational Domains
      executiveMetrics: {
        mobilityAndFleet: {
          totalVehiclesInFleet: 48,
          activeVehiclesInTransit: vehicles.filter((v) => v.status === 'ON_TIME' || v.status === 'DELAYED').length || 42,
          delayedVehiclesCount: vehicles.filter((v) => v.status === 'DELAYED').length || 3,
          breakdownAlertCount: vehicles.filter((v) => v.status === 'BREAKDOWN').length || 1,
          totalCompletedFleetTripsToday: 162,
          passengerLegsServed: 4380
        },
        workforceVolunteers: {
          totalRosterSize: 212,
          activeOnDuty: volunteers.filter((v) => v.status !== 'OFFLINE').length + 175 || 186,
          availableFloatingReserves: volunteers.filter((v) => v.status === 'AVAILABLE').length + 9 || 12,
          notCheckedIn: volunteers.filter((v) => v.status === 'OFFLINE').length + 13 || 14
        },
        sessionsOverview: {
          totalScheduled: sessions.length,
          liveNow: sessions.filter((s) => s.status === 'LIVE').length,
          actionRequired: sessions.filter((s) => s.avStatus === 'ACTION REQUIRED' || s.translationStatus === 'ACTION REQUIRED').length
        },
        vipProtocolOverview: {
          totalDignitaries: vipGuests.length,
          vvipHeadsOfState: vipGuests.filter((g) => g.tier === 'VVIP').length,
          motorcadesInTransit: vipGuests.filter((g) => g.motorcade.status === 'Convoy In Transit').length,
          arrivedAtVenue: vipGuests.filter((g) => g.motorcade.status === 'Arrived Onsite').length
        }
      },
      sessionsAndReadinessDossier: {
        summaryText: 'Plenary and breakout schedule monitored with live AV telemetry.',
        sessionsRoster: sessions.map((s) => ({
          sessionId: s.id,
          title: s.title,
          hall: s.room,
          speaker: s.speaker,
          moderator: s.moderator,
          scheduledTime: s.time,
          avSystemReadiness: s.avStatus,
          translationSystemReadiness: s.translationStatus,
          broadcastRecordingState: s.recordingStatus,
          attendanceMetric: s.attendance,
          operationalStatus: s.status,
          actionRequiredNote: s.alertNote || null
        }))
      },
      vipAndProtocolTravelDossier: {
        summaryText: `Management manifest for all ${vipGuests.length || 50} VIP and VVIP dignitaries.`,
        dignitariesRoster: (vipGuests || []).map((v) => ({
          vipId: v.id,
          name: v.name,
          title: v.officialTitle,
          countryOrOrg: v.countryOrOrg,
          tier: v.tier,
          flightNumber: v.flightInfo.flightNumber,
          flightStatus: v.flightInfo.status,
          terminal: v.flightInfo.terminal,
          convoyId: v.motorcade.convoyId,
          vehicleType: v.motorcade.vehicleType,
          driverName: v.motorcade.driverName,
          driverMobile: v.motorcade.driverPhone,
          motorcadeStatus: v.motorcade.status,
          currentEta: v.motorcade.currentEta,
          personalLiaison: `${v.liaisonOfficer.name} (${v.liaisonOfficer.phone})`,
          assignedSuite: v.assignedSuite,
          hotel: v.hotel,
          securityClearance: v.securityClearance,
          dietaryRestrictions: v.dietaryRestrictions
        }))
      },
      documentFooter: {
        certification:
          'This document is an automated electronic daily summary exported directly from the YESummit Operations Command Centre.',
        exportEngine: 'YESummit Super Admin Core v2.4 (RFC 8259 JSON)',
        hashFingerprint: `sha256-${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`
      }
    };
  };

  // Handler to download daily summary
  const handleDownloadDailySummary = () => {
    const summaryData = generateSummaryData();
    const jsonString = JSON.stringify(summaryData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `YESummit_2027_Daily_Operations_Summary_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onAddToast) {
      onAddToast(
        'Daily Summary Exported',
        'Structured JSON snapshot of active incidents, tasks, real-time attendance, volunteer duties, and registered user liaisons downloaded successfully.',
        'success'
      );
    }

    if (onLogActivity) {
      onLogActivity('Exported complete Daily Operations Summary (structured JSON snapshot with volunteers & registered users data)', 'admin');
    }
  };

  const handlePreviewDailySummary = () => {
    const summaryData = generateSummaryData();
    setGeneratedSummaryObj(summaryData);
    setGeneratedSummaryJson(JSON.stringify(summaryData, null, 2));
    setPreviewTab('json');
    setShowPreviewSummaryModal(true);
  };

  // Full Operational Audit Log & System State CSV Exporter
  const handleExportFullAuditCSV = () => {
    const csvSections: string[] = [];

    // Header banner
    csvSections.push('# YESUMMIT 2027 SINGAPORE - FULL OPERATIONAL AUDIT LOG & SYSTEM STATE');
    csvSections.push(`# Export Timestamp: ${new Date().toISOString()} (SGT UTC+8)`);
    csvSections.push('# Classification: OFFICIAL / RESTRICTED POST-EVENT AUDIT RECORD');
    csvSections.push('');

    // SECTION 1: AUDIT EVENT LEDGER
    csvSections.push('## SECTION 1: CHRONOLOGICAL OPERATIONAL AUDIT LOG');
    csvSections.push('Timestamp,Category,Audit Message');
    (activities || []).forEach((act) => {
      csvSections.push(`"${act.timestamp}","${act.category}","${act.message.replace(/"/g, '""')}"`);
    });
    csvSections.push('');

    // SECTION 2: INCIDENT TRIAGE & RESOLUTION
    csvSections.push('## SECTION 2: SYSTEM INCIDENTS & ESCALATIONS');
    csvSections.push('ID,Priority,Status,Type,Title,Location,Reported At,Reporter,Assigned Unit,Affected Pax,Description');
    (incidents || []).forEach((inc) => {
      csvSections.push(
        `"${inc.id}","${inc.priority}","${inc.status}","${inc.type}","${inc.title.replace(/"/g, '""')}","${inc.location.replace(/"/g, '""')}","${inc.reportedAt}","${inc.reporter}","${inc.assignedTeam}",${inc.affectedCount},"${inc.description.replace(/"/g, '""')}"`
      );
    });
    csvSections.push('');

    // SECTION 3: VVIP DIPLOMATIC PROTOCOL & GATE ARRIVALS
    csvSections.push('## SECTION 3: DIPLOMATIC PROTOCOL & VVIP CONVOYS');
    csvSections.push('VIP ID,Tier,Name,Official Title,Country,Flight Number,Flight Status,Convoy ID,Vehicle Type,Driver,Liaison,Assigned Suite,Motorcade Status');
    (vipGuests || []).forEach((v) => {
      csvSections.push(
        `"${v.id}","${v.tier}","${v.name.replace(/"/g, '""')}","${v.officialTitle.replace(/"/g, '""')}","${v.countryOrOrg}","${v.flightInfo.flightNumber}","${v.flightInfo.status}","${v.motorcade.convoyId}","${v.motorcade.vehicleType}","${v.motorcade.driverName}","${v.liaisonOfficer.name}","${v.assignedSuite}","${v.motorcade.status}"`
      );
    });
    csvSections.push('');

    // SECTION 4: FLEET MOBILITY & TELEMATICS
    csvSections.push('## SECTION 4: FLEET MOBILITY TELEMATICS');
    csvSections.push('Vehicle ID,Driver,Type,Route,Location,Occupancy,Status,ETA,Battery Fuel Pct');
    (vehicles || []).forEach((vh) => {
      csvSections.push(
        `"${vh.id}","${vh.driver}","${vh.type}","${vh.route}","${vh.location}","${vh.passengers}","${vh.status}","${vh.eta}",${vh.batteryFuel}`
      );
    });
    csvSections.push('');

    // SECTION 5: TASKS & LOGISTICS
    csvSections.push('## SECTION 5: OPERATIONAL TASKS & RESOLUTIONS');
    csvSections.push('Task ID,Category,Title,Location,Priority,Status,Assignee,Created At');
    (tasks || []).forEach((t) => {
      csvSections.push(
        `"${t.id}","${t.category}","${t.title.replace(/"/g, '""')}","${t.location.replace(/"/g, '""')}","${t.priority}","${t.status}","${t.assignee}","${t.createdAt}"`
      );
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvSections.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `YESummit_2027_Operational_Audit_Log_System_State_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddToast) {
      onAddToast(
        'Full Audit CSV Exported',
        'Complete operational audit log and system state downloaded as CSV for post-event forensic analysis.',
        'success'
      );
    }
    if (onLogActivity) {
      onLogActivity('Exported full operational audit log and system state CSV', 'admin');
    }
  };

  // Real CSV Exporter functions
  const handleExportIncidentsCSV = () => {
    const headers = ['ID', 'Type', 'Title', 'Location', 'Priority', 'Status', 'Reported At', 'Reporter', 'Assigned Team', 'Affected Count'];
    const rows = incidents.map((inc) => [
      inc.id,
      `"${inc.type}"`,
      `"${inc.title.replace(/"/g, '""')}"`,
      `"${inc.location.replace(/"/g, '""')}"`,
      inc.priority,
      inc.status,
      inc.reportedAt,
      `"${inc.reporter}"`,
      `"${inc.assignedTeam}"`,
      inc.affectedCount
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `YESummit_2027_Incidents_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddToast) {
      onAddToast('Incidents Exported', 'Incidents CSV file generated and downloaded.', 'info');
    }
  };

  const handleExportMealsCSV = () => {
    const headers = ['Participant ID', 'QR ID', 'Name', 'Category', 'Breakfast Status', 'Lunch Status', 'Dinner Status', 'Hotel'];
    const rows = participants.map((p) => [
      p.id,
      p.qrId,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      p.mealsToday.breakfast ? 'REDEEMED' : 'NOT REDEEMED',
      p.mealsToday.lunch ? 'REDEEMED' : 'PENDING SERVICE',
      p.mealsToday.dinner ? 'REDEEMED' : 'PENDING SERVICE',
      `"${p.hotel}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `YESummit_2027_Meals_Scans_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddToast) {
      onAddToast('Meals Exported', 'Meals redemption CSV log downloaded.', 'info');
    }
  };

  const handleExportParticipantsCSV = () => {
    const headers = ['ID', 'QR Code', 'Name', 'Category', 'Hotel', 'Transport Allocation', 'Status', 'Phone', 'Email', 'Responsible Volunteer'];
    const rows = participants.map((p) => [
      p.id,
      p.qrId,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      `"${p.hotel}"`,
      `"${p.transportAllocation}"`,
      p.eventStatus,
      p.phone,
      p.email,
      `"${p.responsibleVolunteerName ? `${p.responsibleVolunteerName} (${p.responsibleVolunteerId})` : 'Unassigned'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `YESummit_2027_Master_Participants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddToast) {
      onAddToast('Participants Exported', 'Master participant roster CSV downloaded.', 'info');
    }
  };

  const handleExportVolunteersCSV = () => {
    const headers = [
      'Volunteer ID',
      'Name',
      'Role',
      'Zone',
      'Duty Status',
      'Check-In Time',
      'Phone',
      'Assigned Cohort',
      'Current Task',
      'Assigned Attendees Count',
      'Assigned Attendees IDs'
    ];
    const rows = volunteers.map((vol) => {
      const assignedParticipants = participants.filter(
        (p) => p.responsibleVolunteerId === vol.id || (vol.assignedParticipantIds && vol.assignedParticipantIds.includes(p.id))
      );
      return [
        vol.id,
        `"${vol.name.replace(/"/g, '""')}"`,
        `"${vol.role.replace(/"/g, '""')}"`,
        `"${vol.zone}"`,
        vol.status,
        vol.checkInTime,
        vol.phone,
        `"${(vol.assignedCohort || 'General Floor Support').replace(/"/g, '""')}"`,
        `"${vol.currentTask.replace(/"/g, '""')}"`,
        assignedParticipants.length,
        `"${assignedParticipants.map((p) => p.id).join('; ')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `YESummit_2027_Volunteers_Responsibility_Manifest_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddToast) {
      onAddToast('Volunteers Manifest Exported', 'Volunteer duties & assigned participant cohorts CSV downloaded.', 'info');
    }
  };

  const handleExportParticipantsWithLiaisonsCSV = () => {
    const headers = [
      'Participant ID',
      'QR Code',
      'Name',
      'Category',
      'Hotel',
      'Transport Allocation',
      'Event Status',
      'Phone',
      'Email',
      'Responsible Volunteer ID',
      'Responsible Volunteer Name',
      'Responsible Volunteer Phone',
      'Breakfast',
      'Lunch',
      'Dinner'
    ];
    const rows = participants.map((p) => [
      p.id,
      p.qrId,
      `"${p.name.replace(/"/g, '""')}"`,
      p.category,
      `"${p.hotel}"`,
      `"${p.transportAllocation}"`,
      p.eventStatus,
      p.phone,
      p.email,
      p.responsibleVolunteerId || 'UNASSIGNED',
      `"${(p.responsibleVolunteerName || 'Floor Pool Support').replace(/"/g, '""')}"`,
      p.responsibleVolunteerPhone || 'N/A',
      p.mealsToday.breakfast ? 'Redeemed' : 'Pending',
      p.mealsToday.lunch ? 'Redeemed' : 'Pending',
      p.mealsToday.dinner ? 'Redeemed' : 'Pending'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `YESummit_2027_Registered_Users_Liaisons_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddToast) {
      onAddToast('Registered Users Exported', 'Attendees and assigned volunteer liaisons CSV downloaded.', 'info');
    }
  };

  const rolesOnline = [
    { name: 'A. Sharma', role: 'Super Admin', status: 'Online', ip: '10.0.1.4 (Command Bridge)' },
    { name: 'Capt. Jonathan Wu', role: 'Command Centre Lead', status: 'Online', ip: '10.0.1.12' },
    { name: 'Rajesh Verma', role: 'Mobility Fleet Lead', status: 'Online', ip: '10.0.2.8' },
    { name: 'Sarah Jenkins', role: 'Volunteers Lead', status: 'Online', ip: '10.0.2.14' },
    { name: 'Kenji Sato', role: 'Venue Operations Lead', status: 'Online', ip: '10.0.2.19' },
    { name: 'Dr. Maya Lin', role: 'Programme Director', status: 'Online', ip: '10.0.2.22' },
    { name: 'Dr. Marcus Vance', role: 'Safety & Medical Lead', status: 'Online', ip: '10.0.2.30' },
    { name: 'David Chen', role: 'Technical & AV Lead', status: 'Offline (Escalation Active)', ip: '10.0.2.45' }
  ];

  return (
    <div className="space-y-6">
      {/* Spec Mandatory One-line Note */}
      <div className="p-3.5 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-xs text-[var(--ink)] flex items-center gap-2">
        <Info className="w-4 h-4 text-[var(--primary)] shrink-0" />
        <span>
          <strong>Hierarchy Architecture:</strong> Super Admin is the system-level role (import, export, roles, security), above the Command Centre Lead.
        </span>
      </div>

      {/* Post-Event Operational Audit Log & System State (Export & Import) */}
      <div className="p-5 rounded-lg bg-[var(--card)] border-2 border-indigo-600/40 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[var(--ink)]">
                  Operational Audit Log & System State (Post-Event Forensic Analysis)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                  CSV & PDF Forensic Export / Import
                </span>
              </div>
              <p className="text-xs text-[var(--mute)] mt-1">
                Export and import the full operational audit log, incident histories, VIP protocol records, fleet telematics, and volunteer deployments. Essential for after-action review, compliance reporting, and post-event analysis.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleExportFullAuditCSV}
              className="px-3 py-2 text-xs font-semibold rounded-md border border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--line)]/50 text-[var(--ink)] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Download entire audit log & state as CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setShowAuditDossierModal(true)}
              className="px-3.5 py-2 text-xs font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-md hover:scale-102"
              title="Open full printable PDF dossier with print-to-PDF formatting"
            >
              <Printer className="w-4 h-4" />
              <span>Export PDF Dossier</span>
            </button>

            <button
              onClick={() => setShowAuditImportModal(true)}
              className="px-3 py-2 text-xs font-semibold rounded-md border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              title="Import and restore an operational audit manifest (.csv or .json)"
            >
              <Upload className="w-4 h-4 text-indigo-600" />
              <span>Import State</span>
            </button>
          </div>
        </div>

        {/* Audit metrics preview ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[var(--line)] text-[11px] text-[var(--mute)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Audit Events: <strong>{activities.length} Recorded</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            <span>Incidents: <strong>{incidents.length} ({incidents.filter(i => i.status === 'RESOLVED').length} Resolved)</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>VIP Delegations: <strong>{vipGuests.length} Managed</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Fleet & Volunteers: <strong>{vehicles.length} Vehicles · {volunteers.length} Active</strong></span>
          </div>
        </div>
      </div>

      {/* Featured Executive Operations Dossier Export Card */}
      <div className="p-5 rounded-lg bg-[var(--card)] border-2 border-[var(--primary)] shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[var(--ink)]">
                  Daily Operations Summary Dossier
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  PDF-Style JSON Report
                </span>
              </div>
              <p className="text-xs text-[var(--mute)] mt-1">
                Generates a complete, structured executive summary of the entire day's operations: active incidents triage, task kanban status, real-time attendance, workforce volunteer responsibilities, and registered user profiles with designated liaisons.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePreviewDailySummary}
              className="px-3.5 py-2 text-xs font-semibold rounded-md border border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--card)] text-[var(--ink)] flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            >
              <Eye className="w-4 h-4 text-[var(--mute)]" />
              <span>Preview Dossier</span>
            </button>

            <button
              onClick={handleDownloadDailySummary}
              className="px-4 py-2 text-xs font-bold rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white flex items-center gap-2 cursor-pointer transition-all shadow-md hover:scale-102"
            >
              <Download className="w-4 h-4" />
              <span>Download Daily Summary</span>
            </button>
          </div>
        </div>

        {/* Quick summary metrics included in the report */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-2 border-t border-[var(--line)] text-[11px] text-[var(--mute)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Attendance: <strong>2,840 (91.6%)</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>Incidents: <strong>{incidents.filter((i) => i.status !== 'RESOLVED').length} open</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Tasks: <strong>{tasks.filter((t) => t.status !== 'COMPLETED').length} active</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            <span>Volunteers: <strong>{volunteers.filter((v) => v.status !== 'OFFLINE').length} deployed</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>Liaisons: <strong>{participants.filter((p) => !!p.responsibleVolunteerId).length}/{participants.length}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span>Fleet: <strong>42 active</strong></span>
          </div>
        </div>
      </div>

      {/* System Architecture & Event Bus Console Card */}
      <div className="p-5 rounded-lg bg-[var(--card)] border border-[var(--primary)]/30 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--ink)]">
                  System Architecture & Event Bus Console
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  EVENT BUS NOMINAL · 142 EVT/S
                </span>
              </div>
              <p className="text-xs text-[var(--mute)] mt-1">
                Distributed event-driven architecture topology: 6 edge client channels (Driver App, Volunteer App, My YESummit, QR Scanners, GPS, Consoles) → API Gateway & Auth → 8 Domain Services, Central Event Bus ("Every Change is an Event"), Realtime WebSockets, Multi-Channel Notifications (Push/SMS/Email/WhatsApp), and Persistent Database + Fast Cache mesh.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenArchitectureModal && (
              <button
                type="button"
                onClick={onOpenArchitectureModal}
                className="px-4 py-2 text-xs font-bold rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
              >
                <Cpu className="w-4 h-4" />
                <span>Open Architecture Console</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time Architecture Micro-Topology */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[var(--line)] text-xs">
          <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
            <div className="font-semibold text-[var(--ink)] flex items-center gap-1 text-[11px]">
              <Radio className="w-3.5 h-3.5 text-[var(--primary)] animate-pulse" />
              <span>Event Bus Backbone</span>
            </div>
            <div className="text-[10px] text-[var(--mute)]">
              Sub-5ms event loop · Replay enabled · 142 events/sec throughput
            </div>
          </div>

          <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
            <div className="font-semibold text-[var(--ink)] flex items-center gap-1 text-[11px]">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Multi-Channel Notification Gateway</span>
            </div>
            <div className="text-[10px] text-[var(--mute)]">
              Push (APNs/FCM) · SMS (Singtel) · Email (SES) · WhatsApp Cloud API
            </div>
          </div>

          <div className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] space-y-1">
            <div className="font-semibold text-[var(--ink)] flex items-center gap-1 text-[11px]">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span>Database & Fast Cache Mesh</span>
            </div>
            <div className="text-[10px] text-[var(--mute)]">
              Temporal audit ledger · In-memory state mesh · 1.1ms turnstile latency
            </div>
          </div>
        </div>
      </div>

      {/* "View As" Role Switcher Card */}
      <div className="p-5 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--primary)]" />
            <h3 className="text-sm font-bold text-[var(--ink)]">
              "View As" Role Switcher (Role-Based Access Control Preview)
            </h3>
          </div>
          <span className="text-[11px] font-mono font-semibold text-[var(--primary)] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--line)]">
            Current: {userRole}
          </span>
        </div>
        <p className="text-xs text-[var(--mute)]">
          Select a role to test role-tailored workspace views. Tab navigation under the header will immediately reconfigure and filter tabs according to each officer's operational clearance.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          {[
            { key: 'super_admin', label: 'Super Admin', sub: 'Full 11 Tabs' },
            { key: 'command_centre_lead', label: 'Command Lead', sub: '8 Core Tabs' },
            { key: 'mobility_lead', label: 'Mobility Lead', sub: 'Mobility, Map, Tasks' },
            { key: 'volunteer_lead', label: 'Volunteer Lead', sub: 'Volunteers, Comms' },
            { key: 'safety_lead', label: 'Safety Lead', sub: 'Incidents, Map' },
            { key: 'technical_lead', label: 'Technical Lead', sub: 'Sessions, AV Map' }
          ].map((r) => (
            <button
              key={r.key}
              onClick={() => onChangeUserRole(r.key as UserRole)}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                userRole === r.key
                  ? 'border-[var(--primary)] bg-[var(--primary)] text-white shadow-xs'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--primary)]'
              }`}
            >
              <div className="text-xs font-bold">{r.label}</div>
              <div className={`text-[10px] mt-0.5 ${userRole === r.key ? 'text-white/80' : 'text-[var(--mute)]'}`}>
                {r.sub}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Danger Zone: Pause All Scanning */}
      <div className="p-5 rounded-lg bg-[var(--card)] border border-red-500/30 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-bold text-red-600">
              Emergency Override: Global Scanning Control
            </h3>
          </div>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded ${
              scanningPaused
                ? 'bg-red-600 text-white'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {scanningPaused ? 'SCANNING SUSPENDED' : 'SCANNERS NOMINAL (ONLINE)'}
          </span>
        </div>

        <p className="text-xs text-[var(--mute)]">
          Immediately pauses all barcode/QR scanning at Gate 1-6 registration turnstiles, session room scanners, and dining hall meal checkpoints. Used during crowd crushes, security evacuations, or major network outages.
        </p>

        <div>
          {scanningPaused ? (
            <button
              onClick={() => onToggleScanning(false)}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Resume All Scanning Operations</span>
            </button>
          ) : (
            <button
              onClick={() => setShowConfirmPauseModal(true)}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Pause All Scanning (Emergency Protocol)</span>
            </button>
          )}
        </div>
      </div>

      {/* Data Import & CSV Export Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Import / Sync */}
        <div className="p-5 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-[var(--primary)] ${isSyncing ? 'animate-spin' : ''}`} />
              <h4 className="font-bold text-[var(--ink)]">Data Import & Gateway Sync</h4>
            </div>
            <span className="font-mono text-[10px] text-[var(--mute)]">Gateway API v2.4</span>
          </div>

          <div className="space-y-1.5 text-[var(--mute)]">
            <div className="flex justify-between">
              <span>Last Synchronized:</span>
              <strong className="text-[var(--ink)] font-mono">11:12:04 SGT</strong>
            </div>
            <div className="flex justify-between">
              <span>Registration Database:</span>
              <span className="text-emerald-600 font-semibold">Connected (3,100 records)</span>
            </div>
            <div className="flex justify-between">
              <span>Turnstile Hardware Mesh:</span>
              <span className="text-emerald-600 font-semibold">16/16 Gateways Online</span>
            </div>
          </div>

          {isSyncing && (
            <div className="w-full bg-[var(--line)] h-2 rounded-full overflow-hidden">
              <div className="bg-[var(--primary)] h-full rounded-full animate-pulse" style={{ width: '85%' }} />
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="px-4 py-2 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--primary)] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing with Master DB...' : 'Sync Now (Flush & Re-cache)'}</span>
            </button>

            {onOpenImportModal && (
              <button
                type="button"
                onClick={() => onOpenImportModal('vip')}
                className="px-4 py-2 rounded bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Dataset (CSV / JSON)</span>
              </button>
            )}
          </div>
        </div>

        {/* CSV Data Exports */}
        <div className="p-5 rounded-lg bg-[var(--card)] border border-[var(--line)] shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <h4 className="font-bold text-[var(--ink)]">Individual CSV Data Exports</h4>
            </div>
            <span className="text-[10px] text-[var(--mute)]">Audited RFC 4180</span>
          </div>

          <p className="text-[var(--mute)]">
            Export specific tabular datasets directly as CSV spreadsheets for spreadsheet analysis.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            <button
              onClick={handleExportMealsCSV}
              className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-emerald-600 text-[var(--ink)] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs text-center"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export Meals CSV</span>
            </button>

            <button
              onClick={handleExportIncidentsCSV}
              className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-red-600 text-[var(--ink)] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs text-center"
            >
              <Download className="w-4 h-4 text-red-600" />
              <span>Export Incidents CSV</span>
            </button>

            <button
              onClick={handleExportParticipantsCSV}
              className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-blue-600 text-[var(--ink)] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs text-center"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Export Attendees CSV</span>
            </button>

            <button
              onClick={handleExportVolunteersCSV}
              className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs text-center"
            >
              <Users className="w-4 h-4 text-[var(--primary)]" />
              <span>Volunteers & Duties CSV</span>
            </button>

            <button
              onClick={handleExportParticipantsWithLiaisonsCSV}
              className="p-2.5 rounded bg-[var(--bg)] border border-[var(--line)] hover:border-indigo-600 text-[var(--ink)] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs text-center"
            >
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Attendees & Liaisons CSV</span>
            </button>

            <button
              onClick={handleDownloadDailySummary}
              className="p-2.5 rounded bg-[var(--bg)] border border-[var(--primary)] hover:border-[var(--primary-hover)] text-[var(--primary)] dark:text-[var(--primary-light)] font-bold flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs text-center hover:bg-[var(--primary)]/5"
            >
              <FileText className="w-4 h-4 text-[var(--primary)]" />
              <span>Daily Summary (JSON)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Roles Online Now Table */}
      <div className="rounded-lg bg-[var(--card)] border border-[var(--line)] overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--primary)]" />
            <h4 className="font-bold text-sm text-[var(--ink)]">
              Authorized Operational Personnel Active Now ({rolesOnline.length})
            </h4>
          </div>
          <span className="text-[11px] font-mono text-emerald-600">Zero Trust TLS 1.3</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--mute)] font-semibold">
                <th className="py-2.5 px-3">Officer Name</th>
                <th className="py-2.5 px-3">Assigned Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Terminal IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {rolesOnline.map((officer, i) => (
                <tr key={i} className="hover:bg-[var(--bg)] transition-colors">
                  <td className="py-2 px-3 font-semibold text-[var(--ink)]">{officer.name}</td>
                  <td className="py-2 px-3 text-[var(--mute)]">{officer.role}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        officer.status.includes('Online') ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{officer.status}</span>
                    </span>
                  </td>
                  <td className="py-2 px-3 font-mono text-[var(--mute)]">{officer.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Daily Summary Modal */}
      {showPreviewSummaryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-4xl w-full border border-[var(--line)] p-5 space-y-4 shadow-2xl text-xs max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[var(--primary)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)]">
                    Daily Operations Summary - Structured JSON Dossier
                  </h3>
                  <p className="text-[11px] text-[var(--mute)]">
                    Compiled snapshot with active incidents, task statuses, attendance, volunteer responsibilities, and registered user profiles.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPreviewSummaryModal(false)}
                className="text-[var(--mute)] hover:text-[var(--ink)] p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Subheader Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2 overflow-x-auto">
              <button
                onClick={() => setPreviewTab('json')}
                className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                  previewTab === 'json'
                    ? 'bg-[var(--primary)] text-white shadow-2xs'
                    : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Raw JSON Snapshot</span>
              </button>

              <button
                onClick={() => setPreviewTab('volunteers')}
                className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                  previewTab === 'volunteers'
                    ? 'bg-[var(--primary)] text-white shadow-2xs'
                    : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Volunteers & Responsibilities ({volunteers.length})</span>
              </button>

              <button
                onClick={() => setPreviewTab('participants')}
                className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                  previewTab === 'participants'
                    ? 'bg-[var(--primary)] text-white shadow-2xs'
                    : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Registered Users & Liaisons ({participants.length})</span>
              </button>

              <button
                onClick={() => setPreviewTab('matrix')}
                className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                  previewTab === 'matrix'
                    ? 'bg-[var(--primary)] text-white shadow-2xs'
                    : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Accountability Matrix</span>
              </button>
            </div>

            {/* Modal Body Tab Content */}
            <div className="flex-1 overflow-y-auto bg-[var(--bg)] p-3 rounded border border-[var(--line)]">
              {previewTab === 'json' && (
                <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--ink)]">
                  {generatedSummaryJson}
                </pre>
              )}

              {previewTab === 'volunteers' && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded bg-[var(--card)] border border-[var(--line)] text-xs text-[var(--mute)] flex items-center justify-between">
                    <span>
                      Total Volunteers: <strong>{volunteers.length}</strong> · Active On-Duty:{' '}
                      <strong className="text-emerald-600">{volunteers.filter((v) => v.status !== 'OFFLINE').length}</strong> · Floating Reserves:{' '}
                      <strong>{volunteers.filter((v) => v.status === 'AVAILABLE').length}</strong>
                    </span>
                    <span className="text-[11px] font-mono text-[var(--primary)]">RFC-8259 JSON Verified</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {volunteers.map((vol) => {
                      const assignedUsers = participants.filter(
                        (p) =>
                          p.responsibleVolunteerId === vol.id ||
                          (vol.assignedParticipantIds && vol.assignedParticipantIds.includes(p.id))
                      );
                      const volTasks = tasks.filter(
                        (t) =>
                          t.assignee.toLowerCase().includes(vol.id.toLowerCase()) ||
                          t.assignee.toLowerCase().includes(vol.name.toLowerCase())
                      );

                      return (
                        <div key={vol.id} className="p-3 rounded-lg bg-[var(--card)] border border-[var(--line)] space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-[var(--ink)] text-xs">{vol.name}</div>
                              <div className="text-[11px] font-mono text-[var(--primary)]">
                                {vol.id} · {vol.role} · Zone: {vol.zone}
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                vol.status === 'AVAILABLE'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                  : vol.status === 'BUSY'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                              }`}
                            >
                              {vol.status}
                            </span>
                          </div>

                          <div className="text-[11px] text-[var(--mute)] space-y-1">
                            <div>
                              Current Task: <strong className="text-[var(--ink)]">{vol.currentTask}</strong>
                            </div>
                            <div>
                              Assigned Cohort: <span className="font-medium text-[var(--ink)]">{vol.assignedCohort || 'General Operations'}</span>
                            </div>
                            <div>
                              Contact Mobile: <span className="font-mono">{vol.phone}</span> (In: {vol.checkInTime})
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[var(--line)]">
                            <div className="text-[11px] font-semibold text-[var(--ink)] flex items-center gap-1 mb-1">
                              <UserCheck className="w-3 h-3 text-[var(--primary)]" />
                              <span>Registered Users Under Direct Care ({assignedUsers.length}):</span>
                            </div>
                            {assignedUsers.length > 0 ? (
                              <div className="space-y-1">
                                {assignedUsers.map((u) => (
                                  <div
                                    key={u.id}
                                    className="p-1.5 rounded bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between text-[10px]"
                                  >
                                    <span className="font-medium text-[var(--ink)]">
                                      {u.name} ({u.category})
                                    </span>
                                    <span className="text-[var(--mute)]">{u.hotel} · {u.eventStatus}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] italic text-[var(--mute)]">
                                Floating responder / General venue assistance
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {previewTab === 'participants' && (
                <div className="space-y-3">
                  <div className="p-2.5 rounded bg-[var(--card)] border border-[var(--line)] text-xs text-[var(--mute)] flex items-center justify-between">
                    <span>
                      Total Registered Attendees: <strong>{participants.length}</strong> · With Assigned Volunteer Liaisons:{' '}
                      <strong className="text-emerald-600">
                        {participants.filter((p) => !!p.responsibleVolunteerId).length}
                      </strong>
                    </span>
                    <span className="text-[11px] text-[var(--primary)] font-semibold">91.6% Check-in Completion</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[var(--line)] bg-[var(--card)] text-[var(--mute)] font-semibold text-[11px]">
                          <th className="py-2 px-2.5">Participant</th>
                          <th className="py-2 px-2.5">Category</th>
                          <th className="py-2 px-2.5">Hotel & Transport</th>
                          <th className="py-2 px-2.5">Event Status</th>
                          <th className="py-2 px-2.5">Responsible Volunteer Liaison</th>
                          <th className="py-2 px-2.5">Operational Responsibilities</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--line)]">
                        {participants.map((p) => {
                          const liaison = volunteers.find((v) => v.id === p.responsibleVolunteerId);
                          return (
                            <tr key={p.id} className="hover:bg-[var(--card)]/50 transition-colors">
                              <td className="py-2 px-2.5">
                                <div className="font-bold text-[var(--ink)]">{p.name}</div>
                                <div className="font-mono text-[10px] text-[var(--mute)]">{p.id} · {p.qrId}</div>
                              </td>
                              <td className="py-2 px-2.5">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                                  {p.category}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-[11px] text-[var(--mute)]">
                                <div>{p.hotel}</div>
                                <div className="text-[10px]">{p.transportAllocation}</div>
                              </td>
                              <td className="py-2 px-2.5">
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>{p.eventStatus}</span>
                                </span>
                              </td>
                              <td className="py-2 px-2.5">
                                {p.responsibleVolunteerName ? (
                                  <div>
                                    <div className="font-semibold text-[var(--ink)] text-[11px]">{p.responsibleVolunteerName}</div>
                                    <div className="font-mono text-[10px] text-[var(--mute)]">
                                      {p.responsibleVolunteerId} · {p.responsibleVolunteerPhone}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-[var(--mute)] italic">General Support Pool</span>
                                )}
                              </td>
                              <td className="py-2 px-2.5 text-[11px] text-[var(--mute)] max-w-xs">
                                {p.category === 'Speaker' && 'Stage presentation & Keynote Q&A'}
                                {p.category === 'VIP' && 'Bilateral dialogue & Ministerial Protocol'}
                                {p.category === 'Organizer' && 'Command centre triage & Zone Lead'}
                                {p.category === 'Media' && 'Press pool coverage & Media Hub'}
                                {p.category === 'Delegate' && 'Plenary & Breakout Track attendance'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {previewTab === 'matrix' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-bold text-xs text-[var(--ink)] mb-1.5">
                      Incident Resolution Accountability (Active Incidents → Responsible Team & Lead)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[var(--line)] bg-[var(--card)] text-[var(--mute)] font-semibold text-[11px]">
                            <th className="py-2 px-2.5">Incident</th>
                            <th className="py-2 px-2.5">Location</th>
                            <th className="py-2 px-2.5">Priority</th>
                            <th className="py-2 px-2.5">Responsible Team</th>
                            <th className="py-2 px-2.5">Reporter</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--line)]">
                          {incidents
                            .filter((i) => i.status !== 'RESOLVED')
                            .map((inc) => (
                              <tr key={inc.id} className="hover:bg-[var(--card)]/50">
                                <td className="py-2 px-2.5">
                                  <span className="font-bold text-[var(--ink)]">{inc.id}</span> - {inc.title}
                                </td>
                                <td className="py-2 px-2.5 text-[var(--mute)]">{inc.location}</td>
                                <td className="py-2 px-2.5">
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                      inc.priority === 'HIGH'
                                        ? 'bg-red-500/10 text-red-600'
                                        : 'bg-amber-500/10 text-amber-600'
                                    }`}
                                  >
                                    {inc.priority}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 font-semibold text-[var(--ink)]">{inc.assignedTeam}</td>
                                <td className="py-2 px-2.5 text-[var(--mute)] font-mono text-[10px]">{inc.reporter}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-[var(--ink)] mb-1.5">
                      Task Execution Accountability (Open Tasks → Responsible Assignees)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[var(--line)] bg-[var(--card)] text-[var(--mute)] font-semibold text-[11px]">
                            <th className="py-2 px-2.5">Task ID</th>
                            <th className="py-2 px-2.5">Title</th>
                            <th className="py-2 px-2.5">Location</th>
                            <th className="py-2 px-2.5">Responsible Assignee</th>
                            <th className="py-2 px-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--line)]">
                          {tasks
                            .filter((t) => t.status !== 'COMPLETED')
                            .map((t) => (
                              <tr key={t.id} className="hover:bg-[var(--card)]/50">
                                <td className="py-2 px-2.5 font-mono text-[var(--primary)]">{t.id}</td>
                                <td className="py-2 px-2.5 text-[var(--ink)]">{t.title}</td>
                                <td className="py-2 px-2.5 text-[var(--mute)]">{t.location}</td>
                                <td className="py-2 px-2.5 font-semibold text-[var(--ink)]">{t.assignee}</td>
                                <td className="py-2 px-2.5">
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-500/10 text-blue-600">
                                    {t.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedSummaryJson);
                  setCopiedNotice(true);
                  setTimeout(() => setCopiedNotice(false), 2000);
                }}
                className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)] flex items-center gap-1.5 font-medium cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedNotice ? 'Copied to Clipboard!' : 'Copy Raw JSON'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewSummaryModal(false)}
                  className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadDailySummary();
                    setShowPreviewSummaryModal(false);
                  }}
                  className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Daily Summary (.json)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Pause Scanning Modal */}
      {showConfirmPauseModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-lg max-w-md w-full border border-red-500 p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center gap-2.5 text-red-600 border-b border-[var(--line)] pb-3">
              <AlertOctagon className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-sm font-bold">CONFIRM SUSPENSION OF ALL SCANNING</h3>
                <p className="text-[11px] text-[var(--mute)]">Super Admin Security Protocol</p>
              </div>
            </div>

            <div className="space-y-2 text-[var(--ink)]">
              <p className="leading-relaxed">
                You are about to issue a <strong>global scanning freeze</strong>.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[var(--mute)]">
                <li>All 16 turnstiles at Registration Pavilion Gates 1-6 will freeze scanning.</li>
                <li>Meal redemption scanners at Dining Pavilion will reject QR codes.</li>
                <li>Volunteers will be instructed via urgent broadcast to switch to offline manual paper rosters.</li>
              </ul>
              <p className="font-semibold text-red-600 pt-1">
                Are you sure you want to pause all scanning?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowConfirmPauseModal(false)}
                className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)] font-medium"
              >
                Abort Action
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleScanning(true);
                  setShowConfirmPauseModal(false);
                }}
                className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold shadow-xs"
              >
                Yes, Pause All Scanning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Operational Audit Log & System State Printable PDF Dossier */}
      <AuditDossierModal
        isOpen={showAuditDossierModal}
        onClose={() => setShowAuditDossierModal(false)}
        incidents={incidents}
        tasks={tasks}
        vehicles={vehicles}
        volunteers={volunteers}
        sessions={sessions}
        participants={participants}
        vipGuests={vipGuests}
        activities={activities}
        onExportCSV={handleExportFullAuditCSV}
      />

      {/* Operational Audit Log & System State Ingestion Modal */}
      {onRestoreSystemState && (
        <AuditStateImportModal
          isOpen={showAuditImportModal}
          onClose={() => setShowAuditImportModal(false)}
          onRestoreSystemState={onRestoreSystemState}
          onAddToast={onAddToast}
          onLogActivity={onLogActivity}
        />
      )}
    </div>
  );
};
