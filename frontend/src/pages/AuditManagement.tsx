import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import { Plus, CheckCircle, HelpCircle, ShieldAlert, Award } from 'lucide-react';

export const AuditManagement: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast, kpiTrigger } = useSocket();

  // Load Data
  const [cycles, setCycles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Active Cycle state for auditor verification checklist
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [selectedCycleDetail, setSelectedCycleDetail] = useState<any>(null);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: '', scopeDepartmentId: '', scopeLocation: '', startDate: '', endDate: '', auditorIds: [] as string[] });
  
  // Auditor check form states
  const [checkAssetId, setCheckAssetId] = useState('');
  const [checkStatus, setCheckStatus] = useState<'VERIFIED' | 'MISSING' | 'DAMAGED'>('VERIFIED');
  const [checkNotes, setCheckNotes] = useState('');

  const loadData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      // 1. Fetch audit cycles
      const resCycles = await fetch('http://localhost:5001/api/audits', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resCycles.ok) setCycles(await resCycles.json());

      // 2. Fetch departments
      const resDepts = await fetch('http://localhost:5001/api/org/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resDepts.ok) setDepartments(await resDepts.json());

      // 3. Fetch employees (auditors list)
      const resEmps = await fetch('http://localhost:5001/api/org/employees', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resEmps.ok) setEmployees(await resEmps.json());

    } catch (err) {
      console.error('Error loading audit data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCycleDetail = async (cycleId: string) => {
    try {
      const res = await fetch(`http://localhost:5001/api/audits/${cycleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSelectedCycleDetail(await res.json());
      }
    } catch (err) {
      console.error('Error loading cycle details', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [token, kpiTrigger]);

  useEffect(() => {
    if (selectedCycleId) fetchCycleDetail(selectedCycleId);
  }, [selectedCycleId]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleForm.name.trim()) {
      return alert('Please enter an audit cycle name.');
    }
    if (!cycleForm.startDate || !cycleForm.endDate) {
      return alert('Please provide both start and end dates.');
    }
    if (cycleForm.auditorIds.length === 0) {
      return alert('Please assign at least one auditor.');
    }

    try {
      const payload = {
        name: cycleForm.name.trim(),
        scopeDepartmentId: cycleForm.scopeDepartmentId || null,
        scopeLocation: cycleForm.scopeLocation?.trim() || null,
        startDate: cycleForm.startDate,
        endDate: cycleForm.endDate,
        auditorIds: cycleForm.auditorIds,
      };

      const res = await fetch('http://localhost:5001/api/audits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Creation failed');
      }

      showToast('Audit Cycle successfully scheduled');
      setShowCreateModal(false);
      setCycleForm({ name: '', scopeDepartmentId: '', scopeLocation: '', startDate: '', endDate: '', auditorIds: [] });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAuditorCheckSubmit = async (assetId: string, status: 'VERIFIED' | 'MISSING' | 'DAMAGED', notes: string = '') => {
    if (!selectedCycleId) return;
    try {
      const res = await fetch('http://localhost:5001/api/audits/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          auditCycleId: selectedCycleId,
          assetId,
          status,
          notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Verification save failed');
      }

      showToast('Auditor verification recorded');
      fetchCycleDetail(selectedCycleId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCloseAuditCycle = async () => {
    if (!selectedCycleId) return;
    if (!window.confirm('WARNING: Closing the cycle will lock all auditor records, permanently set missing assets to LOST, and auto-raise HIGH urgency maintenance tickets for damaged items. Proceed?')) return;
    
    try {
      const res = await fetch(`http://localhost:5001/api/audits/${selectedCycleId}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Closure failed');
      }

      showToast('Audit cycle closed. Relational triggers executed successfully.');
      setSelectedCycleId(null);
      setSelectedCycleDetail(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAuditorCheckboxChange = (empId: string) => {
    const ids = [...cycleForm.auditorIds];
    const index = ids.indexOf(empId);
    if (index > -1) {
      ids.splice(index, 1);
    } else {
      ids.push(empId);
    }
    setCycleForm({ ...cycleForm, auditorIds: ids });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Loading structured audits...
      </div>
    );
  }

  // Calculate discrepancies count for current cycle view
  const discrepanciesCount = selectedCycleDetail?.records?.filter((r: any) => ['MISSING', 'DAMAGED'].includes(r.status)).length || 0;

  return (
    <div className="main-content">
      <Header title="Asset Verification Audits" />
      <div className="page-body">
        
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.8fr', gap: 32, alignItems: 'start' }}>
          
          {/* Audit Cycles List Left */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Audit Schedules</span>
              {['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && (
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setShowCreateModal(true)}>
                  <Plus size={12} /> New Cycle
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {cycles.map((c) => (
                <div 
                  key={c.id} 
                  className={`kpi-card ${c.id === selectedCycleId ? 'info' : c.status === 'COMPLETED' ? 'success' : ''}`}
                  onClick={() => { setSelectedCycleId(c.id); setSelectedCycleDetail(null); }}
                  style={{ cursor: 'pointer', padding: 18, minHeight: 'auto', border: c.id === selectedCycleId ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 14 }}>{c.name}</strong>
                    <span className={`badge ${c.status === 'ACTIVE' ? 'badge-warning' : c.status === 'COMPLETED' ? 'badge-success' : 'badge-danger'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                    Scope: {c.department_name || 'All Departments'} {c.scope_location ? `| ${c.scope_location}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Dates: {new Date(c.start_date).toLocaleDateString()} to {new Date(c.end_date).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {cycles.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 8 }}>
                  No scheduled audit cycles found.
                </div>
              )}
            </div>
          </div>

          {/* Verification Checklist Right */}
          <div>
            {selectedCycleDetail ? (
              <div className="table-card" style={{ padding: 24 }}>
                
                {/* Active Cycle Control Panel */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>{selectedCycleDetail.name}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Auditors: {selectedCycleDetail.auditors.map((a: any) => a.name).join(', ')}
                    </p>
                  </div>
                  {selectedCycleDetail.status === 'ACTIVE' && ['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && (
                    <button className="btn btn-danger" style={{ padding: '8px 16px', fontSize: 12 }} onClick={handleCloseAuditCycle}>
                      Close Audit Cycle & Lock
                    </button>
                  )}
                </div>

                {/* Scope Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24, backgroundColor: 'var(--bg-tertiary)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13 }}>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>DEPARTMENT SCOPE</div>
                    <strong>{selectedCycleDetail.department_name || 'All'}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>LOCATION SCOPE</div>
                    <strong>{selectedCycleDetail.scope_location || 'All'}</strong>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>FLAGGED DISCREPANCIES</div>
                    <strong style={{ color: discrepanciesCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {discrepanciesCount} Anomalies
                    </strong>
                  </div>
                </div>

                {/* Checklist Table */}
                <span style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 12 }}>Checklist Directory</span>
                <div className="table-wrapper" style={{ border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Tag</th>
                        <th>Asset Name</th>
                        <th>Expected Location</th>
                        <th>Current State</th>
                        <th>Auditor Verification Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCycleDetail.records?.map((record: any) => {
                        const isCycleActive = selectedCycleDetail.status === 'ACTIVE';
                        // Check if current user is an assigned auditor (or admin)
                        const isAssignedAuditor = selectedCycleDetail.auditors.some((a: any) => a.id === user!.id) || user!.role === 'ADMIN';

                        return (
                          <tr key={record.id}>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{record.asset_tag}</td>
                            <td style={{ fontWeight: 600 }}>{record.asset_name}</td>
                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{record.expected_location}</td>
                            <td>
                              <span className="badge badge-info">{record.asset_status}</span>
                            </td>
                            <td>
                              {isCycleActive && isAssignedAuditor ? (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button 
                                    className={`btn ${record.status === 'VERIFIED' ? 'btn-primary' : 'btn-secondary'}`} 
                                    style={{ padding: '4px 8px', fontSize: 10 }}
                                    onClick={() => handleAuditorCheckSubmit(record.asset_id, 'VERIFIED')}
                                  >
                                    Verified
                                  </button>
                                  <button 
                                    className={`btn ${record.status === 'MISSING' ? 'btn-danger' : 'btn-secondary'}`} 
                                    style={{ padding: '4px 8px', fontSize: 10 }}
                                    onClick={() => handleAuditorCheckSubmit(record.asset_id, 'MISSING')}
                                  >
                                    Missing
                                  </button>
                                  <button 
                                    className={`btn ${record.status === 'DAMAGED' ? 'btn-danger' : 'btn-secondary'}`} 
                                    style={{ padding: '4px 8px', fontSize: 10 }}
                                    onClick={() => handleAuditorCheckSubmit(record.asset_id, 'DAMAGED')}
                                  >
                                    Damaged
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <span className={`badge ${
                                    record.status === 'VERIFIED' ? 'badge-success' : 'badge-danger'
                                  }`}>{record.status || 'UNCHECKED'}</span>
                                  {record.notes && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Note: {record.notes}</div>}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedCycleDetail.records || selectedCycleDetail.records.length === 0) && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                            No assets fall within this cycle's scope parameters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            ) : (
              <div style={{ 
                height: 300, 
                border: '1px dashed var(--border-color)', 
                borderRadius: 'var(--radius-lg)', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--text-muted)',
                gap: 10
              }}>
                <HelpCircle size={48} />
                <span>Select an Audit Schedule to inspect or complete checklist verifications.</span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Schedule Structured Audit Cycle</span>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Audit Cycle Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Q3 Audit: Engineering Bay"
                    value={cycleForm.name}
                    onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
                    required
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Department Scope (Optional)</label>
                    <select
                      className="form-control"
                      value={cycleForm.scopeDepartmentId}
                      onChange={(e) => setCycleForm({ ...cycleForm, scopeDepartmentId: e.target.value })}
                    >
                      <option value="">All Departments</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location Scope (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Bengaluru Office"
                      value={cycleForm.scopeLocation}
                      onChange={(e) => setCycleForm({ ...cycleForm, scopeLocation: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={cycleForm.startDate}
                      onChange={(e) => setCycleForm({ ...cycleForm, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={cycleForm.endDate}
                      onChange={(e) => setCycleForm({ ...cycleForm, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign Auditor Staff (Select multiple)</label>
                  <div style={{
                    maxHeight: 120,
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    {employees.filter(emp => ['ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD'].includes(emp.role_name)).map(emp => (
                      <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={cycleForm.auditorIds.includes(emp.id)}
                          onChange={() => handleAuditorCheckboxChange(emp.id)}
                          style={{ width: 16, height: 16 }}
                        />
                        <span>{emp.name} ({emp.role_name.replace(/_/g, ' ')})</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule Cycle</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default AuditManagement;
