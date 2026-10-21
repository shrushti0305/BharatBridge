import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  ArrowRight,
  ArrowLeft,
  User,
  MapPin,
  Clock,
  Filter,
  CheckCircle2,
  X
} from 'lucide-react';
import { Task, Priority } from '../types';

interface TasksTabProps {
  tasks: Task[];
  onAdvanceTask: (id: string) => void;
  onRegressTask: (id: string) => void;
  onCreateTask: (newTask: Omit<Task, 'id' | 'createdAt'>) => void;
  onUpdateAssignee: (id: string, assignee: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  onAdvanceTask,
  onRegressTask,
  onCreateTask,
  onUpdateAssignee
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Task['category']>('Logistics');
  const [location, setLocation] = useState('Main Hall');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [assignee, setAssignee] = useState('Unassigned');

  const categories: Task['category'][] = ['Venue', 'AV', 'Catering', 'Logistics', 'Security', 'Medical', 'Volunteer'];

  const filteredTasks = tasks.filter((t) => {
    if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
    return true;
  });

  const columns: { status: Task['status']; label: string; count: number; color: string }[] = [
    { status: 'NEW', label: 'New', count: filteredTasks.filter((t) => t.status === 'NEW').length, color: 'border-t-blue-500' },
    { status: 'ASSIGNED', label: 'Assigned', count: filteredTasks.filter((t) => t.status === 'ASSIGNED').length, color: 'border-t-purple-500' },
    { status: 'IN_PROGRESS', label: 'In Progress', count: filteredTasks.filter((t) => t.status === 'IN_PROGRESS').length, color: 'border-t-amber-500' },
    { status: 'COMPLETED', label: 'Completed', count: filteredTasks.filter((t) => t.status === 'COMPLETED').length, color: 'border-t-emerald-500' }
  ];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreateTask({
      title: title.trim(),
      category,
      location,
      priority,
      status: assignee !== 'Unassigned' ? 'ASSIGNED' : 'NEW',
      assignee
    });

    setTitle('');
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-lg border border-[var(--line)] shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
          <span className="text-xs font-semibold text-[var(--mute)] shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Category:
          </span>
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
              filterCategory === 'ALL'
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                filterCategory === cat
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg)] text-[var(--mute)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors whitespace-nowrap cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Task</span>
        </button>
      </div>

      {/* Kanban Board Grid: 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.status);
          return (
            <div
              key={col.status}
              className={`rounded-lg bg-[var(--card)] border border-[var(--line)] border-t-4 ${col.color} p-3.5 flex flex-col min-h-[500px] shadow-xs`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                  {col.label}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg)] font-mono font-bold text-[var(--mute)] border border-[var(--line)]">
                  {colTasks.length}
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[var(--mute)] border border-dashed border-[var(--line)] rounded-md">
                    No tasks in {col.label}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-md bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] transition-all shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-[var(--primary)]">
                            {task.id}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--line)] text-[var(--mute)]">
                            {task.category}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            task.priority === 'HIGH'
                              ? 'bg-red-500/10 text-red-600'
                              : task.priority === 'MEDIUM'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-slate-500/10 text-slate-600'
                          }`}
                        >
                          {task.priority === 'HIGH' ? '▲ High' : task.priority === 'MEDIUM' ? '■ Med' : '● Low'}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-[var(--ink)] leading-snug">
                        {task.title}
                      </h4>

                      <div className="space-y-1 text-[11px] text-[var(--mute)] border-t border-[var(--line)]/60 pt-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{task.location}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 shrink-0" />
                            <span className="font-medium text-[var(--ink)] truncate max-w-[120px]">
                              {task.assignee}
                            </span>
                          </span>
                          <span className="font-mono tabular-nums text-[10px]">
                            {task.createdAt}
                          </span>
                        </div>
                      </div>

                      {/* Advance / Regress Buttons */}
                      <div className="flex items-center justify-between pt-1 gap-2">
                        {task.status !== 'NEW' ? (
                          <button
                            onClick={() => onRegressTask(task.id)}
                            className="p-1 rounded text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--card)] border border-transparent hover:border-[var(--line)] text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Move back"
                          >
                            <ArrowLeft className="w-3 h-3" />
                            <span>Back</span>
                          </button>
                        ) : <div />}

                        {task.status !== 'COMPLETED' ? (
                          <button
                            onClick={() => onAdvanceTask(task.id)}
                            className="px-2 py-1 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] text-[11px] font-medium flex items-center gap-1 ml-auto cursor-pointer shadow-2xs"
                          >
                            <span>
                              {task.status === 'NEW'
                                ? 'Assign'
                                : task.status === 'ASSIGNED'
                                ? 'Start'
                                : 'Complete'}
                            </span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 ml-auto">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-[var(--card)] rounded-lg max-w-md w-full border border-[var(--line)] p-5 space-y-4 shadow-xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                <span>Create New Operational Task</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--mute)] hover:text-[var(--ink)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Replenish bottled water in VIP lounge"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Task['category'])}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block text-[var(--ink)] mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                  >
                    <option value="HIGH">High Priority ▲</option>
                    <option value="MEDIUM">Medium Priority ■</option>
                    <option value="LOW">Low Priority ●</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>

              <div>
                <label className="font-semibold block text-[var(--ink)] mb-1">Assignee</label>
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="e.g. VOL-104 (Priya Rao) or Team Beta"
                  className="w-full p-2 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--bg)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] font-semibold shadow-xs"
              >
                Create Task Card
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
