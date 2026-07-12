import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Header from '../components/Header';
import { Search, Eye, Filter, RefreshCw } from 'lucide-react';

export const AssetDirectory: React.FC = () => {
  const { token, user } = useAuth();
  const { showToast } = useSocket();
  const [assets, setAssets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');

  // Detail Modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState<any>(null);

  // Status edit state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAssetId, setStatusAssetId] = useState('');
  const [targetStatus, setTargetStatus] = useState('AVAILABLE');

  const fetchFilters = async () => {
    if (!token) return;
    try {
      // 1. Categories
      const resCats = await fetch('http://localhost:5001/api/org/categories', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resCats.ok) setCategories(await resCats.json());

      // 2. Departments
      const resDepts = await fetch('http://localhost:5001/api/org/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resDepts.ok) setDepartments(await resDepts.json());

      // 3. Locations
      const resLocs = await fetch('http://localhost:5001/api/org/locations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resLocs.ok) setLocations(await resLocs.json());
    } catch (err) {
      console.error('Error fetching categories/departments/locations', err);
    }
  };

  const fetchAssets = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedCategory !== 'All') params.append('category', selectedCategory);
      if (selectedStatus !== 'All') params.append('status', selectedStatus);
      if (selectedLocation !== 'All') params.append('location', selectedLocation);

      const res = await fetch(`http://localhost:5001/api/assets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAssets(await res.json());
      }
    } catch (err) {
      console.error('Error fetching assets list', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, [token]);

  useEffect(() => {
    fetchAssets();
  }, [token, searchQuery, selectedCategory, selectedStatus, selectedLocation]);

  const handleOpenDetail = async (assetId: string) => {
    try {
      const res = await fetch(`http://localhost:5001/api/assets/${assetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSelectedAssetDetail(await res.json());
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error('Error fetching asset details', err);
    }
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:5001/api/assets/${statusAssetId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Status change failed');
      }

      showToast('Asset status successfully updated');
      setShowStatusModal(false);
      fetchAssets();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="main-content">
      <Header title="Assets Directory" />
      <div className="page-body">
        
        {/* Search & Filter Options Strip */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '2fr repeat(3, 1fr)', 
          gap: 16, 
          backgroundColor: 'var(--bg-secondary)', 
          border: '1px solid var(--border-color)', 
          padding: 16, 
          borderRadius: 'var(--radius-md)',
          marginBottom: 24,
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search tag, serial, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select className="form-control" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <select className="form-control" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="ALLOCATED">ALLOCATED</option>
            <option value="RESERVED">RESERVED</option>
            <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
            <option value="LOST">LOST</option>
            <option value="RETIRED">RETIRED</option>
            <option value="DISPOSED">DISPOSED</option>
          </select>

          <select className="form-control" value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
            <option value="All">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Directory Grid/Table */}
        {loading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>Loading asset directory...</div>
        ) : (
          <div className="table-card">
            <div className="table-wrapper">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Asset Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Holder / Department</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{asset.asset_tag}</td>
                      <td style={{ fontWeight: 600 }}>{asset.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{asset.category_name}</td>
                      <td>
                        <span className={`badge ${
                          asset.status === 'AVAILABLE' ? 'badge-success' :
                          asset.status === 'ALLOCATED' ? 'badge-info' :
                          asset.status === 'UNDER_MAINTENANCE' ? 'badge-warning' :
                          'badge-danger'
                        }`}>
                          {asset.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{asset.location}</td>
                      <td>
                        {asset.status === 'ALLOCATED' ? (
                          asset.holder_name ? (
                            <span>👤 {asset.holder_name} (User)</span>
                          ) : (
                            <span>🏢 {asset.department_name} (Dept)</span>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>--</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleOpenDetail(asset.id)}>
                          <Eye size={12} /> View Details
                        </button>
                        {['ADMIN', 'ASSET_MANAGER'].includes(user!.role) && (
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setStatusAssetId(asset.id); setTargetStatus(asset.status); setShowStatusModal(true); }}>
                            <RefreshCw size={12} /> State
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {assets.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No assets found matching the search/filter parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* DETAIL MODAL */}
      {showDetailModal && selectedAssetDetail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Asset Lifecycle Card: {selectedAssetDetail.asset_tag}</span>
              <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Asset Info Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ASSET NAME</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedAssetDetail.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12 }}>ACQUISITION COST</div>
                  <div style={{ fontWeight: 600 }}>${parseFloat(selectedAssetDetail.acquisition_cost).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>SERIAL NUMBER</div>
                  <div style={{ fontWeight: 600 }}>{selectedAssetDetail.serial_number || 'N/A'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12 }}>ACQUISITION DATE</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{new Date(selectedAssetDetail.acquisition_date).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Status and Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>CONDITION</div>
                  <div style={{ fontWeight: 600 }}>{selectedAssetDetail.condition}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12 }}>LOCATION</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{selectedAssetDetail.location}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>CURRENT LIFECYCLE STATUS</div>
                  <div>
                    <span className={`badge ${
                      selectedAssetDetail.status === 'AVAILABLE' ? 'badge-success' :
                      selectedAssetDetail.status === 'ALLOCATED' ? 'badge-info' :
                      selectedAssetDetail.status === 'UNDER_MAINTENANCE' ? 'badge-warning' :
                      'badge-danger'
                    }`} style={{ marginTop: 4 }}>
                      {selectedAssetDetail.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 12 }}>SHARED/BOOKABLE RESOURCE</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{selectedAssetDetail.is_shared_bookable ? 'YES' : 'NO'}</div>
                </div>
              </div>

              {/* Custom Category Attributes */}
              {Object.keys(selectedAssetDetail.category_fields).length > 0 && (
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>CATEGORY ATTRIBUTES ({selectedAssetDetail.category_name})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {Object.entries(selectedAssetDetail.category_fields).map(([key, val]) => (
                      <div key={key}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}:</span>
                        <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 8 }}>{val as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allocations & Returns History */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--accent-primary)' }}>Allocation History Log</div>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  {selectedAssetDetail.history?.allocations?.map((h: any) => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                      <div>
                        <strong>{h.user_name || h.department_name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Allocated: {new Date(h.allocated_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge ${h.status === 'ACTIVE' ? 'badge-info' : 'badge-success'}`}>{h.status}</span>
                        {h.returned_at && (
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                            Returned: {new Date(h.returned_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!selectedAssetDetail.history?.allocations || selectedAssetDetail.history.allocations.length === 0) && (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>No allocation logs found.</div>
                  )}
                </div>
              </div>

              {/* Maintenance History */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--warning)' }}>Maintenance Log History</div>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6 }}>
                  {selectedAssetDetail.history?.maintenance?.map((h: any) => (
                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-color)', fontSize: 13 }}>
                      <div>
                        <strong>{h.description}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Priority: {h.priority} | Cost: ${h.cost || '0'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="badge badge-info">{h.status.replace(/_/g, ' ')}</span>
                        {h.resolved_at && (
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                            Resolved: {new Date(h.resolved_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!selectedAssetDetail.history?.maintenance || selectedAssetDetail.history.maintenance.length === 0) && (
                    <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>No maintenance logs found.</div>
                  )}
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowDetailModal(false)}>Close Card</button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS MANUAL CHANGE MODAL */}
      {showStatusModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: 18 }}>Change Asset Lifecycle State</span>
              <button onClick={() => setShowStatusModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleUpdateStatusSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Asset Lifecycle Status</label>
                  <select
                    className="form-control"
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    required
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="RESERVED">RESERVED</option>
                    <option value="LOST">LOST</option>
                    <option value="RETIRED">RETIRED</option>
                    <option value="DISPOSED">DISPOSED</option>
                  </select>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Note: setting status to ALLOCATED or UNDER_MAINTENANCE manually is blocked. Please use the allocation screen or maintenance workflow to transition to those states.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStatusModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Change State</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
export default AssetDirectory;
