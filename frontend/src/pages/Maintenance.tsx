import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import { Plus, User, ArrowRight, ShieldCheck } from 'lucide-react';

export const Maintenance: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast, kpiTrigger } = useSocket();

  // Load Data
  const [requests, setRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modals
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  // Form Fields
  const [raiseForm, setRaiseForm] = useState({ assetId: '', description: '', priority: 'MEDIUM', photoUrl: '' });
  const [assignForm, setAssignForm] = useState({ requestId: '', technicianId: '' });
  const [resolveForm, setResolveForm] = useState({ requestId: '', cost: 0, resolutionNotes: '' });

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      // 1. Fetch maintenance requests
      const resReqs = await fetch('http://localhost:5001/api/maintenance', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resReqs.ok) setRequests(await resReqs.json());

      // 2. Fetch employees (for technician list)
      const resEmps = await fetch('http://localhost:5001/api/org/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmps.ok) setEmployees(await resEmps.json());

      // 3. Fetch assets
      const resAssets = await fetch('http://localhost:5001/api/assets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resAssets.ok) setAllAssets(await resAssets.json());

    } catch (err) {
      console.error('Error loading maintenance datasets', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, kpiTrigger]);

  const handleRaiseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raiseForm.assetId) {
      return alert('Please select an asset to raise maintenance for.');
    }
    if (raiseForm.description.trim().length < 5) {
      return alert('Please provide more details in the issue description.');
    }
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(raiseForm.priority)) {
      return alert('Please select a valid priority.');
    }

    try {
      const res = await fetch('http://localhost:5001/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...raiseForm, photoUrl: '' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Operation failed');
      }

      showToast('Maintenance request successfully raised');
      setShowRaiseModal(false);
      setRaiseForm({ assetId: '', description: '', priority: 'MEDIUM', photoUrl: '' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusTransition = async (requestId: string, status: string, additionalPayload: any = {}) => {
    try {
      const res = await fetch(`http://localhost:5001/api/maintenance/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          ...additionalPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Transition failed');
      }

      showToast(`Request transitioned to ${status}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleStatusTransition(assignForm.requestId, 'TECHNICIAN_ASSIGNED', {
      technicianId: assignForm.technicianId,
    });
    setShowAssignModal(false);
    setAssignForm({ requestId: '', technicianId: '' });
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleStatusTransition(resolveForm.requestId, 'RESOLVED', {
      cost: resolveForm.cost,
      resolutionNotes: resolveForm.resolutionNotes,
    });
    setShowResolveModal(false);
    setResolveForm({ requestId: '', cost: 0, resolutionNotes: '' });
  };

  // Group requests by columns for Kanban
  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const approvedRequests = requests.filter(r => r.status === 'APPROVED');
  const assignedRequests = requests.filter(r => r.status === 'TECHNICIAN_ASSIGNED');
  const inProgressRequests = requests.filter(r => r.status === 'IN_PROGRESS');
  const resolvedRequests = requests.filter(r => r.status === 'RESOLVED');

  const renderPriorityBadge = (prio: string) => {
    switch (prio) {
      case 'CRITICAL': return <span className="badge badge-danger" style={{ fontSize: 9 }}>Critical</span>;
      case 'HIGH': return <span className="badge badge-warning" style={{ fontSize: 9 }}>High</span>;
      default: return <span className="badge badge-info" style={{ fontSize: 9 }}>{prio}</span>;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading maintenance pipelines...
      </div>
    );
  }

  const isManager = ['ADMIN', 'ASSET_MANAGER'].includes(user!.role);

  return (
    <div className="main-content">
      <Header title="Maintenance Pipelines" />
      <div className="page-body">
        
        {/* Strip */}
        <div className="action-strip">
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            ERP Maintenance Kanban. Approving cards sets asset to Under Maintenance. Resolving returns it to Available.
          </span>
          <button className="btn btn-primary" onClick={() => setShowRaiseModal(true)}>
            <Plus size={16} /> Raise Ticket
          </button>
        </div>

        {/* KANBAN BOARD */}
        <div className="kanban-board">
          
          {/* COLUMN 1: PENDING */}
          <div className="kanban-column">
            <div className="kanban-column-title">
              <span>Pending Check</span>
              <span className="count">{pendingRequests.length}</span>
            </div>
            
            {pendingRequests.map(r => (
              <div key={r.id} className="kanban-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{r.asset_tag}</span>
                  {renderPriorityBadge(r.priority)}
                </div>
                <div className="kanban-card-title">{r.asset_name}</div>
                <div className="kanban-card-desc">{r.description}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Raised by: {r.raised_by_name}</div>

                {isManager && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 11, flex: 1 }} onClick={() => handleStatusTransition(r.id, 'APPROVED')}>
                      Approve
                    </button>
                    <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 11, flex: 1 }} onClick={() => handleStatusTransition(r.id, 'REJECTED')}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* COLUMN 2: APPROVED */}
          <div className="kanban-column">
            <div className="kanban-column-title">
              <span>Approved</span>
              <span className="count">{approvedRequests.length}</span>
            </div>

            {approvedRequests.map(r => (
              <div key={r.id} className="kanban-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{r.asset_tag}</span>
                  {renderPriorityBadge(r.priority)}
                </div>
                <div className="kanban-card-title">{r.asset_name}</div>
                <div className="kanban-card-desc">{r.description}</div>

                {isManager && (
                  <button 
                    className="btn btn-secondary btn-block" 
                    style={{ padding: 6, fontSize: 11, marginTop: 10 }}
                    onClick={() => { setAssignForm({ requestId: r.id, technicianId: '' }); setShowAssignModal(true); }}
                  >
                    <User size={12} /> Assign Tech
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* COLUMN 3: TECH ASSIGNED */}
          <div className="kanban-column">
            <div className="kanban-column-title">
              <span>Tech Assigned</span>
              <span className="count">{assignedRequests.length}</span>
            </div>

            {assignedRequests.map(r => (
              <div key={r.id} className="kanban-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{r.asset_tag}</span>
                  {renderPriorityBadge(r.priority)}
                </div>
                <div className="kanban-card-title">{r.asset_name}</div>
                <div style={{ fontSize: 12, color: 'var(--info)' }}>Tech: {r.technician_name}</div>
                <div className="kanban-card-desc">{r.description}</div>

                {(isManager || r.technician_id === user!.id) && (
                  <button 
                    className="btn btn-primary btn-block" 
                    style={{ padding: 6, fontSize: 11, marginTop: 10 }}
                    onClick={() => handleStatusTransition(r.id, 'IN_PROGRESS')}
                  >
                    Start Repairs <ArrowRight size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* COLUMN 4: IN PROGRESS */}
          <div className="kanban-column">
            <div className="kanban-column-title">
              <span>In Progress</span>
              <span className="count">{inProgressRequests.length}</span>
            </div>

            {inProgressRequests.map(r => (
              <div key={r.id} className="kanban-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{r.asset_tag}</span>
                  {renderPriorityBadge(r.priority)}
                </div>
                <div className="kanban-card-title">{r.asset_name}</div>
                <div style={{ fontSize: 12, color: 'var(--info)' }}>Tech: {r.technician_name}</div>
                <div className="kanban-card-desc">{r.description}</div>

                {(isManager || r.technician_id === user!.id) && (
                  <button 
                    className="btn btn-success btn-block" 
                    style={{ padding: 6, fontSize: 11, marginTop: 10 }}
                    onClick={() => { setResolveForm({ requestId: r.id, cost: 0, resolutionNotes: '' }); setShowResolveModal(true); }}
                  >
                    Mark Resolved <ShieldCheck size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* COLUMN 5: RESOLVED */}
          <div className="kanban-column">
            <div className="kanban-column-title">
              <span>Resolved</span>
              <span className="count">{resolvedRequests.length}</span>
            </div>

            {resolvedRequests.map(r => (
              <div key={r.id} className="kanban-card" style={{ opacity: 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{r.asset_tag}</span>
                  <span className="badge badge-success" style={{ fontSize: 9 }}>Closed</span>
                </div>
                <div className="kanban-card-title">{r.asset_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Cost: ${parseFloat(r.cost || 0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Notes: {r.resolution_notes}</div>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* RAISE MODAL */}
      {showRaiseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Raise Maintenance Ticket</span>
              <button onClick={() => setShowRaiseModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleRaiseSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Malfunctioning Asset</label>
                  <select 
                    className="form-control" 
                    value={raiseForm.assetId} 
                    onChange={(e) => setRaiseForm({ ...raiseForm, assetId: e.target.value })}
                    required
                  >
                    <option value="">Select Asset...</option>
                    {allAssets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.asset_tag}) - {a.status}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Urgency Priority</label>
                  <select 
                    className="form-control" 
                    value={raiseForm.priority} 
                    onChange={(e) => setRaiseForm({ ...raiseForm, priority: e.target.value })}
                    required
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Issue Details</label>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    placeholder="Describe what is broken..." 
                    value={raiseForm.description}
                    onChange={(e) => setRaiseForm({ ...raiseForm, description: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRaiseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">File Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN TECH MODAL */}
      {showAssignModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Assign Repair Technician</span>
              <button onClick={() => setShowAssignModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Technician / Staff</label>
                  <select 
                    className="form-control" 
                    value={assignForm.technicianId} 
                    onChange={(e) => setAssignForm({ ...assignForm, technicianId: e.target.value })}
                    required
                  >
                    <option value="">Select Staff...</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role_name.replace(/_/g, ' ')})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Assign & Approve</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE MODAL */}
      {showResolveModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Resolve Maintenance Request</span>
              <button onClick={() => setShowResolveModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleResolveSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Repair Cost (USD)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={resolveForm.cost}
                    onChange={(e) => setResolveForm({ ...resolveForm, cost: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Resolution Notes</label>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    placeholder="Provide details of the fix (e.g. replaced power supply unit, tested OK)..." 
                    value={resolveForm.resolutionNotes}
                    onChange={(e) => setResolveForm({ ...resolveForm, resolutionNotes: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowResolveModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Resolve & Close Ticket</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default Maintenance;
