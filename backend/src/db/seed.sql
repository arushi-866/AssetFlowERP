-- AssetFlow Realistic Seed Data
-- Deterministic UUIDs used for relationships consistency

-- Clean table entries
TRUNCATE roles, departments, users, asset_categories, assets, asset_allocations, transfer_requests, resource_bookings, maintenance_requests, audit_cycles, audit_auditors, audit_records, notifications, activity_logs CASCADE;

-- 1. Insert Roles
INSERT INTO roles (id, name, description) VALUES
('00000000-0000-0000-0000-000000000001', 'ADMIN', 'System Administrator with full access to organization setups, directories, and configuration.'),
('00000000-0000-0000-0000-000000000002', 'ASSET_MANAGER', 'Asset Manager responsible for asset registration, allocations, transfer approvals, maintenance approvals, and audit cycle completion.'),
('00000000-0000-0000-0000-000000000003', 'DEPARTMENT_HEAD', 'Department Head who manages department specific assets, approves internal transfer requests, and books resources on behalf of their department.'),
('00000000-0000-0000-0000-000000000004', 'EMPLOYEE', 'Standard organization employee who views allocated assets, books shared resources, and raises maintenance requests.');

-- 2. Insert Departments
INSERT INTO departments (id, name, parent_department_id, status) VALUES
('11111111-1111-1111-1111-111111111111', 'Engineering', NULL, 'ACTIVE');

-- 3. Insert Users (Seeded passwords are 'password123')
INSERT INTO users (id, name, email, password_hash, role_id, department_id, status) VALUES
('22222222-2222-2222-2222-222222222221', 'Aditi Rao', 'admin@company.com', '$2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ACTIVE'),
('22222222-2222-2222-2222-222222222222', 'Rohan Mehta', 'manager@company.com', '$2a$10$zRcuC6L/8lM5B1hR9cRDuO5P5QW6Lq2C.N3s8J2O/eQ2e577o0W82', '00000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'ACTIVE');

-- Link head_id for departments
UPDATE departments SET head_id = '22222222-2222-2222-2222-222222222221' WHERE id = '11111111-1111-1111-1111-111111111111'; -- Engineering Head: Aditi

-- 4. Insert Asset Categories
INSERT INTO asset_categories (id, name, custom_fields) VALUES
('33333333-3333-3333-3333-333333333331', 'Electronics', '{"warranty_period_months": "number", "processor": "string", "ram_gb": "number"}'::jsonb);

-- 5. Insert Assets
INSERT INTO assets (id, name, category_id, asset_tag, serial_number, acquisition_date, acquisition_cost, condition, location, is_shared_bookable, status, department_id, current_holder_id, category_fields) VALUES
-- Allocated Dell Laptop
('44444444-4444-4444-4444-444444444411', 'Dell Latitude 5420', '33333333-3333-3333-3333-333333333331', 'AF-0012', 'SN-DELL-9921A', '2025-01-10', 1200.00, 'Good', 'Bengaluru Office', FALSE, 'ALLOCATED', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '{"warranty_period_months": 36, "processor": "Intel i5", "ram_gb": 16}'::jsonb),
-- Shared Conference Room
('44444444-4444-4444-4444-444444444415', 'Conference Room B2', '33333333-3333-3333-3333-333333333331', 'AF-0999', 'SN-ROOM-B2', '2023-08-01', 15000.00, 'Good', 'HQ Floor 1', TRUE, 'AVAILABLE', NULL, NULL, '{"warranty_period_months": 24, "processor": "N/A", "ram_gb": 0}'::jsonb);

-- 6. Insert Asset Allocations (History)
INSERT INTO asset_allocations (id, asset_id, user_id, department_id, allocated_by, allocated_at, expected_return_at, returned_at, check_in_notes, status) VALUES
-- Active allocation: Dell Laptop allocated to Employee Rohan
('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444411', '22222222-2222-2222-2222-222222222222', NULL, '22222222-2222-2222-2222-222222222221', '2026-03-12 10:00:00+05:30', NULL, NULL, NULL, 'ACTIVE');

-- 7. Insert Transfer Requests
INSERT INTO transfer_requests (id, asset_id, from_user_id, from_department_id, to_user_id, to_department_id, requested_by, status, approved_by, approval_notes) VALUES
-- Pending transfer request: Admin wants Dell Laptop currently held by Employee Rohan
('66666666-6666-6666-6666-666666666601', '44444444-4444-4444-4444-444444444411', '22222222-2222-2222-2222-222222222222', NULL, '22222222-2222-2222-2222-222222222221', NULL, '22222222-2222-2222-2222-222222222221', 'PENDING', NULL, NULL);

-- 8. Insert Resource Bookings
INSERT INTO resource_bookings (id, asset_id, booked_by, booked_for_department_id, start_time, end_time, status) VALUES
-- Ongoing booking for Conference Room B2
('77777777-7777-7777-7777-777777777701', '44444444-4444-4444-4444-444444444415', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '2026-07-12 09:00:00+05:30', '2026-07-12 10:00:00+05:30', 'ONGOING');

-- 9. Insert Maintenance Requests
INSERT INTO maintenance_requests (id, asset_id, raised_by, description, priority, status, technician_id) VALUES
-- Pending laptop maintenance
('88888888-8888-8888-8888-888888888802', '44444444-4444-4444-4444-444444444411', '22222222-2222-2222-2222-222222222222', 'Laptop keyboard keys (E, R, T) not responding.', 'LOW', 'PENDING', NULL);

-- 10. Insert Audit Cycles
INSERT INTO audit_cycles (id, name, scope_department_id, scope_location, start_date, end_date, status) VALUES
-- Active Audit Cycle
('99999999-9999-9999-9999-999999999901', 'Q3 Audit: Engineering Dept', '11111111-1111-1111-1111-111111111111', 'Bengaluru Office', '2026-07-01', '2026-07-15', 'ACTIVE');

-- 11. Assign Auditors (Many-to-Many)
INSERT INTO audit_auditors (audit_cycle_id, auditor_id) VALUES
('99999999-9999-9999-9999-999999999901', '22222222-2222-2222-2222-222222222221'); -- Admin

-- 12. Insert Audit Records (Flagged discrepancies)
INSERT INTO audit_records (id, audit_cycle_id, asset_id, auditor_id, status, notes) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999901', '44444444-4444-4444-4444-444444444411', '22222222-2222-2222-2222-222222222221', 'VERIFIED', 'Asset located and verified in employee possession.');

-- 13. Insert Notifications
INSERT INTO notifications (id, user_id, title, message, type, is_read, reference_entity_type, reference_entity_id) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddd01', '22222222-2222-2222-2222-222222222222', 'Asset Laptop Assigned', 'Dell Latitude 5420 (AF-0012) has been allocated to you.', 'ASSET_ASSIGNED', FALSE, 'assets', '44444444-4444-4444-4444-444444444411');

-- 14. Seed Activity Logs
INSERT INTO activity_logs (user_id, action, target_table, target_id, previous_values, new_values) VALUES
('22222222-2222-2222-2222-222222222221', 'ALLOCATE_ASSET', 'asset_allocations', '55555555-5555-5555-5555-555555555502', NULL, '{"asset_tag": "AF-0012", "user": "Employee", "status": "ACTIVE"}'::jsonb);
